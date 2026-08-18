"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";

import { createLog } from "@/lib/log-activity";

export async function createPeriode(nama: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const userId = session.user.id;

  try {
    // Check if user has any periods
    const count = await prisma.periode.count({
      where: { userId },
    });

    const isActive = count === 0;

    const periode = await prisma.periode.create({
      data: {
        nama,
        userId,
        isActive,
      },
    });

    if (isActive) {
      await prisma.user.update({
        where: { id: userId },
        data: { periodeAktifId: periode.id },
      });
      (await cookies()).delete("view_periode_id");
    }

    revalidatePath("/dashboard/periode", "page");
    if (isActive) {
      (revalidateTag as any)("public-stats", "max");
      (revalidateTag as any)("dashboard-stats", "max");
    }

    // Log activity
    createLog("CREATE", "PERIODE", `Membuat periode baru: ${nama}`, periode.id);

    return { success: "Periode berhasil dibuat!", data: periode };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { error: "Nama periode ini sudah ada!" };
    }
    return { error: "Gagal membuat periode." };
  }
}

export async function activatePeriode(periodeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const userId = session.user.id;

  // Verify ownership
  const periode = await prisma.periode.findUnique({
    where: { id: periodeId, userId },
  });

  if (!periode) return { error: "Periode tidak ditemukan" };

  // Set all periods of this user to inactive
  await prisma.periode.updateMany({
    where: { userId },
    data: { isActive: false },
  });

  // Set this one to active
  await prisma.periode.update({
    where: { id: periodeId },
    data: { isActive: true },
  });

  // Update user's active periode ID
  await prisma.user.update({
    where: { id: userId },
    data: { periodeAktifId: periodeId },
  });

  revalidatePath("/dashboard/periode", "page");

  (revalidateTag as any)("public-stats", "max");
  (revalidateTag as any)("dashboard-stats", "max");

  // Log activity
  createLog(
    "UPDATE",
    "PERIODE",
    `Mengaktifkan periode: ${periode.nama}`,
    periodeId,
  );

  return { success: "Periode berhasil diaktifkan!" };
}

export async function deletePeriode(periodeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const userId = session.user.id;

  const periode = await prisma.periode.findUnique({
    where: { id: periodeId, userId },
  });

  if (!periode) return { error: "Periode tidak ditemukan" };
  if (periode.isActive) return { error: "Periode aktif tidak dapat dihapus" };

  await prisma.periode.delete({
    where: { id: periodeId },
  });

  revalidatePath("/dashboard/periode", "page");

  // Log activity
  createLog(
    "DELETE",
    "PERIODE",
    `Menghapus periode: ${periode.nama}`,
    periodeId,
  );

  return { success: "Periode berhasil dihapus!" };
}

export async function getPeriode(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return await prisma.periode.findUnique({
    where: { id, userId: session.user.id },
  });
}

export async function getPeriodes(page: number = 1, limit: number = 100) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return await prisma.periode.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
}

export async function updatePeriode(id: string, nama: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    await prisma.periode.update({
      where: { id, userId: session.user.id },
      data: { nama },
    });

    revalidatePath("/dashboard/periode", "page");

    // Log activity
    createLog(
      "UPDATE",
      "PERIODE",
      `Mengubah nama periode menjadi: ${nama}`,
      id,
    );

    return { success: "Periode berhasil diperbarui!" };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { error: "Nama periode ini sudah ada!" };
    }
    return { error: "Gagal memperbarui periode." };
  }
}
