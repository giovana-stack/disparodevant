import { createServerFn } from "@tanstack/react-start";

async function callGemini(prompt: string, temperature = 0.8): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    }),
  });
  if (!r.ok) throw new Error(`Gemini falhou: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export const gerarChamadaPost = createServerFn({ method: "POST" })
  .inputValidator((d: { origem: "instagram" | "linkedin"; texto: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const texto = data.texto?.trim();
    if (!texto) throw new Error("Cole o texto do post");
    const origemNome = data.origem === "instagram" ? "Instagram" : "LinkedIn";

    const prompt = `Você é redator da Devant Soluções Tributárias, uma consultoria tributária que fala com donos de empresa de forma clara e acessível. Leia o post abaixo (do ${origemNome}) e escreva uma chamada curta para o WhatsApp convidando a pessoa a ver o post completo no ${origemNome}.

Regras obrigatórias:
1. Português brasileiro natural e simples, tom de conversa, sem juridiquês.
2. Entre 2 e 4 linhas curtas.
3. Pode usar poucos emojis (no máximo 2), sem exagero.
4. Desperte curiosidade destacando o ponto mais interessante do post, sem entregar tudo.
5. NÃO inclua link nenhum — o link é adicionado depois automaticamente.
6. Varie a forma de abrir, nada de fórmulas repetidas ("Você sabia que...", "Confira...").
7. Termine convidando a ver o post completo no ${origemNome}.

Responda APENAS com o texto da chamada, sem aspas, sem markdown, sem explicação.

Post:
${texto}`;

    const raw = (await callGemini(prompt, 0.9)).trim();
    const chamada = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!chamada) throw new Error("Resposta do Gemini vazia");
    return { chamada };
  });

export const gerarEnquete = createServerFn({ method: "POST" })
  .inputValidator((d: { noticia: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY não configurada");
    const noticia = data.noticia?.trim();
    if (!noticia) throw new Error("Notícia vazia");

    const prompt = `Você recebe uma notícia. Crie UMA pergunta de enquete para um grupo de donos de pequeno negócio no WhatsApp.

Regras obrigatórias:
1. A pergunta deve forçar a pessoa a se posicionar sobre uma ESCOLHA CONCRETA do dia a dia de quem tem um negócio. Nada de opinião abstrata.
2. Foque num ponto específico da notícia que realmente divida opiniões.
3. Frases curtas e diretas. Zero termo técnico ou financeiro rebuscado. Fale como dono de loja, de boteco, de oficina, de salão.
4. Gere de 3 a 4 opções que sejam escolhas reais do dia a dia, faladas do jeito que a pessoa falaria. Exemplo de tom: "vou tirar meu dinheiro antes", "vou continuar do mesmo jeito", "não sei o que fazer", "vou esperar pra ver".
5. NUNCA use opções genéricas como "concordo", "discordo", "indiferente" ou "depende".
6. A graça é dividir opinião de forma fácil. Não pode parecer prova de faculdade.

Responda APENAS com JSON válido, sem markdown, sem comentários, no formato:
{"pergunta":"...","opcoes":["...","..."]}

Notícia:
${noticia}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      }),
    });
    if (!r.ok) throw new Error(`Gemini falhou: ${r.status} ${await r.text()}`);
    const j = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let parsed: { pergunta?: string; opcoes?: string[] } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const pergunta = (parsed.pergunta || "").toString().trim();
    const opcoes = Array.isArray(parsed.opcoes)
      ? parsed.opcoes.map((o) => String(o).trim()).filter(Boolean).slice(0, 4)
      : [];
    if (!pergunta || opcoes.length < 3) throw new Error("Resposta do Gemini inválida");
    return { pergunta, opcoes };
  });
