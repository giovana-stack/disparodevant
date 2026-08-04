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
  const buffer = await r.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buffer);

  const j = JSON.parse(text) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export const gerarChamadaPost = createServerFn({ method: "POST" })
  .inputValidator((d: { origem: "instagram" | "linkedin"; texto: string; link?: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const texto = data.texto?.trim();
    if (!texto) throw new Error("Cole o texto do post");
    const link = (data.link || "").trim();
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
    let chamada = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!chamada) throw new Error("Resposta do Gemini vazia");
    if (link) chamada = `${chamada}\n\n👉 Leia mais: ${link}`;
    return { chamada };
  });

export const gerarLegendaInstagram = createServerFn({ method: "POST" })
  .inputValidator((d: { titulo: string; mensagem: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const titulo = data.titulo?.trim();
    const mensagem = data.mensagem?.trim();
    if (!titulo) throw new Error("Título vazio");
    const prompt = `Crie uma legenda de Instagram para a Devant Soluções Tributárias sobre esta notícia: ${titulo}. Conteúdo: ${mensagem || ""}. 

Regras de conteúdo:
1. REESCREVA completamente com suas próprias palavras. 
2. A legenda deve ser uma VERSÃO MINI DA MATÉRIA JORNALÍSTICA — cubra os fatos principais da notícia, explique o contexto, os números se houver, quem é afetado, o que muda e por quê. NÃO é pra ser só um resumo raso. É pra pessoa ler e entender a notícia inteira sem precisar clicar em nada. 
3. Use o NOME REAL das coisas. O leitor é dono de empresa, não é contador — então explique termos técnicos APENAS se forem obscuros.
4. Não explique siglas que o público-alvo já conhece pelo contexto (ex: não escreva 'MEI (Microentreendedor Individual)', apenas 'MEI'; não escreva 'Documento de Arrecadação do Simples Nacional — o famoso DAS', apenas 'DAS'). 
5. Corte conectores burocráticos e redundâncias (prefira 'tornando-as desamparadas' a 'o que faz com que percam a qualidade de segurada e fiquem desamparadas'). 

Regras de estilo e tom:
1. Tom: informativo, direto, como uma notícia reescrita em linguagem simples. 
2. Frases enxutas, sem listar itens em sequência longa quando dá pra reorganizar de forma mais fluida. 
3. O fechamento do texto deve ser uma afirmação direta e assertiva sobre a importância do tema, não um conselho suave.
4. SEM CTA (não diga 'ligue pro contador', 'fale com seu escritório', 'entre em contato', 'confira' nem nada do tipo). SEM frases de chamada pra ação de nenhum tipo. Apenas informe.
5. Entre 10 e 15 linhas. Parágrafos curtos. 
6. A abertura da legenda (primeira ou segunda linha) deve ser o GANCHO mais chamativo do TÍTULO da notícia — o que tem mais potencial de prender atenção e gerar engajamento, seja qual for o assunto daquela notícia específica (pode ser um direito, um risco, um prazo, uma mudança, uma oportunidade, o que for — depende do título). Identifique qual é o ponto central que o título está comunicando e abra por ele. Detalhes técnicos, burocráticos, pré-requisitos, mecanismos ou processos que expliquem o 'como funciona' devem ficar no MEIO do texto, nunca na abertura. A abertura vende a ideia; o meio explica os detalhes; o fechamento reforça a importância.
7. Emojis com moderação.

Hashtags:
1. NUNCA use hashtags com o nome da marca. 
2. As 5 hashtags finais devem ser termos curtos e simples (ex: #MEI, #INSS), nunca hashtags compostas longas (nada de #DireitosMEI ou #AposentadoriaMEI).
3. Sem hashtags genéricas como #Empresarios ou #GestaoEmpresarial.

Responda apenas com a legenda, sem aspas.`;
    const raw = (await callGemini(prompt, 0.9)).trim();
    const legenda = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!legenda) throw new Error("Resposta do Gemini vazia");
    return { legenda };
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
