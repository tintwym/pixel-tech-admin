'use client';

import React, { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type SignOutModalProps = {
  open: boolean;
  adminName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SignOutModal({ open, adminName, onCancel, onConfirm }: SignOutModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onCancel} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            aria-describedby="signout-desc"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121a24] p-6 shadow-2xl"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/15">
              <LogOut className="h-5 w-5" />
            </span>
            <h2 id="signout-title" className="mt-4 font-sans text-lg font-semibold text-slate-900 dark:text-white">
              Sign out?
            </h2>
            <p id="signout-desc" className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              You’re signed in as <span className="font-semibold text-slate-700 dark:text-slate-200">{adminName}</span>.
              You’ll need to sign in again to manage the store.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
