import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";
import { validateApiKey } from "@/lib/api-key";
import { LogAction, LogModule, Prisma } from "@prisma/client";

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Ambil riwayat aktivitas (Personal/Global Cabang)
 *     tags: [Activity Logs]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [me, global] }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: module
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string }
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

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "me";
  const search = searchParams.get("q") || "";
  const moduleFilter = searchParams.get("module") || "ALL";
  const actionFilter = searchParams.get("action") || "ALL";
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const where: Prisma.LogActivityWhereInput = {};

    if (mode === "global") {
      if (user?.role !== "SEKRETARIS_CABANG")
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 },
        );
      where.periode = { isActive: true };
    } else {
      where.userId = session.user.id;
    }

    if (moduleFilter !== "ALL") where.module = moduleFilter as LogModule;
    if (actionFilter !== "ALL") where.action = actionFilter as LogAction;
    if (search) {
      where.description = { contains: search, mode: "insensitive" };
    }

    const logs = await prisma.logActivity.findMany({
      where,
      include: {
        user: { select: { name: true, image: true, role: true } },
        periode: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
