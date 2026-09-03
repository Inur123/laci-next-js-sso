import { NextResponse, type NextRequest } from "next/server";

const API_URL = (process.env.GO_API_URL || "http://localhost:8080").replace(/\/$/, "");

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");
  const isHome = pathname === "/";
  const sessionCookie = request.cookies.get("laci_session");

  if (isDashboard && !sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (isHome && !sessionCookie) return NextResponse.next();

  let user: any = null;
  try {
    const response = await fetch(`${API_URL}/api/v1/me`, {
      headers: { Cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    });
    if (response.ok) user = (await response.json())?.data || null;
  } catch {
    // Server components will surface backend availability errors when relevant.
  }

  if (isDashboard) {
    if (!user) return NextResponse.redirect(new URL("/", request.url));
    if (user.isActive === false) {
      return NextResponse.redirect(new URL("/?error=account_inactive", request.url));
    }
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  if (isHome && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/"],
};
