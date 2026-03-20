/**
 * Supabase session refresh for Next.js middleware.
 *
 * Bridges request/response cookies so `@supabase/ssr` can refresh
 * expired tokens on every navigation.
 *
 * Anonymous access: Most routes are publicly accessible. Only team/invite
 * pages require authentication. The middleware refreshes tokens when a user
 * IS logged in, but does not redirect anonymous users away from the app.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that are auth pages (login, register, callback) */
const AUTH_ROUTES = ["/login", "/register", "/auth/callback"];

/** Routes that require authentication (team collaboration features) */
const PROTECTED_ROUTES = ["/teams", "/invites"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

export async function updateSession(request: NextRequest) {
  // Dev bypass: skip all auth checks when enabled
  if (process.env.DEV_BYPASS_AUTH === "true") {
    return NextResponse.next({ request });
  }

  // If Supabase is not configured, skip auth entirely (pure local mode)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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

  // Only redirect unauthenticated users if they're trying to access protected routes
  // (teams, invites — features that require collaboration)
  if (!user && isProtectedRoute(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login/register
  if (user && isAuthRoute(request.nextUrl.pathname) && request.nextUrl.pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
