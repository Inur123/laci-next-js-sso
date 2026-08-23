import { proxyGo } from "@/lib/go-route-proxy";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request){return proxyGo(request,"/realtime")}
