import { NextResponse, type NextRequest } from "next/server";

/**
 * OPTIMIZED MIDDLEWARE
 * 
 * Menggunakan fetch ke /api/auth/get-session karena middleware
 * berjalan di Edge Runtime dan tidak bisa import Prisma secara langsung.
 * 
 * Optimasi: Skip fetch untuk halaman login/register jika tidak ada cookie session.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isOnDashboard = pathname.startsWith("/dashboard");
  const isOnAuthPage = pathname.startsWith("/login");

  // Ambil domain dari header Nginx (agar tidak perlu hardcode domain)
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || request.nextUrl.host;
  const origin = `${proto}://${host}`;

  // OPTIMASI: Cek cookie dulu sebelum fetch
  // Cari cookie session secara fleksibel (karena prefix bisa bervariasi)
  const allCookies = request.cookies.getAll();
  const sessionCookie = allCookies.find(c => c.name.includes("session_token"));
  


  // Jika di halaman auth dan TIDAK ada cookie → langsung lanjut (tidak perlu fetch)
  if (isOnAuthPage && !sessionCookie) {
    return NextResponse.next();
  }

  // Jika di dashboard dan TIDAK ada cookie → langsung redirect login
  if (isOnDashboard && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  // Hanya fetch session jika ada cookie (artinya mungkin sudah login)
  let session: any = null;
  let user: any = null;
  if (sessionCookie) {
    try {
      // Gunakan URL internal dari .env (jika ada) untuk menghindari SSL error di VPS
      const internalUrl = process.env.BETTER_AUTH_URL_INTERNAL || "https://laci.pelajarnumagetan.or.id";
      const res = await fetch(`${internalUrl}/api/auth/get-session`, {
        headers: {
          "cookie": request.headers.get("cookie") || "",
          "x-forwarded-proto": request.headers.get("x-forwarded-proto") || "https",
          "host": request.headers.get("host") || host,
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const authData = await res.json();
        if (authData) {
          session = authData.session || null;
          user = authData.user || null;
        }
      } else {
        // Jika kena limit (429), biarkan lewat ke Server Component (yang akses DB langsung)
        if (res.status === 429) {
          const response = NextResponse.next();
          response.headers.set("x-pathname", pathname);
          return response;
        }
      }
    } catch (err) {
      // Jika fetch gagal karena rate limit (429) atau timeout, 
      const response = NextResponse.next();
      response.headers.set("x-pathname", pathname);
      return response;
    }
  }

  // 1. Dashboard: cek login dan status aktif
  if (isOnDashboard) {
    if (!session || !user) {
      return NextResponse.redirect(new URL("/login", origin));
    }

    if (user.isActive === false) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", "account_inactive");
      return NextResponse.redirect(loginUrl);
    }



    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  // 2. Auth page: redirect ke dashboard jika sudah login
  if (isOnAuthPage && session && user) {
    if (user.isActive === false) {
      return NextResponse.next(); // Biarkan tetap di halaman login/register
    }
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
