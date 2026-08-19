import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");

  if (
    error?.includes("UNREGISTERED_EMAIL") ||
    error === "unable_to_create_user"
  ) {
    return NextResponse.redirect(
      new URL("/?error=unregistered", request.url),
    );
  }

  // Semua error lain juga balik ke login
  return NextResponse.redirect(new URL("/?error=auth_error", request.url));
}
