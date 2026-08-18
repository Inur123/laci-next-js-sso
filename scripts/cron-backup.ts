import { executeBackupLogic } from "../src/app/actions/backup-actions";

async function runCron() {
  console.log(`[${new Date().toISOString()}] Memulai proses backup otomatis terjadwal (Cron)...`);
  try {
    const result = await executeBackupLogic(true);
    if (result.error) {
      console.error("Backup otomatis GAGAL:", result.error);
      process.exit(1);
    } else {
      console.log("Backup otomatis BERHASIL:", result.filename);
      process.exit(0);
    }
  } catch (error) {
    console.error("Error tidak terduga saat backup otomatis:", error);
    process.exit(1);
  }
}

runCron();
