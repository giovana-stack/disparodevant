import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const { getSession } = await import("./auth.server");
  const session = await getSession();
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
    const { getSession } = await import("./auth.server");
    const session = await getSession();
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockApp = createServerFn({ method: "POST" }).handler(async () => {
  const { getSession } = await import("./auth.server");
  const session = await getSession();
  await session.clear();
  return { ok: true as const };
});
