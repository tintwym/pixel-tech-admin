'use client';

import React, { useState } from 'react';
import { Cpu, Lock, Eye, EyeOff, AlertTriangle, ArrowLeft, Shield } from 'lucide-react';
import { AdminApiError, AdminFieldErrors, loginAdmin, serverErrorMessage } from '@/lib/adminApi';
import { validateAdminForm, validateAdminPassword, validateAdminUsername } from '@/lib/validation';
import { AdminSession, setAdminSession, setAdminToken } from '@/lib/adminAuth';

type Field = keyof AdminFieldErrors;

type AdminLoginProps = {
  onSignedIn: (session: AdminSession) => void;
  onAddToast: (title: string, msg: string, type: 'success' | 'warning' | 'info') => void;
};

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || 'http://127.0.0.1:3000';

export default function AdminLogin({ onSignedIn, onAddToast }: AdminLoginProps) {
  const [values, setValues] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState<Record<Field, boolean>>({ username: false, password: false });
  const [clientErrors, setClientErrors] = useState<AdminFieldErrors>({});
  const [serverErrors, setServerErrors] = useState<AdminFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateField = (field: Field, value: string) =>
    field === 'username' ? validateAdminUsername(value) : validateAdminPassword(value);

  const handleChange = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setServerErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
    if (touched[field]) {
      setClientErrors((e) => ({ ...e, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field: Field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setClientErrors((e) => ({ ...e, [field]: validateField(field, values[field]) }));
  };

  const finishSignIn = (session: AdminSession, token: string) => {
    setAdminToken(token);
    setAdminSession(session);
    onAddToast('Signed in', 'Welcome to the admin dashboard.', 'success');
    onSignedIn(session);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setServerErrors({});
    setTouched({ username: true, password: true });

    const errors = validateAdminForm(values);
    setClientErrors(errors);
    if (Object.keys(errors).length) {
      setFormError('Please fix the highlighted fields.');
      return;
    }

    const username = values.username.trim();
    setIsLoading(true);
    try {
      const token = await loginAdmin(username, values.password);
      finishSignIn({ username }, token);
    } catch (err) {
      const apiError = err instanceof AdminApiError ? err : new AdminApiError(500, '');
      setServerErrors(apiError.fieldErrors);
      setFormError(serverErrorMessage(apiError));
    } finally {
      setIsLoading(false);
    }
  };

  const fieldError = (field: Field) => serverErrors[field] || (touched[field] ? clientErrors[field] : undefined);

  const inputClass = (field: Field) =>
    `w-full rounded-xl border bg-white dark:bg-[#121a24] px-3.5 py-3 text-sm outline-hidden placeholder:text-slate-400 ${
      fieldError(field)
        ? 'border-rose-400 ring-2 ring-rose-400/25'
        : 'border-slate-200 dark:border-white/10 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30'
    }`;

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#0B1220] text-slate-900 dark:text-[#e7eef5] flex flex-col">
      <header className="border-b border-slate-200/70 dark:border-white/10 bg-white/85 dark:bg-[#0B1220]/90 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <a
            href={STORE_URL}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0284c7] dark:hover:text-sky-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to store
          </a>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#0284c7] dark:text-sky-400">
            <Shield className="w-3.5 h-3.5" />
            Admin only
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#121a24] shadow-[0_12px_32px_-12px_rgb(2_132_199/0.18)] p-6 sm:p-8 relative overflow-hidden">
          <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />

          <div className="relative flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-[#0284c7] to-[#0ea5e9] text-white shadow-md shadow-sky-500/25">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-sans text-xl font-bold">Admin sign in</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage orders, products and inventory.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative space-y-4" noValidate>
            {formError && (
              <div
                className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3.5 py-3 text-sm font-medium text-rose-700 dark:text-rose-300"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="admin-username"
                className={`mb-1 block text-xs font-semibold ${fieldError('username') ? 'text-rose-600' : 'text-slate-500'}`}
              >
                Username
              </label>
              <input
                id="admin-username"
                value={values.username}
                onChange={(e) => handleChange('username', e.target.value)}
                onBlur={() => handleBlur('username')}
                autoComplete="username"
                placeholder="Admin username"
                aria-invalid={!!fieldError('username')}
                aria-describedby={fieldError('username') ? 'admin-username-error' : undefined}
                className={inputClass('username')}
              />
              {fieldError('username') && (
                <p id="admin-username-error" className="mt-1.5 text-xs font-medium text-rose-600" role="alert">
                  {fieldError('username')}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className={`mb-1 block text-xs font-semibold ${fieldError('password') ? 'text-rose-600' : 'text-slate-500'}`}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  autoComplete="current-password"
                  placeholder="Admin password"
                  aria-invalid={!!fieldError('password')}
                  aria-describedby={fieldError('password') ? 'admin-password-error' : undefined}
                  className={`${inputClass('password')} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldError('password') && (
                <p id="admin-password-error" className="mt-1.5 text-xs font-medium text-rose-600" role="alert">
                  {fieldError('password')}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-br from-[#0284c7] to-[#0ea5e9] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0284c7]/25 disabled:opacity-60 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
