import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText } from "@/lib/encryption";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/presensi/{id}:
 *   get:
 *     summary: Ambil detail presensi beserta daftar kehadiran
 *     tags: [Presensi]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not Found
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  try {
    const presensi = await prisma.presensi.findUnique({
      where: { id, userId: session.user.id },
      include: {
        dataPresensi: { orderBy: { createdAt: "desc" } },
        periode: { select: { nama: true } },
      },
    });

    if (!presensi) {
      return NextResponse.json(
        { success: false, message: "Presensi tidak ditemukan" },
        { status: 404 },
      );
    }

    // Decrypt sensitive data
    const decryptedData = presensi.dataPresensi.map((item) => ({
      id: item.id,
      namaLengkap: decryptText(item.namaLengkap),
      email: decryptText(item.email),
      noHp: decryptText(item.noHp),
      organisasi: item.organisasi,
      tingkat: item.tingkat,
      jabatan: item.jabatan,
      instansi: item.instansi,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        id: presensi.id,
        namaKegiatan: presensi.namaKegiatan,
        tempat: presensi.tempat,
        penyelenggara: presensi.penyelenggara,
        tanggal: presensi.tanggal,
        jamMulai: presensi.jamMulai,
        jamSelesai: presensi.jamSelesai,
        isActive: presensi.isActive,
        periode: presensi.periode?.nama ?? null,
        jumlahPeserta: decryptedData.length,
        dataPresensi: decryptedData,
        createdAt: presensi.createdAt,
      },
    });
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
 * /api/presensi/{id}:
 *   patch:
 *     summary: Update presensi atau toggle status (buka/tutup)
 *     tags: [Presensi]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namaKegiatan: { type: string }
 *               tempat: { type: string }
 *               penyelenggara: { type: string }
 *               tanggal: { type: string, format: date }
 *               jamMulai: { type: string }
 *               jamSelesai: { type: string }
 *               isActive: { type: boolean, description: "Toggle status presensi" }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not Found
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  try {
    const existing = await prisma.presensi.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Presensi tidak ditemukan" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      namaKegiatan,
      tempat,
      penyelenggara,
      tanggal,
      jamMulai,
      jamSelesai,
      isActive,
    } = body;

    const updated = await prisma.presensi.update({
      where: { id },
      data: {
        namaKegiatan: namaKegiatan ?? undefined,
        tempat: tempat ?? undefined,
        penyelenggara: penyelenggara ?? undefined,
        tanggal: tanggal ? new Date(tanggal) : undefined,
        jamMulai: jamMulai ?? undefined,
        jamSelesai: jamSelesai ?? undefined,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
      },
    });

    const logMessage =
      typeof isActive === "boolean"
        ? `${isActive ? "Membuka" : "Menutup"} sesi presensi via API: ${updated.namaKegiatan}`
        : `Update presensi via API: ${updated.namaKegiatan}`;

    createLog("UPDATE", "PRESENSI", logMessage, id);

    return NextResponse.json({
      success: true,
      message: "Presensi berhasil diperbarui",
      data: updated,
    });
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
 * /api/presensi/{id}:
 *   delete:
 *     summary: Hapus presensi beserta seluruh data kehadiran
 *     tags: [Presensi]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not Found
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  try {
    const existing = await prisma.presensi.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Presensi tidak ditemukan" },
        { status: 404 },
      );
    }

    // Cascade delete (dataPresensi) ditangani Prisma via onDelete: Cascade
    await prisma.presensi.delete({ where: { id } });

    createLog(
      "DELETE",
      "PRESENSI",
      `Hapus presensi via API: ${existing.namaKegiatan}`,
      id,
    );

    return NextResponse.json({
      success: true,
      message: "Presensi berhasil dihapus",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
