import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins";
import prisma from "./prisma";

async function notifyAuthEvent(userId: string, action: "LOGIN" | "LOGOUT") {
  if (!process.env.BFF_SHARED_SECRET) return;
  await fetch(`${process.env.GO_API_URL || "http://localhost:8080"}/api/v1/internal/auth-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-BFF-Secret": process.env.BFF_SHARED_SECRET },
    body: JSON.stringify({ userId, action }),
  });
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  pages: { signIn: "/", error: `${process.env.BETTER_AUTH_URL}/` },
  account: {
    autoLink: true,
    accountLinking: { enabled: true, trustedProviders: ["sso-ipnu"] },
  },
  advanced: { useSecureCookies: true, cookiePrefix: "ipnu-laci" },
  trustHost: true,
  user: {
    additionalFields: {
      role: { type: "string" },
      isActive: { type: "boolean" },
      periodeAktifId: { type: "string" },
      lastLogoutAt: { type: "date" },
    },
  },
  plugins: [
    genericOAuth({ config: [{
      providerId: "sso-ipnu",
      discoveryUrl: `${process.env.SSO_ISSUER}/.well-known/openid-configuration`,
      clientId: process.env.SSO_CLIENT_ID!, clientSecret: process.env.SSO_CLIENT_SECRET!,
      scopes: ["openid", "profile", "email"], pkce: true, prompt: "consent",
    }] }),
  ],
  databaseHooks: {
    user: { create: { before: async (user) => {
      if (process.env.SEEDING !== "true") { user.emailVerified = true; user.isActive = true; }
    } } },
    session: {
      create: { after: async (session) => { await notifyAuthEvent(session.userId, "LOGIN").catch(() => undefined); } },
      delete: { after: async (session) => {
        const userId = (session as { userId?: string })?.userId;
        if (userId) await notifyAuthEvent(userId, "LOGOUT").catch(() => undefined);
      } },
    },
  },
  session: { expiresIn: 60 * 60 * 6, updateAge: 60 * 60, cookieCache: { enabled: true, maxAge: 5 * 60 } },
  trustedOrigins: ["https://laci.pelajarnumagetan.or.id", "http://localhost:3000", process.env.BETTER_AUTH_URL || ""].filter(Boolean),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET!,
});

export type Session = typeof auth.$Infer.Session;
