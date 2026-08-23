import { proxyGo } from "@/lib/go-route-proxy";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return proxyGo(request,`/images/users/${(await params).id}`)}
