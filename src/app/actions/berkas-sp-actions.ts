"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
  generateEncryptedFilename,
  generateDownloadToken as createToken,
} from "@/lib/encryption";

import { BerkasSP, Organisasi, Prisma } from "@prisma/client";
import { createLog } from "@/lib/log-activity";
import { uploadToR2, deleteFromR2, downloadFromR2 } from "@/lib/storage-r2";

// Type for form data
export type BerkasSPFormData = {
  nama: string;
  organisasi: Organisasi | null;
  tanggalMulai: Date;
  tanggalBerakhir: Date;
  catatan?: string;
  file: File;
};

/**
 * Get all berkas SP for current user's active periode
 */
export async function getBerkasSPs(
  query?: string,
  organisasiFilter?: string,
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

  const whereClause: Prisma.BerkasSPWhereInput = {
    userId: session.user.id,
    periodeId: targetPeriodeId,
  };

  // Add DB-level organisation filter if possible (unencrypted field)
  if (
    organisasiFilter &&
    organisasiFilter !== "ALL" &&
    Object.values(Organisasi).includes(organisasiFilter as Organisasi)
  ) {
    whereClause.organisasi = organisasiFilter as Organisasi;
  }

  const isEncryptedSort = sortKey === "nama" || sortKey === "catatan";

  // 1. Optimized Path: No search query and sorting by unencrypted DB fields -> DB Pagination
  if (!query && !isEncryptedSort) {
    let orderByClause: Prisma.BerkasSPOrderByWithRelationInput = {
      tanggalMulai: "desc",
    };
    if (sortKey) {
      const dir = sortDir === "asc" ? "asc" : "desc";
      if (sortKey === "tanggalMulai") orderByClause = { tanggalMulai: dir };
      else if (sortKey === "tanggalBerakhir" || sortKey === "status")
        orderByClause = { tanggalBerakhir: dir };
      else if (sortKey === "organisasi") orderByClause = { organisasi: dir };
    }

    const [total, berkasSps] = await Promise.all([
      prisma.berkasSP.count({ where: whereClause }),
      prisma.berkasSP.findMany({
        where: whereClause,
        orderBy: orderByClause,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const decryptedData = berkasSps.map((berkas: BerkasSP) => ({
      ...berkas,
      nama: decryptText(berkas.nama),
      catatan: berkas.catatan ? decryptText(berkas.catatan) : null,
    }));

    return {
      data: decryptedData,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 2. Search / Encrypted Sort Path: Fetch all matching org, decrypt, filter by query, sort in-memory, manually paginate
  const allBerkas = await prisma.berkasSP.findMany({
    where: whereClause,
    take: 2000, // Safety limit for in-memory processing
  });

  const decryptedAll = allBerkas.map((berkas: BerkasSP) => ({
    ...berkas,
    nama: decryptText(berkas.nama),
    catatan: berkas.catatan ? decryptText(berkas.catatan) : null,
  }));

  let filtered = decryptedAll;
  if (query) {
    const searchLower = query.toLowerCase();
    filtered = decryptedAll.filter(
      (item) =>
        item.nama.toLowerCase().includes(searchLower) ||
        (item.catatan && item.catatan.toLowerCase().includes(searchLower)) ||
        (item.organisasi &&
          item.organisasi.toLowerCase().includes(searchLower)),
    );
  }

  // Sorting in-memory
  const actualSortKey =
    sortKey === "status" ? "tanggalBerakhir" : sortKey || "tanggalMulai";
  const actualSortDir = sortDir || "desc";

  filtered.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (
      actualSortKey === "tanggalMulai" ||
      actualSortKey === "tanggalBerakhir"
    ) {
      aVal = new Date(a[actualSortKey]).getTime();
      bVal = new Date(b[actualSortKey]).getTime();
    } else {
      aVal = (a[actualSortKey as keyof typeof a] ?? "")
        .toString()
        .toLowerCase();
      bVal = (b[actualSortKey as keyof typeof b] ?? "")
        .toString()
        .toLowerCase();
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
 * Get statistics for berkas SP
 */
export async function getBerkasSPStats() {
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

  if (!targetPeriodeId) {
    return {
      total: 0,
      ipnu: 0,
      ippnu: 0,
    };
  }

  const [total, ipnu, ippnu] = await Promise.all([
    prisma.berkasSP.count({
      where: {
        userId: session.user.id,
        periodeId: targetPeriodeId,
      },
    }),
    prisma.berkasSP.count({
      where: {
        userId: session.user.id,
        periodeId: targetPeriodeId,
        organisasi: "IPNU",
      },
    }),
    prisma.berkasSP.count({
      where: {
        userId: session.user.id,
        periodeId: targetPeriodeId,
        organisasi: "IPPNU",
      },
    }),
  ]);

  return {
    total,
    ipnu,
    ippnu,
  };
}

/**
 * Get single berkas SP by ID
 */
export async function getBerkasSPById(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const berkas = await prisma.berkasSP.findFirst({
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
 * Create new Berkas SP
 */
export async function createBerkasSP(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_CABANG") {
    return { error: "Hanya Sekretaris Cabang yang dapat membuat Berkas SP" };
  }

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
  const rawOrganisasi = formData.get("organisasi")?.toString();
  const organisasi = rawOrganisasi as Organisasi | null;
  const nama = formData.get("nama") as string;
  const tanggalMulai = new Date(formData.get("tanggalMulai") as string);
  const tanggalBerakhir = new Date(formData.get("tanggalBerakhir") as string);
  const catatan = formData.get("catatan") as string;
  const file = formData.get("file") as File | null;

  if (!organisasi) {
    return { error: "Organisasi harus dipilih" };
  }

  if (!nama) {
    return { error: "Nama pimpinan harus diisi" };
  }

  // Handle file upload and encryption
  let encryptedFilePath: string | null = null;
  if (file && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) {
      return { error: "Ukuran file maksimal 2MB" };
    }
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Encrypt file
      const encryptedBuffer = encryptFile(buffer);
      const encryptedFilename = generateEncryptedFilename(file.name);

      const r2Key = `berkas-sp/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);
      encryptedFilePath = r2Key;
    } catch (error) {
      console.error("Error saving file:", error);
      return { error: "Gagal menyimpan file lampiran" };
    }
  }

  // Encrypt sensitive data
  const encryptedData = {
    userId: session.user.id,
    periodeId: periodeAktif.id,
    organisasi: organisasi as Organisasi,
    nama: encryptText(nama),
    tanggalMulai,
    tanggalBerakhir,
    catatan: catatan ? encryptText(catatan) : null,
    file: encryptedFilePath,
  };

  try {
    const berkas = await prisma.berkasSP.create({
      data: encryptedData,
    });
    revalidatePath("/dashboard/berkas-sp", "page");

    revalidatePath("/dashboard/berkas-sp", "page");

    // Log activity
    createLog("CREATE", "BERKAS_SP", `Membuat berkas SP: ${nama}`, berkas.id);

    return { success: "Berkas SP berhasil dibuat!", data: berkas };
  } catch (error) {
    console.error("Database error:", error);
    return { error: `Gagal menyimpan: ${(error as Error).message}` };
  }
}

/**
 * Update Berkas SP
 */
export async function updateBerkasSP(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const existing = await prisma.berkasSP.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return { error: "Berkas SP tidak ditemukan" };

    const rawOrganisasi = formData.get("organisasi")?.toString();
    const organisasi = rawOrganisasi as Organisasi | null;
    const nama = formData.get("nama") as string;
    const tanggalMulai = new Date(formData.get("tanggalMulai") as string);
    const tanggalBerakhir = new Date(formData.get("tanggalBerakhir") as string);
    const catatan = formData.get("catatan") as string;
    const file = formData.get("file") as File | null;

    if (!organisasi) {
      return { error: "Organisasi harus dipilih" };
    }

    if (!nama) {
      return { error: "Nama pimpinan harus diisi" };
    }

    let encryptedFilePath = existing.file;
    if (file && file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) {
        return { error: "Ukuran file maksimal 2MB" };
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

      const r2Key = `berkas-sp/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);
      encryptedFilePath = r2Key;
    }

    await prisma.berkasSP.update({
      where: { id },
      data: {
        organisasi,
        nama: encryptText(nama),
        tanggalMulai,
        tanggalBerakhir,
        catatan: catatan ? encryptText(catatan) : null,
        file: encryptedFilePath,
      },
    });

    revalidatePath("/dashboard/berkas-sp", "page");
    revalidatePath(`/dashboard/berkas-sp/${id}`, "page");

    // Log activity
    createLog("UPDATE", "BERKAS_SP", `Mengupdate berkas SP: ${nama}`, id);

    return { success: "Berkas SP berhasil diperbarui!" };
  } catch (error) {
    console.error("Update error:", error);
    return { error: "Gagal memperbarui Berkas SP" };
  }
}

/**
 * Delete Berkas SP
 */
export async function deleteBerkasSP(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const berkas = await prisma.berkasSP.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!berkas) return { error: "Berkas SP tidak ditemukan" };

    if (berkas.file && !berkas.file.startsWith("/storage")) {
      try {
        await deleteFromR2(berkas.file);
      } catch (e) {
        console.error("Error deleting file:", e);
      }
    }

    const namaDecrypted = decryptText(berkas.nama);

    await prisma.berkasSP.delete({
      where: { id },
    });

    // Log activity
    createLog(
      "DELETE",
      "BERKAS_SP",
      `Menghapus berkas SP: ${namaDecrypted}`,
      id,
    );

    revalidatePath("/dashboard/berkas-sp", "page");
    return { success: "Berkas SP berhasil dihapus!" };
  } catch (error) {
    console.error("Delete error:", error);
    return { error: "Gagal menghapus Berkas SP" };
  }
}

/**
 * Download and decrypt file
 */
export async function downloadBerkasSPFile(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const berkas = await prisma.berkasSP.findFirst({
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
 * Bulk import berkas SP dari Excel (tanpa file lampiran)
 */
export async function bulkImportBerkasSP(
  rows: Array<{
    nama: string;
    organisasi?: string;
    tanggalMulai: string;
    tanggalBerakhir: string;
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
      if (
        !row.nama?.trim() ||
        !row.tanggalMulai?.trim() ||
        !row.tanggalBerakhir?.trim()
      ) {
        failed++;
        failedRows.push(`${rowLabel}: Ada kolom wajib yang kosong`);
        continue;
      }

      const dateMulai = parseFlexibleDate(row.tanggalMulai);
      const dateBerakhir = parseFlexibleDate(row.tanggalBerakhir);

      if (!dateMulai || !dateBerakhir) {
        failed++;
        failedRows.push(`${rowLabel}: Format tanggal tidak valid`);
        continue;
      }

      let organisasi: Organisasi = Organisasi.IPNU;
      if (row.organisasi) {
        const orgMatch = Object.values(Organisasi).find(
          (o) => o.toLowerCase() === row.organisasi?.toLowerCase(),
        );
        if (orgMatch) organisasi = orgMatch;
      }

      dataToInsert.push({
        userId: session.user.id,
        periodeId: periodeAktif.id,
        organisasi,
        nama: encryptText(row.nama.trim()),
        tanggalMulai: dateMulai,
        tanggalBerakhir: dateBerakhir,
        catatan: row.catatan ? encryptText(row.catatan.trim()) : null,
      });
    } catch (err) {
      failed++;
      failedRows.push(`${rowLabel}: Internal error`);
    }
  }

  if (dataToInsert.length > 0) {
    try {
      await prisma.berkasSP.createMany({
        data: dataToInsert,
      });
      success = dataToInsert.length;
      createLog(
        "CREATE",
        "BERKAS_SP",
        `Import Excel: ${success} berkas SP berhasil diimport`,
      );
      revalidatePath("/dashboard/berkas-sp", "page");
    } catch (err) {
      console.error("Bulk insert error Berkas SP:", err);
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
 * Get a temporary download token for a berkas SP file
 */
export async function getBerkasSPDownloadToken(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Check if user owns this berkas
  const berkas = await prisma.berkasSP.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!berkas) throw new Error("Berkas tidak ditemukan");

  return createToken(id);
}
