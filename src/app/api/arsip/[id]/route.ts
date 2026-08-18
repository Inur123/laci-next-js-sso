import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/encryption";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";
import { Organisasi, JenisSurat } from "@prisma/client";

/**
 * @swagger
 * /api/arsip/{id}:
 *   get:
 *     summary: Ambil detail satu arsip surat
 *     tags: [Arsip Surat]
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
    const item = await prisma.arsipSurat.findUnique({
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
        noSurat: decryptText(item.noSurat),
        pengirimPenerima: decryptText(item.pengirimPenerima),
        perihal: decryptText(item.perihal),
        deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
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
 * /api/arsip/{id}:
 *   patch:
 *     summary: Update arsip surat
 *     tags: [Arsip Surat]
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
 *               noSurat: { type: string }
 *               perihal: { type: string }
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
    const {
      noSurat,
      jenisSurat,
      tanggal,
      pengirimPenerima,
      perihal,
      deskripsi,
      organisasi,
    } = body;

    const existing = await prisma.arsipSurat.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Access Denied / Not Found" },
        { status: 404 },
      );
    }

    const updated = await prisma.arsipSurat.update({
      where: { id },
      data: {
        noSurat: noSurat ? encryptText(noSurat) : undefined,
        jenisSurat: (jenisSurat as JenisSurat) || undefined,
        tanggal: tanggal ? new Date(tanggal) : undefined,
        pengirimPenerima: pengirimPenerima
          ? encryptText(pengirimPenerima)
          : undefined,
        perihal: perihal ? encryptText(perihal) : undefined,
        deskripsi: deskripsi ? encryptText(deskripsi) : undefined,
        organisasi: (organisasi as Organisasi) || undefined,
      },
    });

    createLog(
      "UPDATE",
      "ARSIP_SURAT",
      `Update arsip via API: ${noSurat || decryptText(existing.noSurat)}`,
      id,
    );

    return NextResponse.json({
      success: true,
      message: "Updated",
      data: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Update Failed" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/arsip/{id}:
 *   delete:
 *     summary: Hapus arsip surat
 *     tags: [Arsip Surat]
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
    const existing = await prisma.arsipSurat.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Access Denied / Not Found" },
        { status: 404 },
      );
    }

    await prisma.arsipSurat.delete({ where: { id } });
    createLog(
      "DELETE",
      "ARSIP_SURAT",
      `Hapus arsip via API ID: ${id}`,
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
