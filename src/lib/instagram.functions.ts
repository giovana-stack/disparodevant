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
      agendado_para: data.agendado_para,
      status: data.status,
      rascunho_id: data.rascunho_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const enviarWebhookMake = createServerFn({ method: "POST" })
  .inputValidator((d: { titulo: string; imagem_fundo_url: string; legenda: string }) => d)
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
    .select("id, titulo, legenda, imagem_url, agendado_para, status")
    .in("status", ["agendado", "publicado"])
    .order("agendado_para", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string | number;
    titulo: string | null;
    legenda: string | null;
    imagem_url: string | null;
    agendado_para: string | null;
    status: string;
  }>;
});

export const listPostagensPublicadas = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireUnlocked();
  const s = await supa();
  const { data, error } = await s
    .from("postagens_instagram")
    .select("id, titulo, legenda, agendado_para, status")
    .in("status", ["publicado", "publicar_agora"])
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
  
  const { data: alreadyPosted } = await s
    .from("postagens_instagram")
    .select("rascunho_id")
    .not("rascunho_id", "is", null);
  
  const postedIds = (alreadyPosted ?? []).map((p: any) => p.rascunho_id);

  let query = s
    .from("rascunhos")
    .select("id, titulo, mensagem, status, criado_em")
    .eq("status", "pendente")
    .eq("tipo", "noticia");

  if (postedIds.length > 0) {
    query = query.not("id", "in", `(${postedIds.join(",")})`);
  }

  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string | number;
    titulo: string | null;
    mensagem: string | null;
    status: string;
    criado_em: string;
  }>;
});