import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/manajemen-user/{id}:
 *   patch:
 *     summary: Toggle status aktif/nonaktif user (Khusus Cabang)
 *     tags: [Users]
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

  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 403 },
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    createLog(
      "UPDATE",
      "USER",
      `${updated.isActive ? "Mengaktifkan" : "Menonaktifkan"} user: ${user.name}`,
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
 * /api/manajemen-user/{id}:
 *   delete:
 *     summary: Hapus user permanen (Khusus Cabang)
 *     tags: [Users]
 *     security:
 *       - apiKeyAuth: []
 *       - cookieAuth: []
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

  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 403 },
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user)
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );

    await prisma.user.delete({ where: { id } });
    createLog(
      "DELETE",
      "USER",
      `Menghapus user permanen: ${user.name}`,
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
