import { NextResponse } from "next/server";

export function GET(request: Request) {
  const incoming = new URL(request.url);
  const backend = (process.env.GO_API_URL || "http://localhost:8080").replace(
    /\/$/,
    "",
  );
  const target = new URL(`${backend}/api/v1/auth/callback`);
  incoming.searchParams.forEach((value, key) =>
    target.searchParams.append(key, value),
  );
  return NextResponse.redirect(target);
}
