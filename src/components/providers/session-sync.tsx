"use client";

import { useSession } from "@/lib/auth-client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Komponen ini berfungsi untuk menyinkronkan status verifikasi email antara
 * database (server) dan session cookie (middleware).
 */
export function SessionSync({ isDbVerified }: { isDbVerified: boolean }) {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Jika di database sudah verified tapi di session browser masih null/falsy
    if (session && isDbVerified && !session.user.emailVerified) {
      // Force refresh data to sync session state
      router.refresh();
    }
  }, [isDbVerified, session, router]);

  return null; // Komponen ini tidak menampilkan apapun
}
