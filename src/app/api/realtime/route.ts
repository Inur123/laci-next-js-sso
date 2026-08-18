import { realtimeHub } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      // Fungsi untuk sebar berita
      const onUpdate = (payload: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          cleanup();
        }
      };

      // Join ke Hub Realtime (Di memori server, bukan di DB!)
      realtimeHub.on("update", onUpdate);

      // HEARTBEAT (Tetap penting di Vercel agar tidak putus)
      const heartbeat = setInterval(() => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            cleanup();
          }
        }
      }, 20000);

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        
        clearInterval(heartbeat);
        realtimeHub.off("update", onUpdate); // Keluar dari antrean Hub

        try {
          controller.close();
        } catch {}
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
