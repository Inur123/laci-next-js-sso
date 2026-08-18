import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/pengajuan-berkas/stats:
 *   get:
 *     summary: Ambil statistik pengajuan PAC
 *     tags: [Pengajuan PAC]
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
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    let stats: any = {};

    if (user?.role === "SEKRETARIS_PAC") {
      const allMyPengajuan = await prisma.pengajuanBerkas.findMany({
        where: { userId: session.user.id },
        select: { status: true },
      });
      stats = {
        total: allMyPengajuan.length,
        pending: allMyPengajuan.filter((p) => p.status === "PENDING").length,
        diterima: allMyPengajuan.filter((p) => p.status === "DITERIMA").length,
        ditolak: allMyPengajuan.filter((p) => p.status === "DITOLAK").length,
      };
    } else if (user?.role === "SEKRETARIS_CABANG") {
      const periodeAktif = await prisma.periode.findFirst({
        where: { userId: session.user.id, isActive: true },
      });
      if (periodeAktif) {
        const allPengajuan = await prisma.pengajuanBerkas.findMany({
          where: { periodeId: periodeAktif.id },
          select: { status: true, penerima: true },
        });
        stats = {
          total: allPengajuan.length,
          ipnu: allPengajuan.filter((p) => p.penerima === "IPNU").length,
          ippnu: allPengajuan.filter((p) => p.penerima === "IPPNU").length,
          bersama: allPengajuan.filter((p) => p.penerima === "BERSAMA").length,
          cbpKpp: allPengajuan.filter((p) => p.penerima === "CBP_KPP").length,
          pending: allPengajuan.filter((p) => p.status === "PENDING").length,
          diterima: allPengajuan.filter((p) => p.status === "DITERIMA").length,
          ditolak: allPengajuan.filter((p) => p.status === "DITOLAK").length,
        };
      }
    }

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}
