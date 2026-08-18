import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/manajemen-user:
 *   get:
 *     summary: Ambil daftar user (Khusus Cabang)
 *     tags: [Users]
 *     security:
 *       - apiKeyAuth: []
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

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    return NextResponse.json(
      { success: false, message: "Unauthorized / Access Denied" },
      { status: 403 },
    );
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
