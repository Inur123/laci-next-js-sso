import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encryptText, generateHash } from "@/lib/encryption";
import { validateApiKey } from "@/lib/api-key";
import { isPresensiOpen } from "@/lib/presensi-utils";

/**
 * @swagger
 * /api/presensi/{id}/absensi:
 *   post:
 *     summary: Submit absensi publik (tanpa login)
 *     description: |
 *       Endpoint publik untuk pengunjung melakukan absensi pada kegiatan yang sedang berlangsung.
 *       Tidak memerlukan autentikasi pengguna, hanya API Key.
 *       Email dan No HP dijamin unik per event (tidak bisa double absen).
 *     tags: [Presensi]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID presensi / kegiatan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [namaLengkap, email, noHp, organisasi]
 *             properties:
 *               namaLengkap:
 *                 type: string
 *                 example: "Irrandy"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "zainurroziqin@email.com"
 *               noHp:
 *                 type: string
 *                 example: "081234567890"
 *               organisasi:
 *                 type: string
 *                 enum: [IPNU, IPPNU, UMUM]
 *                 example: "IPNU"
 *               tingkat:
 *                 type: string
 *                 description: "Tingkat organisasi (opsional, untuk struktural)"
 *                 example: "PAC"
 *               jabatan:
 *                 type: string
 *                 description: "Jabatan / posisi (opsional)"
 *                 example: "Ketua"
 *               instansi:
 *                 type: string
 *                 description: "Nama instansi (opsional, untuk non-struktural)"
 *                 example: "SMA Negeri 1"
 *     responses:
 *       201:
 *         description: Absensi berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *       400:
 *         description: Field wajib tidak lengkap atau presensi tidak aktif
 *       401:
 *         description: Invalid API Key
 *       404:
 *         description: Presensi tidak ditemukan
 *       409:
 *         description: Email / No HP sudah digunakan di kegiatan ini (double absen)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid API Key" },
      { status: 401 },
    );
  }

  const { id: presensiId } = await params;

  try {
    const body = await request.json();
    const {
      namaLengkap,
      email,
      noHp,
      organisasi,
      tingkat = null,
      jabatan = null,
      instansi = null,
    } = body;

    // Validasi field wajib
    if (!namaLengkap || !email || !noHp || !organisasi) {
      return NextResponse.json(
        {
          success: false,
          message: "namaLengkap, email, noHp, dan organisasi wajib diisi",
        },
        { status: 400 },
      );
    }

    // Cek presensi ada dan aktif
    const presensi = await prisma.presensi.findUnique({
      where: { id: presensiId },
    });

    if (!presensi) {
      return NextResponse.json(
        { success: false, message: "Presensi tidak ditemukan" },
        { status: 404 },
      );
    }

    if (!isPresensiOpen(presensi)) {
      return NextResponse.json(
        { success: false, message: "Presensi sudah ditutup atau belum dibuka" },
        { status: 400 },
      );
    }

    // Hash untuk unique constraint (tidak menyimpan plaintext duplicate check)
    const emailHash = generateHash(email);
    const noHpHash = generateHash(noHp);

    await prisma.presensiData.create({
      data: {
        presensiId,
        namaLengkap: encryptText(namaLengkap),
        email: encryptText(email),
        noHp: encryptText(noHp),
        emailHash,
        noHpHash,
        organisasi,
        tingkat,
        jabatan,
        instansi,
      },
    });

    return NextResponse.json(
      { success: true, message: "Absensi berhasil dicatat" },
      { status: 201 },
    );
  } catch (error: any) {
    // Duplicate email/noHp (unique constraint)
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email atau No HP ini sudah digunakan untuk absen di kegiatan ini",
        },
        { status: 409 },
      );
    }
    console.error("Submit absensi API error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
