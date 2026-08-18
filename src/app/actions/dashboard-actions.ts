"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { decryptText } from "@/lib/encryption";
import { cookies } from "next/headers";

/**
 * HIGH-PERFORMANCE DASHBOARD STATS
 *
 * Optimized for Remote VPS + Vercel:
 * - Parallel data fetching
 * - Database-level aggregation (no heavy JS filtering)
 * - Removed heavy DISTINCT JOINs
 */
export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  // Get active or selected view periode
  const cookieStore = await cookies();
  const viewPeriodeId = cookieStore.get("view_periode_id")?.value;
  
  let targetPeriodeId = viewPeriodeId;
  
  if (!targetPeriodeId) {
    const activePeriode = await prisma.periode.findFirst({
      where: { userId: userId, isActive: true },
      select: { id: true, nama: true },
    });
    targetPeriodeId = activePeriode?.id || undefined;
  }

  const [user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, id: true, emailVerified: true },
    }),
  ]);

  const periodeId = targetPeriodeId;

  // 2. Get Trend Data — OPTIMIZED: Database does the counting
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // Pakai groupBy agar yang dikirim internet cuma angka, bukan ribuan data surat
  const suratStats = await prisma.arsipSurat.groupBy({
    by: ["createdAt"],
    where: {
      userId: userId,
      periodeId: periodeId || undefined,
      createdAt: { gte: sixMonthsAgo },
    },
    _count: true,
  });

  // Mapping hasil groupBy ke format chart
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });

  const trendStats = months.map((date) => {
    const month = date.getMonth();
    const year = date.getFullYear();

    const count = suratStats.reduce((acc, curr) => {
      const d = curr.createdAt;
      if (d.getMonth() === month && d.getFullYear() === year) {
        return acc + curr._count;
      }
      return acc;
    }, 0);

    return {
      name: date.toLocaleString("id-ID", { month: "short" }),
      value: count,
    };
  });

  // 3. Get All Personal Stats & Global Totals
  const [
    counts,
    globalAnggota,
    globalArsip,
    globalPimpinan,
    globalPengajuan,
    verifikasiPending,
  ] = await Promise.all([
    // Grouped counts for current user
    Promise.all([
      prisma.anggota.count({
        where: { userId, periodeId: periodeId || undefined },
      }),
      prisma.arsipSurat.count({
        where: { userId, periodeId: periodeId || undefined },
      }),
      prisma.berkasPimpinan.count({
        where: { userId, periodeId: periodeId || undefined },
      }),
      prisma.berkasSP.count({
        where: { userId, periodeId: periodeId || undefined },
      }),
      prisma.pengajuanBerkas.count({
        where:
          user?.role === "SEKRETARIS_CABANG"
            ? { periodeId: periodeId || undefined }
            : { userId, periodeIdPac: periodeId || undefined },
      }),
      prisma.user.count({
        where: { role: "SEKRETARIS_PAC", isActive: true, emailVerified: true },
      }),
      prisma.periode.count({ where: { userId } }),
      prisma.agendaKegiatan.count({
        where: { userId, periodeId: periodeId || undefined },
      }),
      prisma.presensi.count({
        where: { userId, periodeId: periodeId || undefined },
      }),
    ]),
    // Global stats: Semua yang ada di periode AKTIF
    prisma.anggota.count({ where: { periode: { isActive: true } } }),
    prisma.arsipSurat.count({ where: { periode: { isActive: true } } }),
    prisma.berkasPimpinan.count({ where: { periode: { isActive: true } } }),
    prisma.pengajuanBerkas.count({
      where: {
        status: "DITERIMA",
        OR: [
          { periodePac: { isActive: true } },
          { periodeCabang: { isActive: true } },
        ],
      },
    }),
    // Pending verification (for Cabang)
    user?.role === "SEKRETARIS_CABANG"
      ? prisma.user.count({
          where: { role: "SEKRETARIS_PAC", isActive: false },
        })
      : Promise.resolve(0),
  ]);

  const personalStats = {
    anggota: counts[0],
    surat: counts[1],
    berkasPimpinan: counts[2],
    berkasSP: counts[3],
    pengajuan: counts[4],
    userCount: counts[5],
    periode: counts[6],
    kegiatan: counts[7],
    presensi: counts[8],
    globalAnggota,
    globalArsip,
    globalPimpinan,
    globalPengajuan,
    trend: trendStats,
  };

  // IF NOT CABANG, RETURN FAST
  if (user?.role !== "SEKRETARIS_CABANG") {
    return {
      role: "PAC",
      emailVerified: !!user?.emailVerified,
      personal: personalStats,
      monitoring: null,
    };
  }

  // 4. CABANG MONITORING — OPTIMIZED LEADERBOARD
  // Mengambil data user aktif saja, stats dihitung tanpa heavy JOIN
  const [activeUsers, perkaderanStats, pendidikanStats] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SEKRETARIS_PAC", isActive: true },
      select: {
        id: true,
        name: true,
        image: true,
        _count: {
          select: {
            anggota: { where: { periode: { isActive: true } } },
            arsipSurats: { where: { periode: { isActive: true } } },
            agendaKegiatan: { where: { periode: { isActive: true } } },
            berkasPimpinans: { where: { periode: { isActive: true } } },
            pengajuanBerkass: { where: { status: "DITERIMA" } },
          },
        },
      },
      take: 50, // Limit leaderboard for performance
    }),
    prisma.perkaderan.findMany({
      where: {
        anggota: {
          periode: { isActive: true },
        },
      },
      select: {
        namaPerkaderan: true,
      },
    }),
    prisma.pendidikan.groupBy({
      by: ["jenjang"],
      where: {
        anggota: {
          periode: { isActive: true },
        },
      },
      _count: {
        id: true,
      },
    }),
  ]);

  const leaderboard = activeUsers
    .map((u) => {
      const anggotas = u._count.anggota;
      const arsipSurats = u._count.arsipSurats;
      const pengajuanBerkass = u._count.pengajuanBerkass;

      // New formula: anggotas + arsipSurats + pengajuanBerkass
      const score = anggotas + arsipSurats + pengajuanBerkass;

      return {
        id: u.id,
        name: u.name || "Unknown",
        image: u.image,
        stats: { anggotas, arsipSurats, pengajuanBerkass },
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    role: "CABANG",
    emailVerified: !!user?.emailVerified,
    personal: personalStats,
    monitoring: {
      leaderboard,
      global: {
        totalAnggota: personalStats.globalAnggota,
        totalSurat:
          personalStats.globalArsip +
          personalStats.globalPimpinan +
          personalStats.globalPengajuan,
        totalPAC: personalStats.userCount,
        verifikasiPending,
        perkaderan: {
          Makesta: (perkaderanStats as any[]).filter(
            (p) => decryptText(p.namaPerkaderan).toUpperCase() === "MAKESTA",
          ).length,
          Lakmud: (perkaderanStats as any[]).filter(
            (p) => decryptText(p.namaPerkaderan).toUpperCase() === "LAKMUD",
          ).length,
          Latin: (perkaderanStats as any[]).filter(
            (p) => decryptText(p.namaPerkaderan).toUpperCase() === "LATIN",
          ).length,
          Latpel: (perkaderanStats as any[]).filter(
            (p) => decryptText(p.namaPerkaderan).toUpperCase() === "LATPEL",
          ).length,
          Lakut: (perkaderanStats as any[]).filter(
            (p) => decryptText(p.namaPerkaderan).toUpperCase() === "LAKUT",
          ).length,
          Diklatama: (perkaderanStats as any[]).filter(
            (p) => decryptText(p.namaPerkaderan).toUpperCase() === "DIKLATAMA",
          ).length,
          Diklatmad: (perkaderanStats as any[]).filter(
            (p) => decryptText(p.namaPerkaderan).toUpperCase() === "DIKLATMAD",
          ).length,
        },
        pendidikan: {
          SD:
            (pendidikanStats as any[]).find(
              (p) => p.jenjang === "SD",
            )?._count.id || 0,
          MI:
            (pendidikanStats as any[]).find(
              (p) => p.jenjang === "MI",
            )?._count.id || 0,
          SMP:
            (pendidikanStats as any[]).find(
              (p) => p.jenjang === "SMP",
            )?._count.id || 0,
          MTs:
            (pendidikanStats as any[]).find(
              (p) => p.jenjang === "MTs",
            )?._count.id || 0,
          SMA:
            (pendidikanStats as any[]).find(
              (p) => p.jenjang === "SMA",
            )?._count.id || 0,
          SMK:
            (pendidikanStats as any[]).find(
              (p) => p.jenjang === "SMK",
            )?._count.id || 0,
          MAN:
            (pendidikanStats as any[]).find(
              (p) => p.jenjang === "MAN",
            )?._count.id || 0,
          KULIAH:
            (pendidikanStats as any[]).find(
              (p) => p.jenjang === "KULIAH",
            )?._count.id || 0,
        },
      },
    },
  };
}

/**
 * PUBLIC STATS — Parallelized
 */
export async function getPublicStats() {
  const activePeriode = await prisma.periode.findFirst({
    where: { user: { role: "SEKRETARIS_CABANG" }, isActive: true },
    select: { nama: true },
  });

  const activeName = activePeriode?.nama;

  const [anggotaCount, suratCount] = await Promise.all([
    prisma.anggota.count({
      where: activeName ? { periode: { nama: activeName } } : {},
    }),
    prisma.pengajuanBerkas.count({
      where: activeName ? { periodeCabang: { nama: activeName } } : {},
    }),
  ]);

  return {
    anggotaCount: anggotaCount || 0,
    suratCount: suratCount || 0,
  };
}
