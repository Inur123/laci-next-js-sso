"use server";

import { auth } from "@/auth";
import { createLog, createLogManual } from "@/lib/log-activity";
import prisma from "@/lib/prisma";
import {
  uploadToR2,
  deleteFromR2,
  listBackupsFromR2,
  getR2SignedUrl,
} from "@/lib/storage-r2";
import { revalidatePath } from "next/cache";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

export type BackupItem = {
  key: string;
  filename: string;
  size: number;
  lastModified: Date;
};

/**
 * Internal function to get the list of database backups from R2.
 * Can be called by cron scripts and client actions alike.
 */
export async function getBackupListInternal(): Promise<BackupItem[]> {
  try {
    const contents = await listBackupsFromR2();
    
    const items = contents
      .filter((obj) => obj.Key && obj.Key !== "backups/")
      .map((obj) => {
        const key = obj.Key!;
        const filename = key.replace("backups/", "");
        return {
          key,
          filename,
          size: obj.Size || 0,
          lastModified: obj.LastModified ? new Date(obj.LastModified) : new Date(),
        };
      });

    // Sort by last modified date (newest first)
    return items.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  } catch (error) {
    console.error("Error listing backups:", error);
    return [];
  }
}

/**
 * Get the list of database backups from R2, sorted by creation date (newest first).
 * Requires SEKRETARIS_CABANG authorization.
 */
export async function getBackupList(): Promise<BackupItem[]> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }
  return getBackupListInternal();
}

/**
 * Core backup logic that executes the pg_dump, zipping, upload, and limit enforcement.
 * Bypasses auth checks so that it can be invoked safely from VPS Cron scripts.
 */
export async function executeBackupLogic(isCron: boolean = false) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL env variable is not configured");
  }

  // Parse connection string
  let host = "";
  let port = "5432";
  let username = "";
  let password = "";
  let database = "";

  try {
    const dbUrl = new URL(databaseUrl);
    host = dbUrl.hostname;
    port = dbUrl.port || "5432";
    username = dbUrl.username;
    password = decodeURIComponent(dbUrl.password);
    database = dbUrl.pathname.replace(/^\//, "");
  } catch (err) {
    throw new Error("Failed to parse DATABASE_URL");
  }

  // Generate filename
  const now = new Date();
  const format2Digits = (n: number) => n.toString().padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${format2Digits(now.getMonth() + 1)}-${format2Digits(now.getDate())}`;
  const timeStr = `${format2Digits(now.getHours())}${format2Digits(now.getMinutes())}${format2Digits(now.getSeconds())}`;
  
  const prefix = "laci_db";
  const filename = `${prefix}_${dateStr}_${timeStr}.sql.gz`;
  
  const tempDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFilePath = path.join(tempDir, filename);

  try {
    // 1. Run pg_dump command and pipe to gzip
    const dumpCommand = `pg_dump -h ${host} -p ${port} -U ${username} -d ${database} | gzip > ${tempFilePath}`;
    
    await execAsync(dumpCommand, {
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
    });

    // 2. Read the generated file
    const fileBuffer = fs.readFileSync(tempFilePath);
    if (fileBuffer.length === 0) {
      throw new Error("Backup file is empty");
    }

    // 3. Find Cabang User for manual logging when cron is active
    let cabangUserId: string | null = null;
    if (isCron) {
      const cabangUser = await prisma.user.findFirst({
        where: { role: "SEKRETARIS_CABANG", isActive: true },
        select: { id: true },
      });
      cabangUserId = cabangUser?.id || null;
    }

    // 4. Check existing backups in R2 (Max 10 limit)
    const existingBackups = await getBackupListInternal();
    if (existingBackups.length >= 10) {
      // Sort oldest first (ascending lastModified)
      const sortedOldest = [...existingBackups].sort(
        (a, b) => a.lastModified.getTime() - b.lastModified.getTime()
      );
      
      // Delete the oldest backup(s) to make space for the new one (keeping it under 10)
      const toDeleteCount = (existingBackups.length - 10) + 1;
      for (let i = 0; i < toDeleteCount; i++) {
        const oldest = sortedOldest[i];
        if (oldest) {
          await deleteFromR2(oldest.key);
          const logMsg = `Sistem otomatis menghapus backup terlama: ${oldest.filename} karena batas maksimal 10 backup tercapai.`;
          if (isCron && cabangUserId) {
            await createLogManual(cabangUserId, "DELETE", "USER", logMsg);
          } else if (!isCron) {
            await createLog("DELETE", "USER", logMsg);
          }
        }
      }
    }

    // 5. Upload to R2
    const r2Key = `backups/${filename}`;
    await uploadToR2(fileBuffer, r2Key, "application/gzip");

    // 6. Cleanup local temp file
    fs.unlinkSync(tempFilePath);

    // 7. Log Activity
    const logMsg = `Berhasil melakukan backup database ${isCron ? "otomatis (Cron)" : "manual"}: ${filename}`;
    if (isCron && cabangUserId) {
      await createLogManual(cabangUserId, "CREATE", "USER", logMsg);
    } else if (!isCron) {
      await createLog("CREATE", "USER", logMsg);
    }

    revalidatePath("/dashboard/backup");
    return { success: "Database berhasil dibackup!", filename };
  } catch (error) {
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (_) {}
    }
    console.error("Backup failed:", error);
    return { error: error instanceof Error ? error.message : "Gagal membuat backup database." };
  }
}

/**
 * Create a new PostgreSQL database backup manually.
 * Requires SEKRETARIS_CABANG authorization.
 */
export async function createDatabaseBackup() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }
  return executeBackupLogic(false);
}

/**
 * Delete a backup from R2.
 */
export async function deleteDatabaseBackup(key: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }

  try {
    const filename = key.replace("backups/", "");
    await deleteFromR2(key);
    
    await createLog(
      "DELETE",
      "USER",
      `Berhasil menghapus backup database: ${filename}`
    );

    revalidatePath("/dashboard/backup");
    return { success: "Backup database berhasil dihapus!" };
  } catch (error) {
    console.error("Failed to delete backup:", error);
    return { error: "Gagal menghapus backup database." };
  }
}

/**
 * Generate a download URL for the database backup file.
 */
export async function getBackupDownloadUrl(key: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    throw new Error("Unauthorized");
  }

  try {
    const url = await getR2SignedUrl(key, 600); // 10 minutes expiry
    return { url };
  } catch (error) {
    console.error("Failed to generate signed URL:", error);
    return { error: "Gagal mendapatkan URL download." };
  }
}
