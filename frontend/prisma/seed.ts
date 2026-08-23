import { PrismaClient } from "@prisma/client";
import { auth } from "../src/lib/auth";

const prisma = new PrismaClient();

async function main() {
  const email = "pelajarnumagetan@gmail.com";
  const password = "password";
  const userId = "ipnuippnu-admin-cabang";

  console.log("🚀 Memulai proses seeding aman (Production Ready)...");

  // 1. Cek apakah Admin sudah ada
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (!existingUser) {
    console.log("   ➤ Admin belum ada, mendaftarkan via Better Auth API...");
    const signUpResponse = await (auth.api as any).signUpEmail({
      body: { email, password, name: "Sekretaris Cabang" },
      headers: new Headers(),
    });

    if (signUpResponse) {
      const newUserId = signUpResponse.user.id;
      // Sesuaikan ID dan Role
      await prisma.$transaction([
        prisma.user.update({
          where: { id: newUserId },
          data: { id: userId, role: "SEKRETARIS_CABANG", isActive: true, emailVerified: true },
        }),
        prisma.account.updateMany({
          where: { userId: newUserId },
          data: { userId: userId },
        }),
      ]);
      console.log("   ✓ Admin Cabang berhasil dibuat.");
    }
  } else {
    console.log("   ✓ Admin sudah ada, melewati pembuatan user.");
  }

  // 2. Seed Allowed Origins (PENTING untuk CORS/Auth)
  const domains = [
    "localhost",
    "laci.pelajarnumagetan.or.id",
    "pelajarnumagetan.or.id",
    "data.laci.pelajarnumagetan.or.id",
  ];

  console.log("   ➤ Sinkronisasi daftar domain yang diizinkan...");
  for (const domain of domains) {
    await prisma.allowedOrigin.upsert({
      where: { domain },
      update: {}, // Jangan ubah apapun kalau sudah ada
      create: { domain },
    });
  }
  console.log("   ✓ Domain berhasil disinkronkan.");

  console.log("✅ Proses Seed Selesai Tanpa Menghapus Data.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed Gagal:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
