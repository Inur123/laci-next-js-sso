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

import {
  PenerimaSurat,
  StatusPengajuan,
  PengajuanBerkas,
  Prisma,
} from "@prisma/client";
import { createLog } from "@/lib/log-activity";
import { uploadToR2, deleteFromR2, downloadFromR2 } from "@/lib/storage-r2";
import {
  sendPengajuanBerkasNotification,
  sendPengajuanBerkasStatusUpdate,
} from "@/lib/email";

/**
 * Get active PAC users for filtering (Cabang only)
 */
export async function getActivePacUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_CABANG") {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      role: "SEKRETARIS_PAC",
      isActive: true,
      emailVerified: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return users;
}

/**
 * Get active PAC users for filtering (PAC reference)
 */
export async function getActivePacUsersForReferensi() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_PAC") {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      role: "SEKRETARIS_PAC",
      isActive: true,
      emailVerified: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return users;
}

/**
 * Get all pengajuan for current user (PAC role)
 */
export async function getPengajuanBerkass(
  query?: string,
  page: number = 1,
  limit: number = 10,
  statusFilter?: string,
  penerimaFilter?: string,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_PAC") {
    throw new Error("Only PAC can access their submissions");
  }

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

  const whereClause: Prisma.PengajuanBerkasWhereInput = {
    userId: session.user.id,
    periodeIdPac: targetPeriodeId,
  };

  if (
    statusFilter &&
    statusFilter !== "ALL" &&
    Object.values(StatusPengajuan).includes(statusFilter as StatusPengajuan)
  ) {
    whereClause.status = statusFilter as StatusPengajuan;
  }
  if (
    penerimaFilter &&
    penerimaFilter !== "ALL" &&
    Object.values(PenerimaSurat).includes(penerimaFilter as PenerimaSurat)
  ) {
    whereClause.penerima = penerimaFilter as PenerimaSurat;
  }

  const isEncryptedSort = sortKey === "noSurat" || sortKey === "keperluan";

  // 1. Optimized Path: No search and unencrypted sort -> DB Pagination
  if (!query && !isEncryptedSort) {
    const validSortCols = ["tanggal", "penerima", "status"];
    const actualSortKey =
      sortKey && validSortCols.includes(sortKey) ? sortKey : "tanggal";
    const dir = sortDir === "asc" ? "asc" : "desc";

    const total = await prisma.pengajuanBerkas.count({ where: whereClause });

    const pengajuans = await prisma.pengajuanBerkas.findMany({
      where: whereClause,
      include: {
        periodePac: true,
        periodeCabang: true,
      },
      orderBy: {
        [actualSortKey]: dir,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const decryptedData = pengajuans.map((p: PengajuanBerkas) => ({
      ...p,
      noSurat: decryptText(p.noSurat),
      keperluan: decryptText(p.keperluan),
      deskripsi: p.deskripsi ? decryptText(p.deskripsi) : null,
      alasanPenolakan: p.alasanPenolakan
        ? decryptText(p.alasanPenolakan)
        : null,
    }));

    return {
      data: decryptedData,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 2. Search & Encrypted Sort Path: Process in-memory
  const allPengajuans = await prisma.pengajuanBerkas.findMany({
    where: whereClause,
    include: {
      periodePac: true,
      periodeCabang: true,
    },
    take: 2000, // Safety limit for in-memory global sort
  });

  const decryptedAll = allPengajuans.map((p) => ({
    ...p,
    noSurat: decryptText(p.noSurat),
    keperluan: decryptText(p.keperluan),
    deskripsi: p.deskripsi ? decryptText(p.deskripsi) : null,
    alasanPenolakan: p.alasanPenolakan ? decryptText(p.alasanPenolakan) : null,
  }));

  let filtered = decryptedAll;
  if (query) {
    const searchLower = query.toLowerCase();
    filtered = decryptedAll.filter(
      (item) =>
        item.noSurat.toLowerCase().includes(searchLower) ||
        item.keperluan.toLowerCase().includes(searchLower),
    );
  }

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
 * Get all pengajuan for Cabang role (for approval)
 */
export async function getVerifikasiPengajuanForCabang(
  query?: string,
  page: number = 1,
  limit: number = 10,
  statusFilter?: string,
  penerimaFilter?: string,
  pacFilter?: string,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_CABANG") {
    throw new Error("Only Cabang can access all submissions");
  }

  // Get active or selected view periode of Cabang
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

  const whereClause: Prisma.PengajuanBerkasWhereInput = {
    periodeId: targetPeriodeId,
  };

  if (
    statusFilter &&
    statusFilter !== "ALL" &&
    Object.values(StatusPengajuan).includes(statusFilter as StatusPengajuan)
  ) {
    whereClause.status = statusFilter as StatusPengajuan;
  }
  if (
    penerimaFilter &&
    penerimaFilter !== "ALL" &&
    Object.values(PenerimaSurat).includes(penerimaFilter as PenerimaSurat)
  ) {
    whereClause.penerima = penerimaFilter as PenerimaSurat;
  }
  if (pacFilter && pacFilter !== "ALL") {
    whereClause.userId = pacFilter;
  }

  const isEncryptedSort = sortKey === "noSurat" || sortKey === "keperluan";

  // 1. Optimized Path: No search and unencrypted sort -> DB Pagination
  if (!query && !isEncryptedSort) {
    const validSortCols = ["tanggal", "penerima", "status"];
    const actualSortKey =
      sortKey && validSortCols.includes(sortKey) ? sortKey : "tanggal";
    const dir = sortDir === "asc" ? "asc" : "desc";

    const total = await prisma.pengajuanBerkas.count({ where: whereClause });

    const pengajuans = await prisma.pengajuanBerkas.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        periodePac: true,
        periodeCabang: true,
      },
      orderBy: {
        [actualSortKey]: dir,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const decryptedData = pengajuans.map((p: PengajuanBerkas) => ({
      ...p,
      noSurat: decryptText(p.noSurat),
      keperluan: decryptText(p.keperluan),
      deskripsi: p.deskripsi ? decryptText(p.deskripsi) : null,
      alasanPenolakan: p.alasanPenolakan
        ? decryptText(p.alasanPenolakan)
        : null,
    }));

    return {
      data: decryptedData,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 2. Search & Encrypted Sort Path: Process in-memory
  const allPengajuans = await prisma.pengajuanBerkas.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      periodePac: true,
      periodeCabang: true,
    },
    take: 2000, // Safety limit for in-memory global sort
  });

  const decryptedAll = allPengajuans.map((p) => ({
    ...p,
    noSurat: decryptText(p.noSurat),
    keperluan: decryptText(p.keperluan),
    deskripsi: p.deskripsi ? decryptText(p.deskripsi) : null,
    alasanPenolakan: p.alasanPenolakan ? decryptText(p.alasanPenolakan) : null,
  }));

  let filtered = decryptedAll;
  if (query) {
    const searchLower = query.toLowerCase();
    filtered = decryptedAll.filter(
      (item) =>
        item.noSurat.toLowerCase().includes(searchLower) ||
        item.keperluan.toLowerCase().includes(searchLower) ||
        (item.user?.name && item.user.name.toLowerCase().includes(searchLower)),
    );
  }

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
 * Get all pengajuan for PAC reference (view all submissions)
 */
export async function getPengajuanForReferensiPac(
  query?: string,
  page: number = 1,
  limit: number = 10,
  statusFilter?: string,
  penerimaFilter?: string,
  pacFilter?: string,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_PAC") {
    throw new Error("Only PAC can access reference submissions");
  }

  const periodeAktifCabang = await prisma.periode.findFirst({
    where: {
      isActive: true,
      user: {
        role: "SEKRETARIS_CABANG",
      },
    },
  });

  if (!periodeAktifCabang) return { data: [], total: 0, totalPages: 0 };

  const whereClause: Prisma.PengajuanBerkasWhereInput = {
    periodeId: periodeAktifCabang.id,
  };

  if (
    statusFilter &&
    statusFilter !== "ALL" &&
    Object.values(StatusPengajuan).includes(statusFilter as StatusPengajuan)
  ) {
    whereClause.status = statusFilter as StatusPengajuan;
  }
  if (
    penerimaFilter &&
    penerimaFilter !== "ALL" &&
    Object.values(PenerimaSurat).includes(penerimaFilter as PenerimaSurat)
  ) {
    whereClause.penerima = penerimaFilter as PenerimaSurat;
  }
  if (pacFilter && pacFilter !== "ALL") {
    whereClause.userId = pacFilter;
  }

  const isCustomSort =
    sortKey === "noSurat" || sortKey === "keperluan" || sortKey === "pengaju";

  // 1. Optimized Path: No search and unencrypted sort -> DB Pagination
  if (!query && !isCustomSort) {
    const validSortCols = ["tanggal", "penerima", "status"];
    const actualSortKey =
      sortKey && validSortCols.includes(sortKey) ? sortKey : "createdAt";
    const dir = sortDir === "asc" ? "asc" : "desc";

    const total = await prisma.pengajuanBerkas.count({ where: whereClause });

    const pengajuans = await prisma.pengajuanBerkas.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        periodePac: true,
        periodeCabang: true,
      },
      orderBy: {
        [actualSortKey]: dir,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const decryptedData = pengajuans.map((p: PengajuanBerkas) => ({
      ...p,
      noSurat: decryptText(p.noSurat),
      keperluan: decryptText(p.keperluan),
      deskripsi: p.deskripsi ? decryptText(p.deskripsi) : null,
      alasanPenolakan: p.alasanPenolakan
        ? decryptText(p.alasanPenolakan)
        : null,
    }));

    return {
      data: decryptedData,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 2. Search & Encrypted/Custom Sort Path: Process in-memory
  const allPengajuans = await prisma.pengajuanBerkas.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      periodePac: true,
      periodeCabang: true,
    },
    take: 2000, // Safety limit for in-memory global sort
  });

  const decryptedAll = allPengajuans.map((p) => ({
    ...p,
    noSurat: decryptText(p.noSurat),
    keperluan: decryptText(p.keperluan),
    deskripsi: p.deskripsi ? decryptText(p.deskripsi) : null,
    alasanPenolakan: p.alasanPenolakan ? decryptText(p.alasanPenolakan) : null,
  }));

  let filtered = decryptedAll;
  if (query) {
    const searchLower = query.toLowerCase();
    filtered = decryptedAll.filter(
      (item) =>
        item.noSurat.toLowerCase().includes(searchLower) ||
        item.keperluan.toLowerCase().includes(searchLower) ||
        (item.user?.name && item.user.name.toLowerCase().includes(searchLower)),
    );
  }

  const actualSortKey = sortKey || "tanggal";
  const actualSortDir = sortDir || "desc";

  filtered.sort((a: any, b: any) => {
    let aVal: any;
    let bVal: any;

    if (actualSortKey === "tanggal") {
      aVal = new Date(a.tanggal).getTime();
      bVal = new Date(b.tanggal).getTime();
    } else if (actualSortKey === "pengaju") {
      aVal = (a.user?.name ?? "").toString().toLowerCase();
      bVal = (b.user?.name ?? "").toString().toLowerCase();
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
 * Get reference stats for PAC (all submissions in active cabang periode)
 */
export async function getPengajuanBerkasStatsForReferensi() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_PAC") {
    throw new Error("Only PAC can access reference stats");
  }

  const periodeAktifCabang = await prisma.periode.findFirst({
    where: {
      isActive: true,
      user: {
        role: "SEKRETARIS_CABANG",
      },
    },
  });

  if (!periodeAktifCabang) {
    return {
      total: 0,
      ipnu: 0,
      ippnu: 0,
      bersama: 0,
      pending: 0,
      diterima: 0,
      ditolak: 0,
    };
  }

  const allPengajuan = await prisma.pengajuanBerkas.findMany({
    where: { periodeId: periodeAktifCabang.id },
    select: {
      status: true,
      penerima: true,
    },
  });

  const total = allPengajuan.length;
  const ipnu = allPengajuan.filter((p) => p.penerima === "IPNU").length;
  const ippnu = allPengajuan.filter((p) => p.penerima === "IPPNU").length;
  const bersama = allPengajuan.filter((p) => p.penerima === "BERSAMA").length;
  const cbpKpp = allPengajuan.filter((p) => p.penerima === "CBP_KPP").length;
  const pending = allPengajuan.filter((p) => p.status === "PENDING").length;
  const diterima = allPengajuan.filter((p) => p.status === "DITERIMA").length;
  const ditolak = allPengajuan.filter((p) => p.status === "DITOLAK").length;

  return {
    total,
    ipnu,
    ippnu,
    bersama,
    cbpKpp,
    pending,
    diterima,
    ditolak,
  };
}

/**
 * Get pengajuan detail for PAC reference (view all submissions)
 */
export async function getPengajuanBerkasDetailForReferensi(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_PAC") return null;

  const periodeAktifCabang = await prisma.periode.findFirst({
    where: {
      isActive: true,
      user: {
        role: "SEKRETARIS_CABANG",
      },
    },
  });

  if (!periodeAktifCabang) return null;

  const pengajuan = await prisma.pengajuanBerkas.findFirst({
    where: {
      id,
      periodeId: periodeAktifCabang.id,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      periodePac: true,
      periodeCabang: true,
    },
  });

  if (!pengajuan) return null;

  return {
    ...pengajuan,
    noSurat: decryptText(pengajuan.noSurat),
    keperluan: decryptText(pengajuan.keperluan),
    deskripsi: pengajuan.deskripsi ? decryptText(pengajuan.deskripsi) : null,
    alasanPenolakan: pengajuan.alasanPenolakan
      ? decryptText(pengajuan.alasanPenolakan)
      : null,
  };
}

/**
 * Get single pengajuan by ID
 */
export async function getPengajuanBerkasById(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const pengajuan = await prisma.pengajuanBerkas.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      periodePac: true,
      periodeCabang: true,
    },
  });

  if (!pengajuan) return null;

  return {
    ...pengajuan,
    noSurat: decryptText(pengajuan.noSurat),
    keperluan: decryptText(pengajuan.keperluan),
    deskripsi: pengajuan.deskripsi ? decryptText(pengajuan.deskripsi) : null,
    alasanPenolakan: pengajuan.alasanPenolakan
      ? decryptText(pengajuan.alasanPenolakan)
      : null,
  };
}

/**
 * Get pengajuan detail for viewing (accessible by owner or Cabang)
 */
export async function getPengajuanBerkasDetail(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isCabang = user?.role === "SEKRETARIS_CABANG";

  // For Cabang, get any pengajuan. For PAC, only their own
  const pengajuan = await prisma.pengajuanBerkas.findFirst({
    where: isCabang
      ? { id }
      : {
          id,
          userId: session.user.id,
        },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      periodePac: true,
      periodeCabang: true,
    },
  });

  if (!pengajuan) return null;

  return {
    ...pengajuan,
    noSurat: decryptText(pengajuan.noSurat),
    keperluan: decryptText(pengajuan.keperluan),
    deskripsi: pengajuan.deskripsi ? decryptText(pengajuan.deskripsi) : null,
    alasanPenolakan: pengajuan.alasanPenolakan
      ? decryptText(pengajuan.alasanPenolakan)
      : null,
  };
}

/**
 * Create new Pengajuan PAC
 */
export async function createPengajuanBerkas(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_PAC") {
    return { error: "Hanya Sekretaris PAC yang dapat membuat pengajuan" };
  }

  // Get active periode PAC
  const periodeAktifPAC = await prisma.periode.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
  });

  if (!periodeAktifPAC) {
    return {
      error:
        "Tidak ada periode aktif. Silakan aktifkan periode terlebih dahulu.",
    };
  }

  // Get active periode Cabang (any active Cabang periode)
  const periodeAktifCabang = await prisma.periode.findFirst({
    where: {
      isActive: true,
      user: {
        role: "SEKRETARIS_CABANG",
      },
    },
  });

  if (!periodeAktifCabang) {
    return {
      error: "Tidak ada periode aktif Cabang. Hubungi Sekretaris Cabang.",
    };
  }

  // Extract form data
  const noSurat = formData.get("noSurat") as string;
  const penerima = formData.get("penerima") as PenerimaSurat;
  const tanggal = new Date(formData.get("tanggal") as string);
  const keperluan = formData.get("keperluan") as string;
  const deskripsi = formData.get("deskripsi") as string;
  const file = formData.get("file") as File | null;

  if (!noSurat) return { error: "Nomor surat harus diisi" };
  if (!penerima) return { error: "Penerima harus dipilih" };
  if (!keperluan) return { error: "Keperluan harus diisi" };
  if (!file || file.size === 0) return { error: "File harus diunggah" };
  if (file.size > 2 * 1024 * 1024) return { error: "Ukuran file maksimal 2MB" };

  // Handle file upload and encryption
  let encryptedFilePath: string | null = null;
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const encryptedBuffer = encryptFile(buffer);
    const encryptedFilename = generateEncryptedFilename(file.name);

    const r2Key = `pengajuan-berkas/${encryptedFilename}`;
    await uploadToR2(encryptedBuffer, r2Key, file.type);
    encryptedFilePath = r2Key;
  } catch (error) {
    console.error("Error saving file:", error);
    return { error: "Gagal menyimpan file lampiran" };
  }

  try {
    const pengajuan = await prisma.pengajuanBerkas.create({
      data: {
        user: {
          connect: { id: session.user.id },
        },
        periodeCabang: {
          connect: { id: periodeAktifCabang.id },
        },
        periodePac: {
          connect: { id: periodeAktifPAC.id },
        },
        noSurat: encryptText(noSurat),
        penerima,
        tanggal,
        keperluan: encryptText(keperluan),
        deskripsi: deskripsi ? encryptText(deskripsi) : null,
        file: encryptedFilePath,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard/pengajuan-berkas", "page");
    revalidatePath("/dashboard", "layout");

    // Log activity
    createLog(
      "CREATE",
      "PENGAJUAN_BERKAS",
      `Membuat pengajuan PAC: ${noSurat}`,
      pengajuan.id,
    );

    // FIX: Ambil email terbaru dari DB, jangan dari session (karena session mungkin stale)
    const freshUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });

    if (freshUser && freshUser.email) {
      // Kirim Notifikasi Email (User & Admin) secara BACKGROUND
      sendPengajuanBerkasNotification(
        freshUser.email,
        {
          userName: freshUser.name || "User",
          pacName: freshUser.name || "PAC",
          detailUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://laci.pelajarnumagetan.or.id"}/dashboard/pengajuan-berkas/${pengajuan.id}`,
          noSurat: noSurat,
        },
        encryptedFilePath
          ? { path: encryptedFilePath, name: file.name }
          : undefined,
      )
        .then((result) => {
          if (!result.success) {
            console.error(
              "[PENGAJUAN-NOTIF] Gagal mengirim email:",
              result.error,
            );
          }
        })
        .catch((err) => {
          console.error(
            "[PENGAJUAN-NOTIF] Error mengirim email di background:",
            err,
          );
        });
    }

    return { success: "Pengajuan berhasil dibuat!", data: pengajuan };
  } catch (error) {
    console.error("Database error:", error);
    return { error: `Gagal menyimpan: ${(error as Error).message}` };
  }
}

/**
 * Update Pengajuan PAC (only if status is PENDING)
 */
export async function updatePengajuanBerkas(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const existing = await prisma.pengajuanBerkas.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) return { error: "Pengajuan tidak ditemukan" };

    if (existing.status !== "PENDING") {
      return {
        error: "Hanya pengajuan dengan status PENDING yang dapat diedit",
      };
    }

    const noSurat = formData.get("noSurat") as string;
    const penerima = formData.get("penerima") as PenerimaSurat;
    const tanggal = new Date(formData.get("tanggal") as string);
    const keperluan = formData.get("keperluan") as string;
    const deskripsi = formData.get("deskripsi") as string;
    const file = formData.get("file") as File | null;

    if (!noSurat) return { error: "Nomor surat harus diisi" };
    if (!penerima) return { error: "Penerima harus dipilih" };
    if (!keperluan) return { error: "Keperluan harus diisi" };

    let encryptedFilePath = existing.file;
    if (file && file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024)
        return { error: "Ukuran file maksimal 2MB" };
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

      const r2Key = `pengajuan-berkas/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);
      encryptedFilePath = r2Key;
    }

    await prisma.pengajuanBerkas.update({
      where: { id },
      data: {
        noSurat: encryptText(noSurat),
        penerima,
        tanggal,
        keperluan: encryptText(keperluan),
        deskripsi: deskripsi ? encryptText(deskripsi) : null,
        file: encryptedFilePath,
      },
    });

    revalidatePath("/dashboard/pengajuan-berkas", "page");
    revalidatePath(`/dashboard/pengajuan-berkas/${id}`, "page");

    // Log activity
    createLog(
      "UPDATE",
      "PENGAJUAN_BERKAS",
      `Mengupdate pengajuan PAC: ${noSurat}`,
      id,
    );

    return { success: "Pengajuan berhasil diperbarui!" };
  } catch (error) {
    console.error("Update error:", error);
    return { error: "Gagal memperbarui pengajuan" };
  }
}

/**
 * Delete Pengajuan PAC/Cabang
 */
export async function deletePengajuanBerkas(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user) return { error: "User tidak ditemukan" };

    const isCabang = user.role === "SEKRETARIS_CABANG";
    const isPac = user.role === "SEKRETARIS_PAC";

    if (!isCabang && !isPac) {
      return { error: "Role tidak diizinkan" };
    }

    const pengajuan = await prisma.pengajuanBerkas.findFirst({
      where: isCabang
        ? { id }
        : { id, userId: session.user.id },
    });

    if (!pengajuan) return { error: "Pengajuan tidak ditemukan" };

    if (pengajuan.file && !pengajuan.file.startsWith("/storage")) {
      try {
        await deleteFromR2(pengajuan.file);
      } catch (e) {
        console.error("Error deleting file:", e);
      }
    }

    const noSuratDecrypted = decryptText(pengajuan.noSurat);

    await prisma.pengajuanBerkas.delete({
      where: { id },
    });

    // Log activity
    createLog(
      "DELETE",
      "PENGAJUAN_BERKAS",
      `Menghapus pengajuan PAC: ${noSuratDecrypted}`,
      id,
    );

    revalidatePath("/dashboard/pengajuan-berkas", "page");
    return { success: "Pengajuan berhasil dihapus!" };
  } catch (error) {
    console.error("Delete error:", error);
    return { error: "Gagal menghapus pengajuan" };
  }
}

/**
 * Update status pengajuan (Cabang only)
 */
export async function updateStatusPengajuan(
  id: string,
  status: StatusPengajuan,
  alasanPenolakan?: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_CABANG") {
    return { error: "Hanya Sekretaris Cabang yang dapat mengubah status" };
  }

  try {
    const pengajuan = await prisma.pengajuanBerkas.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!pengajuan || !pengajuan.user)
      return { error: "Pengajuan tidak ditemukan" };

    if (status === "DITOLAK" && !alasanPenolakan) {
      return { error: "Alasan penolakan harus diisi" };
    }

    await prisma.pengajuanBerkas.update({
      where: { id },
      data: {
        status,
        alasanPenolakan:
          status === "DITOLAK" && alasanPenolakan
            ? encryptText(alasanPenolakan)
            : null,
      },
    });

    revalidatePath("/dashboard/pengajuan-berkas", "page");
    revalidatePath(`/dashboard/pengajuan-berkas/${id}`, "page");

    // Log activity
    createLog(
      status === "DITERIMA" ? "APPROVE" : "REJECT",
      "PENGAJUAN_BERKAS",
      `${status === "DITERIMA" ? "Menyetujui" : "Menolak"} pengajuan PAC: ${decryptText(pengajuan.noSurat)}`,
      id,
    );

    // Kirim Notifikasi Email Status ke User secara BACKGROUND
    sendPengajuanBerkasStatusUpdate(pengajuan.user.email!, {
      userName: pengajuan.user.name || "User",
      pacName: pengajuan.user.name || "PAC",
      status: status === "DITERIMA" ? "DITERIMA" : "DITOLAK",
      alasanPenolakan: alasanPenolakan,
      detailUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://laci.pelajarnumagetan.or.id"}/dashboard/pengajuan-berkas/${id}`,
      noSurat: decryptText(pengajuan.noSurat),
    }).catch((err) => {
      console.error("[STATUS-UPDATE-NOTIF] Gagal mengirim email:", err);
    });

    return {
      success: `Pengajuan berhasil ${status === "DITERIMA" ? "diterima" : "ditolak"}!`,
    };
  } catch (error) {
    console.error("Status update error:", error);
    return { error: "Gagal mengubah status pengajuan" };
  }
}

/**
 * Get statistics for pengajuan PAC
 */
export async function getPengajuanBerkasStats(userId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isCabang = user?.role === "SEKRETARIS_CABANG";

  // For Cabang, we show stats for all PACs in their active periode
  // For PAC, we show stats for their own pengajuan
  const whereClause: { userId?: string; periodeId?: string; periodeIdPac?: string } = {};

  if (!isCabang) {
    whereClause.userId = session.user.id;
    // Get PAC's active period
    const periodeAktifPac = await prisma.periode.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });

    if (periodeAktifPac) {
      whereClause.periodeIdPac = periodeAktifPac.id;
    } else {
      // If there is no active period, set a non-matching ID so stats return empty
      whereClause.periodeIdPac = "none";
    }
  } else {
    // If specific userId requested and it's not ALL, use it
    if (userId && userId !== "ALL") {
      whereClause.userId = userId;
    }

    // Get Cabang's active or selected view periode to filter pengajuans
    const cookieStore = await cookies();
    const viewPeriodeId = cookieStore.get("view_periode_id")?.value;

    let targetPeriodeId = viewPeriodeId;
    if (!targetPeriodeId) {
      const periodeAktifCabang = await prisma.periode.findFirst({
        where: {
          userId: session.user.id,
          isActive: true,
        },
      });
      targetPeriodeId = periodeAktifCabang?.id;
    }

    if (targetPeriodeId) {
      whereClause.periodeId = targetPeriodeId;
    }
  }

  // OPTIMASI: Ambil semua data dalam 1x Query saja (Hemat Koneksi)
  const allPengajuan = await prisma.pengajuanBerkas.findMany({
    where: whereClause,
    select: {
      status: true,
      penerima: true,
    },
  });

  // Hitung manual di JS (Sangat cepat & Hemat resource DB)
  const total = allPengajuan.length;
  const ipnu = allPengajuan.filter((p) => p.penerima === "IPNU").length;
  const ippnu = allPengajuan.filter((p) => p.penerima === "IPPNU").length;
  const bersama = allPengajuan.filter((p) => p.penerima === "BERSAMA").length;
  const cbpKpp = allPengajuan.filter((p) => p.penerima === "CBP_KPP").length;

  const pending = allPengajuan.filter((p) => p.status === "PENDING").length;
  const diterima = allPengajuan.filter((p) => p.status === "DITERIMA").length;
  const ditolak = allPengajuan.filter((p) => p.status === "DITOLAK").length;

  return {
    total,
    ipnu,
    ippnu,
    bersama,
    cbpKpp,
    pending,
    diterima,
    ditolak,
  };
}

/**
 * Download and decrypt file
 */
export async function downloadPengajuanFile(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const pengajuan = await prisma.pengajuanBerkas.findUnique({
    where: { id },
  });

  if (!pengajuan || !pengajuan.file) throw new Error("File tidak ditemukan");

  // Check access: either owner or Cabang
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (
    pengajuan.userId !== session.user.id &&
    user?.role !== "SEKRETARIS_CABANG"
  ) {
    throw new Error("Unauthorized");
  }

  let encryptedBuffer: Buffer;
  if (pengajuan.file.startsWith("/storage")) {
    throw new Error("File legacy (Lokal) tidak dapat didownload di Cloud");
  } else {
    encryptedBuffer = await downloadFromR2(pengajuan.file);
  }

  return decryptFile(encryptedBuffer);
}

/**
 * Get a temporary download token for a pengajuan file
 */
export async function getPengajuanDownloadToken(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const pengajuan = await prisma.pengajuanBerkas.findUnique({
    where: { id },
  });

  if (!pengajuan) throw new Error("Pengajuan tidak ditemukan");

  // Check access
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (
    pengajuan.userId !== session.user.id &&
    user?.role !== "SEKRETARIS_CABANG"
  ) {
    throw new Error("Unauthorized");
  }

  return createToken(id);
}
