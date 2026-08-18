import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 5,
    select: { id: true, createdAt: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  const logs = await prisma.logActivity.findMany({
    take: 5,
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  console.log("=== USER IDs ===");
  users.forEach((u) =>
    console.log(`${u.id} (Created: ${u.createdAt.toISOString()}) - ${u.name}`),
  );

  console.log("\n=== LOG IDs ===");
  logs.forEach((l) =>
    console.log(`${l.id} (Created: ${l.createdAt.toISOString()})`),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
