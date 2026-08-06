'use client';

// ============================================================
// PSMI System — Login Page
// ============================================================

import { useState, useEffect } from 'react';
import { signIn } from '@/actions/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Zap, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect to set-password if accepting an invitation or recovery link
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=invite') || hash.includes('type=signup') || hash.includes('type=recovery'))) {
      router.push(`/set-password${hash}`);
    }
  }, [router]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-950 via-surface-900 to-brand-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo / Brand
          ─────────────────────────────────────────────────
          To use your company logo:
          1. Place your logo file at /public/logo.svg (or .png)
          2. Uncomment the <Image> tag below
          3. Remove or comment out the <Zap> icon fallback
          ───────────────────────────────────────────────── */}
        <div className="text-center mb-8 animate-fade-in">
          {/* Option A: Icon placeholder (default) */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl shadow-brand mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>

          {/* Option B: Custom company logo — uncomment below
          <div className="mb-4">
            <Image
              src="/logo.svg"
              alt="Company Logo"
              width={64}
              height={64}
              className="mx-auto rounded-2xl"
              priority
            />
          </div>
          */}

          <h1 className="text-3xl font-bold text-white">PSMI</h1>
          <p className="text-surface-400 mt-1">
            Power Station Management Inventory
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card-elevated p-8 animate-slide-up">
          <h2 className="text-xl font-semibold text-white mb-6">
            Welcome back
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm animate-scale-in">
              {error}
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-surface-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="input pl-10 bg-surface-800/50 border-surface-700 text-white placeholder:text-surface-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-surface-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="input pl-10 pr-10 bg-surface-800/50 border-surface-700 text-white placeholder:text-surface-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Forgot password / invite note */}
          <div className="mt-6 text-center space-y-2">
            <Link
              href="/auth/reset-password"
              className="text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              Forgot your password?
            </Link>
            <p className="text-surface-500 text-xs">
              Access is by invitation only. Contact your administrator.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-surface-600 text-xs mt-6">
          © 2026 PSMI System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
