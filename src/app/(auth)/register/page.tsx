'use client';

// ============================================================
// PSMI System — Dedicated Staff Registration Page
// ============================================================
// Route: /register
// Dedicated page for new staff to sign up.
// Upon successful registration, displays an explicit modal:
// "Account registered. Please wait for admin to grant you access"
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Zap,
  Lock,
  Mail,
  User,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Check,
} from 'lucide-react';
import { registerUser } from '@/actions/users';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Real-time helper indicators
  const isPasswordLongEnough = password.length >= 8;
  const doPasswordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid work email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await registerUser({
        full_name: cleanName,
        email: cleanEmail,
        password,
      });

      if (res.error) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      // Success! Open the requested modal
      setIsSubmitting(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
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
          <div className="inline-flex items-center justify-center p-3.5 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl shadow-lg shadow-indigo-500/20 mb-4 transition-transform hover:scale-105 duration-300">
            <Zap className="w-8 h-8 text-indigo-400 fill-indigo-400/20" />
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            PSMI
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Power Station Management Inventory
          </p>
        </div>

        {/* Dedicated Sign Up Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 shadow-2xl rounded-2xl p-7 sm:p-8 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Sign Up</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Create your staff account
              </p>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              Registration
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. Busayo Sobamowo"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 shadow-sm transition-all font-medium disabled:opacity-50"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Work Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  disabled={isSubmitting}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 shadow-sm transition-all font-medium disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Password *
                </label>
                {password.length > 0 && (
                  <span
                    className={`text-[11px] font-semibold flex items-center gap-1 ${
                      isPasswordLongEnough ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isPasswordLongEnough ? (
                      <>
                        <Check className="w-3 h-3" /> 8+ characters
                      </>
                    ) : (
                      `${password.length}/8 characters`
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 shadow-sm transition-all font-medium font-mono disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={isSubmitting}
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

            {/* Confirm Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Confirm Password *
                </label>
                {confirmPassword.length > 0 && (
                  <span
                    className={`text-[11px] font-semibold flex items-center gap-1 ${
                      doPasswordsMatch ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {doPasswordsMatch ? (
                      <>
                        <Check className="w-3 h-3" /> Passwords match
                      </>
                    ) : (
                      '✕ Does not match'
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Re-enter your password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 shadow-sm transition-all font-medium font-mono disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Inline Error Message */}
            {error && (
              <div className="p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold animate-shake flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 font-semibold rounded-xl shadow-lg transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer mt-5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-indigo-600/30 hover:shadow-indigo-600/50 disabled:opacity-60 disabled:cursor-not-allowed select-none touch-manipulation"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Registering account…</span>
                </>
              ) : (
                <>
                  <span>Sign Up</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Login Page */}
          <div className="mt-6 text-center pt-4 border-t border-slate-800/80">
            <p className="text-slate-400 text-xs">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors ml-1"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-8">
          © 2026 PSMI System. All rights reserved.
        </p>
      </div>

      {/* ============================================================ */}
      {/* POP-UP MODAL: Account Registered — Wait for Admin Approval   */}
      {/* ============================================================ */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 animate-scale-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Account registered.
              </h3>
              <p className="text-sm font-semibold text-amber-400">
                Please wait for admin to grant you access
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800/90 rounded-xl text-xs text-slate-300 text-left space-y-2 leading-relaxed">
              <p>
                Your account for <strong className="text-white">{email}</strong> has been registered successfully.
              </p>
              <p className="text-slate-400">
                To safeguard warehouse inventory and operations, all new accounts require an administrator to assign your role and authorized location before you can enter.
              </p>
              <p className="text-emerald-400 font-medium">
                ✓ Once approved, you can log in directly with the password you just created.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3 px-4 font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <span>Back to Login</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
