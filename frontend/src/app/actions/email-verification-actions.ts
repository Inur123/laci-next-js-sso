"use server";

/**
 * DEPRECATED: Email verification is now handled by Better Auth.
 * This file is kept temporarily to avoid immediate import errors.
 */

export async function sendEmailVerification() {
  return {
    success: false,
    error: "Silakan gunakan fitur verifikasi bawaan aplikasi.",
  };
}

export async function verifyEmail(token: string) {
  return {
    success: false,
    error: "Silakan gunakan tautan verifikasi yang baru dikirim ke email Anda.",
    message: undefined as string | undefined,
    userName: undefined as string | undefined,
  };
}

export async function updateUserEmail(newEmail: string) {
  return {
    success: false,
    error: "Silakan gunakan menu pengaturan profil untuk mengubah email.",
  };
}
