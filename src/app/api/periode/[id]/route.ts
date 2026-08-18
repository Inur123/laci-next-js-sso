import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { validateApiKey } from "@/lib/api-key";
import { createLog } from "@/lib/log-activity";

/**
 * @swagger
 * /api/periode/{id}:
 *   patch:
 *     summary: Update periode (Aktivasi atau Ubah Nama)
 *     tags: [Periode]
 *     security:
 *       - apiKeyAuth: []
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
 *               nama: { type: string }
 *               isActive: { type: boolean }
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

  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );

  try {
    const body = await request.json();
    const { nama, isActive } = body;

    const target = await prisma.periode.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!target)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );

    const updateData: any = {};
    if (nama) updateData.nama = nama;

    // Handle activation logic
    if (isActive === true && !target.isActive) {
      await prisma.periode.updateMany({
        where: { userId: session.user.id },
        data: { isActive: false },
      });
      updateData.isActive = true;

      // Update user's active periode ID
      await prisma.user.update({
        where: { id: session.user.id },
        data: { periodeAktifId: id },
      });

      createLog(
        "UPDATE",
        "PERIODE",
        `Mengaktifkan periode via API: ${target.nama}`,
        id,
      );
    } else if (isActive === false && target.isActive) {
      // Cannot deactivate the only active period without activating another
      return NextResponse.json(
        {
          success: false,
          message:
            "Gunakan aktivasi pada periode lain untuk menonaktifkan ini.",
        },
        { status: 400 },
      );
    }

    if (nama) {
      createLog(
        "UPDATE",
        "PERIODE",
        `Mengubah nama periode via API menjadi: ${nama}`,
        id,
      );
    }

    const updated = await prisma.periode.update({
      where: { id },
      data: updateData,
    });

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
 * /api/periode/{id}:
 *   delete:
 *     summary: Hapus periode
 *     tags: [Periode]
 *     security:
 *       - apiKeyAuth: []
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

  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );

  try {
    const target = await prisma.periode.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!target)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );
    if (target.isActive)
      return NextResponse.json(
        { success: false, message: "Periode aktif tidak bisa dihapus" },
        { status: 400 },
      );

    await prisma.periode.delete({ where: { id } });
    createLog(
      "DELETE",
      "PERIODE",
      `Menghapus periode via API: ${target.nama}`,
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
