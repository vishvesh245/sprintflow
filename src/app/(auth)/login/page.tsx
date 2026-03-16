'use client'

import { signIn, useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

const CheckIcon = () => (
  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

function LoginContent() {
  const { status } = useSession()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')

  const validateEmail = (value: string) => {
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address'
    return ''
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateEmail(email)
    if (validationError) {
      setEmailError(validationError)
      setTimeout(() => setEmailError(''), 5000)
      return
    }
    setLoading(true)
    await signIn('credentials', { email, callbackUrl: '/sprint' })
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 space-y-8">
          {/* Logo */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-200">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">SprintFlow</h1>
              <p className="text-gray-500 mt-1">Sprint management, simplified.</p>
            </div>
          </div>

          {/* Feature checklist */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckIcon />
              <span>Plan sprints & manage your backlog</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckIcon />
              <span>Kanban board with drag & drop</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckIcon />
              <span>Track progress with real-time updates</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">
                An error occurred during sign in. Please try again.
              </p>
            </div>
          )}

          {/* Email Input */}
          <form onSubmit={handleLogin} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Enter your email to get started
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              className={`w-full px-4 py-3 rounded-lg border ${emailError ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} outline-none transition text-gray-900 placeholder-gray-400`}
            />
            {emailError && (
              <p className="text-red-500 text-xs mt-1">{emailError}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors shadow-sm hover:shadow-md"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400">
            No password needed — just enter your email to explore the demo
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
