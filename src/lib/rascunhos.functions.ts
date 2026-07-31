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
    const r = await fetch(url, { method: "POST", redirect: "follow", signal: ctrl.signal });
    if (!r.ok) throw new Error(`Falha ao buscar notícias: ${r.status}`);
    try { await r.text(); } catch { /* ignore */ }
    return { ok: true as const };
  } finally {
    clearTimeout(timeout);
  }
});

export const listPendingNoticias = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();
  const { data, error } = await s
    .from("rascunhos")
    .select("*")
    .eq("status", "pendente")
    .eq("tipo", "noticia")
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listSentNoticias = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();
  const { data, error } = await s
    .from("rascunhos")
    .select("id, titulo, mensagem, status, criado_em, enviado_em")
    .in("status", ["pendente", "enviado"])
    .eq("tipo", "noticia")
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
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
  .inputValidator((d: { pergunta: string; opcoes: string[] }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const pergunta = data.pergunta?.trim();
    const opcoes = (data.opcoes || []).map((o) => o.trim()).filter(Boolean);
    if (!pergunta) throw new Error("Pergunta obrigatória");
    if (opcoes.length < 2 || opcoes.length > 5) throw new Error("Entre 2 e 5 opções");
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
