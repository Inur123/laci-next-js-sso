import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { JenisWilayah } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jenis = searchParams.get("jenis") as JenisWilayah | null;
    const pacId = searchParams.get("pacId");

    const where: any = {};
    
    if (jenis && ["RANTING", "PK"].includes(jenis)) {
      where.jenis = jenis;
    }
    
    if (pacId) {
      where.userId = pacId;
    }

    const wilayahs = await prisma.wilayah.findMany({
      where,
      select: {
        id: true,
        jenis: true,
        nama: true,
        ketua: true,
        kontak: true,
        alamat: true,
        user: {
          select: {
            id: true,
            name: true,
          }
        },
        periode: {
          select: {
            nama: true,
            isActive: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const response = NextResponse.json({
      success: true,
      count: wilayahs.length,
      data: wilayahs,
    });

    const origin = request.headers.get("origin") || "*";
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
  } catch (error) {
    console.error("API Wilayah Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
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
