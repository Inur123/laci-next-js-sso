"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { encryptText, decryptText } from "@/lib/encryption";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { createLog } from "@/lib/log-activity";

export type KegiatanFormData = {
  judul: string;
  deskripsi?: string;
  lokasi?: string;
  warna: string;
  tanggalMulai: Date;
  tanggalSelesai?: Date;
};

// Helper to compute status
const computeStatus = (mulai: Date, selesai: Date | null) => {
  const now = new Date();
  if (now < mulai) return "MENDATANG";
  if (selesai && now > selesai) return "SELESAI";
  if (!selesai && now.getDate() !== mulai.getDate() && now > mulai)
    return "SELESAI"; // Assume single day event ends next day? Or just simple comparison
  // If no end date, and start date is past, strictly speaking it's done, unless it's "today".
  // Let's keep it simple: if single day, checks if today.

  // Revised logic based on "Mendatang" vs "Selesai" (and "Berlangsung")
  if (selesai) {
    if (now >= mulai && now <= selesai) return "BERLANGSUNG";
  } else {
    // If no end date, assume 1 day duration for status calculation
    const endOfDay = new Date(mulai);
    endOfDay.setHours(23, 59, 59, 999);
    if (now >= mulai && now <= endOfDay) return "BERLANGSUNG";
  }

  return now < mulai ? "MENDATANG" : "SELESAI";
};

/**
 * Get all kegiatan for current user's active periode
 */
export async function getAgendaKegiatanList(
  query?: string,
  page: number = 1,
  limit: number = 10,
  statusFilter?: string,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Get active or selected view periode
  const cookieStore = await cookies();
  const viewPeriodeId = cookieStore.get("view_periode_id")?.value;
  
  let targetPeriodeId = viewPeriodeId;
  
  if (!targetPeriodeId) {
    const periodeAktif = await prisma.periode.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });
    targetPeriodeId = periodeAktif?.id;
  }

  if (!targetPeriodeId) return { data: [], total: 0, totalPages: 0 };

  const whereClause: Prisma.AgendaKegiatanWhereInput = {
    userId: session.user.id,
    periodeId: targetPeriodeId,
  };

  const isCustomSort =
    sortKey === "judul" || sortKey === "lokasi" || sortKey === "status";

  // 1. Optimized Path: No search, no status filter, and unencrypted sort -> DB Pagination (Fast)
  if (!query && (!statusFilter || statusFilter === "ALL") && !isCustomSort) {
    const dir = sortDir === "asc" ? "asc" : "desc";
    const actualSort = sortKey === "tanggalMulai" ? "tanggalMulai" : "createdAt";

    const total = await prisma.agendaKegiatan.count({ where: whereClause });
    const kegiatanList = await prisma.agendaKegiatan.findMany({
      where: whereClause,
      orderBy: { [actualSort]: dir },
      skip: (page - 1) * limit,
      take: limit,
    });

    const paginatedData = kegiatanList.map((item) => ({
      ...item,
      judul: decryptText(item.judul),
      deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
      lokasi: item.lokasi ? decryptText(item.lokasi) : null,
      status: computeStatus(item.tanggalMulai, item.tanggalSelesai),
    }));

    return {
      data: paginatedData,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 2. Search/Filter/Custom Sort Path: Fetch all, decrypt, filter, sort globally, paginate
  const allKegiatan = await prisma.agendaKegiatan.findMany({
    where: whereClause,
    orderBy: {
      createdAt: "desc",
    },
    take: 2000, // Safety limit for global sorting
  });

  // Decrypt and compute status
  let filteredData = allKegiatan.map((item) => ({
    ...item,
    judul: decryptText(item.judul),
    deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
    lokasi: item.lokasi ? decryptText(item.lokasi) : null,
    status: computeStatus(item.tanggalMulai, item.tanggalSelesai),
  }));

  // Apply Query Filter
  if (query) {
    const lowerQuery = query.toLowerCase();
    filteredData = filteredData.filter(
      (item) =>
        item.judul.toLowerCase().includes(lowerQuery) ||
        (item.deskripsi && item.deskripsi.toLowerCase().includes(lowerQuery)) ||
        (item.lokasi && item.lokasi.toLowerCase().includes(lowerQuery)),
    );
  }

  // Apply Status Filter
  if (statusFilter && statusFilter !== "ALL") {
    filteredData = filteredData.filter((item) => item.status === statusFilter);
  }

  // Apply Global Sorting
  if (sortKey) {
    const isAsc = sortDir === "asc";
    filteredData.sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;
      if (sortKey === "tanggalMulai") {
        aVal = new Date(a.tanggalMulai).getTime();
        bVal = new Date(b.tanggalMulai).getTime();
      } else {
        aVal = (a[sortKey] || "").toString().toLowerCase();
        bVal = (b[sortKey] || "").toString().toLowerCase();
      }
      if (aVal < bVal) return isAsc ? -1 : 1;
      if (aVal > bVal) return isAsc ? 1 : -1;
      return 0;
    });
  }

  // Pagination
  const total = filteredData.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = filteredData.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get single kegiatan
 */
export async function getKegiatanById(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const item = await prisma.agendaKegiatan.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!item) return null;

  return {
    ...item,
    judul: decryptText(item.judul),
    deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
    lokasi: item.lokasi ? decryptText(item.lokasi) : null,
  };
}

/**
 * Create Kegiatan
 */
export async function createKegiatan(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  if (session.user.role !== "SEKRETARIS_CABANG") {
    return { error: "Akses ditolak. Fitur ini khusus Sekretaris Cabang." };
  }

  const periodeAktif = await prisma.periode.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
  });

  if (!periodeAktif) {
    return {
      error: "Tidak ada periode aktif.",
    };
  }

  const judul = formData.get("judul") as string;
  const deskripsi = formData.get("deskripsi") as string;
  const lokasi = formData.get("lokasi") as string;
  const warna = formData.get("warna") as string;
  const tanggalMulaiStr = formData.get("tanggalMulai") as string;
  const tanggalSelesaiStr = formData.get("tanggalSelesai") as string;

  if (!judul || !tanggalMulaiStr || !warna) {
    return { error: "Data wajib belum diisi lengkap." };
  }

  try {
    const result = await prisma.agendaKegiatan.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        judul: encryptText(judul),
        deskripsi: deskripsi ? encryptText(deskripsi) : null,
        lokasi: lokasi ? encryptText(lokasi) : null,
        warna: warna,
        tanggalMulai: new Date(tanggalMulaiStr),
        tanggalSelesai: tanggalSelesaiStr ? new Date(tanggalSelesaiStr) : null,
      },
    });

    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/agenda-kegiatan", "page");

    // Log activity
    createLog(
      "CREATE",
      "AGENDA_KEGIATAN",
      `Membuat kegiatan: ${judul}`,
      result.id,
    );

    return { success: "Kegiatan berhasil ditambahkan!", data: result };
  } catch (error) {
    console.error("Create kegiatan error:", error);
    return { error: "Gagal menyimpan kegiatan." };
  }
}

/**
 * Update Kegiatan
 */
export async function updateKegiatan(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const judul = formData.get("judul") as string;
  const deskripsi = formData.get("deskripsi") as string;
  const lokasi = formData.get("lokasi") as string;
  const warna = formData.get("warna") as string;
  const tanggalMulaiStr = formData.get("tanggalMulai") as string;
  const tanggalSelesaiStr = formData.get("tanggalSelesai") as string;

  try {
    // Allow user to edit their own data
    await prisma.agendaKegiatan.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        judul: encryptText(judul),
        deskripsi: deskripsi ? encryptText(deskripsi) : null,
        lokasi: lokasi ? encryptText(lokasi) : null,
        warna: warna,
        tanggalMulai: new Date(tanggalMulaiStr),
        tanggalSelesai: tanggalSelesaiStr ? new Date(tanggalSelesaiStr) : null,
      },
    });

    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/agenda-kegiatan", "page");

    // Log activity
    createLog("UPDATE", "AGENDA_KEGIATAN", `Mengupdate kegiatan: ${judul}`, id);

    return { success: "Kegiatan berhasil diperbarui!" };
  } catch (error) {
    console.error("Update kegiatan error:", error);
    return { error: "Gagal memperbarui kegiatan." };
  }
}

/**
 * Delete Kegiatan
 */
export async function deleteKegiatan(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    await prisma.agendaKegiatan.deleteMany({
      where: {
        id,
        userId: session.user.id,
      },
    });

    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/agenda-kegiatan", "page");

    // Log activity
    createLog("DELETE", "AGENDA_KEGIATAN", `Menghapus kegiatan ID: ${id}`, id);

    return { success: "Kegiatan berhasil dihapus." };
  } catch (error) {
    console.error("Delete kegiatan error:", error);
    return { error: "Gagal menghapus kegiatan." };
  }
}

/**
 * Get statistics for kegiatan
 */
export async function getAgendaKegiatanStats() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Get active or selected view periode
  const cookieStore = await cookies();
  const viewPeriodeId = cookieStore.get("view_periode_id")?.value;
  
  let targetPeriodeId = viewPeriodeId;
  
  if (!targetPeriodeId) {
    const periodeAktif = await prisma.periode.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });
    targetPeriodeId = periodeAktif?.id;
  }

  if (!targetPeriodeId) return { total: 0, mendatang: 0, selesai: 0 };

  const now = new Date();

  const [total, mendatang, selesai] = await Promise.all([
    prisma.agendaKegiatan.count({
      where: {
        userId: session.user.id,
        periodeId: targetPeriodeId,
      },
    }),
    prisma.agendaKegiatan.count({
      where: {
        userId: session.user.id,
        periodeId: targetPeriodeId,
        tanggalMulai: { gt: now },
      },
    }),
    prisma.agendaKegiatan.count({
      where: {
        userId: session.user.id,
        periodeId: targetPeriodeId,
        OR: [
          {
            tanggalSelesai: { lt: now }, // Case 1: has end date and it's past
          },
          {
            tanggalSelesai: null,
            tanggalMulai: { lt: now }, // Case 2: no end date and start was past
          },
        ],
      },
    }),
  ]);

  return { total, mendatang, selesai };
}
