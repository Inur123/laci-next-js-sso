import { goAPI } from "@/lib/go-api";

/**
 * Compatibility wrapper for auth() function
 * Maps the Go session response to the shape expected by existing UI pages.
 */
export async function auth() {
  try {
    const response = await goAPI<{ data: any }>("/me");
    const u = response.data;
    if (!u || u.isActive === false) return null;

    return {
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image ?? null,
        role: u.role as "SEKRETARIS_CABANG" | "SEKRETARIS_PAC",
        isActive: !!u.isActive,
        periodeAktifId: u.periodeAktifId ?? null,
        emailVerified: !!u.emailVerified,
      },
      expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    };
  } catch (error) {
    return null;
  }
}
