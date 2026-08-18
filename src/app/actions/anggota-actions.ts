"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  encryptText,
  decryptText,
  encryptFile,
  generateEncryptedFilename,
} from "@/lib/encryption";
import { JenisKelamin, Prisma } from "@prisma/client";
import { createLog } from "@/lib/log-activity";
import { uploadToR2, deleteFromR2 } from "@/lib/storage-r2";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * Get List of Members with Pagination and Search
 */
export async function getAnggotaList(
  query?: string,
  page: number = 1,
  limit: number = 10,
  userId?: string,
  periodeId?: string,
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
      where: { userId: session.user.id, isActive: true },
    });
    targetPeriodeId = periodeAktif?.id;
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isCabang = currentUser?.role === "SEKRETARIS_CABANG";
  let whereClause: Prisma.AnggotaWhereInput = {};

  if (!isCabang) {
    const effectivePeriodeId = periodeId || targetPeriodeId;
    if (!effectivePeriodeId) return { data: [], total: 0, totalPages: 0 };
    whereClause = { userId: session.user.id, periodeId: effectivePeriodeId };
  } else {
    const finalPeriodeId = periodeId || targetPeriodeId;
    let targetPeriodeNama: string | undefined;

    if (finalPeriodeId) {
      const selectedPeriode = await prisma.periode.findUnique({
        where: { id: finalPeriodeId },
        select: { nama: true },
      });
      targetPeriodeNama = selectedPeriode?.nama;
    }

    if (userId && userId !== "ALL") {
      whereClause.userId = userId;
      if (userId === session.user.id) {
        if (finalPeriodeId) whereClause.periodeId = finalPeriodeId;
      } else if (targetPeriodeNama) {
        whereClause.periode = { nama: targetPeriodeNama };
      }
    } else {
      if (finalPeriodeId && targetPeriodeNama) {
        whereClause.OR = [
          { periodeId: finalPeriodeId },
          { periode: { nama: targetPeriodeNama } },
        ];
      } else if (finalPeriodeId) {
        whereClause.periodeId = finalPeriodeId;
      }
    }
  }

  // Apakah pengurutan memerlukan dekripsi atau relasi?
  const needsInMemorySort =
    sortKey === "namaLengkap" ||
    sortKey === "jabatan" ||
    sortKey === "noHp" ||
    sortKey === "periode" ||
    sortKey === "dibuatOleh";

  if (!query && !needsInMemorySort) {
    const dir = sortDir === "asc" ? "asc" : "desc";
    const actualSort = sortKey === "jenisKelamin" ? "jenisKelamin" : "createdAt";

    const [total, allAnggota] = await Promise.all([
      prisma.anggota.count({ where: whereClause }),
      prisma.anggota.findMany({
        where: whereClause,
        orderBy: { [actualSort]: dir },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true } },
          periode: { select: { nama: true } },
          perkaderans: true,
          pendidikans: true,
        },
      }),
    ]);
    const decryptedData = allAnggota.map((item) => ({
      ...item,
      namaLengkap: decryptText(item.namaLengkap),
      nik: item.nik ? decryptText(item.nik) : null,
      nia: item.nia ? decryptText(item.nia) : null,
      noHp: item.noHp ? decryptText(item.noHp) : null,
      jabatan: item.jabatan ? decryptText(item.jabatan) : null,
      alamatLengkap: item.alamatLengkap
        ? decryptText(item.alamatLengkap)
        : null,
      tempatLahir: item.tempatLahir ? decryptText(item.tempatLahir) : null,
      hobi: item.hobi ? decryptText(item.hobi) : null,
      noRfid: item.noRfid ? decryptText(item.noRfid) : null,
      pekerjaan: item.pekerjaan ? decryptText(item.pekerjaan) : null,
      namaInstansiPendidikan: item.namaInstansiPendidikan
        ? decryptText(item.namaInstansiPendidikan)
        : null,
      perkaderans: item.perkaderans.map((p) => ({
        ...p,
        namaPerkaderan: decryptText(p.namaPerkaderan),
        tempat: decryptText(p.tempat),
      })),
      pendidikans: item.pendidikans.map((p) => ({
        ...p,
        jenjang: p.jenjang,
        namaSekolah: decryptText(p.namaSekolah),
      })),
    }));
    return { data: decryptedData, total, totalPages: Math.ceil(total / limit) };
  }

  // Jalur In-Memory Global Sort / Search
  const allAnggota = await prisma.anggota.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
      periode: { select: { nama: true } },
      perkaderans: true,
      pendidikans: true,
    },
    take: 3000, // Safety limit for global sorting
  });

  const decryptedData = allAnggota.map((item) => ({
    ...item,
    namaLengkap: decryptText(item.namaLengkap),
    nik: item.nik ? decryptText(item.nik) : null,
    nia: item.nia ? decryptText(item.nia) : null,
    noHp: item.noHp ? decryptText(item.noHp) : null,
    jabatan: item.jabatan ? decryptText(item.jabatan) : null,
    alamatLengkap: item.alamatLengkap ? decryptText(item.alamatLengkap) : null,
    tempatLahir: item.tempatLahir ? decryptText(item.tempatLahir) : null,
    hobi: item.hobi ? decryptText(item.hobi) : null,
    noRfid: item.noRfid ? decryptText(item.noRfid) : null,
    pekerjaan: item.pekerjaan ? decryptText(item.pekerjaan) : null,
    namaInstansiPendidikan: item.namaInstansiPendidikan
      ? decryptText(item.namaInstansiPendidikan)
      : null,
    perkaderans: item.perkaderans.map((p) => ({
      ...p,
      namaPerkaderan: decryptText(p.namaPerkaderan),
      tempat: decryptText(p.tempat),
    })),
    pendidikans: item.pendidikans.map((p) => ({
      ...p,
      jenjang: p.jenjang,
      namaSekolah: decryptText(p.namaSekolah),
    })),
  }));

  let filtered = decryptedData;
  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = decryptedData.filter(
      (item) =>
        item.namaLengkap.toLowerCase().includes(lowerQuery) ||
        (item.jabatan && item.jabatan.toLowerCase().includes(lowerQuery)) ||
        (item.nik && item.nik.toLowerCase().includes(lowerQuery)) ||
        (item.nia && item.nia.toLowerCase().includes(lowerQuery)),
    );
  }

  const actualSortKey = sortKey || "namaLengkap";
  const actualSortDir = sortDir || "asc";
  const collator = new Intl.Collator("id", {
    usage: "sort",
    sensitivity: "base",
    numeric: true,
  });

  filtered.sort((a, b) => {
    const getVal = (item: any) => {
      if (actualSortKey === "periode") return item.periode?.nama ?? "";
      if (actualSortKey === "dibuatOleh") return item.user?.name ?? "";
      return ((item as any)[actualSortKey] ?? "").toString();
    };

    const aVal = getVal(a);
    const bVal = getVal(b);

    if (actualSortKey === "createdAt") {
      const diff =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (diff !== 0) {
        return actualSortDir === "asc" ? diff : -diff;
      }
    }

    const result = collator.compare(aVal, bVal);
    if (result !== 0) {
      return actualSortDir === "asc" ? result : -result;
    }

    const createdAtDiff =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdAtDiff !== 0) {
      return -createdAtDiff;
    }

    return collator.compare(a.id, b.id);
  });

  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = filtered.slice(startIndex, startIndex + limit);

  return { data: paginatedData, total, totalPages: Math.ceil(total / limit) };
}

/**
 * Get all active users (for filtering by creator)
 */
export async function getActiveUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "SEKRETARIS_CABANG") return [];

  return await prisma.user.findMany({
    where: { isActive: true, emailVerified: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Get member by ID with full details
 */
export async function getAnggotaById(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const item = await prisma.anggota.findUnique({
    where: { id },
    include: { perkaderans: true, pendidikans: true },
  });

  if (!item) return null;

  return {
    ...item,
    namaLengkap: decryptText(item.namaLengkap),
    nik: item.nik ? decryptText(item.nik) : null,
    nia: item.nia ? decryptText(item.nia) : null,
    noHp: item.noHp ? decryptText(item.noHp) : null,
    alamatLengkap: item.alamatLengkap ? decryptText(item.alamatLengkap) : null,
    hobi: item.hobi ? decryptText(item.hobi) : null,
    jabatan: item.jabatan ? decryptText(item.jabatan) : null,
    noRfid: item.noRfid ? decryptText(item.noRfid) : null,
    pekerjaan: item.pekerjaan ? decryptText(item.pekerjaan) : null,
    namaInstansiPendidikan: item.namaInstansiPendidikan
      ? decryptText(item.namaInstansiPendidikan)
      : null,
    tempatLahir: item.tempatLahir ? decryptText(item.tempatLahir) : null,
    perkaderans: item.perkaderans.map((p) => ({
      ...p,
      namaPerkaderan: decryptText(p.namaPerkaderan),
      tempat: decryptText(p.tempat),
    })),
    pendidikans: item.pendidikans.map((p) => ({
      ...p,
      jenjang: p.jenjang,
      namaSekolah: decryptText(p.namaSekolah),
    })),
  };
}

/**
 * Create New Member
 */
export async function createAnggota(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const periodeAktif = await prisma.periode.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!periodeAktif)
    return { error: "Silakan aktifkan periode terlebih dahulu." };

  const namaLengkap = formData.get("namaLengkap") as string;
  const jenisKelamin = formData.get("jenisKelamin") as JenisKelamin;

  if (!namaLengkap || !namaLengkap.trim())
    return { error: "Nama Lengkap wajib diisi" };

  let photoPath: string | null = null;
  const imageFile = formData.get("foto") as File | null;
  if (imageFile && imageFile instanceof File && imageFile.size > 0) {
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    photoPath = `anggota/${generateEncryptedFilename(imageFile.name)}`;
    await uploadToR2(encryptFile(buffer), photoPath, imageFile.type);
  }

  try {
    const rawPerkaderans = formData.get("perkaderans") as string;
    const rawPendidikans = formData.get("pendidikans") as string;
    const anggota = await prisma.anggota.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        namaLengkap: encryptText(namaLengkap),
        jenisKelamin,
        foto: photoPath,
        nik: formData.get("nik")
          ? encryptText(formData.get("nik") as string)
          : null,
        nia: formData.get("nia")
          ? encryptText(formData.get("nia") as string)
          : null,
        email: (formData.get("email") as string) || null,
        tempatLahir: formData.get("tempatLahir")
          ? encryptText(formData.get("tempatLahir") as string)
          : null,
        tanggalLahir: formData.get("tanggalLahir")
          ? new Date(formData.get("tanggalLahir") as string)
          : null,
        alamatLengkap: formData.get("alamatLengkap")
          ? encryptText(formData.get("alamatLengkap") as string)
          : null,
        noHp: formData.get("noHp")
          ? encryptText(formData.get("noHp") as string)
          : null,
        hobi: formData.get("hobi")
          ? encryptText(formData.get("hobi") as string)
          : null,
        jabatan: formData.get("jabatan")
          ? encryptText(formData.get("jabatan") as string)
          : null,
        noRfid: formData.get("noRfid")
          ? encryptText(formData.get("noRfid") as string)
          : null,
        pekerjaan: formData.get("pekerjaan")
          ? encryptText(formData.get("pekerjaan") as string)
          : null,
        jenjangPendidikan:
          (formData.get("jenjangPendidikan") as string) || null,
        namaInstansiPendidikan: formData.get("namaInstansiPendidikan")
          ? encryptText(formData.get("namaInstansiPendidikan") as string)
          : null,
        perkaderans: {
          create: rawPerkaderans
            ? JSON.parse(rawPerkaderans).map((p: any) => ({
                namaPerkaderan: encryptText(p.namaPerkaderan),
                tanggal: p.tanggal ? new Date(p.tanggal) : new Date(),
                tempat: encryptText(p.tempat || "-"),
              }))
            : [],
        },
        pendidikans: {
          create: rawPendidikans
            ? JSON.parse(rawPendidikans).map((p: any) => ({
                jenjang: p.jenjang,
                namaSekolah: encryptText(p.namaSekolah || "-"),
              }))
            : [],
        },
      },
    });

    createLog(
      "CREATE",
      "ANGGOTA",
      `Membuat data anggota: ${namaLengkap}`,
      anggota.id,
    );
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/anggota", "page");
    return { success: "Data anggota berhasil disimpan!" };
  } catch (error) {
    console.error(error);
    return { error: "Gagal menyimpan data anggota." };
  }
}

/**
 * Update Existing Member
 */
export async function updateAnggota(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  try {
    const existing = await prisma.anggota.findUnique({ where: { id } });
    if (!existing) return { error: "Data tidak ditemukan" };

    const namaLengkap = formData.get("namaLengkap") as string;
    let photoPath = existing.foto;
    const imageFile = formData.get("foto") as File | null;

    if (imageFile && imageFile instanceof File && imageFile.size > 0) {
      if (existing.foto) await deleteFromR2(existing.foto).catch(() => {});
      photoPath = `anggota/${generateEncryptedFilename(imageFile.name)}`;
      await uploadToR2(
        encryptFile(Buffer.from(await imageFile.arrayBuffer())),
        photoPath,
        imageFile.type,
      );
    }

    const rawPerkaderans = formData.get("perkaderans") as string;
    const rawPendidikans = formData.get("pendidikans") as string;

    await prisma.anggota.update({
      where: { id },
      data: {
        namaLengkap: encryptText(namaLengkap),
        jenisKelamin: formData.get("jenisKelamin") as JenisKelamin,
        foto: photoPath,
        nik: formData.get("nik")
          ? encryptText(formData.get("nik") as string)
          : null,
        nia: formData.get("nia")
          ? encryptText(formData.get("nia") as string)
          : null,
        email: (formData.get("email") as string) || null,
        tempatLahir: formData.get("tempatLahir")
          ? encryptText(formData.get("tempatLahir") as string)
          : null,
        tanggalLahir: formData.get("tanggalLahir")
          ? new Date(formData.get("tanggalLahir") as string)
          : null,
        alamatLengkap: formData.get("alamatLengkap")
          ? encryptText(formData.get("alamatLengkap") as string)
          : null,
        noHp: formData.get("noHp")
          ? encryptText(formData.get("noHp") as string)
          : null,
        hobi: formData.get("hobi")
          ? encryptText(formData.get("hobi") as string)
          : null,
        jabatan: formData.get("jabatan")
          ? encryptText(formData.get("jabatan") as string)
          : null,
        noRfid: formData.get("noRfid")
          ? encryptText(formData.get("noRfid") as string)
          : null,
        pekerjaan: formData.get("pekerjaan")
          ? encryptText(formData.get("pekerjaan") as string)
          : null,
        jenjangPendidikan:
          (formData.get("jenjangPendidikan") as string) || null,
        namaInstansiPendidikan: formData.get("namaInstansiPendidikan")
          ? encryptText(formData.get("namaInstansiPendidikan") as string)
          : null,
        perkaderans: {
          deleteMany: {},
          create: rawPerkaderans
            ? JSON.parse(rawPerkaderans).map((p: any) => ({
                namaPerkaderan: encryptText(p.namaPerkaderan),
                tanggal: p.tanggal ? new Date(p.tanggal) : new Date(),
                tempat: encryptText(p.tempat || "-"),
              }))
            : [],
        },
        pendidikans: {
          deleteMany: {},
          create: rawPendidikans
            ? JSON.parse(rawPendidikans).map((p: any) => ({
                jenjang: p.jenjang,
                namaSekolah: encryptText(p.namaSekolah || "-"),
              }))
            : [],
        },
      },
    });

    createLog(
      "UPDATE",
      "ANGGOTA",
      `Mengupdate data anggota: ${namaLengkap}`,
      id,
    );
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/anggota", "page");
    revalidatePath(`/dashboard/anggota/${id}`, "page");
    return { success: "Data anggota berhasil diperbarui!" };
  } catch (error) {
    console.error(error);
    return { error: "Gagal memperbarui data anggota" };
  }
}

/**
 * Delete Member
 */
export async function deleteAnggota(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };
  try {
    const existing = await prisma.anggota.findUnique({ where: { id } });
    if (!existing) return { error: "Data anggota tidak ditemukan" };
    if (existing.foto) await deleteFromR2(existing.foto).catch(() => {});
    const nama = decryptText(existing.namaLengkap);
    await prisma.anggota.delete({ where: { id } });
    createLog("DELETE", "ANGGOTA", `Menghapus data anggota: ${nama}`, id);
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/anggota", "page");
    return { success: "Data anggota berhasil dihapus!" };
  } catch (error) {
    return { error: "Gagal menghapus data anggota" };
  }
}

/**
 * Stats for Member Module
 */
export async function getAnggotaStats(userId?: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const isCabang = user?.role === "SEKRETARIS_CABANG";
  let where: Prisma.AnggotaWhereInput = {};
  // Get active or selected view periode
  const cookieStore = await cookies();
  const viewPeriodeId = cookieStore.get("view_periode_id")?.value;
  
  let targetPeriodeId = viewPeriodeId;
  
  if (!targetPeriodeId) {
    const active = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
    });
    targetPeriodeId = active?.id;
  }

  if (isCabang) {
    let targetPeriodeNama: string | undefined;

    if (targetPeriodeId) {
      const selectedPeriode = await prisma.periode.findUnique({
        where: { id: targetPeriodeId },
        select: { nama: true },
      });
      targetPeriodeNama = selectedPeriode?.nama;
    }

    if (userId && userId !== "ALL") {
      where.userId = userId;
      if (userId === session.user.id) {
        if (targetPeriodeId) where.periodeId = targetPeriodeId;
      } else if (targetPeriodeNama) {
        where.periode = { nama: targetPeriodeNama };
      }
    } else {
      if (targetPeriodeId && targetPeriodeNama) {
        where.OR = [
          { periodeId: targetPeriodeId },
          { periode: { nama: targetPeriodeNama } },
        ];
      } else if (targetPeriodeId) {
        where.periodeId = targetPeriodeId;
      }
    }
  } else {
    if (!targetPeriodeId) return null;
    where = { userId: session.user.id, periodeId: targetPeriodeId };
  }

  const [total, lakiLaki, perempuan, perkaderans] = await Promise.all([
    prisma.anggota.count({ where }),
    prisma.anggota.count({ where: { ...where, jenisKelamin: "LAKI_LAKI" } }),
    prisma.anggota.count({ where: { ...where, jenisKelamin: "PEREMPUAN" } }),
    prisma.perkaderan.findMany({
      where: { anggota: where },
      select: { namaPerkaderan: true },
    }),
  ]);

  let makesta = 0;
  let lakmud = 0;
  let latin = 0;
  let latpel = 0;
  let lakut = 0;

  perkaderans.forEach((p) => {
    const nama = decryptText(p.namaPerkaderan).toUpperCase();
    if (nama === "MAKESTA") makesta++;
    else if (nama === "LAKMUD") lakmud++;
    else if (nama === "LATIN") latin++;
    else if (nama === "LATPEL") latpel++;
    else if (nama === "LAKUT") lakut++;
  });

  return { total, lakiLaki, perempuan, makesta, lakmud, latin, latpel, lakut };
}

/**
 * Copy anggota to current period
 */
export async function copyAnggotaToCurrentPeriode(anggotaIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Belum terautentikasi" };

  const periodeAktif = await prisma.periode.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!periodeAktif)
    return { error: "Silakan aktifkan periode tujuan terlebih dahulu." };

  try {
    const sourceAnggota = await prisma.anggota.findMany({
      where: { id: { in: anggotaIds } },
      include: { perkaderans: true, pendidikans: true },
    });

    const createdCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const item of sourceAnggota) {
        if (item.periodeId === periodeAktif.id) continue;
        await tx.anggota.create({
          data: {
            userId: session.user.id,
            periodeId: periodeAktif.id,
            namaLengkap: item.namaLengkap,
            nik: item.nik,
            nia: item.nia,
            email: item.email,
            foto: item.foto,
            jenisKelamin: item.jenisKelamin,
            tempatLahir: item.tempatLahir,
            tanggalLahir: item.tanggalLahir,
            alamatLengkap: item.alamatLengkap,
            noHp: item.noHp,
            hobi: item.hobi,
            jabatan: item.jabatan,
            noRfid: item.noRfid,
            pekerjaan: item.pekerjaan,
            jenjangPendidikan: item.jenjangPendidikan,
            namaInstansiPendidikan: item.namaInstansiPendidikan,
            perkaderans: {
              create: item.perkaderans.map((p) => ({
                namaPerkaderan: p.namaPerkaderan,
                tanggal: p.tanggal,
                tempat: p.tempat,
              })),
            },
            pendidikans: {
              create: item.pendidikans.map((p) => ({
                jenjang: p.jenjang,
                namaSekolah: p.namaSekolah,
              })),
            },
          },
        });
        count++;
      }
      return count;
    });

    createLog(
      "CREATE",
      "ANGGOTA",
      `Menyalin ${createdCount} anggota ke periode: ${periodeAktif.nama}`,
    );
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/anggota", "page");
    return { success: `${createdCount} anggota berhasil disalin!` };
  } catch (error) {
    return { error: "Gagal menyalin data anggota." };
  }
}
