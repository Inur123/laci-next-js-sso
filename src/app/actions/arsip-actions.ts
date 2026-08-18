"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
  generateEncryptedFilename,
  generateDownloadToken as createToken,
} from "@/lib/encryption";
import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";

// FS Imports Removed
import { Organisasi, JenisSurat, ArsipSurat, Prisma } from "@prisma/client";
import { createLog } from "@/lib/log-activity";
import { uploadToR2, deleteFromR2, downloadFromR2 } from "@/lib/storage-r2";

// Type untuk form data
export type ArsipSuratFormData = {
  organisasi: Organisasi | null;
  noSurat: string;
  jenisSurat: JenisSurat;
  tanggal: Date;
  pengirimPenerima: string;
  deskripsi?: string;
  perihal: string;
  file?: File;
};

/**
 * Get all arsip surat for current user's active periode with filtering
 */
/**
 * Get all arsip surat for current user's active periode with filtering
 */
export async function getArsipSurats(
  query?: string,
  organisasiFilter?: string,
  jenisSuratFilter?: string,
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

  // Build DB filter for non-encrypted fields
  const whereClause: Prisma.ArsipSuratWhereInput = {
    userId: session.user.id,
    periodeId: targetPeriodeId,
  };

  if (
    organisasiFilter &&
    organisasiFilter !== "ALL" &&
    Object.values(Organisasi).includes(organisasiFilter as Organisasi)
  ) {
    whereClause.organisasi = organisasiFilter as Organisasi;
  }

  if (
    jenisSuratFilter &&
    jenisSuratFilter !== "ALL" &&
    Object.values(JenisSurat).includes(jenisSuratFilter as JenisSurat)
  ) {
    whereClause.jenisSurat = jenisSuratFilter as JenisSurat;
  }

  const isEncryptedSort =
    sortKey === "noSurat" ||
    sortKey === "pengirimPenerima" ||
    sortKey === "perihal";

  // OPTIMIZATION: If NO search query and sorting by unencrypted DB fields -> DB Pagination
  if (!query && !isEncryptedSort) {
    let orderByClause: Prisma.ArsipSuratOrderByWithRelationInput = {
      tanggal: "desc",
    };
    if (sortKey) {
      const dir = sortDir === "asc" ? "asc" : "desc";
      if (sortKey === "tanggal") orderByClause = { tanggal: dir };
      else if (sortKey === "organisasi") orderByClause = { organisasi: dir };
      else if (sortKey === "jenisSurat") orderByClause = { jenisSurat: dir };
    }

    const [total, arsipSurats] = await Promise.all([
      prisma.arsipSurat.count({ where: whereClause }),
      prisma.arsipSurat.findMany({
        where: whereClause,
        orderBy: orderByClause,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Decrypt data
    const decryptedArsip = arsipSurats.map((arsip: ArsipSurat) => ({
      ...arsip,
      noSurat: decryptText(arsip.noSurat),
      pengirimPenerima: decryptText(arsip.pengirimPenerima),
      deskripsi: arsip.deskripsi ? decryptText(arsip.deskripsi) : null,
      perihal: decryptText(arsip.perihal),
    }));

    return {
      data: decryptedArsip,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // If query exists or sorting by encrypted fields, we must fetch ALL matches then process in memory
  const arsipSurats = await prisma.arsipSurat.findMany({
    where: whereClause,
    take: 2000, // Safety limit for in-memory processing
  });

  // Decrypt data
  const decryptedArsip = arsipSurats.map((arsip: ArsipSurat) => ({
    ...arsip,
    noSurat: decryptText(arsip.noSurat),
    pengirimPenerima: decryptText(arsip.pengirimPenerima),
    deskripsi: arsip.deskripsi ? decryptText(arsip.deskripsi) : null,
    perihal: decryptText(arsip.perihal),
  }));

  // Filter keys that are encrypted (in-memory) if query exists
  let filtered = decryptedArsip;
  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = decryptedArsip.filter(
      (item: any) =>
        item.noSurat.toLowerCase().includes(lowerQuery) ||
        item.perihal.toLowerCase().includes(lowerQuery) ||
        item.pengirimPenerima.toLowerCase().includes(lowerQuery) ||
        (item.deskripsi && item.deskripsi.toLowerCase().includes(lowerQuery)),
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

  // Manual pagination for processed results
  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = filtered.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get statistics for arsip surat
 */
export async function getArsipStats() {
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

  const [total, masuk, keluar, ipnu, ippnu, bersama, cbpkpp] =
    await Promise.all([
      prisma.arsipSurat.count({ where: whereBase }),
      prisma.arsipSurat.count({
        where: { ...whereBase, jenisSurat: "MASUK" },
      }),
      prisma.arsipSurat.count({
        where: { ...whereBase, jenisSurat: "KELUAR" },
      }),
      prisma.arsipSurat.count({
        where: { ...whereBase, organisasi: "IPNU" },
      }),
      prisma.arsipSurat.count({
        where: { ...whereBase, organisasi: "IPPNU" },
      }),
      prisma.arsipSurat.count({
        where: { ...whereBase, organisasi: "BERSAMA" },
      }),
      prisma.arsipSurat.count({
        where: { ...whereBase, organisasi: "CBP_KPP" as any },
      }),
    ]);

  return {
    total,
    masuk,
    keluar,
    ipnu,
    ippnu,
    bersama,
    cbpkpp,
  };
}

/**
 * Get single arsip surat by ID
 */
export async function getArsipSuratById(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const arsip = await prisma.arsipSurat.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      periode: true,
    },
  });

  if (!arsip) return null;

  // Decrypt data
  return {
    ...arsip,
    noSurat: decryptText(arsip.noSurat),
    pengirimPenerima: decryptText(arsip.pengirimPenerima),
    deskripsi: arsip.deskripsi ? decryptText(arsip.deskripsi) : null,
    perihal: decryptText(arsip.perihal),
  };
}

/**
 * Create new arsip surat with encryption
 */
export async function createArsipSurat(formData: FormData) {
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

  const rawOrganisasi = formData.get("organisasi")?.toString();
  const organisasi = (
    rawOrganisasi ? rawOrganisasi : null
  ) as Organisasi | null;
  const noSurat = formData.get("noSurat") as string;
  const jenisSurat = formData.get("jenisSurat") as JenisSurat;
  const tanggal = new Date(formData.get("tanggal") as string);
  const pengirimPenerima = formData.get("pengirimPenerima") as string;
  const deskripsi = formData.get("deskripsi") as string;
  const perihal = formData.get("perihal") as string;

  if (!organisasi) return { error: "Organisasi harus dipilih" };
  if (!perihal?.trim()) return { error: "Perihal harus diisi" };
  const file = formData.get("file") as File | null;
  if (file && file instanceof File && file.size > 2 * 1024 * 1024) {
    return { error: "Ukuran file maksimal 2MB" };
  }

  // Handle file upload and encryption
  let encryptedFilePath: string | null = null;
  if (file && file instanceof File && file.size > 0) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Encrypt file
    const encryptedBuffer = encryptFile(buffer);
    const encryptedFilename = generateEncryptedFilename(file.name);

    // Upload to R2 (Cloudflare)
    // Path: arsip/<filename>
    const r2Key = `arsip/${encryptedFilename}`;

    try {
      await uploadToR2(encryptedBuffer, r2Key, file.type);
      encryptedFilePath = r2Key;
    } catch (uploadError) {
      console.error("R2 Upload Error:", uploadError);
      return { error: "Gagal mengupload file ke storage cloud" };
    }
  }

  // Encrypt sensitive data
  const encryptedData = {
    userId: session.user.id,
    periodeId: periodeAktif.id,
    organisasi,
    noSurat: encryptText(noSurat),
    jenisSurat,
    tanggal,
    pengirimPenerima: encryptText(pengirimPenerima),
    deskripsi: deskripsi ? encryptText(deskripsi) : null,
    perihal: encryptText(perihal),
    file: encryptedFilePath,
  };

  try {
    const arsip = await prisma.arsipSurat.create({
      data: encryptedData,
    });

    // Log activity
    createLog(
      "CREATE",
      "ARSIP_SURAT",
      `Membuat arsip surat: ${noSurat}`,
      arsip.id,
    );

    revalidatePath("/dashboard/arsip/surat", "page");
    revalidatePath("/dashboard", "layout");

    return { success: "Arsip surat berhasil dibuat!", data: arsip };
  } catch (error) {
    console.error("Database error:", error);
    return { error: `Gagal menyimpan: ${(error as Error).message}` };
  }
}

/**
 * Update arsip surat
 */
export async function updateArsipSurat(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const existing = await prisma.arsipSurat.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return { error: "Arsip surat tidak ditemukan" };

    const rawOrganisasi = formData.get("organisasi")?.toString();
    const organisasi = (
      rawOrganisasi ? rawOrganisasi : null
    ) as Organisasi | null;
    const noSurat = formData.get("noSurat") as string;
    const jenisSurat = formData.get("jenisSurat") as JenisSurat;
    const tanggal = new Date(formData.get("tanggal") as string);
    const pengirimPenerima = formData.get("pengirimPenerima") as string;
    const deskripsi = formData.get("deskripsi") as string;
    const perihal = formData.get("perihal") as string;

    if (!organisasi) return { error: "Organisasi harus dipilih" };
    if (!perihal?.trim()) return { error: "Perihal harus diisi" };
    const file = formData.get("file") as File | null;
    if (file && file instanceof File && file.size > 2 * 1024 * 1024) {
      return { error: "Ukuran file maksimal 2MB" };
    }

    let encryptedFilePath = existing.file;
    if (file && file instanceof File && file.size > 0) {
      if (existing.file) {
        // Old file deletion logic
        try {
          // If it's a new R2 path (simple string), delete from R2
          if (!existing.file.startsWith("/storage")) {
            await deleteFromR2(existing.file);
          }
          // Note: If migrating from local storage, old files won't be deleted automatically
          // from server file system because we lack fs access in serverless environment.
        } catch (e) {
          console.error("Error deleting old file:", e);
        }
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const encryptedBuffer = encryptFile(buffer);
      const encryptedFilename = generateEncryptedFilename(file.name);

      const r2Key = `arsip/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);

      encryptedFilePath = r2Key;
    }

    await prisma.arsipSurat.update({
      where: { id },
      data: {
        organisasi,
        noSurat: encryptText(noSurat),
        jenisSurat,
        tanggal,
        pengirimPenerima: encryptText(pengirimPenerima),
        deskripsi: deskripsi ? encryptText(deskripsi) : null,
        perihal: encryptText(perihal),
        file: encryptedFilePath,
      },
    });

    // Log activity
    createLog(
      "UPDATE",
      "ARSIP_SURAT",
      `Mengupdate arsip surat: ${noSurat}`,
      id,
    );

    revalidatePath("/dashboard/arsip/surat", "page");
    revalidatePath(`/dashboard/arsip/surat/${id}`, "page");
    revalidatePath("/dashboard", "layout");

    return { success: "Arsip surat berhasil diperbarui!" };
  } catch (error) {
    console.error("Update error:", error);
    return { error: "Gagal memperbarui arsip surat" };
  }
}

/**
 * Delete arsip surat
 */
export async function deleteArsipSurat(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const arsip = await prisma.arsipSurat.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!arsip) return { error: "Arsip surat tidak ditemukan" };

    if (arsip.file) {
      try {
        // Delete from R2 (assuming new format)
        // Old local files won't be deleted, but that's acceptable in migration
        if (!arsip.file.startsWith("/storage")) {
          await deleteFromR2(arsip.file);
        }
      } catch (e) {
        console.error("Error deleting file:", e);
      }
    }

    // Get noSurat before deleting for log
    const noSuratDecrypted = decryptText(arsip.noSurat);

    await prisma.arsipSurat.delete({
      where: { id },
    });

    // Log activity
    createLog(
      "DELETE",
      "ARSIP_SURAT",
      `Menghapus arsip surat: ${noSuratDecrypted}`,
      id,
    );

    revalidatePath("/dashboard/arsip/surat", "page");
    revalidatePath("/dashboard", "layout");
    return { success: "Arsip surat berhasil dihapus!" };
  } catch (error) {
    console.error("Delete error:", error);
    return { error: "Gagal menghapus arsip surat" };
  }
}

/**
 * Download and decrypt file
 */
export async function downloadArsipFile(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const arsip = await prisma.arsipSurat.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!arsip || !arsip.file) throw new Error("File tidak ditemukan");

  // Download from R2
  // If it's an old file (starts with /storage), it will fail in Vercel.
  // Assuming all new files are R2 keys.

  let encryptedBuffer: Buffer;

  if (arsip.file.startsWith("/storage") || arsip.file.startsWith("/uploads")) {
    // Fallback for legacy local files (won't work in Vercel but keeps type safety)
    // In migration, these files should have been moved or will be broken.
    throw new Error(
      "File LAMA (lokal) tidak dapat diakses di Cloud. Silakan upload ulang file.",
    );
  } else {
    // R2 Download
    encryptedBuffer = await downloadFromR2(arsip.file);
  }
  return decryptFile(encryptedBuffer);
}

/**
 * Parse tanggal dari berbagai format:
 * - ISO: 2025-01-15
 * - DD/MM/YYYY: 15/01/2025
 * - Format Indonesia: "15 Januari 2025"
 */
function parseFlexibleDate(raw: string): Date | null {
  // Bersihkan karakter aneh dan spasi berlebih
  // Hapus nama hari (Minggu, Senin, dst) dan koma jika ada di depan
  let s = raw.trim().replace(/^[a-zA-Z]+,\s*/, "");

  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split("/");
    return new Date(`${y}-${m}-${d}`);
  }

  // Format Indonesia: "15 Februari 2026"
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

  // Fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Bulk import arsip surat dari Excel (tanpa file lampiran)
 */
export async function bulkImportArsipSurat(
  rows: Array<{
    noSurat: string;
    jenisSurat: string;
    organisasi?: string;
    tanggal: string; // YYYY-MM-DD atau DD/MM/YYYY
    pengirimPenerima: string;
    perihal: string;
    deskripsi?: string;
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
      // Validasi field wajib
      if (
        !row.noSurat?.trim() ||
        !row.jenisSurat?.trim() ||
        !row.tanggal?.trim() ||
        !row.pengirimPenerima?.trim() ||
        !row.perihal?.trim()
      ) {
        failed++;
        failedRows.push(`${rowLabel}: Ada kolom wajib yang kosong`);
        continue;
      }

      // Validasi Jenis Surat
      const jenisSuratUpper = row.jenisSurat.trim().toUpperCase();
      if (!["MASUK", "KELUAR"].includes(jenisSuratUpper)) {
        failed++;
        failedRows.push(`${rowLabel}: Jenis Surat harus MASUK atau KELUAR`);
        continue;
      }

      // Parse tanggal
      const tanggal = parseFlexibleDate(row.tanggal);
      if (!tanggal) {
        failed++;
        failedRows.push(
          `${rowLabel}: Format tanggal "${row.tanggal}" tidak valid`,
        );
        continue;
      }

      // Validasi Organisasi
      let organisasi: Organisasi | null = null;
      if (row.organisasi?.trim()) {
        let orgUpper = row.organisasi.trim().toUpperCase().replace(/\//g, "_"); // Handle CBP/KPP -> CBP_KPP
        if (Object.values(Organisasi).includes(orgUpper as Organisasi)) {
          organisasi = orgUpper as Organisasi;
        }
      }

      // Siapkan data terenkripsi
      dataToInsert.push({
        userId: session.user.id,
        periodeId: periodeAktif.id,
        noSurat: encryptText(row.noSurat.trim()),
        jenisSurat: jenisSuratUpper as JenisSurat,
        organisasi,
        tanggal,
        pengirimPenerima: encryptText(row.pengirimPenerima.trim()),
        perihal: encryptText(row.perihal.trim()),
        deskripsi: row.deskripsi?.trim()
          ? encryptText(row.deskripsi.trim())
          : null,
        file: null,
      });
    } catch (err) {
      failed++;
      failedRows.push(`${rowLabel}: ${(err as Error).message}`);
    }
  }

  // Tembak sekaligus ke DB
  if (dataToInsert.length > 0) {
    try {
      await prisma.arsipSurat.createMany({
        data: dataToInsert,
      });
      success = dataToInsert.length;

      createLog(
        "CREATE",
        "ARSIP_SURAT",
        `Import Excel: ${success} arsip berhasil diimport`,
      );
      revalidatePath("/dashboard/arsip/surat", "page");
      revalidatePath("/dashboard", "layout");
    } catch (err) {
      console.error("Bulk insert error:", err);
      return {
        error: "Gagal menyimpan data ke database. Cek koneksi internet/DB.",
      };
    }
  }

  return { success, failed, failedRows };
}

/**
 * Get a temporary download token for an arsip file
 */
export async function getArsipDownloadToken(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Check if user owns this arsip
  const arsip = await prisma.arsipSurat.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!arsip) throw new Error("Arsip tidak ditemukan");

  return createToken(id);
}
