import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText } from "@/lib/encryption"; // Gunakan nama fungsi yang benar

/**
 * @swagger
 * /api/kegiatan:
 *   get:
 *     summary: Ambil data kegiatan lokal yang digabungkan dengan PHBI Nasional (Public API)
 *     tags: [Kegiatan]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       judul:
 *                         type: string
 *                       deskripsi:
 *                         type: string
 *                       lokasi:
 *                         type: string
 *                       warna:
 *                         type: string
 *                       tanggal_mulai:
 *                         type: string
 *                       tanggal_selesai:
 *                         type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 */
export async function GET(request: Request) {
  try {
    const origin = request.headers.get("origin") || "";

    const data = await prisma.agendaKegiatan.findMany({
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        tanggalMulai: "asc",
      },
    });

    const localData = data.map((item) => ({
      id: item.id,
      judul: decryptText(item.judul),
      deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
      lokasi: item.lokasi ? decryptText(item.lokasi) : null,
      warna: item.warna,
      tanggal_mulai: item.tanggalMulai,
      tanggal_selesai: item.tanggalSelesai,
      user: {
        name: item.user.name,
      },
    }));

    // Fetch PHBI data
    let phbiEvents: any[] = [];
    try {
      const currentYear = new Date().getFullYear();
      const yearsToFetch = [currentYear, currentYear + 1];
      
      const phbiPromises = yearsToFetch.map(async (year) => {
        try {
          const res = await fetch(`https://api-hari-libur.vercel.app/api?year=${year}`, {
            next: { revalidate: 86400 }
          });
          if (res.ok) {
            const json = await res.json();
            return json?.data || [];
          }
        } catch (e) {
          console.error(`Gagal fetch PHBI tahun ${year} di API public kegiatan`, e);
        }
        return [];
      });

      const phbiResults = await Promise.all(phbiPromises);
      const phbiHolidays = phbiResults.flat();

      phbiEvents = phbiHolidays.map((h: any) => ({
        id: `phbi-${h.date}`,
        judul: h.description,
        deskripsi: "Hari Libur / Peringatan Nasional",
        lokasi: "Seluruh Indonesia",
        warna: "#7c3aed",
        tanggal_mulai: h.date,
        tanggal_selesai: null,
        user: {
          name: "PHBI Nasional",
        },
      }));
    } catch (err) {
      console.error("Gagal menggabungkan PHBI ke API public kegiatan", err);
    }

    const response = NextResponse.json({
      success: true,
      data: [...localData, ...phbiEvents],
    });

    // 4. Set Header CORS sesuai izin
    // Kalau domain terdaftar, kita kasih izin spesifik. Kalau tidak, kita tetap kasih (karena ini API publik Blogger)
    // Tapi amannya kita pakai "*" saja kalau kamu mau ini bisa dipasang di mana saja
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
  } catch (error) {
    console.error("Error fetching kegiatan:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Handler untuk Preflight Request (Penting buat Browser)
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}
