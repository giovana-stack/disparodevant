import { createServerFn } from "@tanstack/react-start";

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
