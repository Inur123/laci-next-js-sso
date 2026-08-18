import crypto from "crypto";
import { gzipSync, gunzipSync } from "zlib";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

/**
 * Derive a proper 32-byte key from the ENCRYPTION_KEY
 */
// Cache the key to avoid expensive derivation on every call
let cachedKey: Buffer | null = null;

function getEncryptionKey32(): Buffer {
  if (cachedKey) return cachedKey;
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not defined");
  }

  cachedKey = crypto.scryptSync(
    ENCRYPTION_KEY,
    "laci-ipnu-ippnu-salt-2025",
    32,
  );
  return cachedKey;
}

/**
 * Encrypt text data
 */
export function encryptText(text: string): string {
  if (!text) return "";

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey32(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Return IV + encrypted data
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt text data
 */
export function decryptText(encryptedText: string): string {
  if (!encryptedText) return "";

  try {
    const parts = encryptedText.split(":");
    
    // Fallback for older data that was stored as plaintext
    // A valid encrypted string has an IV of 16 bytes (32 hex chars) and a colon separator
    if (parts.length !== 2 || parts[0].length !== 32) {
      return encryptedText;
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey32(),
      iv,
    );

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Decryption failed for text: ${encryptedText.substring(0, 20)}... Error:`,
      message,
    );
    // Fallback to original text if decryption fails
    return encryptedText;
  }
}

/**
 * Encrypt file buffer
 */
/**
 * Encrypt file buffer with compression
 */
export function encryptFile(buffer: Buffer): Buffer {
  // Compress first
  const compressed = gzipSync(buffer);

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey32(), iv);

  // Encrypt compressed data
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);

  // Prepend IV to encrypted data
  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypt file buffer
 */
/**
 * Decrypt file buffer with decompression
 */
export function decryptFile(encryptedBuffer: Buffer): Buffer {
  try {
    const iv = encryptedBuffer.subarray(0, IV_LENGTH);
    const encrypted = encryptedBuffer.subarray(IV_LENGTH);

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey32(),
      iv,
    );

    const decryptedCompressed = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    // Decompress result
    return gunzipSync(decryptedCompressed);
  } catch (error) {
    console.error("File decryption error:", error);
    throw new Error("Failed to decrypt file");
  }
}

/**
 * Generate secure filename for encrypted file
 */
export function generateEncryptedFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const ext = originalFilename.split(".").pop()?.toLowerCase() || "bin";

  // Use hyphen instead of dot to "hide" the format from being a secondary extension
  return `${timestamp}-${random}-${ext}.enc`;
}

/**
 * Get original extension from encrypted filename
 */
export function getOriginalExtension(encryptedFilename: string): string {
  if (!encryptedFilename) return "";
  const filename = encryptedFilename.split("/").pop() || "";
  const base = filename.replace(/\.enc$/, "");

  // Match NEW pattern: timestamp-random-ext
  const newMatch = base.match(/^\d+-[a-f0-9]+-(.+)$/);
  if (newMatch) return newMatch[1].toLowerCase();

  // Match OLD pattern: timestamp-random.ext
  const oldMatch = base.match(/^\d+-[a-f0-9]+\.(.+)$/);
  if (oldMatch) return oldMatch[1].toLowerCase();

  return "bin";
}

/**
 * Check if file is a PDF based on encrypted filename
 */
export function isPdf(encryptedFilename: string | null | undefined): boolean {
  if (!encryptedFilename) return false;
  const ext = getOriginalExtension(encryptedFilename);
  return ext === "pdf";
}

/**
 * Check if file is an image based on encrypted filename
 */
export function isImage(encryptedFilename: string | null | undefined): boolean {
  if (!encryptedFilename) return false;
  const ext = getOriginalExtension(encryptedFilename);
  return ["jpg", "jpeg", "png", "webp"].includes(ext);
}

/**
 * Get a clean filename for display in the UI (hides the extension part)
 */
export function getDisplayFilename(
  fullPath: string | null | undefined,
): string {
  if (!fullPath) return "";
  const filename = fullPath.split("/").pop() || "";

  // Turn timestamp-random-ext.enc OR timestamp-random.ext.enc
  // Into timestamp-random.enc
  return filename.replace(/(^\d+-[a-f0-9]+)[.-](.+)\.enc$/, "$1.enc");
}

/**
 * Generate a short-lived download token for mobile/external viewers
 */
export function generateDownloadToken(id: string): string {
  // Token valid for 5 minutes (enough for external viewer to fetch)
  const expiry = Date.now() + 5 * 60 * 1000;
  return encryptText(`${id}:${expiry}`);
}

/**
 * Verify a download token and return the ID if valid
 */
export function verifyDownloadToken(token: string): string | null {
  try {
    const decrypted = decryptText(token);
    if (!decrypted) return null;
    
    const [id, expiryStr] = decrypted.split(":");
    const expiry = parseInt(expiryStr);
    
    if (isNaN(expiry) || expiry < Date.now()) {
      return null;
    }
    
    return id;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a hash for sensitive data to allow unique checks without decryption
 */
export function generateHash(text: string): string {
  if (!text) return "";
  return crypto
    .createHash("sha256")
    .update(text.toLowerCase().trim())
    .digest("hex");
}
