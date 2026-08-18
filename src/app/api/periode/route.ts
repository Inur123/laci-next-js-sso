import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-key";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";

/**
 * @swagger
 * /api/periode:
 *   get:
 *     summary: Ambil daftar periode milik sendiri
 *     tags: [Periode]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
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

  const session = await authenticateApi(request);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const data = await prisma.periode.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/periode:
 *   post:
 *     summary: Buat periode baru
 *     tags: [Periode]
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
 *             required: [nama]
 *             properties:
 *               nama: { type: string }
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
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { nama } = body;

    const count = await prisma.periode.count({
      where: { userId: session.user.id },
    });

    const isActive = count === 0;

    const result = await prisma.periode.create({
      data: {
        userId: session.user.id,
        nama,
        isActive,
      },
    });

    if (isActive) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { periodeAktifId: result.id },
      });
      const { cookies } = await import("next/headers");
      (await cookies()).delete("view_periode_id");
    }

    createLog(
      "CREATE",
      "PERIODE",
      `Membuat periode baru via API: ${nama}`,
      result.id,
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
