import { Pool, Client } from "pg";
import { EventEmitter } from "events";

/**
 * GLOBAL REALTIME HUB
 *
 * Strategi: "Satu Koneksi untuk Ribuan User"
 * Kita hanya pakai 1 koneksi database persisten untuk LISTEN,
 * lalu disebarkan ke semua user yang sedang online lewat memori (EventEmitter).
 *
 * PENTING: Semua state disimpan di globalThis agar survive HMR (Hot Module Replacement)
 * di development mode. Tanpa ini, setiap save file akan membuat instance baru
 * dan SSE connections akan menunjuk ke EventEmitter yang sudah mati.
 */

// Deklarasi global types untuk TypeScript
declare global {
  var __realtimeHub: EventEmitter | undefined;
  var __realtimePool: Pool | undefined;
  var __realtimeListenerClient: Client | undefined;
  var __realtimeListenerStarted: boolean | undefined;
}

// Singleton Emitter — gunakan globalThis agar survive HMR
if (!globalThis.__realtimeHub) {
  globalThis.__realtimeHub = new EventEmitter();
  globalThis.__realtimeHub.setMaxListeners(2000);
}
export const realtimeHub = globalThis.__realtimeHub;

export function getPool(): Pool {
  if (!globalThis.__realtimePool) {
    const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL/DIRECT_URL not set");

    globalThis.__realtimePool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return globalThis.__realtimePool;
}

/**
 * Memulai Listener Tunggal (PENTING!)
 * Dipanggil otomatis saat ada user yang konek.
 */
async function startGlobalListener() {
  if (globalThis.__realtimeListenerClient) return; // Sudah jalan

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) return;

  try {
    const client = new Client({ connectionString: databaseUrl });
    globalThis.__realtimeListenerClient = client;

    await client.connect();
    await client.query("LISTEN laci_realtime");

    client.on("notification", (msg) => {
      const payload = msg.payload || "{}";
      // SEBARKAN BERITA KE SEMUA USER (DI MEMORI)
      realtimeHub.emit("update", payload);
    });

    client.on("error", (err) => {
      console.error("[Realtime] Listener Error:", err.message);
      globalThis.__realtimeListenerClient = undefined;
      setTimeout(startGlobalListener, 5000); // Auto-reconnect jika putus
    });

    client.on("end", () => {
      globalThis.__realtimeListenerClient = undefined;
      setTimeout(startGlobalListener, 5000);
    });
  } catch (err) {
    console.error(
      "[Realtime] Failed to start listener:",
      (err as Error).message,
    );
    globalThis.__realtimeListenerClient = undefined;
    setTimeout(startGlobalListener, 5000);
  }
}

// Jalankan listener secara otomatis, tapi hanya jika dalam konteks server (bukan saat build/seed)
if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  const isServer =
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NODE_ENV === "development";
  
  // Deteksi build phase
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";

  if (isServer && !isBuild && !globalThis.__realtimeListenerStarted) {
    globalThis.__realtimeListenerStarted = true;
    startGlobalListener();
  }
}

/**
 * Panggil fungsi ini jika ada mutasi data (Create/Update/Delete)
 */
export async function notifyRealtime(payload: object) {
  try {
    const p = getPool();
    await p.query("SELECT pg_notify($1, $2)", [
      "laci_realtime",
      JSON.stringify(payload),
    ]);
  } catch (err) {
    console.error("[Realtime] Notification failed:", (err as Error).message);
  }
}
