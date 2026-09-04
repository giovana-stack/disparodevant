import { createServerFn } from "@tanstack/react-start";

type Tipo = "noticia" | "enquete" | "instagram" | "linkedin";

async function supa() {
  const { getSupa } = await import("./supa.server");
  return getSupa();
}

async function uaText(text: string) {
  const url = process.env.UAZAPI_URL!;
  const token = process.env.UAZAPI_TOKEN!;
  const grupo = process.env.UAZAPI_GRUPO_ID!;
  const r = await fetch(`${url.replace(/\/$/, "")}/send/text`, {
    method: "POST",
    headers: { token, "Content-Type": "application/json" },
    body: JSON.stringify({ number: grupo, text }),
  });
  if (!r.ok) throw new Error(`uazapi /send/text falhou: ${r.status} ${await r.text()}`);
  return r.json().catch(() => ({}));
}

async function uaPoll(question: string, choices: string[]) {
  const url = process.env.UAZAPI_URL!;
  const token = process.env.UAZAPI_TOKEN!;
  const grupo = process.env.UAZAPI_GRUPO_ID!;
  const r = await fetch(`${url.replace(/\/$/, "")}/send/menu`, {
    method: "POST",
    headers: { token, "Content-Type": "application/json" },
    body: JSON.stringify({ number: grupo, type: "poll", text: question, choices }),
  });
  if (!r.ok) throw new Error(`uazapi /send/menu falhou: ${r.status} ${await r.text()}`);
  return r.json().catch(() => ({}));
}

export const buscarNovasNoticias = createServerFn({ method: "POST" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) throw new Error("APPS_SCRIPT_URL não configurada");
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 150000);
  try {
    console.log("Chamando Apps Script URL:", url);
    const r = await fetch(url, {
      method: "POST",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    console.log("Apps Script Response status:", r.status);
    const text = await r.text();
    console.log("Apps Script Response body (first 500 chars):", text.slice(0, 500));

    // Verificamos se o status é sucesso (200 ou redirecionamento bem-sucedido)
    if (!r.ok) throw new Error(`Falha ao buscar notícias: ${r.status}`);

    // Apps Script às vezes retorna HTML de erro mesmo com status 200 se a função falhar internamente
    if (text.includes("Script function not found") || text.includes("Erro") || text.includes("Error")) {
      if (text.length < 1000) { // Se for uma mensagem curta de erro
        throw new Error(`Apps Script retornou erro: ${text}`);
      }
    }

    return { ok: true as const };
  } catch (error) {
    console.error("Erro em buscarNovasNoticias:", error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
});

export const listPendingNoticias = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();

  const { data: postedData } = await s
    .from("postagens_instagram")
    .select("rascunho_id, status")
    .not("rascunho_id", "is", null);

  const postedDataArr = postedData ?? [];
  // Excluímos apenas os que já foram publicados (status 'publicado' ou 'publicar_agora')
  // Os agendados devem continuar aparecendo na lista de Notícias, mas com ícone.
  const publishedIds = postedDataArr
    .filter(p => p.status === "publicado" || p.status === "publicar_agora")
    .map(p => p.rascunho_id);

  const scheduledIds = postedDataArr
    .filter(p => p.status === "agendado")
    .map(p => p.rascunho_id);

  let query = s
    .from("rascunhos")
    .select("*")
    .eq("status", "pendente")
    .eq("tipo", "noticia");

  if (publishedIds.length > 0) {
    query = query.not("id", "in", `(${publishedIds.join(",")})`);
  }

  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map(r => ({
    ...r,
    is_scheduled: scheduledIds.includes(r.id)
  }));
});

export const listSentNoticias = createServerFn({ method: "GET" }).handler(async () => {
  const { listNoticiasSelecionaveis } = await import("./instagram.functions");
  return listNoticiasSelecionaveis();
});

export const listSent = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();
  const { data, error } = await s
    .from("rascunhos")
    .select("id, titulo, mensagem, tipo, enviado_em, poll_opcoes")
    .eq("status", "enviado")
    .not("enviado_em", "is", null)
    .order("enviado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const approveNoticia = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number; mensagem: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    if (!data.mensagem?.trim()) throw new Error("Mensagem vazia");
    await uaText(data.mensagem);
    const s = await supa();
    const { error } = await s
      .from("rascunhos")
      .update({ status: "enviado", enviado_em: new Date().toISOString(), mensagem: data.mensagem })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const discardNoticia = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const s = await supa();
    const { error } = await s.from("rascunhos").update({ status: "descartado" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const dispararEnquete = createServerFn({ method: "POST" })
  .inputValidator((d: { pergunta: string; opcoes: string[]; agendadoPara?: string | null }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const pergunta = data.pergunta?.trim();
    const opcoes = (data.opcoes || []).map((o) => o.trim()).filter(Boolean);
    if (!pergunta) throw new Error("Pergunta obrigatória");
    if (opcoes.length < 2 || opcoes.length > 5) throw new Error("Entre 2 e 5 opções");

    const quandoRaw = data.agendadoPara?.trim();
    if (quandoRaw) {
      const quando = new Date(quandoRaw);
      if (Number.isNaN(quando.getTime())) throw new Error("Data de agendamento inválida");
      const s = await supa();
      const { error } = await s.from("rascunhos").insert({
        titulo: pergunta,
        mensagem: pergunta,
        status: "agendado",
        tipo: "enquete",
        agendado_para: quando.toISOString(),
        poll_opcoes: opcoes,
      });
      if (error) throw new Error(error.message);
      return { ok: true as const, agendada: true as const };
    }

    await uaPoll(pergunta, opcoes);
    const s = await supa();
    const { error } = await s.from("rascunhos").insert({
      titulo: pergunta,
      mensagem: pergunta,
      status: "enviado",
      tipo: "enquete",
      enviado_em: new Date().toISOString(),
      poll_opcoes: opcoes,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, agendada: false as const };
  });

export const listEnquetesAgendadas = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();
  const { data, error } = await s
    .from("rascunhos")
    .select("id, titulo, mensagem, poll_opcoes, agendado_para")
    .eq("tipo", "enquete")
    .eq("status", "agendado")
    .order("agendado_para", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const cancelarEnqueteAgendada = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const s = await supa();
    const { error } = await s
      .from("rascunhos")
      .update({ status: "descartado" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const atualizarDataEnquete = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number; novaData: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const quando = new Date(data.novaData);
    if (Number.isNaN(quando.getTime())) throw new Error("Data de agendamento inválida");
    const s = await supa();
    const { error } = await s
      .from("rascunhos")
      .update({ agendado_para: quando.toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const dispararEnqueteAgora = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const s = await supa();
    const { data: row, error: errSel } = await s
      .from("rascunhos")
      .select("id, titulo, poll_opcoes")
      .eq("id", data.id)
      .single();
    if (errSel) throw new Error(errSel.message);
    const pergunta = (row?.titulo || "").trim();
    const opcoes = ((row?.poll_opcoes as string[]) || []).map((o) => String(o).trim()).filter(Boolean);
    if (!pergunta) throw new Error("Pergunta vazia");
    if (opcoes.length < 2 || opcoes.length > 5) throw new Error("Entre 2 e 5 opções");
    await uaPoll(pergunta, opcoes);
    const { error } = await s
      .from("rascunhos")
      .update({ status: "enviado", enviado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const dispararPost = createServerFn({ method: "POST" })
  .inputValidator((d: { origem: "instagram" | "linkedin"; link: string; chamada: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const link = data.link?.trim();
    const chamada = data.chamada?.trim();
    if (!link) throw new Error("Link obrigatório");
    if (!chamada) throw new Error("Texto de chamada obrigatório");
    if (data.origem !== "instagram" && data.origem !== "linkedin") throw new Error("Origem inválida");
    const texto = chamada.includes(link) ? chamada : `${chamada}\n\n👉 Leia mais: ${link}`;
    await uaText(texto);
    const s = await supa();
    const tipo: Tipo = data.origem;
    const { error } = await s.from("rascunhos").insert({
      titulo: chamada,
      mensagem: texto,
      status: "enviado",
      tipo,
      enviado_em: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const marcarRascunhoEnviado = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const s = await supa();
    const { error } = await s
      .from("rascunhos")
      .update({ status: "enviado", enviado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
