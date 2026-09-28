'use client';

// ============================================================
// PSMI System — Self-Registration & Access Request
// ============================================================
// Staff members create their credentials directly.
// Access to dashboard data is held pending Admin approval.
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
  ArrowRight,
  ShieldAlert,
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
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid work email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await registerUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.error) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to complete registration.');
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

        {/* High-Contrast Glass Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 shadow-2xl rounded-2xl p-8 transition-all duration-300">
          {!isSuccess ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Create Account</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Register for staff access
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  Admin Approval Required
                </span>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs font-medium animate-scale-in flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="e.g. Sarah Connor"
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="staff@bluetti.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 shadow-sm transition-all font-medium disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Create Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
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
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="Re-enter password"
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 font-semibold rounded-xl shadow-lg transition-all duration-300 text-sm flex items-center justify-center gap-2 cursor-pointer mt-5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white shadow-indigo-600/30 hover:shadow-indigo-600/50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Submitting registration…</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account & Request Access</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Back to Login Link */}
              <div className="mt-6 text-center pt-4 border-t border-slate-800/80">
                <p className="text-slate-400 text-xs">
                  Already registered?{' '}
                  <Link
                    href="/login"
                    className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors ml-1"
                  >
                    Sign in to your account
                  </Link>
                </p>
              </div>
            </>
          ) : (
            /* Success State — Pending Approval Card */
            <div className="text-center py-2 animate-fade-in space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1">
                <Clock className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">
                  Registration Submitted!
                </h2>
                <p className="text-xs font-semibold text-amber-400 mt-1">
                  Pending Administrator Approval
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-left text-xs text-slate-300 space-y-2">
                <p>
                  Your account for <strong className="text-white">{email}</strong> has been created with your chosen password.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  To protect inventory records, your access is currently restricted. An administrator has been notified to assign your role and authorized warehouse/branch location.
                </p>
                <p className="text-emerald-400 font-medium">
                  ✓ As soon as an admin approves your request, you can log in immediately.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full py-2.5 px-4 font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-8">
          © 2026 PSMI System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
