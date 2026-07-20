// Server-only session config for the shared-password gate.
export const sessionConfig = {
  password: process.env.SESSION_SECRET!,
  name: "wa-disparos-session",
  maxAge: 60 * 60 * 24 * 30, // 30 dias
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
  },
};

export type AppSession = { unlocked?: boolean };
