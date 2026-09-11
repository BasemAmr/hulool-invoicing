import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "app_session";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // 1. Allow public asset requests
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api/files")
  ) {
    return NextResponse.next();
  }

  // 2. Allow public signed share routes & signed PDF downloads
  if (pathname.startsWith("/share/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/documents/") && pathname.endsWith("/pdf")) {
    // If a signature is provided in query params, let the route handler verify the HMAC
    if (searchParams.has("sig") && searchParams.has("exp")) {
      return NextResponse.next();
    }
  }

  // 3. Login page logic
  if (pathname === "/login") {
    if (sessionToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 4. Protected routes: If not authenticated, redirect to /login
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/files (public file serving)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
