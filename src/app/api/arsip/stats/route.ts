import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/arsip/stats:
 *   get:
 *     summary: Ambil statistik arsip surat
 *     tags: [Arsip Surat]
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
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!periodeAktif) return NextResponse.json({ success: true, data: null });

    const whereBase = {
      userId: session.user.id,
      periodeId: periodeAktif.id,
    };

    const [total, masuk, keluar, ipnu, ippnu, bersama] = await Promise.all([
      prisma.arsipSurat.count({ where: whereBase }),
      prisma.arsipSurat.count({ where: { ...whereBase, jenisSurat: "MASUK" } }),
      prisma.arsipSurat.count({
        where: { ...whereBase, jenisSurat: "KELUAR" },
      }),
      prisma.arsipSurat.count({ where: { ...whereBase, organisasi: "IPNU" } }),
      prisma.arsipSurat.count({ where: { ...whereBase, organisasi: "IPPNU" } }),
      prisma.arsipSurat.count({
        where: { ...whereBase, organisasi: "BERSAMA" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { total, masuk, keluar, ipnu, ippnu, bersama },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
