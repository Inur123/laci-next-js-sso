import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/encryption";
import { authenticateApi } from "@/lib/api-auth";
import { createLog } from "@/lib/log-activity";
import { validateApiKey } from "@/lib/api-key";
import { JenisKelamin } from "@prisma/client";

/**
 * @swagger
 * /api/anggota/{id}:
 *   get:
 *     summary: Ambil detail satu anggota
 *     tags: [Anggota]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: OK
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  try {
    const item = await prisma.anggota.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        periode: { select: { nama: true } },
        perkaderans: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, message: "Not Found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        namaLengkap: decryptText(item.namaLengkap),
        nik: item.nik ? decryptText(item.nik) : null,
        nia: item.nia ? decryptText(item.nia) : null,
        noHp: item.noHp ? decryptText(item.noHp) : null,
        jabatan: item.jabatan ? decryptText(item.jabatan) : null,
        alamatLengkap: item.alamatLengkap
          ? decryptText(item.alamatLengkap)
          : null,
        hobi: item.hobi ? decryptText(item.hobi) : null,
        tempatLahir: item.tempatLahir ? decryptText(item.tempatLahir) : null,
        noRfid: item.noRfid ? decryptText(item.noRfid) : null,
        perkaderans: item.perkaderans.map((p) => ({
          ...p,
          namaPerkaderan: decryptText(p.namaPerkaderan),
          tempat: decryptText(p.tempat),
        })),
      },
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
 * /api/anggota/{id}:
 *   patch:
 *     summary: Update data anggota
 *     tags: [Anggota]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namaLengkap: { type: string }
 *               jenisKelamin: { type: string, enum: [LAKI_LAKI, PEREMPUAN] }
 *               nik: { type: string }
 *               nia: { type: string }
 *               email: { type: string }
 *               noHp: { type: string }
 *               jabatan: { type: string }
 *               alamatLengkap: { type: string }
 *               noRfid: { type: string }
 *               hobi: { type: string }
 *               perkaderans: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: OK
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

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
    const tanggalLahirStr = formData.get("tanggalLahir") as string;
    const alamatLengkap = formData.get("alamatLengkap") as string;
    const hobi = formData.get("hobi") as string;
    const noRfid = formData.get("noRfid") as string;
    const imageFile = formData.get("foto") as File | null;
    const rawPerkaderans = formData.get("perkaderans") as string;

    const existing = await prisma.anggota.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Access Denied / Not Found" },
        { status: 404 },
      );
    }

    let photoPath = existing.foto;
    if (imageFile && imageFile instanceof File && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const encryptedBuffer = (await import("@/lib/encryption")).encryptFile(
        buffer,
      );
      const encryptedFilename = (
        await import("@/lib/encryption")
      ).generateEncryptedFilename(imageFile.name);
      const r2Key = `anggota/${encryptedFilename}`;
      await (
        await import("@/lib/storage-r2")
      ).uploadToR2(encryptedBuffer, r2Key, imageFile.type);
      photoPath = r2Key;
    }

    const updated = await prisma.anggota.update({
      where: { id },
      data: {
        namaLengkap: namaLengkap ? encryptText(namaLengkap) : undefined,
        jenisKelamin: jenisKelamin || undefined,
        nik: nik !== null ? encryptText(nik) : null,
        nia: nia !== null ? encryptText(nia) : null,
        email: email || undefined,
        noHp: noHp !== null ? encryptText(noHp) : null,
        jabatan: jabatan !== null ? encryptText(jabatan) : null,
        tempatLahir: tempatLahir !== null ? encryptText(tempatLahir) : null,
        tanggalLahir: tanggalLahirStr ? new Date(tanggalLahirStr) : undefined,
        alamatLengkap:
          alamatLengkap !== null ? encryptText(alamatLengkap) : null,
        hobi: hobi !== null ? encryptText(hobi) : null,
        noRfid: noRfid !== null ? encryptText(noRfid) : null,
        foto: photoPath,
        perkaderans: rawPerkaderans
          ? {
              deleteMany: {},
              create: JSON.parse(rawPerkaderans).map((p: any) => ({
                namaPerkaderan: encryptText(p.namaPerkaderan),
                tanggal: new Date(p.tanggal),
                tempat: encryptText(p.tempat),
              })),
            }
          : undefined,
      },
    });

    createLog(
      "UPDATE",
      "ANGGOTA",
      `Update anggota via API: ${namaLengkap || decryptText(existing.namaLengkap)}`,
      id,
    );

    return NextResponse.json({
      success: true,
      message: "Updated",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Update Failed" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/anggota/{id}:
 *   delete:
 *     summary: Hapus data anggota
 *     tags: [Anggota]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: OK
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  try {
    const existing = await prisma.anggota.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Access Denied / Not Found" },
        { status: 404 },
      );
    }

    await prisma.anggota.delete({ where: { id } });
    createLog(
      "DELETE",
      "ANGGOTA",
      `Hapus data anggota via API ID: ${id}`,
      id,
    );

    return NextResponse.json({ success: true, message: "Deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Delete Failed" },
      { status: 500 },
    );
  }
}
