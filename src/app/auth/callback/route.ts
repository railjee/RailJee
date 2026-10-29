import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncUserProfile } from '@/lib/api'
import { getSafeRedirect } from '@/lib/safeRedirect'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = getSafeRedirect(requestUrl.searchParams.get('redirect'))

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
      const result = await syncUserProfile({
        supabaseId: user.id,
        email: user.email!,
        username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      })
      if (!result.success) {
        console.error('Failed to create user profile:', result.error)
      }
    } else {
      console.error('OAuth callback: no user found in session data', data)
    }
  }

  return NextResponse.redirect(new URL(redirect, requestUrl.origin))
}
