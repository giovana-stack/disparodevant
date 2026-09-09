import { createServerFn } from "@tanstack/react-start";

async function callGemini(prompt: string, temperature = 0.8, responseMimeType?: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada");

  const models = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.6-flash"];

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

    const avisoSemLeitura =
      data.leu_materia === false
        ? "\n\nATENÇÃO: a matéria original não pôde ser lida. A base factual abaixo é limitada. Não preencha lacunas com conhecimento próprio — se faltar dado concreto, escreva uma legenda mais curta e genérica e NÃO use título com promessa de revelação."
        : "";

    const prompt = `Você é o redator da Devant Soluções Tributárias para Instagram. Escreve para donos de empresa que já lidam com imposto, banco e contador no dia a dia. Eles são adultos ocupados e informados, não leigos que precisam de aula.

REGRA DA PRIMEIRA LINHA (prioridade máxima, acima de qualquer regra de estilo):
A primeira linha é a manchete. Ela tem que conter o fato mais importante da BASE FACTUAL — o dado que muda alguma coisa para o leitor: o prazo, o valor, o percentual, a mudança de regra, quem é afetado.
A primeira linha DEVE conter pelo menos um dado concreto (número, data, valor, percentual ou nome).
É TERMINANTEMENTE PROIBIDO abrir com: metáfora, analogia, comparação ("é como se..."), pergunta retórica, "sabe quando...", "imagine que...", frase de efeito genérica, contexto ou preâmbulo.
Se você escrever a primeira linha e ela não informar nada sozinha, está errada. Reescreva.

TOM (segunda prioridade):
Escreva como quem informa um par, não como quem ensina uma criança.
PROIBIDO usar metáfora, analogia ou comparação didática em qualquer ponto do texto.
Não explique o óbvio para o público (o que é dívida, o que é renegociar, por que atraso é ruim, por que estar em dia é bom).
Só explique um termo se ele for realmente técnico e pouco conhecido — e explique em três ou quatro palavras, dentro da própria frase, sem virar parágrafo.
Frases curtas e secas. Sem adjetivo decorativo, sem moralismo, sem conselho genérico de gestão.
Português brasileiro natural, sem tradução do inglês.

FORMATO:
Linha 1: a manchete (regra acima).
Depois: um parágrafo curto (no máximo 2 linhas) com o contexto essencial — quem é afetado e o que muda. Se não houver contexto novo a dar, pule esse parágrafo.
Depois: tópicos com 🔹 carregando os dados concretos (prazos, valores, percentuais, faixas, condições).
Depois: uma linha final com a consequência prática de agir ou não agir — sem sermão.
Depois: uma pergunta objetiva ao leitor sobre a situação dele.
Depois: CTA de engajamento (salvar, enviar para alguém, comentar).
Depois: exatamente 5 hashtags relacionadas ao assunto.
Emojis com moderação, só nos tópicos.
Nunca repita palavras ou frases que já estejam nos slides/imagens do post.
ABSOLUTAMENTE PROIBIDO HASHTAGS DE MARCA OU COM O NOME DA EMPRESA, como #DEVANT, #DEVANTSOLUCOES ou variações.

REGRAS DE FIDELIDADE AOS FATOS (mesma prioridade da primeira linha):
Use APENAS os dados listados em BASE FACTUAL. Todo nome próprio, número, valor, data, prazo ou percentual que você escrever tem que estar lá.
É PROIBIDO completar com conhecimento próprio, estimar, arredondar ou generalizar um dado que não esteja na BASE FACTUAL.
Se a BASE FACTUAL não tem dado concreto sobre algum ponto, simplesmente não escreva sobre esse ponto.
Os tópicos com 🔹 devem carregar os dados concretos. Tópico sem dado concreto não serve.

REGRA DE PROMESSA DO TÍTULO:
O título do post promete algo ao leitor. Se ele diz "veja quem são", "entenda o que muda", "saiba quanto", "descubra", "confira a lista" ou qualquer variação, a legenda TEM que entregar exatamente isso, com os dados da BASE FACTUAL.
Exemplo: título "veja quem são as 10 mais ricas" exige que a legenda cite os nomes. Não vale falar sobre o tema em volta sem citar.
Se a BASE FACTUAL não tiver o que o título promete, NÃO tente contornar escrevendo em volta. Nesse caso, escreva a legenda com o que existe e, ao final da resposta, acrescente numa última linha isolada:
[AVISO: o título promete "..." mas os dados disponíveis não entregam isso — reescrever o título]${avisoSemLeitura}

ANTES DE RESPONDER, CONFIRA:
A primeira linha tem dado concreto e nenhuma metáfora?
O texto inteiro está livre de comparações didáticas?
Você explicou algo que um dono de empresa já sabe? Se sim, corte.

Responda APENAS com a legenda, sem aspas, sem markdown, sem explicação.

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

    const prompt = `Resuma o post abaixo para um grupo de WhatsApp de donos de empresa.

Regras:
Máximo 4 linhas curtas.
A primeira linha tem que trazer o fato mais importante com dado concreto (prazo, valor, percentual, mudança de regra). Nada de metáfora, analogia, comparação, aspas de efeito ou pergunta retórica.
No máximo 1 emoji no texto inteiro, e só se ele acrescentar alguma coisa. Zero emoji no fim das linhas.
Tom seco e direto, de quem avisa um colega. Sem adjetivo decorativo, sem conselho genérico, sem explicar o óbvio.
Só use dados que estão no post abaixo. Não invente, não arredonde, não complete.
Sem hashtags. Sem link. Sem CTA de seguir a página.
Termine exatamente com: Leia mais no nosso Instagram 👇

Título: ${titulo}
Post: ${legenda || ""}`;

    const raw = (await callGemini(prompt, 0.5)).trim();
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

    const ANGULOS = [
      "O PRAZO: o que a pessoa vai fazer dentro da janela de tempo que a notícia estabelece.",
      "O DINHEIRO: quanto isso pesa ou alivia no caixa dela, e o que ela faria com essa diferença.",
      "A DECISÃO DE ADERIR OU NÃO: se ela entraria nisso ou passaria longe, e por quê.",
      "QUEM RESOLVE: se ela mesma vai atrás, joga pro contador, contrata alguém ou deixa parado.",
      "A DESCONFIANÇA: se ela acredita que isso funciona na prática ou acha que tem pegadinha.",
      "O EFEITO NO DIA A DIA: o que trava ou destrava na operação dela por causa disso.",
      "A COMPARAÇÃO: como ela lidou com uma situação parecida antes e se faria diferente agora.",
      "O DETALHE ESQUECIDO: um dado específico da notícia que quase ninguém comenta, mas muda a decisão.",
    ];
    const angulo = ANGULOS[Math.floor(Math.random() * ANGULOS.length)];

    const prompt = `Você recebe uma notícia. Crie UMA pergunta de enquete para um grupo de donos de pequeno negócio no WhatsApp.

PASSO 1 (não escreva isso na resposta): leia a notícia inteira e liste mentalmente todos os pontos concretos que ela traz — prazos, valores, percentuais, condições, exceções, quem entra e quem fica de fora.

PASSO 2: monte a enquete usando obrigatoriamente este ângulo:
${angulo}

Regras obrigatórias:
1. A pergunta tem que ancorar num dado concreto da notícia (um prazo, um valor, um percentual, uma condição específica). Enquete genérica que serviria para qualquer notícia está errada.
2. Ela deve forçar a pessoa a se posicionar sobre uma ESCOLHA CONCRETA do dia a dia de quem tem um negócio. Nada de opinião abstrata.
3. Frases curtas e diretas. Zero termo técnico ou financeiro rebuscado. Fale como dono de loja, de boteco, de oficina, de salão.
4. Gere de 3 a 4 opções que sejam escolhas reais do dia a dia, faladas do jeito que a pessoa falaria. Exemplo de tom: "vou tirar meu dinheiro antes", "vou continuar do mesmo jeito", "não sei o que fazer", "vou esperar pra ver".
5. NUNCA use opções genéricas como "concordo", "discordo", "indiferente" ou "depende".
6. As opções têm que ser mutuamente excludentes e cobrir posições realmente diferentes — não podem ser variações da mesma resposta.
7. A graça é dividir opinião de forma fácil. Não pode parecer prova de faculdade.

Responda APENAS com JSON válido, sem markdown, sem comentários, no formato:
{"pergunta":"...","opcoes":["...","..."]}

Notícia:
${noticia}`;

    const text = await callGemini(prompt, 1.0, "application/json");

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
