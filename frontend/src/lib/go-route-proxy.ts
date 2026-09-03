import "server-only";

export async function proxyGo(request: Request, path: string, authenticated = true) {
  const source = new URL(request.url);
  const target = new URL(`${process.env.GO_API_URL || "http://localhost:8080"}/api/v1${path}`);
  source.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (authenticated && cookie) headers.set("Cookie", cookie);
  if (request.headers.get("content-type")) headers.set("Content-Type", request.headers.get("content-type")!);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    // @ts-expect-error Node fetch requires duplex for streaming request bodies.
    duplex: "half",
    cache: "no-store",
  });
  const responseHeaders = new Headers();
  for (const name of ["content-type", "content-disposition", "cache-control"]) {
    const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
