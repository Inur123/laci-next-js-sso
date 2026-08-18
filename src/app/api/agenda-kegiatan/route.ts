import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/encryption";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";
import { authenticateApi } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";

// Helper logic for status
const computeStatus = (mulai: Date, selesai: Date | null) => {
  const now = new Date();
  if (selesai) {
    if (now >= mulai && now <= selesai) return "BERLANGSUNG";
  } else {
    const endOfDay = new Date(mulai);
    endOfDay.setHours(23, 59, 59, 999);
    if (now >= mulai && now <= endOfDay) return "BERLANGSUNG";
  }
  return now < mulai ? "MENDATANG" : "SELESAI";
};

/**
 * @swagger
 * /api/agenda-kegiatan:
 *   get:
 *     summary: Ambil daftar kegiatan publik (Dari semua periode aktif)
 *     tags: [Kegiatan]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
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

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  try {
    // Ambil semua kegiatan dari periode yang aktif (public)
    const dbData = await prisma.agendaKegiatan.findMany({
      where: {
        periode: { isActive: true },
      },
      include: {
        user: { select: { name: true } },
        periode: { select: { nama: true } },
      },
      orderBy: { tanggalMulai: "asc" },
    });

    const decryptedData = dbData.map((item) => ({
      id: item.id,
      judul: decryptText(item.judul),
      deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
      lokasi: item.lokasi ? decryptText(item.lokasi) : null,
      warna: item.warna,
      tanggalMulai: item.tanggalMulai,
      tanggalSelesai: item.tanggalSelesai,
      status: computeStatus(item.tanggalMulai, item.tanggalSelesai),
      uploader: item.user.name,
      periode: item.periode.nama,
      createdAt: item.createdAt,
    }));

    let filtered = decryptedData;
    if (query) {
      const q = query.toLowerCase();
      filtered = decryptedData.filter(
        (item) =>
          item.judul.toLowerCase().includes(q) ||
          (item.deskripsi && item.deskripsi.toLowerCase().includes(q)) ||
          (item.lokasi && item.lokasi.toLowerCase().includes(q)),
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
 * /api/agenda-kegiatan:
 *   post:
 *     summary: Tambah kegiatan baru
 *     tags: [Kegiatan]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [judul, warna, tanggalMulai]
 *             properties:
 *               judul: { type: string }
 *               deskripsi: { type: string }
 *               lokasi: { type: string }
 *               warna: { type: string }
 *               tanggalMulai: { type: string, format: date-time }
 *               tanggalSelesai: { type: string, format: date-time }
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

  if (session.user.role !== "SEKRETARIS_CABANG") {
    return NextResponse.json(
      { success: false, message: "Forbidden: Hanya Sekretaris Cabang" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { judul, deskripsi, lokasi, warna, tanggalMulai, tanggalSelesai } =
      body;

    if (!judul || !warna || !tanggalMulai) {
      return NextResponse.json(
        {
          success: false,
          message: "Judul, Warna, dan Tanggal Mulai wajib diisi",
        },
        { status: 400 },
      );
    }

    const periodeAktif = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
    });

    if (!periodeAktif)
      return NextResponse.json(
        { success: false, message: "Tidak ada periode aktif" },
        { status: 400 },
      );

    const result = await prisma.agendaKegiatan.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        judul: encryptText(judul),
        deskripsi: deskripsi ? encryptText(deskripsi) : null,
        lokasi: lokasi ? encryptText(lokasi) : null,
        warna,
        tanggalMulai: new Date(tanggalMulai),
        tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : null,
      },
    });

    createLog(
      "CREATE",
      "AGENDA_KEGIATAN",
      `Membuat kegiatan via API: ${judul}`,
      result.id,
    );

    return NextResponse.json(
      { success: true, message: "Kegiatan berhasil dibuat", data: result },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
