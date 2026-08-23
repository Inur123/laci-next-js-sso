import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const perkaderans = await prisma.perkaderan.groupBy({
    by: ["namaPerkaderan"],
    _count: true
  });
  console.log("All Perkaderan Types:", perkaderans);

  const activePerkaderans = await prisma.perkaderan.count({
    where: {
        anggota: {
            periode: { isActive: true }
        }
    }
  });
  console.log("Count with active period:", activePerkaderans);

  const sample = await prisma.perkaderan.findFirst({
    include: {
        anggota: {
            include: {
                periode: true
            }
        }
    }
  });
  console.log("Sample Perkaderan:", JSON.stringify(sample, null, 2));
}

check();
