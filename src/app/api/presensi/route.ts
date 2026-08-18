import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText } from "@/lib/encryption";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";
import { authenticateApi } from "@/lib/api-auth";

/**
 * @swagger
 * /api/presensi:
 *   get:
 *     summary: Ambil daftar presensi milik user
 *     tags: [Presensi]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Pencarian berdasarkan nama kegiatan atau tempat
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter berdasarkan status presensi
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
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
  const status = searchParams.get("status"); // "active" | "inactive"

  try {
    const where: any = { userId: session.user.id };
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    const data = await prisma.presensi.findMany({
      where,
      orderBy: { tanggal: "desc" },
      include: {
        _count: { select: { dataPresensi: true } },
        periode: { select: { nama: true } },
      },
    });

    let filtered = data;
    if (query) {
      const q = query.toLowerCase();
      filtered = data.filter(
        (item) =>
          item.namaKegiatan.toLowerCase().includes(q) ||
          item.tempat.toLowerCase().includes(q) ||
          item.penyelenggara.toLowerCase().includes(q),
      );
    }

    const result = filtered.map((item) => ({
      id: item.id,
      namaKegiatan: item.namaKegiatan,
      tempat: item.tempat,
      penyelenggara: item.penyelenggara,
      tanggal: item.tanggal,
      jamMulai: item.jamMulai,
      jamSelesai: item.jamSelesai,
      isActive: item.isActive,
      jumlahPeserta: item._count.dataPresensi,
      periode: item.periode?.nama ?? null,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/presensi:
 *   post:
 *     summary: Buat presensi baru
 *     tags: [Presensi]
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
 *             required: [namaKegiatan, tempat, penyelenggara, tanggal, jamMulai, jamSelesai]
 *             properties:
 *               namaKegiatan: { type: string }
 *               tempat: { type: string }
 *               penyelenggara: { type: string }
 *               tanggal: { type: string, format: date }
 *               jamMulai: { type: string }
 *               jamSelesai: { type: string }
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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

  if (session.user.role !== "SEKRETARIS_CABANG") {
    return NextResponse.json(
      { success: false, message: "Forbidden: Hanya Sekretaris Cabang" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const {
      namaKegiatan,
      tempat,
      penyelenggara,
      tanggal,
      jamMulai,
      jamSelesai,
    } = body;

    if (
      !namaKegiatan ||
      !tempat ||
      !penyelenggara ||
      !tanggal ||
      !jamMulai ||
      !jamSelesai
    ) {
      return NextResponse.json(
        { success: false, message: "Semua field wajib diisi" },
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

    const presensi = await prisma.presensi.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        namaKegiatan,
        tempat,
        penyelenggara,
        tanggal: new Date(tanggal),
        jamMulai,
        jamSelesai,
      },
    });

    createLog(
      "CREATE",
      "PRESENSI",
      `Membuat presensi via API: ${namaKegiatan}`,
      presensi.id,
    );

    return NextResponse.json(
      { success: true, message: "Presensi berhasil dibuat", data: presensi },
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
