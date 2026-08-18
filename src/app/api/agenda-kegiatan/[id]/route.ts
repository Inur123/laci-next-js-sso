import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/encryption";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/agenda-kegiatan/{id}:
 *   get:
 *     summary: Ambil detail satu kegiatan
 *     tags: [Kegiatan]
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
    const item = await prisma.agendaKegiatan.findUnique({
      where: { id },
      include: { user: { select: { name: true, role: true } } },
    });

    if (!item)
      return NextResponse.json(
        { success: false, message: "Kegiatan tidak ditemukan" },
        { status: 404 },
      );

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        judul: decryptText(item.judul),
        deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
        lokasi: item.lokasi ? decryptText(item.lokasi) : null,
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
 * /api/agenda-kegiatan/{id}:
 *   patch:
 *     summary: Update kegiatan
 *     tags: [Kegiatan]
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
  if (!session?.user?.id)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );

  const { id } = await params;

  try {
    const body = await request.json();
    const { judul, deskripsi, lokasi, warna, tanggalMulai, tanggalSelesai } =
      body;

    const existingItem = await prisma.agendaKegiatan.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existingItem)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );

    const updated = await prisma.agendaKegiatan.update({
      where: { id },
      data: {
        judul: judul ? encryptText(judul) : undefined,
        deskripsi: deskripsi ? encryptText(deskripsi) : undefined,
        lokasi: lokasi ? encryptText(lokasi) : undefined,
        warna,
        tanggalMulai: tanggalMulai ? new Date(tanggalMulai) : undefined,
        tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : undefined,
      },
    });

    createLog(
      "UPDATE",
      "AGENDA_KEGIATAN",
      `Update kegiatan via API: ${judul || decryptText(existingItem.judul)}`,
      id,
    );

    return NextResponse.json({
      success: true,
      message: "Updated",
      data: updated,
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
 * /api/agenda-kegiatan/{id}:
 *   delete:
 *     summary: Hapus kegiatan
 *     tags: [Kegiatan]
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
    const existingItem = await prisma.agendaKegiatan.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existingItem)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );

    await prisma.agendaKegiatan.delete({ where: { id } });
    createLog(
      "DELETE",
      "AGENDA_KEGIATAN",
      `Hapus kegiatan via API ID: ${id}`,
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
