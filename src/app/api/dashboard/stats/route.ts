import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Ambil statistik dashboard lengkap (Sesuai getDashboardStats action)
 *     tags: [Dashboard]
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
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, id: true },
    });

    const activePeriode = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    });

    const periodeId = activePeriode?.id || undefined;

    // Trend 6 Bulan (Filtered by Period)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const allSurat = await prisma.arsipSurat.findMany({
      where: {
        userId: session.user.id,
        periodeId: periodeId,
        createdAt: { gte: sixMonthsAgo },
      },
      select: { createdAt: true },
    });

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return d;
    });

    const trend = months.map((date) => {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const count = allSurat.filter(
        (s) => s.createdAt >= monthStart && s.createdAt <= monthEnd,
      ).length;

      return {
        name: date.toLocaleString("id-ID", { month: "short" }),
        value: count,
      };
    });

    // Personal Stats (Filtered by Period)
    const [
      anggota,
      surat,
      berkasPimpinan,
      berkasSP,
      pengajuan,
      userCount,
      periodeCount,
      kegiatan,
      globalAnggota,
      presensi,
    ] = await Promise.all([
      prisma.anggota.count({ where: { userId: session.user.id, periodeId } }),
      prisma.arsipSurat.count({ where: { userId: session.user.id, periodeId } }),
      prisma.berkasPimpinan.count({ where: { userId: session.user.id, periodeId } }),
      prisma.berkasSP.count({ where: { userId: session.user.id, periodeId } }),
      prisma.pengajuanBerkas.count({ where: { userId: session.user.id, periodeIdPac: periodeId } }),
      prisma.user.count({
        where: {
          role: "SEKRETARIS_PAC",
          isActive: true,
          emailVerified: true,
        },
      }),
      prisma.periode.count({ where: { userId: session.user.id } }),
      prisma.agendaKegiatan.count({ where: { userId: session.user.id, periodeId } }),
      prisma.anggota.count({ 
        where: { 
          periode: { isActive: true } 
        }
      }),
      prisma.presensi.count({ where: { userId: session.user.id, periodeId } }),
    ]);

    const personal = {
      anggota,
      surat,
      berkasPimpinan,
      berkasSP,
      pengajuan,
      userCount,
      periode: periodeCount,
      kegiatan,
      globalAnggota,
      presensi,
      trend,
    };

    if (user?.role !== "SEKRETARIS_CABANG") {
      return NextResponse.json({ success: true, role: "PAC", personal });
    }

    // Cabang Monitoring (Leaderboard & Global) - Optimized with Raw Query matching dashboard-actions
    const leaderboardRaw = await prisma.$queryRaw<any[]>`
      SELECT 
        u.id, u.name, u.image,
        COUNT(DISTINCT a.id) as anggota_count,
        COUNT(DISTINCT ar.id) as arsip_count,
        COUNT(DISTINCT k.id) as kegiatan_count,
        COUNT(DISTINCT bp.id) as berkas_count,
        COUNT(DISTINCT CASE WHEN p.status = 'DITERIMA' THEN p.id END) as pengajuan_count
      FROM "User" u
      JOIN "Periode" per ON per."userId" = u.id AND per."isActive" = true
      LEFT JOIN "Anggota" a ON a."userId" = u.id AND a."periodeId" = per.id
      LEFT JOIN "ArsipSurat" ar ON ar."userId" = u.id AND ar."periodeId" = per.id
      LEFT JOIN "Kegiatan" k ON k."userId" = u.id AND k."periodeId" = per.id
      LEFT JOIN "BerkasPimpinan" bp ON bp."userId" = u.id AND bp."periodeId" = per.id
      LEFT JOIN "PengajuanPAC" p ON p."userId" = u.id AND p."periodeIdPac" = per.id
      WHERE u.role = 'SEKRETARIS_PAC' AND u."isActive" = true
      GROUP BY u.id, u.name, u.image
    `;

    const leaderboard = leaderboardRaw
      .map((row) => {
        const aCount = Number(row.anggota_count);
        const arCount = Number(row.arsip_count);
        const kCount = Number(row.agendaKegiatan_count);
        const bCount = Number(row.berkas_count);
        const pCount = Number(row.pengajuan_count);
        const totalAdmin = arCount + bCount + pCount;

        return {
          id: row.id,
          name: row.name || "Unknown",
          image: row.image,
          stats: { anggotas: aCount, totalAdmin, kegiatans: kCount },
          score: aCount * 1 + totalAdmin * 2 + kCount * 3,
        };
      })
      .sort((a, b) => b.score - a.score);

    const monitoring = {
      leaderboard,
      global: {
        totalAnggota: leaderboard.reduce((acc, c) => acc + c.stats.anggotas, 0),
        totalSurat: leaderboard.reduce((acc, c) => acc + c.stats.totalAdmin, 0),
        totalPAC: leaderboard.length,
        verifikasiPending: await prisma.user.count({
          where: { role: "SEKRETARIS_PAC", isActive: false },
        }),
      },
    };

    return NextResponse.json({
      success: true,
      role: "CABANG",
      personal,
      monitoring,
    });
  } catch (error) {
    console.error("[API_STATS_ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
