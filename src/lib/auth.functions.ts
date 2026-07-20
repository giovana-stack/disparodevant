import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { sessionConfig, type AppSession } from "./session";

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function requireUnlocked() {
  const session = await useSession<AppSession>(sessionConfig);
  if (!session.data.unlocked) throw new Error("Não autorizado");
  return session;
}

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AppSession>(sessionConfig);
  return { unlocked: Boolean(session.data.unlocked) };
});

export const unlockApp = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env.APP_PASSWORD;
    if (!expected) throw new Error("APP_PASSWORD não configurada no servidor");
    if (!data.password || !passwordMatches(data.password, expected)) {
      return { ok: false as const };
    }
    const session = await useSession<AppSession>(sessionConfig);
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockApp = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AppSession>(sessionConfig);
  await session.clear();
  return { ok: true as const };
});
