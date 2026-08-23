import { PrismaClient } from "@prisma/client";

// Prisma remains only for Better Auth's Account/Session persistence.
const prismaClientSingleton = () => new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  datasources: { db: { url: process.env.DATABASE_URL } },
});

declare global { var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>; }
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();
if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
export default prisma;
