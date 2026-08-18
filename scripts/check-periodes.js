const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const periodes = await prisma.periode.findMany({
    select: {
      id: true,
      nama: true,
      userId: true,
      isActive: true,
    },
  });
  console.table(periodes);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
