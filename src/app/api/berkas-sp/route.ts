import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  decryptText,
  encryptText,
  encryptFile,
  generateEncryptedFilename,
} from "@/lib/encryption";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";
import { Organisasi } from "@prisma/client";
import { uploadToR2 } from "@/lib/storage-r2";

/**
 * @swagger
 * /api/berkas-sp:
 *   get:
 *     summary: Ambil daftar berkas SP (Hanya dalam periode aktif)
 *     tags: [Berkas SP]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Pencarian nama/catatan
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

  try {
    const periodeAktif = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
    });

    if (!periodeAktif) return NextResponse.json({ success: true, data: [] });

    const dbData = await prisma.berkasSP.findMany({
      where: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
      },
      include: {
        user: { select: { name: true } },
        periode: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const decryptedData = dbData.map((item) => ({
      id: item.id,
      nama: decryptText(item.nama),
      catatan: item.catatan ? decryptText(item.catatan) : null,
      organisasi: item.organisasi,
      tanggalMulai: item.tanggalMulai,
      tanggalBerakhir: item.tanggalBerakhir,
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
          item.nama.toLowerCase().includes(q) ||
          (item.catatan && item.catatan.toLowerCase().includes(q)),
      );
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/berkas-sp:
 *   post:
 *     summary: Tambah berkas SP baru (Mendukung Upload File)
 *     tags: [Berkas SP]
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
 *             required: [nama, organisasi, tanggalMulai, tanggalBerakhir]
 *             properties:
 *               nama: { type: string }
 *               organisasi: { type: string, enum: [IPNU, IPPNU, BERSAMA] }
 *               tanggalMulai: { type: string, format: date-time }
 *               tanggalBerakhir: { type: string, format: date-time }
 *               catatan: { type: string }
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
    const nama = formData.get("nama") as string;
    const organisasi = formData.get("organisasi") as string;
    const tanggalMulai = formData.get("tanggalMulai") as string;
    const tanggalBerakhir = formData.get("tanggalBerakhir") as string;
    const catatan = formData.get("catatan") as string;
    const file = formData.get("file") as File | null;

    if (!nama || !organisasi || !tanggalMulai || !tanggalBerakhir) {
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
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: "Ukuran file maksimal 5MB" },
          { status: 400 },
        );
      }
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const encryptedBuffer = encryptFile(buffer);
      const encryptedFilename = generateEncryptedFilename(file.name);
      r2Key = `berkas-sp/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);
    }

    const result = await prisma.berkasSP.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        nama: encryptText(nama),
        organisasi: organisasi as Organisasi,
        tanggalMulai: new Date(tanggalMulai),
        tanggalBerakhir: new Date(tanggalBerakhir),
        catatan: catatan ? encryptText(catatan) : null,
        file: r2Key,
      },
    });

    createLog(
      "CREATE",
      "BERKAS_SP",
      `Membuat berkas SP via API: ${nama}`,
      result.id,
    );

    return NextResponse.json(
      { success: true, message: "Berkas SP berhasil dibuat", data: result },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
