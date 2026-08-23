const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const userId = "ipnuippnu-admin-cabang";
  const action = "LOGIN";
  const module = "AUTH";

  console.log(`Checking user ${userId}...`);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { periodeAktifId: true, name: true },
  });

  if (!user?.periodeAktifId) {
    console.error(`User ${userId} has no active period.`);
    return;
  }

  console.log(`Creating log for ${user.name}...`);
  const log = await prisma.logActivity.create({
    data: {
      userId,
      periodeId: user.periodeAktifId,
      action,
      module,
      description: `[TEST] User login: ${user.name}`,
    },
  });

  console.log(`Created log: ${log.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
