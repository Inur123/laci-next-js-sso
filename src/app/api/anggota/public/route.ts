import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-key";
import { encryptText } from "@/lib/encryption";
import { JenisKelamin } from "@prisma/client";

/**
 * @swagger
 * /api/anggota/public:
 *   post:
 *     summary: API Khusus untuk Sistem Anggota (Eksternal) memasukkan data ke Laci
 *     tags: [Anggota]
 *     security:
 *       - apiKeyAuth: []
 */
export async function POST(request: Request) {
  // 1. Validasi API Key demi keamanan (Hanya Sistem Anggota yang tahu key-nya)
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid API Key" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    
    // Data wajib dari sistem luar
    const { 
      pacId, 
      namaLengkap, 
      jenisKelamin, 
      wilayahId 
    } = body;

    if (!pacId || !namaLengkap || !jenisKelamin) {
      return NextResponse.json(
        { success: false, message: "pacId, namaLengkap, dan jenisKelamin wajib diisi." },
        { status: 400 }
      );
    }

    // Cari periode aktif untuk PAC tersebut
    const periodeAktif = await prisma.periode.findFirst({
      where: { userId: pacId, isActive: true },
    });

    if (!periodeAktif) {
      return NextResponse.json(
        { success: false, message: "PAC tersebut tidak memiliki periode aktif saat ini." },
        { status: 400 }
      );
    }

    // Masukkan ke database dengan status PENDING
    const anggota = await prisma.anggota.create({
      data: {
        userId: pacId,
        periodeId: periodeAktif.id,
        wilayahId: wilayahId || null,
        status: "PENDING", // Otomatis masuk antrean verifikasi
        namaLengkap: encryptText(namaLengkap),
        jenisKelamin: jenisKelamin as JenisKelamin,
        // Data opsional lainnya
        nik: body.nik ? encryptText(body.nik) : null,
        nia: body.nia ? encryptText(body.nia) : null,
        email: body.email || null,
        tempatLahir: body.tempatLahir ? encryptText(body.tempatLahir) : null,
        tanggalLahir: body.tanggalLahir ? new Date(body.tanggalLahir) : null,
        alamatLengkap: body.alamatLengkap ? encryptText(body.alamatLengkap) : null,
        noHp: body.noHp ? encryptText(body.noHp) : null,
        hobi: body.hobi ? encryptText(body.hobi) : null,
        jabatan: body.jabatan ? encryptText(body.jabatan) : null,
        pekerjaan: body.pekerjaan ? encryptText(body.pekerjaan) : null,
        jenjangPendidikan: body.jenjangPendidikan || null,
        namaInstansiPendidikan: body.namaInstansiPendidikan ? encryptText(body.namaInstansiPendidikan) : null,
        perkaderans: {
          create: Array.isArray(body.perkaderans)
            ? body.perkaderans.map((p: any) => ({
                namaPerkaderan: encryptText(p.namaPerkaderan),
                tanggal: p.tanggal ? new Date(p.tanggal) : new Date(),
                tempat: encryptText(p.tempat || "-"),
              }))
            : [],
        },
        pendidikans: {
          create: Array.isArray(body.pendidikans)
            ? body.pendidikans.map((p: any) => ({
                jenjang: p.jenjang,
                namaSekolah: encryptText(p.namaSekolah || "-"),
              }))
            : [],
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Data anggota berhasil dikirim dan menunggu verifikasi PAC.",
      data: { id: anggota.id }
    }, { status: 201 });

  } catch (error) {
    console.error("API Anggota Public Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error saat memproses pendaftaran." },
      { status: 500 }
    );
  }
}
