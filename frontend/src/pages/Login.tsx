import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { LoginHero } from '../components/auth/LoginHero'

export function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? '/'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(identifier, password)
      navigate(from, { replace: true })
    } catch {
      setError('Invalid username/email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      {/* Decorative background shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="login-orb absolute -right-20 top-20 h-64 w-64 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="login-orb login-orb-2 absolute -left-16 bottom-16 h-48 w-48 rounded-full bg-brand-gold/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl border border-border/80 bg-bg-primary/80 shadow-2xl shadow-brand-navy/10 backdrop-blur-xl">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <LoginHero />

          <section className="login-form-panel flex flex-col justify-center p-8 sm:p-10 lg:p-12">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gold text-lg font-bold text-brand-navy">
                  A
                </div>
                <span className="font-medium text-text-primary">
                  APS Wallet BI
                </span>
              </div>
            </div>

            <div className="login-fade-up login-delay-1">
              <p className="text-micro font-medium uppercase tracking-[0.18em] text-brand-blue">
                Secure Sign In
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                Use your username or email and password to access your
                workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="login-fade-up login-delay-2">
                <label
                  htmlFor="identifier"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Username or Email
                </label>
                <div className="relative">
                  <i className="ti ti-user absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"></i>
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    className="login-input w-full rounded-md border border-border bg-bg-secondary/80 py-2.5 pl-10 pr-3 text-sm text-text-primary outline-none transition focus:border-brand-blue"
                    placeholder="owner or owner@bi.local"
                    required
                  />
                </div>
              </div>

              <div className="login-fade-up login-delay-3">
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Password
                </label>
                <div className="relative">
                  <i className="ti ti-lock absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"></i>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="login-input w-full rounded-md border border-border bg-bg-secondary/80 py-2.5 pl-10 pr-10 text-sm text-text-primary outline-none transition focus:border-brand-blue"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition hover:text-text-primary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i
                      className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`}
                    ></i>
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-fade-up flex items-center gap-2 rounded-md border border-semantic-red/20 bg-semantic-red/10 px-3 py-2 text-sm text-semantic-red">
                  <i className="ti ti-alert-circle"></i>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="login-submit login-fade-up login-delay-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <i className="ti ti-loader animate-spin"></i>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <i className="ti ti-arrow-right"></i>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
