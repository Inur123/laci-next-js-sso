import { proxyGo } from "@/lib/go-route-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  if (!/(^|;\s*)laci_session=/.test(cookie))
    return new Response(null, { status: 204 });
  return proxyGo(request, "/realtime");
}
