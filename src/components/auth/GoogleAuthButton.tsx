'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { departmentCache } from '@/lib/departmentCache'
import { chromeIntentUrl, isAndroid, isInAppBrowser } from '@/lib/inAppBrowser'
import { withAttributionParams } from '@/lib/metaTracking'

interface GoogleAuthButtonProps {
  label: string
  redirectTo: string // already-safe same-site path
  disabled?: boolean
  onError: (message: string) => void
}

const buttonClass =
  'w-full flex items-center justify-center gap-2 sm:gap-3 bg-white border border-stone-300 text-stone-700 py-2 sm:py-2.5 px-4 text-sm rounded-lg font-medium hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed'

export default function GoogleAuthButton({ label, redirectTo, disabled, onError }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false)
  // Read the user agent after mount so server and client render the same markup
  const [browser, setBrowser] = useState<'normal' | 'in-app-android' | 'in-app-ios'>('normal')

  useEffect(() => {
    const ua = navigator.userAgent
    if (isInAppBrowser(ua)) {
      setBrowser(isAndroid(ua) ? 'in-app-android' : 'in-app-ios')
    }
  }, [])

  async function handleClick() {
    setLoading(true)
    try {
      departmentCache.clear()
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
      // Keep loading=true so the spinner stays visible during redirect
    } catch (error: any) {
      onError(error.message)
      setLoading(false)
    }
  }

  // Google blocks sign-in inside the Facebook/Instagram app, so send users to a real browser
  if (browser === 'in-app-android') {
    return (
      // Chrome has its own cookies: carry the ad attribution over in the URL.
      <a href={chromeIntentUrl(withAttributionParams(window.location.href))} className={buttonClass}>
        <GoogleIcon />
        Open in Chrome to use Google
      </a>
    )
  }

  if (browser === 'in-app-ios') {
    return (
      <p className="text-center text-xs sm:text-sm text-stone-600 bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
        To use Google, tap <span className="font-semibold">•••</span> at the top and choose{' '}
        <span className="font-semibold">Open in browser</span>. Or use email above.
      </p>
    )
  }

  return (
    <button onClick={handleClick} type="button" disabled={loading || disabled} className={buttonClass}>
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5 text-stone-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Redirecting to Google...
        </>
      ) : (
        <>
          <GoogleIcon />
          {label}
        </>
      )}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
