import { proxyGo } from "@/lib/go-route-proxy";

export async function GET(request: Request) {
  return proxyGo(request, "/public/phbi", false);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
