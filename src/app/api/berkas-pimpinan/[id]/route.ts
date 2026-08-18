import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/encryption";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/berkas-pimpinan/{id}:
 *   get:
 *     summary: Ambil detail berkas pimpinan
 *     tags: [Berkas Pimpinan]
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
    const item = await prisma.berkasPimpinan.findUnique({
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
 * /api/berkas-pimpinan/{id}:
 *   patch:
 *     summary: Update berkas pimpinan
 *     tags: [Berkas Pimpinan]
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
    const { nama, tanggal, catatan } = body;

    const existing = await prisma.berkasPimpinan.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );
    }

    const updated = await prisma.berkasPimpinan.update({
      where: { id },
      data: {
        nama: nama ? encryptText(nama) : undefined,
        tanggal: tanggal ? new Date(tanggal) : undefined,
        catatan: catatan ? encryptText(catatan) : undefined,
      },
    });

    createLog(
      "UPDATE",
      "BERKAS_PIMPINAN",
      `Update berkas pimpinan via API: ${nama || decryptText(existing.nama)}`,
      id,
    );

    return NextResponse.json({
      success: true,
      message: "Updated",
      data: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Update Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/berkas-pimpinan/{id}:
 *   delete:
 *     summary: Hapus berkas pimpinan
 *     tags: [Berkas Pimpinan]
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
    const existing = await prisma.berkasPimpinan.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Access Denied / Not Found" },
        { status: 404 },
      );
    }

    await prisma.berkasPimpinan.delete({ where: { id } });
    createLog(
      "DELETE",
      "BERKAS_PIMPINAN",
      `Hapus berkas pimpinan via API ID: ${id}`,
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
