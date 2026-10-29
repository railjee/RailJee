'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { syncUserProfile } from '@/lib/api'
import { departmentCache } from '@/lib/departmentCache'
import { getSafeRedirect } from '@/lib/safeRedirect'
import Navbar from '@/components/common/Navbar'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'
import Link from 'next/link'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const redirectTo = getSafeRedirect(searchParams.get('redirect'))
  const signInHref = `/auth/signin?redirect=${encodeURIComponent(redirectTo)}`

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Create Supabase auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (signUpError) throw signUpError

      // 2. Create user profile via backend API
      if (data.user) {
        const { success, error: createError } = await syncUserProfile({
          supabaseId: data.user.id,
          email: data.user.email!,
          username: name,
        })

        if (!success) {
          throw new Error(createError || 'Failed to create user profile')
        }

        departmentCache.clear()
        setLoading(false)
        setShowVerifyModal(true)
        if (window.fbq) {
          window.fbq("track", "CompleteRegistration");
        } else {
          const storageKey = "meta-pixel-pending-events";
          const pendingEvents = JSON.parse(sessionStorage.getItem(storageKey) || "[]") as string[];
          pendingEvents.push("CompleteRegistration");
          sessionStorage.setItem(storageKey, JSON.stringify(pendingEvents));
        }
      }
    } catch (error: any) {
      const rawMessage = error?.message || ''
      const normalizedMessage = rawMessage.toLowerCase()
      const isExistingUserMessage =
        normalizedMessage.includes('already exists') ||
        normalizedMessage.includes('user already') ||
        normalizedMessage.includes('duplicate')

      setError(
        isExistingUserMessage
          ? 'User already exists'
          : 'Some error occurred during sign up please contact support'
      )
      setLoading(false)
      console.error('Sign up error:', rawMessage)
    }
  }

  function handleVerifyOk() {
    setShowVerifyModal(false)
    router.push(signInHref)
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Navbar variant="auth" ctaLabel="Sign In" ctaHref={signInHref} />
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
            Join RailJee
          </h2>
          <p className="mt-1.5 text-center text-xs sm:text-sm text-stone-600">
            Take the next step in your railway career.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}


        <form onSubmit={handleSignUp} className="space-y-4 sm:space-y-5">
          <div>
            <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-stone-700 mb-1">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="Enter your full name"
            />
          </div>

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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="Minimum 6 characters"
            />
            <p className="mt-1 text-xs text-stone-500">
              Must be at least 6 characters long
            </p>
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
                Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-stone-500">Or continue with</span>
          </div>
        </div>

        <GoogleAuthButton
          label="Continue with Google"
          redirectTo={redirectTo}
          disabled={loading}
          onError={setError}
        />

        <p className="text-center text-xs sm:text-sm text-stone-600">
          Already have an account?{' '}
          <Link href={signInHref} className="font-medium text-orange-600 hover:text-orange-700">
            Sign in
          </Link>
        </p>
      </div>
      </div>

      {/* Email Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 flex flex-col items-center gap-5">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            {/* Text */}
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-stone-900">Check your email</h3>
              <p className="text-sm text-stone-600">
                We&apos;ve sent a verification link to{' '}
                <span className="font-medium text-stone-800">{email}</span>.
                Please verify your account before signing in.
              </p>
            </div>
            {/* Button */}
            <button
              onClick={handleVerifyOk}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 px-4 rounded-full font-semibold hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all shadow-lg"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
