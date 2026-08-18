import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText } from "@/lib/encryption";

/**
 * @swagger
 * /api/public/stats:
 *   get:
 *     summary: Ambil data statistik publik agregat per-PAC & event mendatang
 *     tags: [Public Data]
 *     responses:
 *       200:
 *         description: OK
 */
export async function GET(request: Request) {
  try {
    const origin = request.headers.get("origin") || "";

    // 1. Ambil Data Agregat Anggota per Kecamatan (PAC)
    // Kita ambil data user (PAC) dan hitung jumlah anggotanya
    const anggotaPerPac = await prisma.user.findMany({
      where: { role: "SEKRETARIS_PAC", isActive: true },
      select: {
        name: true,
        _count: {
          select: { anggota: true }
        }
      }
    });

    // 2. Statistik Surat & Berkas
    const [totalSurat, totalSP, totalKegiatan] = await Promise.all([
      prisma.arsipSurat.count(),
      prisma.berkasSP.count(),
      prisma.agendaKegiatan.count(),
    ]);

    // 3. Ambil 5 Kegiatan Mendatang (Telah Di-dekripsi)
    const upcomingEvents = await prisma.agendaKegiatan.findMany({
      take: 5,
      where: { tanggalMulai: { gte: new Date() } },
      orderBy: { tanggalMulai: "asc" },
      select: {
        judul: true,
        tanggalMulai: true,
        lokasi: true,
        warna: true
      }
    });

    const response = NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalAnggota: anggotaPerPac.reduce((acc, curr) => acc + curr._count.anggota, 0),
        totalSurat,
        totalSertifikatSP: totalSP,
        totalKegiatan
      },
      distribution: anggotaPerPac.map(pac => ({
        name: pac.name,
        count: pac._count.anggota
      })),
      events: upcomingEvents.map(event => ({
        judul: decryptText(event.judul),
        tanggal: event.tanggalMulai,
        lokasi: event.lokasi ? decryptText(event.lokasi) : "Lokasi tidak ditentukan",
        warna: event.warna
      }))
    });

    // CORS Setup
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("Public API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
