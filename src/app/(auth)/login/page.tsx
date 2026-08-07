'use client';

// ============================================================
// PSMI System — High-Contrast Executive Login Page
// ============================================================

import { useState, useEffect } from 'react';
import { signIn } from '@/actions/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Zap, Lock, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect to set-password if accepting an invitation or recovery link
  useEffect(() => {
    const hash = window.location.hash;
    if (
      hash &&
      (hash.includes('type=invite') ||
        hash.includes('type=signup') ||
        hash.includes('type=recovery'))
    ) {
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Ambient background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-5 py-8">
        {/* Brand Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center p-3.5 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl shadow-lg shadow-indigo-500/20 mb-4">
            <Zap className="w-8 h-8 text-indigo-400 fill-indigo-400/20" />
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            PSMI
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Power Station Management Inventory
          </p>
        </div>

        {/* High-Contrast Glass Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 shadow-2xl rounded-2xl p-8 transition-all">
          <h2 className="text-xl font-bold text-white mb-6">
            Welcome back
          </h2>

          {error && (
            <div className="mb-5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs font-medium animate-scale-in">
              {error}
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            {/* Email Address */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 shadow-sm transition-all font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 shadow-sm transition-all font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing in…</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Links & Information */}
          <div className="mt-6 text-center space-y-2 pt-2 border-t border-slate-800/80">
            <Link
              href="/reset-password"
              className="inline-block text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Forgot your password?
            </Link>
            <p className="text-slate-400 text-xs leading-relaxed">
              Access is by invitation only. Contact your administrator.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-8">
          © 2026 PSMI System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
