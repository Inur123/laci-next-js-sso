"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Set target periode yang ingin ditampilkan datanya di layar
 */
export async function setViewPeriode(periodeId: string | null) {
  const cookieStore = await cookies();
  
  if (!periodeId) {
    // Jika null, hapus cookie (artinya kembali mengikuti periode aktif)
    cookieStore.delete("view_periode_id");
  } else {
    // Simpan target periode di cookie selama 30 hari
    cookieStore.set("view_periode_id", periodeId, {
      maxAge: 30 * 24 * 60 * 60, // 30 hari
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  // Refresh data dan layout agar langsung beralih ke data periode terpilih
  revalidatePath("/", "layout");
  return { success: true };
}
