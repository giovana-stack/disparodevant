import { useSession } from "@tanstack/react-start/server";
import { sessionConfig, type AppSession } from "./session";

export async function getSession() {
  return useSession<AppSession>(sessionConfig);
}

export async function requireUnlocked() {
  const session = await getSession();
  if (!session.data.unlocked) throw new Error("Não autorizado");
  return session;
}
