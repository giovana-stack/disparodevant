import { createClient } from "@supabase/supabase-js";

export function getSupa() {
  const url = process.env.SUPA_URL;
  const key = process.env.SUPA_ANON_KEY;
  if (!url || !key) throw new Error("SUPA_URL / SUPA_ANON_KEY não configurados");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Rascunho = {
  id: string | number;
  criado_em: string;
  titulo: string | null;
  mensagem: string | null;
  status: "pendente" | "aprovado" | "enviado" | "descartado";
  tipo: "noticia" | "enquete" | "instagram" | "linkedin";
  enviado_em: string | null;
  poll_opcoes: string[] | null;
};
