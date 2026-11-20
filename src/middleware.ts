import { NextResponse, type NextRequest } from "next/server";

// Fast redirect for signed-out visitors. This is a UX convenience only:
// every page and API handler re-checks the session and role on the server.
const COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function middleware(req: NextRequest) {
  const hasSession = COOKIES.some((c) => req.cookies.has(c));
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/portal/:path*", "/admin/:path*"] };
