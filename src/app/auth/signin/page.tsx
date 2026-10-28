'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { departmentCache } from '@/lib/departmentCache'
import { getSafeRedirect } from '@/lib/safeRedirect'
import Navbar from '@/components/common/Navbar'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'
import Link from 'next/link'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const redirectTo = getSafeRedirect(searchParams.get('redirect'))
  const signUpHref = `/auth/signup?redirect=${encodeURIComponent(redirectTo)}`
  // Callback failed, e.g. the confirmation email was opened in a different browser (email is still confirmed)
  const callbackFailed = searchParams.get('error') === 'callback_error'

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      departmentCache.clear()
      // Keep loading=true so the spinner stays visible during navigation
      router.push(redirectTo)
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'Invalid email or password')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Navbar variant="auth" ctaLabel="Sign Up" ctaHref={signUpHref} />
      <div className="flex justify-center px-4 pt-8 pb-8 relative">
      {/* Decorative Elements - Railway themed */}
      <div className="hidden sm:block absolute top-20 right-10 sm:right-20 w-16 sm:w-24 h-16 sm:h-24 text-orange-500 opacity-20">
        <svg viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z" />
        </svg>
      </div>
      <div className="hidden sm:block absolute bottom-20 left-10 w-20 h-20 rounded-full border-4 border-stone-200 opacity-40"></div>
      <div className="hidden sm:block absolute top-10 left-1/4 w-3 h-3 bg-orange-500 rounded-full opacity-60"></div>

      <div className="max-w-md w-full space-y-5 sm:space-y-8 p-5 sm:p-8 bg-white rounded-2xl shadow-xl relative z-10">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-stone-900">
            Welcome Back
          </h2>
          <p className="mt-1.5 text-center text-xs sm:text-sm text-stone-600">
            Sign in to continue your exam preparation
          </p>
        </div>

        {callbackFailed && !error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
            We couldn&apos;t finish signing you in. If you just confirmed your email, it&apos;s confirmed. Please sign in below.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4 sm:space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-stone-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="your.email@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-stone-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-stone-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-xs sm:text-sm text-stone-700">
                Remember me
              </label>
            </div>

            <Link
              href="/auth/forgot-password"
              className="text-xs sm:text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 sm:py-3 px-4 text-sm sm:text-base rounded-full font-semibold hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing In...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Google OAuth - temporarily disabled */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-stone-500">Or continue with</span>
          </div>
        </div>

        <GoogleAuthButton
          label="Sign in with Google"
          redirectTo={redirectTo}
          disabled={loading}
          onError={setError}
        />
       

        <p className="text-center text-xs sm:text-sm text-stone-600">
          Don&apos;t have an account?{' '}
          <Link href={signUpHref} className="font-medium text-orange-600 hover:text-orange-700">
            Sign up for free
          </Link>
        </p>
      </div>
      </div>
    </div>
  )
}
