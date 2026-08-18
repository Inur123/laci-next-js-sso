import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  decryptText,
  encryptText,
  encryptFile,
  generateEncryptedFilename,
} from "@/lib/encryption";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";
import { authenticateApi } from "@/lib/api-auth";
import { Organisasi, JenisSurat, Prisma } from "@prisma/client";
import { uploadToR2 } from "@/lib/storage-r2";

/**
 * @swagger
 * /api/arsip:
 *   get:
 *     summary: Ambil daftar arsip surat (Hanya dalam periode aktif)
 *     tags: [Arsip Surat]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Kata kunci pencarian
 *     responses:
 *       200:
 *         description: OK
 */
export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid API Key" },
      { status: 401 },
    );
  }

  const session = await authenticateApi(request);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const organisasiFilter = searchParams.get("organisasi") || "ALL";
  const jenisSuratFilter = searchParams.get("jenis") || "ALL";
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    const periodeAktif = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
    });

    if (!periodeAktif) return NextResponse.json({ success: true, data: [] });

    const whereClause: Prisma.ArsipSuratWhereInput = {
      userId: session.user.id,
      periodeId: periodeAktif.id,
    };

    if (
      organisasiFilter !== "ALL" &&
      Object.values(Organisasi).includes(organisasiFilter as Organisasi)
    ) {
      whereClause.organisasi = organisasiFilter as Organisasi;
    }
    if (
      jenisSuratFilter !== "ALL" &&
      Object.values(JenisSurat).includes(jenisSuratFilter as JenisSurat)
    ) {
      whereClause.jenisSurat = jenisSuratFilter as JenisSurat;
    }

    const dbData = await prisma.arsipSurat.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true } },
        periode: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const decryptedData = dbData.map((item) => ({
      id: item.id,
      noSurat: decryptText(item.noSurat),
      pengirimPenerima: decryptText(item.pengirimPenerima),
      perihal: decryptText(item.perihal),
      deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
      jenisSurat: item.jenisSurat,
      organisasi: item.organisasi,
      tanggal: item.tanggal,
      file: item.file,
      uploader: item.user.name,
      periode: item.periode.nama,
      createdAt: item.createdAt,
    }));

    let filtered = decryptedData;
    if (query) {
      const q = query.toLowerCase();
      filtered = decryptedData.filter(
        (item) =>
          item.noSurat.toLowerCase().includes(q) ||
          item.perihal.toLowerCase().includes(q) ||
          item.pengirimPenerima.toLowerCase().includes(q) ||
          (item.deskripsi && item.deskripsi.toLowerCase().includes(q)),
      );
    }

    return NextResponse.json({
      success: true,
      data: filtered.slice(0, limit),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/arsip:
 *   post:
 *     summary: Tambah arsip surat baru (Mendukung Upload File)
 *     tags: [Arsip Surat]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [noSurat, jenisSurat, tanggal, pengirimPenerima, perihal, organisasi]
 *             properties:
 *               noSurat: { type: string }
 *               jenisSurat: { type: string, enum: [MASUK, KELUAR] }
 *               tanggal: { type: string, format: date-time }
 *               pengirimPenerima: { type: string }
 *               perihal: { type: string }
 *               organisasi: { type: string, enum: [IPNU, IPPNU, BERSAMA] }
 *               deskripsi: { type: string }
 *               file: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Created
 */
export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid API Key" },
      { status: 401 },
    );
  }

  const session = await authenticateApi(request);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const noSurat = formData.get("noSurat") as string;
    const jenisSurat = formData.get("jenisSurat") as JenisSurat;
    const tanggal = formData.get("tanggal") as string;
    const pengirimPenerima = formData.get("pengirimPenerima") as string;
    const perihal = formData.get("perihal") as string;
    const organisasi = formData.get("organisasi") as Organisasi;
    const deskripsi = formData.get("deskripsi") as string;
    const file = formData.get("file") as File | null;

    if (
      !noSurat ||
      !jenisSurat ||
      !tanggal ||
      !pengirimPenerima ||
      !perihal ||
      !organisasi
    ) {
      return NextResponse.json(
        { success: false, message: "Field wajib belum lengkap" },
        { status: 400 },
      );
    }

    const periodeAktif = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
    });

    if (!periodeAktif) {
      return NextResponse.json(
        { success: false, message: "Tidak ada periode aktif" },
        { status: 400 },
      );
    }

    let r2Key: string | null = null;
    if (file && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: "Ukuran file maksimal 2MB" },
          { status: 400 },
        );
      }
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const encryptedBuffer = encryptFile(buffer);
      const encryptedFilename = generateEncryptedFilename(file.name);
      r2Key = `arsip/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);
    }

    const result = await prisma.arsipSurat.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        noSurat: encryptText(noSurat),
        jenisSurat,
        tanggal: new Date(tanggal),
        pengirimPenerima: encryptText(pengirimPenerima),
        perihal: encryptText(perihal),
        deskripsi: deskripsi ? encryptText(deskripsi) : null,
        organisasi,
        file: r2Key,
      },
    });

    createLog(
      "CREATE",
      "ARSIP_SURAT",
      `Membuat arsip surat via API: ${noSurat}`,
      result.id,
    );

    return NextResponse.json(
      { success: true, message: "Arsip berhasil dibuat", data: result },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Gagal memproses" },
      { status: 500 },
    );
  }
}
