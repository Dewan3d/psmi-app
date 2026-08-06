'use client';

// ============================================================
// PSMI System — Reset Password Page
// ============================================================
// Two modes:
// 1. Email input mode — user enters email to receive reset link
// 2. New password mode — handles the redirect from Supabase email link
// ============================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { resetPassword, updatePassword } from '@/actions/auth';
import { createClient } from '@/lib/supabase/client';
import { Zap, Mail, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [mode, setMode] = useState<'request' | 'update'>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Check if this is a password reset callback (has a hash in the URL)
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-950 via-surface-900 to-brand-950 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl shadow-brand mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">PSMI</h1>
          <p className="text-surface-400 mt-1">Password Reset</p>
        </div>

        <div className="glass-card-elevated p-8 animate-slide-up">
          {mode === 'request' && !sent && (
            <>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
              <h2 className="text-xl font-semibold text-white mb-2">Reset your password</h2>
              <p className="text-sm text-surface-400 mb-6">Enter your email address and we&apos;ll send you a reset link.</p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-surface-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input pl-10 bg-surface-800/50 border-surface-700 text-white placeholder:text-surface-500 w-full"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          {mode === 'request' && sent && (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 rounded-full mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
              <p className="text-sm text-surface-400 mb-6">
                We&apos;ve sent a password reset link to <strong className="text-white">{email}</strong>.
                The link expires in 1 hour.
              </p>
              <Link href="/login" className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors">
                Back to login
              </Link>
            </div>
          )}

          {mode === 'update' && (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Set new password</h2>
              <p className="text-sm text-surface-400 mb-6">Choose a strong password for your account.</p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-surface-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="input pl-10 bg-surface-800/50 border-surface-700 text-white placeholder:text-surface-500 w-full"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-surface-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="input pl-10 bg-surface-800/50 border-surface-700 text-white placeholder:text-surface-500 w-full"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-surface-600 text-xs mt-6">
          © 2026 PSMI System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
