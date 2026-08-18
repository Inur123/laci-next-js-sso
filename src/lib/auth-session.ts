import { auth } from "./auth";
import { headers } from "next/headers";
import { cache } from "react";

/**
 * Get current session from Better Auth
 * Use this in Server Components and Server Actions
 * Memoized per-request using React cache()
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
});

/**
 * Get current user from session
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Require authentication - throw error if not authenticated or inactive
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Proteksi akun aktif
  if ((session.user as any).isActive === false) {
    throw new Error("Inactive account");
  }

  return session;
}

/**
 * Require specific role
 */
export async function requireRole(role: string) {
  const session = await requireAuth(); // requireAuth sudah cek isActive
  if ((session.user as any).role !== role) {
    throw new Error("Forbidden");
  }
  return session;
}
