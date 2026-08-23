import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.logActivity.count({
    where: { module: "AUTH" },
  });
  console.log("AUTH Log Count:", count);

  const lastLogs = await prisma.logActivity.findMany({
    where: { module: "AUTH" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("Last 5 AUTH logs:", JSON.stringify(lastLogs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
