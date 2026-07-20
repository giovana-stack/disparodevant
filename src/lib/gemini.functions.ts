import { createServerFn } from "@tanstack/react-start";

export const gerarEnquete = createServerFn({ method: "POST" })
  .inputValidator((d: { noticia: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY não configurada");
    const noticia = data.noticia?.trim();
    if (!noticia) throw new Error("Notícia vazia");

    const prompt = `Você recebe uma notícia. Crie UMA pergunta de enquete para um grupo de donos de empresa no WhatsApp.

Regras obrigatórias:
1. A pergunta deve forçar o empresário a se posicionar sobre uma AÇÃO PRÁTICA ou uma ESCOLHA CONCRETA relacionada à notícia — não sobre opinião abstrata.
2. Foque num ponto ESPECÍFICO e DIVISÍVEL da notícia, não no tema geral.
3. Gere de 3 a 4 opções curtas que representem POSIÇÕES ou ATITUDES REAIS e DIFERENTES que donos de empresa tomariam. Nunca use opções genéricas como "concordo", "discordo" ou "indiferente".
4. Use linguagem simples, direta, de dono de empresa.

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
      ? parsed.opcoes.map((o) => String(o).trim()).filter(Boolean).slice(0, 3)
      : [];
    if (!pergunta || opcoes.length < 2) throw new Error("Resposta do Gemini inválida");
    return { pergunta, opcoes };
  });
