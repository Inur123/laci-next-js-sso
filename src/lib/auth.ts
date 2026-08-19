import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins";
import prisma from "./prisma";
import { createLogManual } from "./log-activity";
import { LogAction, LogModule } from "@prisma/client";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Redirect error autentikasi ke halaman login
  pages: {
    signIn: "/",
    error: `${process.env.BETTER_AUTH_URL}/`,
  },

  // Izinkan auto-link akun jika email SSO cocok dengan akun yang sudah terdaftar
  account: {
    autoLink: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ["sso-ipnu"],
    },
  },

  // Izinkan proxy (Nginx/Cloudflare) & PAKSA HTTPS di Production
  advanced: {
    useSecureCookies: true,
    cookiePrefix: "ipnu-laci",
  },
  
  // Percaya header Host dari Nginx (Nginx mengirim Host: laci.pelajarnumagetan.or.id)
  trustHost: true,

  // Autentikasi lokal (Email/Password & OTP) dihapus. Menggunakan SSO sepenuhnya.
  // Custom User Fields Mapping for Better Auth
  user: {
    additionalFields: {
      role: {
        type: "string",
      },
      isActive: {
        type: "boolean",
      },
      periodeAktifId: {
        type: "string",
      },
      lastLogoutAt: {
        type: "date",
      },
    },
  },

  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "sso-ipnu",
          discoveryUrl: `${process.env.SSO_ISSUER}/.well-known/openid-configuration`,
          clientId: process.env.SSO_CLIENT_ID!,
          clientSecret: process.env.SSO_CLIENT_SECRET!,
          scopes: ["openid", "profile", "email"],
          pkce: true,
          prompt: "consent",
          authorizationUrlParams: {
            nonce: "sso-nonce-12345",
          },
        },
      ],
    }),
  ],

  // DB Hooks for reliable auditing
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Bypass saat seeding database
          if (process.env.SEEDING === "true") return;

          // Otomatis tandai email terverifikasi karena login melalui SSO terpusat
          user.emailVerified = true;
          // Otomatis aktifkan akun (tidak perlu approval lagi) karena bersumber dari SSO
          user.isActive = true;
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          // FIRE AND FORGET: Do not await logging in serverless environment to speed up response
          (async () => {
            try {
              const user = await prisma.user.findUnique({
                where: { id: session.userId },
                select: { name: true, email: true },
              });
              
              await createLogManual(
                session.userId,
                "LOGIN" as LogAction,
                "AUTH" as LogModule,
                `User login ke sistem: ${user?.name || user?.email || "Unknown"}`,
              ).catch((e) => console.log("[Auth Hook] Logging failed silently (DB connection issue)"));
            } catch (err) {
              console.log("[Auth Hook] Background Login log failed silently");
            }
          })();
        },
      },
      delete: {
        after: async (session) => {
          const userId = (session as any)?.userId;
          if (!userId) return;

          // FIRE AND FORGET: Do not await logout logging
          (async () => {
            try {
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true },
              });

              // Serial background tasks
              await createLogManual(
                userId,
                "LOGOUT" as LogAction,
                "AUTH" as LogModule,
                `User logout dari sistem: ${user?.name || "Unknown"}`,
              ).catch((e) => console.log("[Auth Hook] Logout logging failed silently"));
              
              await prisma.user.update({
                where: { id: userId },
                data: { lastLogoutAt: new Date() },
              }).catch((e) => console.log("[Auth Hook] LastLogout update failed silently"));
            } catch (err) {
              console.log("[Auth Hook] Background Logout task failed silently");
            }
          })();
        },
      },
    },
  },

  // Session Configuration
  session: {
    expiresIn: 60 * 60 * 6, // 6 jam
    updateAge: 60 * 60, // refresh setiap 1 jam
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  // Trust proxy for production
  trustedOrigins: [
    "https://laci.pelajarnumagetan.or.id",
    "http://localhost:3001",
    process.env.BETTER_AUTH_URL || "",
  ].filter(Boolean),

  // Base URL harus absolut, ambil dari .env
  baseURL: process.env.BETTER_AUTH_URL || "https://laci.pelajarnumagetan.or.id",

  secret: process.env.BETTER_AUTH_SECRET!,
});



export type Session = typeof auth.$Infer.Session;
