"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function LoginClient() {
  const hasToasted = useRef(false);

  useEffect(() => {
    if (hasToasted.current) return;

    // Gunakan URLSearchParams standar browser
    const params = new URLSearchParams(window.location.search);
    const logout = params.get("logout");
    const verified = params.get("verified");
    const error = params.get("error");

    if (logout === "success") {
      toast.success("Berhasil keluar! Sampai jumpa lagi.");
      hasToasted.current = true;
    } else if (verified === "true") {
      toast.success("Email berhasil diverifikasi! Menunggu aktivasi admin.");
      hasToasted.current = true;
    } else if (error === "account_inactive" || error === "inactive") {
      toast.error("Akun Anda belum diaktifkan oleh Sekretaris Cabang.");
      hasToasted.current = true;
    } else if (error === "unregistered") {
      toast.error(
        "Email Anda belum terdaftar. Silakan register terlebih dahulu.",
      );
      hasToasted.current = true;
    } else if (error === "auth_error") {
      toast.error("Terjadi kesalahan saat autentikasi.");
      hasToasted.current = true;
    } else if (error === "session_expired") {
      toast.error("Sesi login Anda telah berakhir", {
        description: "Silakan login kembali untuk melanjutkan akses.",
      });
      hasToasted.current = true;
    }

    if (hasToasted.current) {
      // Clean up URL without reload
      const newPath = window.location.pathname;
      window.history.replaceState(null, "", newPath);
    }
  }, []);

  return null;
}
