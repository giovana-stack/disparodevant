import { createServerFn } from "@tanstack/react-start";

async function callGemini(prompt: string, temperature = 0.8, responseMimeType?: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada");

  const models = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              ...(responseMimeType ? { responseMimeType } : {}),
            },
          }),
        });

        if (r.status === 503) {
          throw new Error(`503: Service Unavailable for model ${model}`);
        }

        if (!r.ok) {
          const errorText = await r.text();
          throw new Error(`Gemini falhou (${model}): ${r.status} ${errorText}`);
        }

        const buffer = await r.arrayBuffer();
        const text = new TextDecoder("utf-8").decode(buffer);
        const j = JSON.parse(text) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const result = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        if (result) return result;
        throw new Error(`Resposta vazia do modelo ${model}`);
      } catch (err: any) {
        lastError = err;
        // Only retry/fallback if it's a 503 or network error.
        // If it's a 400 (bad prompt) or 401 (bad key), don't bother retrying models.
        if (err.message?.includes("503") || err.message?.includes("fetch")) {
          console.warn(`Tentativa ${attempt} falhou para o modelo ${model}: ${err.message}`);
          continue; // Try next attempt or next model
        } else {
          throw err; // Re-throw fatal errors
        }
      }
    }
  }

  if (lastError?.message?.includes("503")) {
    throw new Error("O gerador de texto está sobrecarregado no momento. Tente novamente em alguns instantes.");
  }

  throw lastError || new Error("Falha ao gerar texto com IA");
}

export const gerarChamadaPost = createServerFn({ method: "POST" })
  .inputValidator((d: { origem: "instagram" | "linkedin"; texto: string; link?: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const texto = data.texto?.trim();
    if (!texto) throw new Error("Cole o texto do post");
    const link = (data.link || "").trim();
    const origemNome = data.origem === "instagram" ? "Instagram" : "LinkedIn";

    const prompt = `Você é redator da Devant Soluções Tributárias, uma consultoria tributária que fala com donos de empresa de forma clara, acessível e de fácil entendimento, utilizando sempre metáforas, analogias e alusões para facilitar a compreensão da notícia. Leia o post abaixo (do ${origemNome}) e escreva uma chamada curta para o WhatsApp convidando a pessoa a ver o post completo no ${origemNome}.

Regras obrigatórias:
1. Português brasileiro natural e simples, tom de conversa, sem linguagem excessivamente formal e sem termos técnicos.
2. Entre 3 e 7 linhas curtas.
3. A primeira linha deve, obrigatoriamente, incluir um emoji relacionado ao assunto
4. Na primeira linha, destaque o ponto mais interessante do post, sem entregar tudo.
5. NÃO inclua link nenhum — o link é adicionado depois automaticamente.
6. Varie a forma de abrir, nada de fórmulas repetidas ("Você sabia que...", "Confira...").
7. Termine convidando a ver o post completo no ${origemNome}.

Responda APENAS com o texto da chamada, sem aspas, sem markdown, sem explicação.

Post:
${texto}`;

    const raw = (await callGemini(prompt, 0.9)).trim();
    let chamada = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!chamada) throw new Error("Resposta do Gemini vazia");
    if (link) chamada = `${chamada}\n\n👉 Leia mais: ${link}`;
    return { chamada };
  });

export const gerarLegendaInstagram = createServerFn({ method: "POST" })
  .inputValidator((d: { titulo: string; mensagem: string; fatos?: string; leu_materia?: boolean }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const titulo = data.titulo?.trim();
    const mensagem = data.mensagem?.trim();
    const fatos = data.fatos?.trim();
    if (!titulo) throw new Error("Título vazio");

    const avisoSemLeitura = data.leu_materia === false
      ? "\n\nATENÇÃO: a matéria original não pôde ser lida. A base factual abaixo é limitada. Não preencha lacunas com conhecimento próprio — se faltar dado concreto, escreva uma legenda mais curta e genérica e NÃO use título com promessa de revelação."
      : "";

    const prompt = `Você é o redator da Devant Soluções Tributárias para Instagram, uma consultoria tributária que fala com donos de empresa de forma clara, acessível e de fácil entendimento, utilizando sempre metáforas, analogias e alusões para facilitar a compreensão da notícia. Escreva uma legenda profissional e informativa sobre a notícia abaixo. Regras obrigatórias:

O público são empresários e donos de negócio. Eles não são da área tributária — explique termos técnicos de forma clara quando usar.
Tom: informativo, direto e profissional, evitando ao máximo ser prolixo, excessivamente formal ou usar termos técnicos.
Comece com uma frase que chame a atenção do empresário para o fator mais importante da notícia
Use o formato: frase chamativa + parágrafo de abertura + tópicos com 🔹 destacando os pontos principais + parágrafo de fechamento + frase com reflexão ou pergunta ao leitor.
Inclua emojis com moderação.
Termine com um CTA de engajamento (salvar, enviar para alguém, comentar).
Exatamente 5 hashtags relacionadas ao assunto da notícia no final.
Nunca repita palavras ou frases que já estejam nos slides/imagens do post.
Português brasileiro natural, sem tradução de inglês.
ABSOLUTAMENTE PROIBIDO HASHTAGS DE MARCA OU COM O NOME DA EMPRESA, como #DEVANT, #DEVANTSOLUCOES ou variações.

REGRAS DE FIDELIDADE AOS FATOS (prioridade máxima, acima de qualquer regra de estilo):
Use APENAS os dados listados em BASE FACTUAL. Todo nome próprio, número, valor, data, prazo ou percentual que você escrever tem que estar lá.
É PROIBIDO completar com conhecimento próprio, estimar, arredondar ou generalizar um dado que não esteja na BASE FACTUAL.
Se a BASE FACTUAL não tem dado concreto sobre algum ponto, simplesmente não escreva sobre esse ponto.
Os tópicos com 🔹 devem carregar os dados concretos — nomes, valores, datas, prazos. Tópico sem dado concreto não serve.

REGRA DE PROMESSA DO TÍTULO:
O título do post promete algo ao leitor. Se ele diz "veja quem são", "entenda o que muda", "saiba quanto", "descubra", "confira a lista" ou qualquer variação, a legenda TEM que entregar exatamente isso, com os dados da BASE FACTUAL.
Exemplo: título "veja quem são as 10 mais ricas" exige que a legenda cite os nomes. Não vale falar sobre o tema em volta sem citar.
Se a BASE FACTUAL não tiver o que o título promete, NÃO tente contornar escrevendo em volta. Nesse caso, escreva a legenda com o que existe e, ao final da resposta, acrescente numa última linha isolada:
[AVISO: o título promete "..." mas os dados disponíveis não entregam isso — reescrever o título]${avisoSemLeitura}

TÍTULO: ${titulo}

BASE FACTUAL (a única fonte de dados permitida):
${fatos || "(vazio — não há base factual disponível)"}

REFERÊNCIA DE TOM (não é fonte de dados, serve só pra sentir o registro; ignore o link no final):
${mensagem || ""}`;

    const raw = (await callGemini(prompt, 0.9)).trim();
    const legenda = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!legenda) throw new Error("Resposta do Gemini vazia");
    return { legenda };
  });

export const gerarResumoWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((d: { titulo: string; legenda: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const titulo = data.titulo?.trim();
    const legenda = data.legenda?.trim();
    if (!titulo) throw new Error("Título vazio");

    const prompt = `Resuma o post abaixo em no máximo 5 linhas curtas para WhatsApp. Linguagem simples, tom de conversa. Sem hashtags. Sem link da notícia. Sem CTA de seguir a página. Termine com: Leia mais no nosso Instagram 👇. Use emojis com moderação.

Título: ${titulo}
Post: ${legenda || ""}`;

    const raw = (await callGemini(prompt, 0.8)).trim();
    const resumo = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!resumo) throw new Error("Resposta do Gemini vazia");
    return { resumo };
  });

export const gerarEnquete = createServerFn({ method: "POST" })
  .inputValidator((d: { noticia: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
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

    const text = await callGemini(prompt, 0.7, "application/json");

    let parsed: { pergunta?: string; opcoes?: string[] } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const pergunta = (parsed.pergunta || "").toString().trim();
    const opcoes = Array.isArray(parsed.opcoes)
      ? parsed.opcoes
          .map((o) => String(o).trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (!pergunta || opcoes.length < 3) throw new Error("Resposta do Gemini inválida");
    return { pergunta, opcoes };
  });
