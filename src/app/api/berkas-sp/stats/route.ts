import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/berkas-sp/stats:
 *   get:
 *     summary: Ambil statistik berkas SP
 *     tags: [Berkas SP]
 *     security:
 *       - apiKeyAuth: []
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
  if (!session?.user?.id)
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );

  try {
    const periodeAktif = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
    });

    if (!periodeAktif)
      return NextResponse.json({
        success: true,
        data: { total: 0, ipnu: 0, ippnu: 0 },
      });

    const whereBase = { userId: session.user.id, periodeId: periodeAktif.id };

    const [total, ipnu, ippnu] = await Promise.all([
      prisma.berkasSP.count({ where: whereBase }),
      prisma.berkasSP.count({ where: { ...whereBase, organisasi: "IPNU" } }),
      prisma.berkasSP.count({ where: { ...whereBase, organisasi: "IPPNU" } }),
    ]);

    return NextResponse.json({ success: true, data: { total, ipnu, ippnu } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
