"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { startOfMonth, endOfMonth } from "date-fns";
import {
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
  generateEncryptedFilename,
  generateDownloadToken as createToken,
} from "@/lib/encryption";

import { BerkasPimpinan } from "@prisma/client";
import { createLog } from "@/lib/log-activity";
import { uploadToR2, deleteFromR2, downloadFromR2 } from "@/lib/storage-r2";

/**
 * Get all berkas pimpinan for current user's active periode
 */
export async function getBerkasPimpinans(
  query?: string,
  page: number = 1,
  limit: number = 10,
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

  const whereClause = {
    userId: session.user.id,
    periodeId: targetPeriodeId,
  };

  const isEncryptedSort = sortKey === "nama" || sortKey === "catatan";

  // 1. Optimized Path: No search query and sorting by unencrypted field -> DB Pagination
  if (!query && !isEncryptedSort) {
    const dir = sortDir === "asc" ? "asc" : "desc";
    const [total, berkas] = await Promise.all([
      prisma.berkasPimpinan.count({ where: whereClause }),
      prisma.berkasPimpinan.findMany({
        where: whereClause,
        orderBy: {
          tanggal: sortKey === "tanggal" ? dir : "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const decryptedData = berkas.map((item: BerkasPimpinan) => ({
      ...item,
      nama: decryptText(item.nama),
      catatan: item.catatan ? decryptText(item.catatan) : null,
    }));

    return {
      data: decryptedData,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 2. Search & Encrypted Sort Path: Fetch matches, process in memory
  const allBerkas = await prisma.berkasPimpinan.findMany({
    where: whereClause,
    take: 2000, // Safety limit for in-memory processing
  });

  const decryptedAll = allBerkas.map((item: BerkasPimpinan) => ({
    ...item,
    nama: decryptText(item.nama),
    catatan: item.catatan ? decryptText(item.catatan) : null,
  }));

  let filtered = decryptedAll;
  if (query) {
    const searchLower = query.toLowerCase();
    filtered = decryptedAll.filter(
      (item) =>
        item.nama.toLowerCase().includes(searchLower) ||
        (item.catatan && item.catatan.toLowerCase().includes(searchLower)),
    );
  }

  // Sorting in-memory
  const actualSortKey = sortKey || "tanggal";
  const actualSortDir = sortDir || "desc";

  filtered.sort((a: any, b: any) => {
    let aVal: any;
    let bVal: any;

    if (actualSortKey === "tanggal") {
      aVal = new Date(a.tanggal).getTime();
      bVal = new Date(b.tanggal).getTime();
    } else {
      aVal = (a[actualSortKey] ?? "").toString().toLowerCase();
      bVal = (b[actualSortKey] ?? "").toString().toLowerCase();
    }

    if (aVal < bVal) return actualSortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return actualSortDir === "asc" ? 1 : -1;
    return 0;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paginatedData = filtered.slice(start, start + limit);

  return {
    data: paginatedData,
    total,
    totalPages,
  };
}

/**
 * Get single berkas pimpinan by ID
 */
export async function getBerkasPimpinanById(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const berkas = await prisma.berkasPimpinan.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      periode: true,
    },
  });

  if (!berkas) return null;

  // Decrypt data
  return {
    ...berkas,
    nama: decryptText(berkas.nama),
    catatan: berkas.catatan ? decryptText(berkas.catatan) : null,
  };
}

/**
 * Create new Berkas Pimpinan
 */
export async function createBerkasPimpinan(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  // Get active periode
  const periodeAktif = await prisma.periode.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
  });

  if (!periodeAktif) {
    return {
      error:
        "Tidak ada periode aktif. Silakan aktifkan periode terlebih dahulu.",
    };
  }

  // Extract form data
  const nama = formData.get("nama") as string;
  const tanggal = new Date(formData.get("tanggal") as string);
  const catatan = formData.get("catatan") as string;
  const file = formData.get("file") as File | null;

  if (!nama) return { error: "Nama harus diisi" };
  if (!formData.get("tanggal")) return { error: "Tanggal harus diisi" };
  if (!file || file.size === 0) return { error: "File harus diunggah" };
  if (file.size > 5 * 1024 * 1024) return { error: "Ukuran file maksimal 5MB" };

  // Handle file upload and encryption
  let encryptedFilePath: string | null = null;
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Encrypt file
    const encryptedBuffer = encryptFile(buffer);
    const encryptedFilename = generateEncryptedFilename(file.name);

    const r2Key = `berkas-pimpinan/${encryptedFilename}`;
    await uploadToR2(encryptedBuffer, r2Key, file.type);
    encryptedFilePath = r2Key;
  } catch (error) {
    console.error("Error saving file:", error);
    return { error: "Gagal menyimpan file lampiran" };
  }

  try {
    const berkas = await prisma.berkasPimpinan.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        nama: encryptText(nama),
        tanggal,
        catatan: catatan ? encryptText(catatan) : null,
        file: encryptedFilePath,
      },
    });
    revalidatePath("/dashboard/berkas-pimpinan", "page");

    // Log activity
    createLog(
      "CREATE",
      "BERKAS_PIMPINAN",
      `Membuat berkas pimpinan: ${nama}`,
      berkas.id,
    );

    return { success: "Berkas berhasil dibuat!", data: berkas };
  } catch (error) {
    console.error("Database error:", error);
    return { error: `Gagal menyimpan: ${(error as Error).message}` };
  }
}

/**
 * Update Berkas Pimpinan
 */
export async function updateBerkasPimpinan(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const existing = await prisma.berkasPimpinan.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return { error: "Berkas tidak ditemukan" };

    const nama = formData.get("nama") as string;
    const tanggal = new Date(formData.get("tanggal") as string);
    const catatan = formData.get("catatan") as string;
    const file = formData.get("file") as File | null;

    if (!nama) return { error: "Nama harus diisi" };
    if (!formData.get("tanggal")) return { error: "Tanggal harus diisi" };

    let encryptedFilePath = existing.file;
    if (file && file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return { error: "Ukuran file maksimal 5MB" };
      }
      if (existing.file && !existing.file.startsWith("/storage")) {
        try {
          await deleteFromR2(existing.file);
        } catch (e) {
          console.error("Error deleting old file:", e);
        }
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const encryptedBuffer = encryptFile(buffer);
      const encryptedFilename = generateEncryptedFilename(file.name);

      const r2Key = `berkas-pimpinan/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);
      encryptedFilePath = r2Key;
    }

    await prisma.berkasPimpinan.update({
      where: { id },
      data: {
        nama: encryptText(nama),
        tanggal,
        catatan: catatan ? encryptText(catatan) : null,
        file: encryptedFilePath,
      },
    });

    revalidatePath("/dashboard/berkas-pimpinan", "page");
    revalidatePath(`/dashboard/berkas-pimpinan/${id}`, "page");

    // Log activity
    createLog(
      "UPDATE",
      "BERKAS_PIMPINAN",
      `Mengupdate berkas pimpinan: ${nama}`,
      id,
    );

    return { success: "Berkas berhasil diperbarui!" };
  } catch (error) {
    console.error("Update error:", error);
    return { error: "Gagal memperbarui Berkas" };
  }
}

/**
 * Delete Berkas Pimpinan
 */
export async function deleteBerkasPimpinan(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const berkas = await prisma.berkasPimpinan.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!berkas) return { error: "Berkas tidak ditemukan" };

    // Only delete from R2 if it's a new style path
    if (berkas.file && !berkas.file.startsWith("/storage")) {
      try {
        await deleteFromR2(berkas.file);
      } catch (e) {
        console.error("Error deleting file:", e);
      }
    }

    const namaDecrypted = decryptText(berkas.nama);

    await prisma.berkasPimpinan.delete({
      where: { id },
    });

    // Log activity
    createLog(
      "DELETE",
      "BERKAS_PIMPINAN",
      `Menghapus berkas pimpinan: ${namaDecrypted}`,
      id,
    );

    revalidatePath("/dashboard/berkas-pimpinan", "page");
    return { success: "Berkas berhasil dihapus!" };
  } catch (error) {
    console.error("Delete error:", error);
    return { error: "Gagal menghapus Berkas" };
  }
}

/**
 * Download and decrypt file
 */
export async function downloadBerkasPimpinanFile(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const berkas = await prisma.berkasPimpinan.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!berkas || !berkas.file) throw new Error("File tidak ditemukan");

  let encryptedBuffer: Buffer;
  if (berkas.file.startsWith("/storage")) {
    throw new Error("File legacy (Lokal) tidak dapat didownload di Cloud");
  } else {
    encryptedBuffer = await downloadFromR2(berkas.file);
  }

  return decryptFile(encryptedBuffer);
}

/**
 * Bulk import berkas pimpinan dari Excel (tanpa file lampiran)
 */
export async function bulkImportBerkasPimpinan(
  rows: Array<{
    nama: string;
    tanggal: string;
    catatan?: string;
  }>,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const periodeAktif = await prisma.periode.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!periodeAktif)
    return {
      error: "Tidak ada periode aktif. Aktifkan periode terlebih dahulu.",
    };

  let success = 0;
  let failed = 0;
  const failedRows: string[] = [];
  const dataToInsert: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `Baris ${i + 2}`;

    try {
      if (!row.nama?.trim() || !row.tanggal?.trim()) {
        failed++;
        failedRows.push(`${rowLabel}: Nama atau Tanggal kosong`);
        continue;
      }

      const dateObj = parseFlexibleDate(row.tanggal);
      if (!dateObj) {
        failed++;
        failedRows.push(`${rowLabel}: Format tanggal tidak valid`);
        continue;
      }

      dataToInsert.push({
        userId: session.user.id,
        periodeId: periodeAktif.id,
        nama: encryptText(row.nama.trim()),
        tanggal: dateObj,
        catatan: row.catatan ? encryptText(row.catatan.trim()) : null,
      });
    } catch (err) {
      failed++;
      failedRows.push(`${rowLabel}: Internal error`);
    }
  }

  if (dataToInsert.length > 0) {
    try {
      await prisma.berkasPimpinan.createMany({
        data: dataToInsert,
      });
      success = dataToInsert.length;
      createLog(
        "CREATE",
        "BERKAS_PIMPINAN",
        `Import Excel: ${success} berkas pimpinan berhasil diimport`,
      );
      revalidatePath("/dashboard/berkas-pimpinan", "page");
    } catch (err) {
      console.error("Bulk insert error Berkas Pimpinan:", err);
      return { error: "Gagal menyimpan data ke database." };
    }
  }

  return { success, failed, failedRows };
}

function parseFlexibleDate(raw: string): Date | null {
  let s = raw.trim().replace(/^[a-zA-Z]+,\s*/, "");

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);

  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split("/");
    return new Date(`${y}-${m}-${d}`);
  }

  const BULAN: Record<string, string> = {
    januari: "01",
    februari: "02",
    maret: "03",
    april: "04",
    mei: "05",
    juni: "06",
    juli: "07",
    agustus: "08",
    september: "09",
    oktober: "10",
    november: "11",
    desember: "12",
  };

  const parts = s.toLowerCase().split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = BULAN[parts[1]];
    const year = parts[2];
    if (month) {
      const d = new Date(`${year}-${month}-${day}`);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Get statistics for berkas pimpinan
 */
export async function getBerkasPimpinanStats() {
  const session = await auth();
  if (!session?.user?.id) return null;

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

  if (!targetPeriodeId) return null;

  const whereBase = {
    userId: session.user.id,
    periodeId: targetPeriodeId,
  };

  const now = new Date();

  const [total, bulanIni] = await Promise.all([
    prisma.berkasPimpinan.count({ where: whereBase }),
    prisma.berkasPimpinan.count({
      where: {
        ...whereBase,
        tanggal: {
          gte: startOfMonth(now),
          lte: endOfMonth(now),
        },
      },
    }),
  ]);

  return {
    total,
    bulanIni,
  };
}

/**
 * Get a temporary download token for a berkas pimpinan file
 */
export async function getBerkasPimpinanDownloadToken(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Check if user owns this berkas
  const berkas = await prisma.berkasPimpinan.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!berkas) throw new Error("Berkas tidak ditemukan");

  return createToken(id);
}
