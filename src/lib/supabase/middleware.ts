/**
 * Supabase session refresh for Next.js middleware.
 *
 * Bridges request/response cookies so `@supabase/ssr` can refresh
 * expired tokens on every navigation.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that do not require authentication */
const PUBLIC_ROUTES = ["/login", "/register", "/auth/callback"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

export async function updateSession(request: NextRequest) {
  // Dev bypass: skip all auth checks when enabled
  if (process.env.DEV_BYPASS_AUTH === "true") {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror cookies onto the request (for downstream SSR)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Recreate the response so the updated request cookies are forwarded
          supabaseResponse = NextResponse.next({ request });
          // Set cookies on the outgoing response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Use getUser() instead of getSession() for security.
  // getUser() validates the token against the Supabase auth server,
  // while getSession() only reads from the local JWT without verification.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (unless they're on a public route)
  if (!user && !isPublicRoute(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login/register
  if (user && isPublicRoute(request.nextUrl.pathname) && request.nextUrl.pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
