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
    const nome = `post_${Date.now()}.png`;
    const bytes = base64ToBytes(data.dataUrl);
    const { error } = await s.storage.from("imagens").upload(nome, bytes, {
      contentType: "image/png",
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
  .inputValidator((d: { titulo: string; photo_url: string; caption: string }) => d)
  .handler(async ({ data }) => {
    await (await import("./auth.server")).requireUnlocked();
    const url = process.env.MAKE_WEBHOOK;
    if (!url) throw new Error("MAKE_WEBHOOK não configurado");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: data.titulo,
        photo_url: data.photo_url,
        caption: data.caption,
      }),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Webhook falhou (${res.status})`);
    return { ok: true as const };
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
