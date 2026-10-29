import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSafeRedirect } from '@/lib/safeRedirect'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/auth')
  const isApiRoute = pathname.startsWith('/api')
  const isHomePage = pathname === '/'
  const isDepartmentPage = pathname.startsWith('/departments')
  const isPublicPage = pathname === '/privacy-policy' || pathname === '/terms-of-service' || pathname === '/about' || pathname === '/contact' || pathname === '/pricing' || pathname === '/subscription' || pathname === '/refund' || pathname === '/pricing/payment'
  const isProtectedRoute = !isHomePage && !isAuthPage && !isApiRoute && !isPublicPage && !isDepartmentPage

  // Use getSession() in middleware — reads JWT from cookie without a network call.
  // getUser() makes an external request to Supabase on every request which causes
  // "middleware invocation failed" on Vercel's Edge Runtime.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // TESTING: Disabled authentication protection - all pages are public
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/auth/signin', request.url)
    // Keep the query string (e.g. ?dept=) so the user lands back on the same exam
    redirectUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }

  if (isAuthPage && user && !pathname.includes('/callback')) {
    const redirect = getSafeRedirect(request.nextUrl.searchParams.get('redirect'))
    return NextResponse.redirect(new URL(redirect, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|json|lottie)$).*)',
  ],
}
