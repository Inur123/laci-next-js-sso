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
import { StatusPengajuan, PenerimaSurat, Prisma } from "@prisma/client";
import { uploadToR2 } from "@/lib/storage-r2";

/**
 * @swagger
 * /api/pengajuan:
 *   get:
 *     summary: Ambil daftar pengajuan (Mendukung mode me, cabang, referensi)
 *     tags: [Pengajuan PAC]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [me, cabang, referensi]
 *         description: me (milik sendiri), cabang (untuk disetujui), referensi (semua dalam periode cabang)
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
  if (!session?.user?.id)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "me";

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    let whereClause: Prisma.PengajuanBerkasWhereInput = {};

    if (mode === "me") {
      whereClause.userId = session.user.id;
      const periodeAktifPac = await prisma.periode.findFirst({
        where: { userId: session.user.id, isActive: true },
      });
      if (!periodeAktifPac)
        return NextResponse.json({ success: true, data: [] });
      whereClause.periodeIdPac = periodeAktifPac.id;
    } else if (mode === "cabang") {
      if (user?.role !== "SEKRETARIS_CABANG")
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 },
        );

      const periodeAktifCabang = await prisma.periode.findFirst({
        where: { userId: session.user.id, isActive: true },
      });
      if (!periodeAktifCabang)
        return NextResponse.json({ success: true, data: [] });
      whereClause.periodeId = periodeAktifCabang.id;
    } else if (mode === "referensi") {
      const periodeAktifCabang = await prisma.periode.findFirst({
        where: { isActive: true, user: { role: "SEKRETARIS_CABANG" } },
      });
      if (!periodeAktifCabang)
        return NextResponse.json({ success: true, data: [] });
      whereClause.periodeId = periodeAktifCabang.id;
    }

    const dbData = await prisma.pengajuanBerkas.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true } },
        periodePac: { select: { nama: true } },
        periodeCabang: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const decryptedData = dbData.map((item) => ({
      id: item.id,
      noSurat: decryptText(item.noSurat),
      keperluan: decryptText(item.keperluan),
      deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
      status: item.status,
      penerima: item.penerima,
      tanggal: item.tanggal,
      file: item.file,
      alasanPenolakan: item.alasanPenolakan
        ? decryptText(item.alasanPenolakan)
        : null,
      uploader: item.user.name,
      periodePac: item.periodePac?.nama,
      periodeCabang: item.periodeCabang?.nama,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({ success: true, data: decryptedData });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/pengajuan:
 *   post:
 *     summary: Buat pengajuan PAC baru (Mendukung Upload File)
 *     tags: [Pengajuan PAC]
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
 *             required: [noSurat, penerima, tanggal, keperluan, file]
 *             properties:
 *               noSurat: { type: string }
 *               penerima: { type: string, enum: [IPNU, IPPNU, BERSAMA, CBP_KPP] }
 *               tanggal: { type: string, format: date-time }
 *               keperluan: { type: string }
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
  if (!session?.user?.id)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );

  try {
    const formData = await request.formData();
    const noSurat = formData.get("noSurat") as string;
    const penerima = formData.get("penerima") as string;
    const tanggal = formData.get("tanggal") as string;
    const keperluan = formData.get("keperluan") as string;
    const deskripsi = formData.get("deskripsi") as string;
    const file = formData.get("file") as File | null;

    if (!noSurat || !penerima || !tanggal || !keperluan) {
      return NextResponse.json(
        { success: false, message: "Field wajib belum lengkap" },
        { status: 400 },
      );
    }

    const [periodePAC, periodeCabang] = await Promise.all([
      prisma.periode.findFirst({
        where: { userId: session.user.id, isActive: true },
      }),
      prisma.periode.findFirst({
        where: { isActive: true, user: { role: "SEKRETARIS_CABANG" } },
      }),
    ]);

    if (!periodePAC || !periodeCabang) {
      return NextResponse.json(
        { success: false, message: "Periode aktif PAC/Cabang tidak ditemukan" },
        { status: 400 },
      );
    }

    let uploadedFileKey: string | null = null;
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
      const r2Key = `pengajuan-berkas/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, file.type);
      uploadedFileKey = r2Key;
    } else {
      return NextResponse.json(
        { success: false, message: "File lampiran wajib diunggah" },
        { status: 400 },
      );
    }

    const result = await prisma.pengajuanBerkas.create({
      data: {
        userId: session.user.id,
        periodeId: periodeCabang.id,
        periodeIdPac: periodePAC.id,
        noSurat: encryptText(noSurat),
        penerima: penerima as PenerimaSurat,
        tanggal: new Date(tanggal),
        keperluan: encryptText(keperluan),
        deskripsi: deskripsi ? encryptText(deskripsi) : null,
        file: uploadedFileKey,
        status: "PENDING",
      },
    });

    createLog(
      "CREATE",
      "PENGAJUAN_BERKAS",
      `Membuat pengajuan via API: ${noSurat}`,
      result.id,
    );

    return NextResponse.json(
      { success: true, message: "Pengajuan berhasil dibuat", data: result },
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
