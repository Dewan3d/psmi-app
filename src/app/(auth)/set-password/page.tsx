'use client';

// ============================================================
// PSMI System — Set Password Page
// ============================================================
// Handles invited users setting their password for the first time.
// ============================================================

import { useState, useEffect } from 'react';
import { updatePassword } from '@/actions/auth';
import { createClient } from '@/lib/supabase/client';
import { Zap, Lock, CheckCircle2 } from 'lucide-react';

export default function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize the Supabase client so it can process the URL hash
  // (which logs the user in) before they try to update their password.
  useEffect(() => {
    const supabase = createClient();
    // Listening to state changes triggers token extraction from hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('SetPasswordPage Auth Event:', event, !!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
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
    } else {
      setSuccess(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-950 via-surface-900 to-brand-950 relative overflow-hidden">
      {/* Background decorative elements */}
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
          <p className="text-surface-400 mt-1">Activate Your Account</p>
        </div>

        <div className="glass-card-elevated p-8 animate-slide-up">
          {success ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 rounded-full mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Password Saved!</h2>
              <p className="text-sm text-surface-400 mb-6">
                Your account is active. Redirecting you to the system dashboard...
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Create Password</h2>
              <p className="text-sm text-surface-400 mb-6">
                Please set a secure password to activate your new account.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-surface-300 mb-1.5">
                    New Password
                  </label>
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
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-surface-300 mb-1.5">
                    Confirm Password
                  </label>
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
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Updating…
                    </span>
                  ) : (
                    'Set Password & Log In'
                  )}
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
