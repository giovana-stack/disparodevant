import { createServerFn } from "@tanstack/react-start";

async function supa() {
  const { getSupa } = await import("./supa.server");
  return getSupa();
}

function base64ToBytes(b64: string) {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const uploadImagemPost = createServerFn({ method: "POST" })
  .inputValidator((d: { dataUrl: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    if (!data.dataUrl) throw new Error("Imagem vazia");
    const s = await supa();
    // O nome do arquivo agora termina em .jpg
    const nome = `post_${Date.now()}.jpg`;
    const bytes = base64ToBytes(data.dataUrl);
    
    // O upload agora especifica image/jpeg
    const { error } = await s.storage.from("imagens").upload(nome, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw new Error(`Falha no upload: ${error.message}`);
    const { data: pub } = s.storage.from("imagens").getPublicUrl(nome);
    return { url: pub.publicUrl };
  });

export const salvarPostagemInstagram = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      titulo: string;
      imagem_url: string;
      legenda: string;
      resumo_whats?: string;
      agendado_para: string;
      status: "agendado" | "publicar_agora";
      rascunho_id?: string | number | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    if (!data.imagem_url) throw new Error("Exporte a imagem primeiro");
    if (!data.agendado_para) throw new Error("Escolha data e hora");
    const s = await supa();
    const { error } = await s.from("postagens_instagram").insert({
      titulo: data.titulo,
      imagem_url: data.imagem_url,
      legenda: data.legenda,
      resumo_whats: data.resumo_whats || null,
      agendado_para: data.agendado_para,
      status: data.status,
      rascunho_id: data.rascunho_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const enviarWebhookMake = createServerFn({ method: "POST" })
  .inputValidator((d: { titulo: string; imagem_fundo_url: string; legenda: string; resumo_whats?: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const url = process.env.APPS_SCRIPT_URL;
    if (!url) throw new Error("APPS_SCRIPT_URL não configurado");
    
    console.log(`[Webhook] Enviando para: ${url}`);
    console.log(`[Webhook] Payload: ${JSON.stringify({
      titulo: String(data.titulo),
      imagem_fundo_url: String(data.imagem_fundo_url),
      legenda: String(data.legenda),
    })}`);
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: String(data.titulo),
          imagem_fundo_url: String(data.imagem_fundo_url),
          legenda: String(data.legenda),
          resumo_whats: String(data.resumo_whats || ""),
        }),
        redirect: "follow",
        signal: controller.signal,
      });

      const bodyText = await res.text();
      console.log(`[Webhook] Status: ${res.status}`);
      console.log(`[Webhook] Headers:`, Object.fromEntries(res.headers.entries()));
      console.log(`[Webhook] Resposta (500 chars): ${bodyText.substring(0, 500)}`);

      // Verifica erros específicos do Apps Script/Backend no corpo da resposta
      const lowerBody = bodyText.toLowerCase();
      const hasError = lowerBody.includes("erro") || lowerBody.includes("função de script não encontrada");

      if (!res.ok || hasError) {
        const errorDetail = bodyText.substring(0, 500);
        throw new Error(`Falha ao publicar. Imagem enviada: ${data.imagem_fundo_url}. Erro do servidor: ${hasError ? "Resposta do servidor indica erro: " : `Status: ${res.status}. Detalhes: `}${errorDetail}`);
      }
      
      return { ok: true as const };
    } catch (e) {
      const err = e as any;
      console.error(`[Webhook] Erro tipo: ${err.name}`);
      console.error(`[Webhook] Erro mensagem: ${err.message}`);
      if (err.cause) console.error(`[Webhook] Erro causa:`, err.cause);

      if (err.name === "AbortError") {
        throw new Error("A publicação demorou demais (timeout de 2min). Tente novamente.");
      }
      throw new Error(`Erro no webhook: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  });


export const listPostagensInstagram = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();
  const { data, error } = await s
    .from("postagens_instagram")
    .select("id, titulo, legenda, resumo_whats, imagem_url, agendado_para, status, rascunho_id")
    .in("status", ["agendado", "publicado"])
    .order("agendado_para", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string | number;
    titulo: string | null;
    legenda: string | null;
    resumo_whats: string | null;
    imagem_url: string | null;
    agendado_para: string | null;
    status: string;
    rascunho_id: string | number | null;
  }>;
});

export const cancelarAgendamento = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number; novoStatus?: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const s = await supa();
    const { error } = await s
      .from("postagens_instagram")
      .update({ status: data.novoStatus || "cancelado" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const atualizarDataAgendamento = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number; novaData: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const s = await supa();
    const { error } = await s
      .from("postagens_instagram")
      .update({ agendado_para: data.novaData })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const excluirNoticiaOriginal = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string | number; rascunho_id: string | number | null }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const s = await supa();
    
    // 1. Deletar da postagens_instagram
    const { error: err1 } = await s.from("postagens_instagram").delete().eq("id", data.id);
    if (err1) throw new Error(err1.message);

    // 2. Se tiver rascunho_id, atualizar rascunho para descartado (ou deletar se preferir, mas descartado é o padrão do app)
    if (data.rascunho_id) {
      const { error: err2 } = await s
        .from("rascunhos")
        .update({ status: "descartado" })
        .eq("id", data.rascunho_id);
      if (err2) console.error("Erro ao descartar rascunho:", err2.message);
    }

    return { ok: true as const };
  });

export const listPostagensPublicadas = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();
  const { data, error } = await s
    .from("postagens_instagram")
    .select("id, titulo, legenda, agendado_para, status")
    .in("status", ["publicado", "publicar_agora", "agendado"])
    .order("agendado_para", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string | number;
    titulo: string | null;
    legenda: string | null;
    agendado_para: string | null;
    status: string;
  }>;
});

export const listNoticiasSelecionaveis = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();
  
  const { data: postedData } = await s
    .from("postagens_instagram")
    .select("rascunho_id, status")
    .not("rascunho_id", "is", null);
  
  const postedIds = (postedData ?? []).map((p: any) => p.rascunho_id);
  const scheduledIds = (postedData ?? [])
    .filter((p: any) => p.status === "agendado")
    .map((p: any) => p.rascunho_id);

  let query = s
    .from("rascunhos")
    .select("id, titulo, mensagem, fatos, leu_materia, link, status, criado_em")
    .eq("status", "pendente")
    .eq("tipo", "noticia");

  if (postedIds.length > 0) {
    query = query.not("id", "in", `(${postedIds.join(",")})`);
  }

  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  
  return (data ?? []).map((r: any) => ({
    ...r,
    is_scheduled: scheduledIds.includes(r.id)
  })) as Array<{
    id: string | number;
    titulo: string | null;
    mensagem: string | null;
    status: string;
    criado_em: string;
    is_scheduled: boolean;
  }>;
});
