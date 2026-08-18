"use server";

import prisma from "@/lib/prisma";
import { z } from "zod";
import { auth as betterAuth } from "@/lib/auth"; // Better Auth Instance
import { auth } from "@/auth"; // Compatibility Layer
import { hashPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";

import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import {
  decryptText,
  encryptFile,
  generateEncryptedFilename,
} from "@/lib/encryption";
// FS imports removed
import { uploadToR2, deleteFromR2 } from "@/lib/storage-r2";


import { createLog } from "@/lib/log-activity";
import {
  generateVerificationToken,
  sendVerificationEmail,
  sendVerifiedSuccessEmail,
} from "@/lib/email";

const RegisterSchema = z.object({
  name: z
    .string()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter")
    .trim()
    .refine(
      (val) => /^[a-zA-Z0-9\s.',-]+$/.test(val),
      "Nama hanya boleh mengandung huruf, angka, spasi, titik, koma, dan apostrof",
    )
    .transform((val) => val.replace(/\s+/g, " ")), // Remove multiple spaces
  email: z
    .string()
    .email("Format email tidak valid")
    .trim()
    .toLowerCase()
    .max(255, "Email terlalu panjang"),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter")
    .max(128, "Password terlalu panjang"),
});

// Register function removed because registration is now handled by Better Auth client-side in register-form.tsx

export async function verifyOTP(email: string, otp: string) {
  // Use Better Auth client-side verification instead of this manual action
  return { error: "Silakan gunakan fitur verifikasi bawaan aplikasi." };
}

export async function resendVerificationAction(email: string) {
  try {
    await betterAuth.api.sendVerificationEmail({
      body: { email },
    });
    return { success: true };
  } catch (error) {
    console.error("[AUTH-ACTION] Resend verification failed:", error);
    return { error: "Gagal mengirim email verifikasi." };
  }
}

// authenticate function removed because login is now handled by Better Auth client-side in login-form.tsx

export async function checkEmailVerificationStatus(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });

    if (!user) return { error: "User tidak ditemukan" };
    return { verified: user.emailVerified };
  } catch (error) {
    return { error: "Gagal mengecek status verifikasi" };
  }
}

/**
 * Trigger pengiriman email sukses verifikasi
 */
export async function sendVerifiedSuccessEmailAction(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { name: true },
    });

    if (!user) return { success: false, error: "User tidak ditemukan" };

    return await sendVerifiedSuccessEmail(email, user.name || "Rekan/Rekanita");
  } catch (error) {
    console.error("[EMAIL-SUCCESS] Gagal mengirim email:", error);
    return { success: false, error: "Terjadi kesalahan internal" };
  }
}

export async function getPACUsers(
  query?: string,
  page: number = 1,
  limit: number = 10,
  status?: string,
  emailStatus?: string,
  sortKey?: string | null,
  sortDir: "asc" | "desc" = "asc",
) {
  const session = await auth();
  if (session?.user?.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }

  const where: Prisma.UserWhereInput = {
    role: "SEKRETARIS_PAC",
  };

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  if (status && status !== "ALL") {
    where.isActive = status === "ACTIVE";
  }

  if (emailStatus && emailStatus !== "ALL") {
    where.emailVerified = emailStatus === "VERIFIED";
  }

  const orderBy: Prisma.UserOrderByWithRelationInput = sortKey
    ? { [sortKey]: sortDir }
    : { createdAt: "desc" };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: users,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get user statistics for Sekretaris Cabang
 */
export async function getUserStats() {
  const session = await auth();
  if (session?.user?.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }

  const [total, aktif, nonaktif, terverifikasi, belumVerifikasi] =
    await Promise.all([
      prisma.user.count({ where: { role: "SEKRETARIS_PAC" } }),
      prisma.user.count({ where: { role: "SEKRETARIS_PAC", isActive: true } }),
      prisma.user.count({ where: { role: "SEKRETARIS_PAC", isActive: false } }),
      prisma.user.count({
        where: { role: "SEKRETARIS_PAC", emailVerified: true },
      }),
      prisma.user.count({
        where: { role: "SEKRETARIS_PAC", emailVerified: false },
      }),
    ]);

  return {
    total,
    aktif,
    nonaktif,
    terverifikasi,
    belumVerifikasi,
  };
}

export async function getUserDetail(userId: string) {
  const session = await auth();
  if (
    session?.user?.role !== "SEKRETARIS_CABANG" &&
    session?.user?.id !== userId
  ) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      periodes: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!user) return null;

  const activePeriod = user.periodes[0];

  let stats = {
    arsipSurats: 0,
    berkasPimpinans: 0,
    pengajuanBerkass: 0,
    anggota: 0,
    logActivities: 0,
    berkasSPs: 0,
  };

  if (activePeriod) {
    const [
      arsipCount,
      pimpinanCount,
      pengajuanCount,
      anggotaCount,
      logCount,
      spCount,
      perkaderanList,
      pendidikanStats,
    ] = await Promise.all([
      prisma.arsipSurat.count({
        where: { userId, periodeId: activePeriod.id },
      }),
      prisma.berkasPimpinan.count({
        where: { userId, periodeId: activePeriod.id },
      }),
      prisma.pengajuanBerkas.count({
        where: { userId, periodeIdPac: activePeriod.id },
      }),
      prisma.anggota.count({
        where: { userId, periodeId: activePeriod.id },
      }),
      prisma.logActivity.count({
        where: { userId, periodeId: activePeriod.id },
      }),
      prisma.berkasSP.count({
        where: { userId, periodeId: activePeriod.id },
      }),
      prisma.perkaderan.findMany({
        where: {
          anggota: {
            userId,
            periodeId: activePeriod.id,
          },
        },
        select: {
          namaPerkaderan: true,
        },
      }),
      prisma.anggota.groupBy({
        by: ["jenjangPendidikan"],
        where: {
          userId,
          periodeId: activePeriod.id,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    stats = {
      arsipSurats: arsipCount,
      berkasPimpinans: pimpinanCount,
      pengajuanBerkass: pengajuanCount,
      anggota: anggotaCount,
      logActivities: logCount,
      berkasSPs: spCount,
    };

    // Perkaderan Counts
    const perkaderanCounts: { [key: string]: number } = {
      Makesta: 0,
      Lakmud: 0,
      Latin: 0,
      Latpel: 0,
      Lakut: 0,
      Diklatama: 0,
      Diklatmad: 0,
    };

    (perkaderanList as any[]).forEach((p) => {
      const decrypted = decryptText(p.namaPerkaderan).toUpperCase();
      if (decrypted === "MAKESTA") perkaderanCounts["Makesta"]++;
      else if (decrypted === "LAKMUD") perkaderanCounts["Lakmud"]++;
      else if (decrypted === "LATIN") perkaderanCounts["Latin"]++;
      else if (decrypted === "LATPEL") perkaderanCounts["Latpel"]++;
      else if (decrypted === "LAKUT") perkaderanCounts["Lakut"]++;
      else if (decrypted === "DIKLATAMA") perkaderanCounts["Diklatama"]++;
      else if (decrypted === "DIKLATMAD") perkaderanCounts["Diklatmad"]++;
    });

    // Pendidikan Counts
    const pendidikanCounts: { [key: string]: number } = {
      SD: 0,
      MI: 0,
      SMP: 0,
      MTs: 0,
      SMA: 0,
      SMK: 0,
      MAN: 0,
      KULIAH: 0,
    };

    (pendidikanStats as any[]).forEach((p: any) => {
      if (
        p.jenjangPendidikan &&
        pendidikanCounts.hasOwnProperty(p.jenjangPendidikan)
      ) {
        pendidikanCounts[p.jenjangPendidikan] = p._count.id;
      }
    });

    (stats as any).perkaderanCounts = perkaderanCounts;
    (stats as any).pendidikanCounts = pendidikanCounts;
  }

  // Fetch Member Info if exists (to get profile's Perkaderan)
  const member = await prisma.anggota.findFirst({
    where: { email: user.email },
    include: {
      perkaderans: {
        orderBy: { tanggal: "desc" },
      },
    },
  });

  return {
    ...user,
    totalArsip: stats.arsipSurats,
    totalBerkasPimpinan: stats.berkasPimpinans,
    totalPengajuan: stats.pengajuanBerkass,
    totalAnggota: stats.anggota,
    totalLog: stats.logActivities,
    totalBerkasSP: stats.berkasSPs,
    perkaderanCounts: (stats as any).perkaderanCounts || {
      Makesta: 0,
      Lakmud: 0,
      Latin: 0,
      Latpel: 0,
      Lakut: 0,
      Diklatama: 0,
      Diklatmad: 0,
    },
    pendidikanCounts: (stats as any).pendidikanCounts || {
      SD: 0,
      MI: 0,
      SMP: 0,
      MTs: 0,
      SMA: 0,
      SMK: 0,
      MAN: 0,
      KULIAH: 0,
    },
    periodeAktif: activePeriod?.nama || "Tidak ada periode aktif",
    perkaderans: member?.perkaderans || [],
  };
}

export async function toggleUserStatus(userId: string) {
  const session = await auth();
  if (session?.user?.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return { error: "User tidak ditemukan" };

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  // Log activity (non-blocking)
  createLog(
    "UPDATE",
    "USER",
    `${user.isActive ? "Menonaktifkan" : "Mengaktifkan"} akun user: ${user.name}`,
    userId,
  );

  revalidatePath("/dashboard/manajemen-user", "page");
  revalidatePath("/dashboard", "layout");
  return { success: `Status akun ${user.name} berhasil diubah!` };
}

export async function deleteUser(userId: string) {
  const session = await auth();
  if (session?.user?.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }

  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    // Log activity (non-blocking)
    createLog("DELETE", "USER", `Menghapus user: ${userId}`, userId);

    revalidatePath("/dashboard/manajemen-user", "page");
    revalidatePath("/dashboard", "layout");
    return { success: "User berhasil dihapus secara permanen!" };
  } catch {
    return { error: "Gagal menghapus user." };
  }
}

export async function resetUserPassword(userId: string) {
  const session = await auth();
  if (session?.user?.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }

  try {
    // IMPORTANT: Better Auth stores password in Account table
    // For now, we manually update the Account table with Bcrypt
    // because we already configured Better Auth to support Bcrypt
    // OR we can leave it to the user.
    // Given the previous configuration, let's update the Account table.

    const hashedPassword = await hashPassword("password");

    await prisma.account.updateMany({
      where: {
        userId: userId,
        providerId: "credential",
      },
      data: { password: hashedPassword },
    });

    // Log activity (non-blocking)
    createLog("UPDATE", "USER", `Mereset password user: ${userId}`, userId);

    return { success: "Password berhasil direset menjadi 'password'!" };
  } catch {
    return { error: "Gagal meriset password." };
  }
}

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const rawName = formData.get("name") as string;
    const rawEmail = formData.get("email") as string;
    const rawPassword = formData.get("password") as string;
    const imageFile = formData.get("image") as File | null;

    // Validate inputs
    const ProfileSchema = z.object({
      name: z
        .string()
        .min(2, "Nama minimal 2 karakter")
        .max(100, "Nama maksimal 100 karakter")
        .trim()
        .refine(
          (val) => /^[a-zA-Z0-9\s.',-]+$/.test(val),
          "Nama hanya boleh mengandung huruf, angka, spasi, titik, koma, dan apostrof",
        )
        .transform((val) => val.replace(/\s+/g, " ")),
      email: z
        .string()
        .email("Format email tidak valid")
        .trim()
        .toLowerCase()
        .max(255, "Email terlalu panjang"),
      password: z
        .string()
        .optional()
        .refine(
          (val) => !val || val.length >= 6,
          "Password minimal 6 karakter jika diisi",
        )
        .refine((val) => !val || val.length <= 128, "Password terlalu panjang"),
    });

    const validation = ProfileSchema.safeParse({
      name: rawName,
      email: rawEmail,
      password: rawPassword || undefined,
    });

    if (!validation.success) {
      const errorMap = validation.error.flatten().fieldErrors;
      const firstError = Object.values(errorMap)[0]?.[0];
      return { error: firstError || "Data tidak valid!" };
    }

    const { name, email, password } = validation.data;

    const updateData: Prisma.UserUpdateInput = {
      name,
      email,
    };

    if (password && password.length >= 6) {
      const hashedPassword = await hashPassword(password);
      await prisma.account.updateMany({
        where: {
          userId: session.user.id,
          providerId: "credential",
        },
        data: { password: hashedPassword },
      });
    }

    // Handle Image Upload
    if (imageFile && imageFile instanceof File && imageFile.size > 0) {
      if (imageFile.size > 2 * 1024 * 1024) {
        return { error: "Ukuran gambar maksimal 2MB" };
      }
      // 1. Get existing user to delete old image if needed
      const existingUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { image: true },
      });

      // 2. Process new image
      // 2. Process new image
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // encryptFile now includes GZIP compression
      const encryptedBuffer = encryptFile(buffer);
      const encryptedFilename = generateEncryptedFilename(imageFile.name);

      const r2Key = `profile/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, imageFile.type);
      updateData.image = r2Key;

      // 3. Delete old image from R2 if it exists and is an R2 key
      if (existingUser?.image) {
        const oldImage = existingUser.image;
        const isExternalUrl =
          oldImage.startsWith("http://") || oldImage.startsWith("https://");
        const isDataUrl = oldImage.startsWith("data:");
        // R2 keys look like "profile/filename.enc" — delete them
        if (!isExternalUrl && !isDataUrl) {
          try {
            await deleteFromR2(oldImage);
          } catch (e) {
            console.warn(
              "[updateProfile] Could not delete old image from R2:",
              e,
            );
          }
        }
      }
    }

    // Handle Email Change
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });

    // Handle Email Change Validation
    if (currentUser && email !== currentUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email },
      });

      if (emailTaken) {
        return { error: "Email sudah digunakan oleh pengguna lain." };
      }

      // Reset verification for the new email
      updateData.emailVerified = false;

      // Unlink social accounts (Google) to prevent login via old identity
      await prisma.account.deleteMany({
        where: {
          userId: session.user.id,
          providerId: { not: "credential" },
        },
      });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    // Handle Email Verification Trigger AFTER DB Update
    if (currentUser && email !== currentUser.email) {
      // Trigger verification link for the NEW email in background
      (async () => {
        try {
          await betterAuth.api.sendVerificationEmail({
            body: { email },
          });
        } catch (e) {
          console.error(
            "[updateProfile] Failed to trigger verification email:",
            e,
          );
        }
      })();
    }

    // Log activity (non-blocking)
    createLog("UPDATE", "USER", `Mengupdate profil akun: ${session.user.name}`);

    revalidatePath("/dashboard", "page");
    revalidatePath("/dashboard/profile", "page");
    revalidatePath("/dashboard", "layout");

    // Determine success message
    const successMessage =
      currentUser && email !== currentUser.email
        ? "Profil diperbarui! Silakan cek email baru Anda untuk verifikasi."
        : "Profil berhasil diperbarui!";

    return { success: successMessage };
  } catch (error) {
    console.error("Update profile error:", error);
    return { error: "Gagal memperbarui profil." };
  }
}
