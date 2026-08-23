/**
 * COMPATIBILITY LAYER for Better Auth Migration
 *
 * This file provides backward compatibility for code that still imports from "@/auth"
 * It wraps Better Auth to match NextAuth's API
 *
 * TODO: Gradually migrate all imports to use @/lib/auth-session instead
 */

import { getSession, getCurrentUser } from "@/lib/auth-session";
import { Role } from "@prisma/client";

/**
 * Compatibility wrapper for auth() function
 * Maps Better Auth session to NextAuth-like format
 */
export async function auth() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return null;
    }

    // Map Better Auth user to NextAuth session format
    const u = user as any;

    // Proteksi Dasar: Jika tidak aktif, anggap tidak terautentikasi
    if (u.isActive === false) {
      return null;
    }

    return {
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image ?? null,
        role: u.role as Role,
        isActive: !!u.isActive,
        periodeAktifId: u.periodeAktifId ?? null,
        emailVerified: !!u.emailVerified,
      },
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };
  } catch (error) {
    return null;
  }
}

/**
 * Placeholder for signIn - Better Auth uses client-side signIn
 * This should not be called from server-side code
 */
export async function signIn() {
  throw new Error(
    "signIn() is not supported in Better Auth server-side. Use client-side authClient.signIn.email() instead.",
  );
}

/**
 * Placeholder for signOut - Better Auth uses client-side signOut
 * This should not be called from server-side code
 */
export async function signOut() {
  throw new Error(
    "signOut() is not supported in Better Auth server-side. Use client-side authClient.signOut() instead.",
  );
}

// Export empty handlers for API routes (not used anymore)
export const handlers = {
  GET: async () => new Response("Not Found", { status: 404 }),
  POST: async () => new Response("Not Found", { status: 404 }),
};
