import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/anggota/stats:
 *   get:
 *     summary: Ambil statistik anggota
 *     tags: [Anggota]
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
    const userProfile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isCabang = userProfile?.role === "SEKRETARIS_CABANG";
    let whereClause: any = {};

    if (!isCabang) {
      const periodeAktif = await prisma.periode.findFirst({
        where: { userId: session.user.id, isActive: true },
      });
      if (!periodeAktif)
        return NextResponse.json({
          success: true,
          data: { total: 0, lakiLaki: 0, perempuan: 0 },
        });
      whereClause = { userId: session.user.id, periodeId: periodeAktif.id };
    } else {
      const periodeAktif = await prisma.periode.findFirst({
        where: { userId: session.user.id, isActive: true },
      });
      if (!periodeAktif)
        return NextResponse.json({
          success: true,
          data: { total: 0, lakiLaki: 0, perempuan: 0 },
        });
      whereClause = { periodeId: periodeAktif.id };
    }

    const [total, lakiLaki, perempuan, perkaderans] = await Promise.all([
      prisma.anggota.count({ where: whereClause }),
      prisma.anggota.count({
        where: { ...whereClause, jenisKelamin: "LAKI_LAKI" },
      }),
      prisma.anggota.count({
        where: { ...whereClause, jenisKelamin: "PEREMPUAN" },
      }),
      prisma.perkaderan.findMany({
        where: { anggota: whereClause },
        select: { namaPerkaderan: true },
      }),
    ]);

    let makesta = 0;
    let lakmud = 0;
    let latin = 0;
    let latpel = 0;
    let lakut = 0;

    const { decryptText } = await import("@/lib/encryption");

    perkaderans.forEach((p) => {
      const nama = decryptText(p.namaPerkaderan).toUpperCase();
      if (nama === "MAKESTA") makesta++;
      else if (nama === "LAKMUD") lakmud++;
      else if (nama === "LATIN") latin++;
      else if (nama === "LATPEL") latpel++;
      else if (nama === "LAKUT") lakut++;
    });

    return NextResponse.json({
      success: true,
      data: {
        total,
        lakiLaki,
        perempuan,
        makesta,
        lakmud,
        latin,
        latpel,
        lakut,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
