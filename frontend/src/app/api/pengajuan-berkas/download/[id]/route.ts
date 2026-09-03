import { proxyGo } from "@/lib/go-route-proxy";
import { attachmentFeedback } from "@/lib/attachment-feedback";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let response: Response;
  try {
    response = await proxyGo(request, `/pengajuan-berkas/${encodeURIComponent(id)}/download`);
  } catch {
    response = Response.json({ error: { code: "FILE_UNAVAILABLE" } }, { status: 502 });
  }
  if (response.ok || !request.headers.get("accept")?.includes("text/html")) return response;

  const feedback = attachmentFeedback(response.status);
  const isReference = new URL(request.url).searchParams.get("scope") === "reference";
  const backUrl = response.status === 401
    ? "/"
    : `/dashboard/${isReference ? "referensi-pengajuan" : "pengajuan-berkas"}/${encodeURIComponent(id)}`;
  void response.body?.cancel().catch(() => {});
  return new Response(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${feedback.title} | Laci Digital</title>
<style>body{margin:0;background:#f8fafc;color:#1e293b;font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{box-sizing:border-box;width:calc(100% - 32px);max-width:520px;padding:40px 28px;text-align:center;background:white;border:1px solid #e2e8f0;border-radius:16px}h1{font-size:22px;margin:16px 0}p{color:#64748b;font-size:15px;line-height:1.7;margin-bottom:28px}a{display:inline-block;border-radius:8px;padding:12px 20px;background:#16a34a;color:white;text-decoration:none;font-size:14px;font-weight:600}a:focus-visible{outline:3px solid #86efac;outline-offset:4px}.brand{color:#16a34a;font-size:13px;font-weight:600}</style>
</head><body><main><div class="brand">Laci Digital</div><h1>${feedback.title}</h1><p>${feedback.description}</p>
<a href="${backUrl}">${response.status === 401 ? "Masuk kembali" : "Kembali ke pengajuan"}</a></main></body></html>`, {
    status: response.status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
