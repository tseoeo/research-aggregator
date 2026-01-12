import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/saved", "/following", "/settings"];

// Routes that should redirect to home if already logged in
const authRoutes = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  // Check if the route is an auth route (login, register)
  const isAuthRoute = authRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to home if accessing auth route while logged in
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)",
  ],
};
