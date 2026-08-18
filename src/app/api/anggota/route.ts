import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  decryptText,
  encryptText,
  encryptFile,
  generateEncryptedFilename,
} from "@/lib/encryption";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";
import { authenticateApi } from "@/lib/api-auth";
import { JenisKelamin, Prisma } from "@prisma/client";
import { uploadToR2 } from "@/lib/storage-r2";

/**
 * @swagger
 * /api/anggota:
 *   get:
 *     summary: Ambil daftar anggota (Hanya dalam periode aktif)
 *     tags: [Anggota]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Kata kunci pencarian (nama/nik/nia)
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

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    const userRole = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isCabang = userRole?.role === "SEKRETARIS_CABANG";
    let whereClause: Prisma.AnggotaWhereInput = {};

    if (!isCabang) {
      const periodeAktif = await prisma.periode.findFirst({
        where: { userId: session.user.id, isActive: true },
      });
      if (!periodeAktif) return NextResponse.json({ success: true, data: [] });
      whereClause = {
        userId: session.user.id,
        periodeId: periodeAktif.id,
      };
    } else {
      const periodeAktif = await prisma.periode.findFirst({
        where: { userId: session.user.id, isActive: true },
      });
      if (!periodeAktif) return NextResponse.json({ success: true, data: [] });
      whereClause = {
        periodeId: periodeAktif.id,
      };
    }

    const dbData = await prisma.anggota.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true } },
        periode: { select: { nama: true } },
        perkaderans: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const decryptedData = dbData.map((item) => ({
      id: item.id,
      namaLengkap: decryptText(item.namaLengkap),
      nik: item.nik ? decryptText(item.nik) : null,
      nia: item.nia ? decryptText(item.nia) : null,
      email: item.email,
      jenisKelamin: item.jenisKelamin,
      noHp: item.noHp ? decryptText(item.noHp) : null,
      jabatan: item.jabatan ? decryptText(item.jabatan) : null,
      noRfid: item.noRfid ? decryptText(item.noRfid) : null,
      hobi: item.hobi ? decryptText(item.hobi) : null,
      foto: item.foto,
      uploader: item.user.name,
      periode: item.periode.nama,
      createdAt: item.createdAt,
      perkaderans: item.perkaderans.map((p) => ({
        ...p,
        namaPerkaderan: decryptText(p.namaPerkaderan),
        tempat: decryptText(p.tempat),
      })),
    }));

    let filtered = decryptedData;
    if (query) {
      const q = query.toLowerCase();
      filtered = decryptedData.filter(
        (item) =>
          item.namaLengkap.toLowerCase().includes(q) ||
          (item.nik && item.nik.toLowerCase().includes(q)) ||
          (item.nia && item.nia.toLowerCase().includes(q)) ||
          (item.jabatan && item.jabatan.toLowerCase().includes(q)),
      );
    }

    return NextResponse.json({
      success: true,
      data: filtered.slice(0, limit),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/anggota:
 *   post:
 *     summary: Tambah anggota baru (Mendukung Upload Foto)
 *     tags: [Anggota]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [namaLengkap, jenisKelamin]
 *             properties:
 *               namaLengkap: { type: string }
 *               jenisKelamin: { type: string, enum: [LAKI_LAKI, PEREMPUAN] }
 *               nik: { type: string }
 *               nia: { type: string }
 *               email: { type: string }
 *               noHp: { type: string }
 *               jabatan: { type: string }
 *               tempatLahir: { type: string }
 *               tanggalLahir: { type: string, format: date }
 *               alamatLengkap: { type: string }
 *               noRfid: { type: string }
 *               hobi: { type: string }
 *               perkaderans: { type: string, description: "JSON string [ { namaPerkaderan, tanggal, tempat } ]" }
 *               foto: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Created
 */
export async function POST(request: Request) {
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
    const formData = await request.formData();
    const namaLengkap = formData.get("namaLengkap") as string;
    const jenisKelamin = formData.get("jenisKelamin") as JenisKelamin;
    const nik = formData.get("nik") as string;
    const nia = formData.get("nia") as string;
    const email = formData.get("email") as string;
    const noHp = formData.get("noHp") as string;
    const jabatan = formData.get("jabatan") as string;
    const tempatLahir = formData.get("tempatLahir") as string;
    const tanggalLahir = formData.get("tanggalLahir") as string;
    const alamatLengkap = formData.get("alamatLengkap") as string;
    const noRfid = formData.get("noRfid") as string;
    const hobi = formData.get("hobi") as string;
    const perkaderansRaw = formData.get("perkaderans") as string; // JSON string
    const fotoFile = formData.get("foto") as File | null;

    if (!namaLengkap || !jenisKelamin) {
      return NextResponse.json(
        { success: false, message: "Nama dan Jenis Kelamin wajib diisi" },
        { status: 400 },
      );
    }

    const periodeAktif = await prisma.periode.findFirst({
      where: { userId: session.user.id, isActive: true },
    });

    if (!periodeAktif) {
      return NextResponse.json(
        { success: false, message: "Tidak ada periode aktif" },
        { status: 400 },
      );
    }

    let photoPath: string | null = null;
    if (fotoFile && fotoFile.size > 0) {
      if (fotoFile.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: "Ukuran foto maksimal 2MB" },
          { status: 400 },
        );
      }
      const bytes = await fotoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const encryptedBuffer = encryptFile(buffer);
      const encryptedFilename = generateEncryptedFilename(fotoFile.name);
      const r2Key = `anggota/${encryptedFilename}`;
      await uploadToR2(encryptedBuffer, r2Key, fotoFile.type);
      photoPath = r2Key;
    }

    const result = await prisma.anggota.create({
      data: {
        userId: session.user.id,
        periodeId: periodeAktif.id,
        namaLengkap: encryptText(namaLengkap),
        nik: nik ? encryptText(nik) : null,
        nia: nia ? encryptText(nia) : null,
        email: email || null,
        jenisKelamin,
        tempatLahir: tempatLahir ? encryptText(tempatLahir) : null,
        tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : null,
        alamatLengkap: alamatLengkap ? encryptText(alamatLengkap) : null,
        noHp: noHp ? encryptText(noHp) : null,
        hobi: hobi ? encryptText(hobi) : null,
        jabatan: jabatan ? encryptText(jabatan) : null,
        noRfid: noRfid ? encryptText(noRfid) : null,
        foto: photoPath,
        perkaderans: {
          create: perkaderansRaw
            ? JSON.parse(perkaderansRaw).map((p: any) => ({
                namaPerkaderan: encryptText(p.namaPerkaderan),
                tanggal: new Date(p.tanggal),
                tempat: encryptText(p.tempat),
              }))
            : [],
        },
      },
    });

    createLog(
      "CREATE",
      "ANGGOTA",
      `Membuat data anggota via API: ${namaLengkap}`,
      result.id,
    );

    return NextResponse.json(
      { success: true, message: "Anggota berhasil dibuat", data: result },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat" },
      { status: 500 },
    );
  }
}
