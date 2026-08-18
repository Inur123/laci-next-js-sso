"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function SessionMonitor() {
  const { data: session, isPending } = useSession();
  const wasLoggedIn = useRef<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Tunggu sampai loading session selesai pertama kali
    if (isPending) return;

    const isLoggedIn = !!session;

    // Jika sebelumnya login, tapi sekarang tidak
    if (wasLoggedIn.current === true && isLoggedIn === false) {
      const isProtectedRoute =
        window.location.pathname.startsWith("/dashboard");

      if (isProtectedRoute) {
        toast.error("Sesi login Anda telah berakhir", {
          description: "Silakan login kembali untuk melanjutkan akses.",
          duration: 5000,
          id: "session-expired",
        });

        router.push("/login?error=session_expired");
      }
    }

    wasLoggedIn.current = isLoggedIn;
  }, [session, isPending, router]);

  return null;
}
