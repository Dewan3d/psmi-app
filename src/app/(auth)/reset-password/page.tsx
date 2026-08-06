'use client';

// ============================================================
// PSMI System — High-Contrast Reset Password Page
// ============================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { resetPassword, updatePassword } from '@/actions/auth';
import { createClient } from '@/lib/supabase/client';
import { Zap, Mail, Lock, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [mode, setMode] = useState<'request' | 'update'>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Check if this is a password reset callback
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update');
      }
    });
  }, []);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await resetPassword(email);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await updatePassword(password);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-5 py-8">
        {/* Brand Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center p-3.5 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl shadow-lg shadow-indigo-500/20 mb-4">
            <Zap className="w-8 h-8 text-indigo-400 fill-indigo-400/20" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">PSMI</h1>
          <p className="text-sm font-medium text-slate-400 mt-1">Password Recovery</p>
        </div>

        {/* High-Contrast Glass Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 shadow-2xl rounded-2xl p-8 transition-all">
          {mode === 'request' && !sent && (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
              <h2 className="text-xl font-bold text-white mb-2">Reset your password</h2>
              <p className="text-xs text-slate-400 mb-6">
                Enter your email address and we&apos;ll send you a password reset link.
              </p>

              {error && (
                <div className="mb-5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleRequestReset} className="space-y-5">
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
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending link…</span>
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          )}

          {mode === 'request' && sent && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-full mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                We&apos;ve sent a password reset link to <strong className="text-white font-semibold">{email}</strong>.
              </p>
              <Link
                href="/login"
                className="inline-block px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
              >
                Back to login
              </Link>
            </div>
          )}

          {mode === 'update' && (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Set new password</h2>
              <p className="text-xs text-slate-400 mb-6">Choose a strong password for your account.</p>

              {error && (
                <div className="mb-5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating…</span>
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-8">
          © 2026 PSMI System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
