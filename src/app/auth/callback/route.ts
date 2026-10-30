import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { syncUserProfile } from '@/lib/api'
import { getSafeRedirect } from '@/lib/safeRedirect'
import {
  INTERNAL_COOKIE,
  PENDING_REGISTRATION_COOKIE,
  attributionFromCookies,
  registrationEventId,
} from '@/lib/metaTracking'

/**
 * The API is called from this server, not the visitor's browser, so it would
 * see Netlify's IP and a "node" user agent. Forward the visitor's own; the
 * API trusts these headers only with the shared secret.
 */
function forwardedClientHeaders(request: Request): Record<string, string> {
  const secret = process.env.INTERNAL_FORWARD_SECRET
  if (!secret) return {}
  const ip =
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const userAgent = request.headers.get('user-agent')
  return {
    'x-rj-forward-secret': secret,
    ...(ip ? { 'x-rj-client-ip': ip } : {}),
    ...(userAgent ? { 'x-rj-client-ua': userAgent } : {}),
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = getSafeRedirect(requestUrl.searchParams.get('redirect'))
  let newAccountId: string | null = null

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error exchanging code for session:', error)
      const signInUrl = new URL('/auth/signin?error=callback_error', requestUrl.origin)
      signInUrl.searchParams.set('redirect', redirect)
      return NextResponse.redirect(signInUrl)
    }

    // For OAuth sign-ups, create backend user profile if it doesn't exist
    const user = data.user ?? data.session?.user
    if (user) {
      const cookieStore = await cookies()
      const readCookie = (name: string) => cookieStore.get(name)?.value
      const attribution = attributionFromCookies(readCookie)
      const provider = user.app_metadata?.provider

      const result = await syncUserProfile(
        {
          supabaseId: user.id,
          email: user.email!,
          username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          ...(provider === 'google' || provider === 'email' ? { authProvider: provider } : {}),
          ...(attribution ? { attribution } : {}),
          ...(readCookie(INTERNAL_COOKIE) === '1' ? { internal: true } : {}),
        },
        forwardedClientHeaders(request),
      )
      if (!result.success) {
        console.error('Failed to create user profile:', result.error)
      } else if (result.created) {
        newAccountId = user.id
      }
    } else {
      console.error('OAuth callback: no user found in session data', data)
    }
  }

  const response = NextResponse.redirect(new URL(redirect, requestUrl.origin))

  // A redirect can't fire the Pixel: leave the event id for the next page,
  // where MetaPixel sends the browser copy of CompleteRegistration.
  if (newAccountId) {
    response.cookies.set(PENDING_REGISTRATION_COOKIE, registrationEventId(newAccountId), {
      maxAge: 600,
      path: '/',
      sameSite: 'lax',
      secure: requestUrl.protocol === 'https:',
      httpOnly: false, // read by the browser Pixel code
    })
  }

  return response
}
