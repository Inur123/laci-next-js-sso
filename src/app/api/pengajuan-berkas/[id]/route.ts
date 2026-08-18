import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/encryption";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/pengajuan-berkas/{id}:
 *   get:
 *     summary: Ambil detail pengajuan
 *     tags: [Pengajuan PAC]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: OK
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
  if (!session?.user?.id)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );

  const { id } = await params;

  try {
    const item = await prisma.pengajuanBerkas.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        periodePac: { select: { nama: true } },
        periodeCabang: { select: { nama: true } },
      },
    });

    if (!item)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        noSurat: decryptText(item.noSurat),
        keperluan: decryptText(item.keperluan),
        deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
        alasanPenolakan: item.alasanPenolakan
          ? decryptText(item.alasanPenolakan)
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/pengajuan-berkas/{id}:
 *   patch:
 *     summary: Update status pengajuan (Approval)
 *     tags: [Pengajuan PAC]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [PENDING, DITERIMA, DITOLAK] }
 *               alasanPenolakan: { type: string }
 *     responses:
 *       200:
 *         description: OK
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
  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { status, alasanPenolakan } = body;

    const existing = await prisma.pengajuanBerkas.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );

    const updated = await prisma.pengajuanBerkas.update({
      where: { id },
      data: {
        status: status as any,
        alasanPenolakan: alasanPenolakan
          ? encryptText(alasanPenolakan)
          : undefined,
      },
    });

    createLog(
      "UPDATE",
      "PENGAJUAN_BERKAS",
      `Update status pengajuan via API: ${status}`,
      id,
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/pengajuan-berkas/{id}:
 *   delete:
 *     summary: Hapus pengajuan
 *     tags: [Pengajuan PAC]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: OK
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
  if (!session?.user?.id)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );

  const { id } = await params;

  try {
    const isCabang = session.user.role === "SEKRETARIS_CABANG";
    const existing = await prisma.pengajuanBerkas.findFirst({
      where: isCabang ? { id } : { id, userId: session.user.id },
    });

    if (!existing)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );

    await prisma.pengajuanBerkas.delete({ where: { id } });
    createLog(
      "DELETE",
      "PENGAJUAN_BERKAS",
      `Hapus pengajuan via API ID: ${id}`,
      id,
    );

    return NextResponse.json({ success: true, message: "Deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
