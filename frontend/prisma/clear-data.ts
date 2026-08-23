import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ADMIN_EMAIL = "lacipelajarnumagetan@gmail.com";
  
  console.log("🗑️  Starting database cleanup...");

  // 1. Delete all activity logs
  const deletedLogs = await prisma.logActivity.deleteMany({});
  console.log(`   ✓ Deleted ${deletedLogs.count} activity logs`);

  // 2. Delete all email logs (IMPORTANT: Fix added here)
  const deletedEmailLogs = await prisma.logEmail.deleteMany({});
  console.log(`   ✓ Deleted ${deletedEmailLogs.count} email logs`);

  // 3. Delete all arsip surat
  const deletedArsip = await prisma.arsipSurat.deleteMany({});
  console.log(`   ✓ Deleted ${deletedArsip.count} arsip surat`);

  // 4. Delete all anggota
  const deletedAnggota = await prisma.anggota.deleteMany({});
  console.log(`   ✓ Deleted ${deletedAnggota.count} anggota`);

  // 5. Delete all agenda kegiatan
  const deletedKegiatan = await prisma.agendaKegiatan.deleteMany({});
  console.log(`   ✓ Deleted ${deletedKegiatan.count} agenda kegiatan`);

  // 6. Delete all berkas pimpinan
  const deletedBerkasPimpinan = await prisma.berkasPimpinan.deleteMany({});
  console.log(`   ✓ Deleted ${deletedBerkasPimpinan.count} berkas pimpinan`);

  // 7. Delete all berkas SP
  const deletedBerkasSP = await prisma.berkasSP.deleteMany({});
  console.log(`   ✓ Deleted ${deletedBerkasSP.count} berkas SP`);

  // 8. Delete all pengajuan berkas
  const deletedPengajuan = await prisma.pengajuanBerkas.deleteMany({});
  console.log(`   ✓ Deleted ${deletedPengajuan.count} pengajuan berkas`);

  // 9. Delete all presensi & presensi data
  const deletedPresensi = await prisma.presensi.deleteMany({});
  console.log(`   ✓ Deleted ${deletedPresensi.count} presensi events`);

  // 10. Delete all periods EXCEPT those belonging to Sekretaris Cabang
  const cabangUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (cabangUser) {
    const deletedPeriods = await prisma.periode.deleteMany({
      where: {
        userId: { not: cabangUser.id },
      },
    });
    console.log(
      `   ✓ Deleted ${deletedPeriods.count} periods (kept Sekretaris Cabang's periods)`,
    );
  }

  // 11. Delete all users EXCEPT Sekretaris Cabang
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: { not: ADMIN_EMAIL },
    },
  });
  console.log(
    `   ✓ Deleted ${deletedUsers.count} users (kept Sekretaris Cabang: ${ADMIN_EMAIL})`,
  );

  console.log("Database cleanup completed!");
  console.log(`Only Sekretaris Cabang user (${ADMIN_EMAIL}) and their periods remain.`);
}

main()
  .catch((e) => {
    console.error("❌ Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
