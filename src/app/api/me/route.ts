import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-key";
import { authenticateApi } from "@/lib/api-auth";
import bcrypt from "bcryptjs";
import { createLog } from "@/lib/log-activity";
import { encryptFile, generateEncryptedFilename } from "@/lib/encryption";
import { uploadToR2, deleteFromR2 } from "@/lib/storage-r2";
import { generateVerificationToken, sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Ambil profile user yang sedang login
 *     tags: [Auth]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
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

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        isActive: true,
      },
    });
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error" },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /api/me:
 *   patch:
 *     summary: Update profile user sendiri (Mendukung Foto & Email Verification)
 *     tags: [Auth]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     description: Menggunakan Multipart Form Data jika ingin upload foto, atau JSON untuk text saja.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: OK
 */
export async function PATCH(request: Request) {
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
    const contentType = request.headers.get("content-type") || "";
    let dataToUpdate: any = {};
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      if (formData.get("name"))
        dataToUpdate.name = formData.get("name") as string;
      if (formData.get("email"))
        dataToUpdate.email = formData.get("email") as string;
      const pass = formData.get("password") as string;
      if (pass) dataToUpdate.password = await bcrypt.hash(pass, 10);
      imageFile = formData.get("image") as File | null;
    } else {
      const body = await request.json();
      if (body.name) dataToUpdate.name = body.name;
      if (body.email) dataToUpdate.email = body.email;
      const pass = body.password as string;
      if (pass) {
        const hashedPassword = await bcrypt.hash(pass, 10);
        await prisma.account.updateMany({
          where: { userId: session.user.id, providerId: "credential" },
          data: { password: hashedPassword },
        });
      }
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, image: true, name: true },
    });

    // Handle Image Upload
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const encryptedBuffer = encryptFile(buffer);
      const encryptedFilename = generateEncryptedFilename(imageFile.name);
      const r2Key = `profile/${encryptedFilename}`;

      await uploadToR2(encryptedBuffer, r2Key, imageFile.type);
      dataToUpdate.image = r2Key;

      if (currentUser?.image) {
        try {
          await deleteFromR2(currentUser.image);
        } catch (e) {}
      }
    }

    // Handle Email Verification Trigger
    if (dataToUpdate.email && dataToUpdate.email !== currentUser?.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: dataToUpdate.email },
      });
      if (emailTaken)
        return NextResponse.json(
          { success: false, message: "Email sudah digunakan" },
          { status: 400 },
        );

      dataToUpdate.emailVerified = false;
      // Note: Better Auth handles verification via its own Verification table.
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: dataToUpdate,
    });

    createLog("UPDATE", "USER", `Mengupdate profil via API`, updated.id);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        image: updated.image,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Update Error" },
      { status: 500 },
    );
  }
}
