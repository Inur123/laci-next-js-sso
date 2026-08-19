"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Prisma, JenisWilayah } from "@prisma/client";
import { createLog } from "@/lib/log-activity";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * Get List of Wilayah with Pagination and Search
 */
export async function getWilayahList(
  jenis: JenisWilayah,
  query?: string,
  page: number = 1,
  limit: number = 10,
  userIdFilter?: string,
  periodeId?: string,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cookieStore = await cookies();
  const viewPeriodeId = cookieStore.get("view_periode_id")?.value;
  
  let targetPeriodeId = viewPeriodeId;
  
  if (!targetPeriodeId) {
    const periodeAktif = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
    });
    targetPeriodeId = periodeAktif?.id;
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isCabang = currentUser?.role === "SEKRETARIS_CABANG";
  let whereClause: Prisma.WilayahWhereInput = { jenis };

  if (!isCabang) {
    const effectivePeriodeId = periodeId || targetPeriodeId;
    if (!effectivePeriodeId) return { data: [], total: 0, totalPages: 0 };
    whereClause = { ...whereClause, userId: session.user.id, periodeId: effectivePeriodeId };
  } else {
    // For Cabang, filter by period name across PACs if needed
    const finalPeriodeId = periodeId || targetPeriodeId;
    let targetPeriodeNama: string | undefined;

    if (finalPeriodeId) {
      const selectedPeriode = await prisma.periode.findUnique({
        where: { id: finalPeriodeId },
        select: { nama: true },
      });
      targetPeriodeNama = selectedPeriode?.nama;
    }

    if (targetPeriodeNama) {
      whereClause.periode = { nama: targetPeriodeNama };
    }
    
    if (userIdFilter && userIdFilter !== "ALL") {
      whereClause.userId = userIdFilter;
    }
  }

  if (query) {
    whereClause.OR = [
      { nama: { contains: query, mode: "insensitive" } },
      { ketua: { contains: query, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.WilayahOrderByWithRelationInput = sortKey
    ? { [sortKey]: sortDir || "asc" }
    : { createdAt: "desc" };

  const [total, data] = await Promise.all([
    prisma.wilayah.count({ where: whereClause }),
    prisma.wilayah.findMany({
      where: whereClause,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { name: true } },
      },
    }),
  ]);

  return {
    data,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createWilayah(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const periodeAktif = await prisma.periode.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!periodeAktif)
    return { error: "Silakan aktifkan periode terlebih dahulu." };

  const jenis = formData.get("jenis") as JenisWilayah;
  const nama = formData.get("nama") as string;
  const ketua = formData.get("ketua") as string;
  const kontak = formData.get("kontak") as string;
  const alamat = formData.get("alamat") as string;

  if (!nama || !nama.trim()) return { error: "Nama Wilayah wajib diisi" };

  try {
    const wilayah = await prisma.wilayah.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        jenis,
        nama,
        ketua: ketua || null,
        kontak: kontak || null,
        alamat: alamat || null,
      },
    });

    createLog(
      "CREATE",
      "WILAYAH",
      `Menambahkan ${jenis === "RANTING" ? "Ranting" : "PK"} baru: ${nama}`,
      session.user.id,
    );

    revalidatePath(`/dashboard/wilayah/${jenis.toLowerCase()}`);
    return { success: true, data: wilayah };
  } catch (error) {
    console.error("Error creating wilayah:", error);
    return { error: "Terjadi kesalahan sistem saat menyimpan data." };
  }
}

export async function updateWilayah(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const existing = await prisma.wilayah.findUnique({ where: { id } });
  if (!existing) return { error: "Data tidak ditemukan" };
  if (existing.userId !== session.user.id) return { error: "Unauthorized" };

  const nama = formData.get("nama") as string;
  const ketua = formData.get("ketua") as string;
  const kontak = formData.get("kontak") as string;
  const alamat = formData.get("alamat") as string;

  if (!nama || !nama.trim()) return { error: "Nama Wilayah wajib diisi" };

  try {
    const updated = await prisma.wilayah.update({
      where: { id },
      data: {
        nama,
        ketua: ketua || null,
        kontak: kontak || null,
        alamat: alamat || null,
      },
    });

    createLog(
      "UPDATE",
      "WILAYAH",
      `Memperbarui data ${existing.jenis === "RANTING" ? "Ranting" : "PK"}: ${nama}`,
      session.user.id,
    );

    revalidatePath(`/dashboard/wilayah/${existing.jenis.toLowerCase()}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating wilayah:", error);
    return { error: "Terjadi kesalahan sistem saat memperbarui data." };
  }
}

export async function deleteWilayah(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const existing = await prisma.wilayah.findUnique({ where: { id } });
  if (!existing) return { error: "Data tidak ditemukan" };
  if (existing.userId !== session.user.id) return { error: "Unauthorized" };

  try {
    await prisma.wilayah.delete({ where: { id } });

    createLog(
      "DELETE",
      "WILAYAH",
      `Menghapus data ${existing.jenis === "RANTING" ? "Ranting" : "PK"}: ${existing.nama}`,
      session.user.id,
    );

    revalidatePath(`/dashboard/wilayah/${existing.jenis.toLowerCase()}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting wilayah:", error);
    return { error: "Terjadi kesalahan sistem saat menghapus data." };
  }
}

/**
 * Copy wilayah to current period
 */
export async function copyWilayahToCurrentPeriode(wilayahIds: string[], jenis: JenisWilayah) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const periodeAktif = await prisma.periode.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!periodeAktif)
    return { error: "Silakan aktifkan periode tujuan terlebih dahulu." };

  try {
    const sourceWilayah = await prisma.wilayah.findMany({
      where: { id: { in: wilayahIds }, jenis },
    });

    const createdCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const item of sourceWilayah) {
        if (item.periodeId === periodeAktif.id) continue;
        await tx.wilayah.create({
          data: {
            userId: session.user.id,
            periodeId: periodeAktif.id,
            jenis: item.jenis,
            nama: item.nama,
            ketua: item.ketua,
            kontak: item.kontak,
            alamat: item.alamat,
          },
        });
        count++;
      }
      return count;
    });

    createLog(
      "CREATE",
      "WILAYAH",
      `Menyalin ${createdCount} data ${jenis === "RANTING" ? "Ranting" : "PK"} ke periode: ${periodeAktif.nama}`,
      session.user.id,
    );

    revalidatePath(`/dashboard/wilayah/${jenis.toLowerCase()}`);
    return { success: `Berhasil menyalin ${createdCount} data ${jenis === "RANTING" ? "Ranting" : "PK"}.` };
  } catch (error) {
    console.error("Error copying wilayah:", error);
    return { error: "Terjadi kesalahan sistem saat menyalin data." };
  }
}
