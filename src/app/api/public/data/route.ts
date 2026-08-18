import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText } from "@/lib/encryption";
import { validateApiKey } from "@/lib/api-key";

/**
 * @swagger
 * /api/public/data:
 *   get:
 *     summary: Ambil seluruh data terenkripsi yang didekripsi di server (Keperluan Sinkronisasi Bot)
 *     tags: [Public Data]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: OK
 */
export async function GET(request: Request) {
  // 1. Validasi API Key demi keamanan
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid API Key" },
      { status: 401 }
    );
  }

  try {
    // Jalankan semua query database secara parallel agar performanya sangat cepat
    const [
      dbArsip,
      dbAnggota,
      dbPengajuan,
      dbBerkasPimpinan,
      dbBerkasSP,
      dbAgenda,
      dbPeriode,
      dbUsers
    ] = await Promise.all([
      // 1. Arsip Surat
      prisma.arsipSurat.findMany({
        include: {
          user: { select: { name: true } },
          periode: { select: { nama: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 2. Data Anggota
      prisma.anggota.findMany({
        include: {
          user: { select: { name: true } },
          periode: { select: { nama: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 3. Pengajuan Berkas PAC
      prisma.pengajuanBerkas.findMany({
        include: {
          user: { select: { name: true } },
          periodePac: { select: { nama: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 4. Berkas Pimpinan
      prisma.berkasPimpinan.findMany({
        include: {
          user: { select: { name: true } },
          periode: { select: { nama: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 5. Berkas SP / Surat Keputusan
      prisma.berkasSP.findMany({
        include: {
          user: { select: { name: true } },
          periode: { select: { nama: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 6. Agenda Kegiatan
      prisma.agendaKegiatan.findMany({
        include: {
          user: { select: { name: true } },
        },
        orderBy: { tanggalMulai: "desc" },
      }),
      // 7. Periode Kepengurusan
      prisma.periode.findMany({
        orderBy: { createdAt: "desc" },
      }),
      // 8. Manajemen User (Sekretaris PAC & Cabang)
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    ]);

    // Didekripsi di tingkat server sebelum dikirimkan ke Bot agar Bot tinggal pakai text biasa
    const responseData = {
      success: true,
      timestamp: new Date().toISOString(),
      
      // 1. Arsip Surat
      arsipSurat: dbArsip.map((item) => ({
        id: item.id,
        noSurat: decryptText(item.noSurat),
        pengirimPenerima: decryptText(item.pengirimPenerima),
        perihal: decryptText(item.perihal),
        deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
        jenisSurat: item.jenisSurat,
        organisasi: item.organisasi,
        tanggal: item.tanggal,
        file: item.file,
        uploader: item.user.name,
        periode: item.periode.nama,
        createdAt: item.createdAt,
      })),

      // 2. Data Anggota
      anggota: dbAnggota.map((item) => ({
        id: item.id,
        nik: item.nik ? decryptText(item.nik) : null,
        nama: item.namaLengkap, // Menggunakan properti namaLengkap sesuai schema.prisma
        email: item.email || null,
        noHp: item.noHp ? decryptText(item.noHp) : null,
        tempatLahir: item.tempatLahir ? decryptText(item.tempatLahir) : null,
        tanggalLahir: item.tanggalLahir,
        alamat: item.alamatLengkap ? decryptText(item.alamatLengkap) : null, // Menggunakan alamatLengkap
        pekerjaan: item.pekerjaan ? decryptText(item.pekerjaan) : null,
        jenjangPendidikan: item.jenjangPendidikan,
        uploader: item.user.name,
        periode: item.periode.nama,
        createdAt: item.createdAt,
      })),

      // 3. Pengajuan Berkas
      pengajuanBerkas: dbPengajuan.map((item) => ({
        id: item.id,
        noSurat: item.noSurat ? decryptText(item.noSurat) : null,
        keperluan: decryptText(item.keperluan), // Sesuai schema.prisma
        deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
        status: item.status,
        file: item.file,
        pacName: item.user.name,
        periodePac: item.periodePac.nama,
        catatanAdmin: item.alasanPenolakan ? decryptText(item.alasanPenolakan) : null, // Menggunakan alasanPenolakan
        createdAt: item.createdAt,
      })),

      // 4. Berkas Pimpinan
      berkasPimpinan: dbBerkasPimpinan.map((item) => ({
        id: item.id,
        nama: decryptText(item.nama),
        catatan: item.catatan ? decryptText(item.catatan) : null,
        tanggal: item.tanggal,
        file: item.file,
        uploader: item.user.name,
        periode: item.periode.nama,
        createdAt: item.createdAt,
      })),

      // 5. Berkas SP
      berkasSP: dbBerkasSP.map((item) => ({
        id: item.id,
        nama: decryptText(item.nama),
        catatan: item.catatan ? decryptText(item.catatan) : null,
        tanggalMulai: item.tanggalMulai, // Sesuai schema.prisma
        tanggalBerakhir: item.tanggalBerakhir, // Sesuai schema.prisma
        file: item.file,
        uploader: item.user.name,
        periode: item.periode.nama,
        createdAt: item.createdAt,
      })),

      // 6. Agenda Kegiatan
      agendaKegiatan: dbAgenda.map((item) => ({
        id: item.id,
        judul: decryptText(item.judul),
        deskripsi: item.deskripsi ? decryptText(item.deskripsi) : null,
        tanggalMulai: item.tanggalMulai,
        tanggalSelesai: item.tanggalSelesai,
        lokasi: item.lokasi ? decryptText(item.lokasi) : null,
        warna: item.warna,
        uploader: item.user.name,
        createdAt: item.createdAt,
      })),

      // 7. Periode
      periode: dbPeriode.map((item) => ({
        id: item.id,
        nama: item.nama,
        isActive: item.isActive,
        createdAt: item.createdAt,
      })),

      // 8. Users
      users: dbUsers
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Unified API Route Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 }
    );
  }
}
