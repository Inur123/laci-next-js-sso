const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Checking LOGIN and LOGOUT logs...");
  const logs = await prisma.logActivity.findMany({
    where: {
      action: {
        in: ["LOGIN", "LOGOUT"],
      },
    },
    include: {
      user: {
        select: {
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  if (logs.length === 0) {
    console.log("No LOGIN/LOGOUT logs found.");
  } else {
    logs.forEach((log) => {
      console.log(
        `[${log.createdAt.toISOString()}] ${log.user?.name} (${log.user?.role}): ${log.action} - ${log.description}`,
      );
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
