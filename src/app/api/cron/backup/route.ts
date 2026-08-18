import { NextResponse } from "next/server";
import { executeBackupLogic } from "@/app/actions/backup-actions";

/**
 * GET /api/cron/backup
 *
 * Endpoint ini dipanggil oleh cron job di VPS menggunakan curl.
 * Dilindungi dengan header Authorization: Bearer <CRON_SECRET>
 *
 * Contoh crontab VPS:
 *   0 0 * * 0 curl -s -X GET "https://your-domain.com/api/cron/backup" \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/backup-cron.log 2>&1
 */
export async function GET(request: Request) {
  // Validasi CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron Backup] CRON_SECRET tidak dikonfigurasi di environment.");
    return NextResponse.json(
      { error: "Server tidak dikonfigurasi dengan benar." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== cronSecret) {
    console.warn("[Cron Backup] Akses ditolak: token tidak valid.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Jalankan backup
  console.log(`[${new Date().toISOString()}] [Cron Backup] Memulai backup otomatis terjadwal...`);
  try {
    const result = await executeBackupLogic(true);

    if (result.error) {
      console.error("[Cron Backup] GAGAL:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log("[Cron Backup] BERHASIL:", result.filename);
    return NextResponse.json(
      { success: true, filename: result.filename, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Terjadi kesalahan tidak terduga.";
    console.error("[Cron Backup] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
