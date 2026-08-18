import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Inisialisasi Client R2
// Pastikan Environment Variable sudah diisi di Vercel/Local (.env)
const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "";

/**
 * Upload file ke Cloudflare R2
 * @param fileBuffer Buffer file (yang sudah dienkripsi)
 * @param fileName Nama file/key (contoh: "arsip/encrypted-file.pdf.enc")
 * @param contentType Tipe konten (opsional)
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = "application/octet-stream",
) {
  if (!process.env.R2_ACCOUNT_ID) throw new Error("R2 configuration missing");

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await R2.send(command);

  // Return key for database storage
  return fileName;
}

/**
 * Hapus file dari Cloudflare R2
 */
export async function deleteFromR2(fileName: string) {
  if (!process.env.R2_ACCOUNT_ID) return;

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });
    await R2.send(command);
  } catch (error) {
    console.error("Error deleting from R2:", error);
    // Suppress error agar tidak memblokir process activity log
  }
}

/**
 * Download file dari Cloudflare R2
 * Mengembalikan Buffer
 */
export async function downloadFromR2(fileName: string): Promise<Buffer> {
  if (!process.env.R2_ACCOUNT_ID) throw new Error("R2 configuration missing");

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
  });

  const response = await R2.send(command);

  if (!response.Body) {
    throw new Error("File body is empty");
  }

  // Convert Web Stream to Buffer
  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}

/**
 * Generate Signed URL (Opsional, untuk preview langsung tanpa lewat server)
 */
export async function getR2SignedUrl(fileName: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
  });

  return getSignedUrl(R2, command, { expiresIn });
}

/**
 * List files from Cloudflare R2 under backups/ prefix
 */
export async function listBackupsFromR2() {
  if (!process.env.R2_ACCOUNT_ID) throw new Error("R2 configuration missing");

  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: "backups/",
  });

  const response = await R2.send(command);
  return response.Contents || [];
}
