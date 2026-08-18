import { NextResponse } from "next/server";

/**
 * @swagger
 * /api/public/phbi:
 *   get:
 *     summary: Ambil data Hari Libur Nasional (PHBI) berdasarkan tahun
 *     tags: [PHBI]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *         description: Tahun data libur yang ingin diambil (default tahun saat ini)
 *     responses:
 *       200:
 *         description: OK
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentYear = new Date().getFullYear();
    const year = searchParams.get("year") || currentYear.toString();

    // Fetch dari API open-source Hari Libur Nasional Indonesia (api-hari-libur.vercel.app)
    const res = await fetch(`https://api-hari-libur.vercel.app/api?year=${year}`, {
      next: { revalidate: 86400 } // Cache data selama 24 jam di server Next.js agar cepat
    });

    if (!res.ok) {
      throw new Error("Gagal mengambil data dari API pihak ketiga");
    }

    const data = await res.json();

    const response = NextResponse.json({
      success: true,
      year,
      source: "https://github.com/andifahruddinakas/api-hari-libur",
      holidays: data?.data || [] // Mengembalikan array 'data' dari response API pihak ketiga
    });

    // CORS Setup agar bot/aplikasi luar bebas memanggil
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("PHBI National API Error:", error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data kalender nasional" }, { status: 500 });
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
