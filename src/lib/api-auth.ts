import { getSession } from "./auth-session";
import { verifyToken } from "@/lib/jwt";
import prisma from "@/lib/prisma";

export type ApiSession = {
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
};

/**
 * Helper untuk mengautentikasi request API baik dari Web (Cookie) maupun Mobile (Bearer Token)
 */
export async function authenticateApi(
  request: Request,
): Promise<ApiSession | null> {
  try {
    // 1. Cek Session (Better Auth) - Biasanya untuk Web/Swagger
    const session = await getSession();

    if (session?.user) {
      const user = session.user as any;
      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role || "USER",
          name: user.name || "",
        },
      };
    }

    // 2. Cek Bearer Token - Untuk Mobile App
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = await verifyToken(token);

      if (payload && payload.id) {
        // Ambil data user dari database untuk cek validitas token
        const user = await prisma.user.findUnique({
          where: { id: payload.id as string },
          select: { lastLogoutAt: true },
        });

        // Jika user tidak ditemukan, token tidak valid
        if (!user) return null;

        // Validasi iat (Issued At) terhadap jam logout terakhir (lastLogoutAt)
        if (user.lastLogoutAt && payload.iat) {
          const iatSeconds = payload.iat as number;
          const lastLogoutSeconds = Math.floor(
            user.lastLogoutAt.getTime() / 1000,
          );

          // Jika token diterbitkan SEBELUM waktu logout terakhir, anggap sudah hangus
          if (iatSeconds < lastLogoutSeconds) {
            console.warn(
              `[Auth] Token rejected: Issued at ${iatSeconds} < Last logout ${lastLogoutSeconds}. User: ${payload.id}`,
            );
            return null;
          }
        }

        return {
          user: {
            id: payload.id as string,
            email: payload.email as string,
            role: payload.role as string,
          },
        };
      }
    }
  } catch (error) {
    console.error("[Auth] authenticateApi error:", error);
    return null;
  }

  return null;
}
