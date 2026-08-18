import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/encryption";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";
import { Organisasi } from "@prisma/client";

/**
 * @swagger
 * /api/berkas-sp/{id}:
 *   get:
 *     summary: Ambil detail berkas SP
 *     tags: [Berkas SP]
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
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const item = await prisma.berkasSP.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        periode: { select: { nama: true } },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        nama: decryptText(item.nama),
        catatan: item.catatan ? decryptText(item.catatan) : null,
      },
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
 * /api/berkas-sp/{id}:
 *   patch:
 *     summary: Update berkas SP
 *     tags: [Berkas SP]
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
    const body = await request.json();
    const { nama, organisasi, tanggalMulai, tanggalBerakhir, catatan } = body;

    const existing = await prisma.berkasSP.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );
    }

    const updated = await prisma.berkasSP.update({
      where: { id },
      data: {
        nama: nama ? encryptText(nama) : undefined,
        organisasi: (organisasi as Organisasi) || undefined,
        tanggalMulai: tanggalMulai ? new Date(tanggalMulai) : undefined,
        tanggalBerakhir: tanggalBerakhir
          ? new Date(tanggalBerakhir)
          : undefined,
        catatan: catatan ? encryptText(catatan) : undefined,
      },
    });

    createLog(
      "UPDATE",
      "BERKAS_SP",
      `Update berkas SP via API: ${nama || decryptText(existing.nama)}`,
      id,
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Update Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/berkas-sp/{id}:
 *   delete:
 *     summary: Hapus berkas SP
 *     tags: [Berkas SP]
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
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.berkasSP.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Access Denied / Not Found" },
        { status: 404 },
      );
    }

    await prisma.berkasSP.delete({ where: { id } });
    createLog(
      "DELETE",
      "BERKAS_SP",
      `Hapus berkas SP via API ID: ${id}`,
      id,
    );

    return NextResponse.json({ success: true, message: "Deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Delete Failed" },
      { status: 500 },
    );
  }
}
