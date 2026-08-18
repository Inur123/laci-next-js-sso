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
import { uploadToR2 } from "@/lib/storage-r2";

/**
 * @swagger
 * /api/berkas-pimpinan:
 *   get:
 *     summary: Ambil daftar berkas pimpinan (Hanya dalam periode aktif)
 *     tags: [Berkas Pimpinan]
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

    const dbData = await prisma.berkasPimpinan.findMany({
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
 * /api/berkas-pimpinan:
 *   post:
 *     summary: Tambah berkas pimpinan baru (Mendukung Upload File)
 *     tags: [Berkas Pimpinan]
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
 *             required: [nama, tanggal, file]
 *             properties:
 *               nama: { type: string }
 *               tanggal: { type: string, format: date-time }
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
    const tanggal = formData.get("tanggal") as string;
    const catatan = formData.get("catatan") as string;
    const file = formData.get("file") as File | null;

    if (!nama || !tanggal) {
      return NextResponse.json(
        { success: false, message: "Nama dan Tanggal wajib diisi" },
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
      r2Key = `berkas-pimpinan/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);
    } else {
      return NextResponse.json(
        { success: false, message: "File wajib diunggah" },
        { status: 400 },
      );
    }

    const result = await prisma.berkasPimpinan.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        nama: encryptText(nama),
        tanggal: new Date(tanggal),
        catatan: catatan ? encryptText(catatan) : null,
        file: r2Key,
      },
    });

    createLog(
      "CREATE",
      "BERKAS_PIMPINAN",
      `Membuat berkas pimpinan via API: ${nama}`,
      result.id,
    );

    return NextResponse.json(
      { success: true, message: "Berkas berhasil dibuat", data: result },
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
