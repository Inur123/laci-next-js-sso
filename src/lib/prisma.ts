import { PrismaClient } from "@prisma/client";
import { notifyRealtime } from "@/lib/realtime";

const mutationActions = new Set([
  "create",
  "update",
  "delete",
  "createMany",
  "updateMany",
  "deleteMany",
  "upsert",
]);

// Cache import agar tidak import ulang setiap kali
let cachedRevalidateTag: ((tag: string) => void) | null = null;
let revalidateTagLoaded = false;

async function getRevalidateTag() {
  if (revalidateTagLoaded) return cachedRevalidateTag;
  
  try {
    const mod = await import("next/cache");
    if (typeof mod.revalidateTag === "function") {
      cachedRevalidateTag = mod.revalidateTag as any;
    }
  } catch {
    // Expected to fail during seed/standalone scripts
  }
  
  revalidateTagLoaded = true;
  return cachedRevalidateTag;
}

const prismaClientSingleton = () => {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  return base.$extends({
    query: {
      $allModels: {
        $allOperations: async ({ model, operation, args, query }) => {
          // 1. Jalankan query utama DULU — ini yang paling penting
          const result = await query(args);

          // 2. Side effects di background (JANGAN await, biar tidak menahan response)
          if (model && mutationActions.has(operation)) {
            // Fire and forget — semua side effect jalan di background
            (async () => {
              try {
                const rt = await getRevalidateTag();
                if (rt) {
                  try {
                    const r = rt as any;
                    r("dashboard-stats", "max");
                    r("public-stats", "max");
                    r("log-activity", "max");
                  } catch {
                    // Ignore revalidation errors
                  }
                }

                // Realtime notification — tidak perlu await
                notifyRealtime({
                  type: "mutation",
                  model,
                  action: operation,
                }).catch(() => {});
              } catch {
                // Ignore all side-effect errors
              }
            })();
          }

          return result;
        },
      },
    },
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

// DEVELOPMENT: Prevent hot-reload from creating new instances
if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

// PRODUCTION: Graceful shutdown for serverless
if (process.env.NODE_ENV === "production") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}
