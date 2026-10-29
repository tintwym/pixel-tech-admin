import type { AdminFieldErrors } from '@/lib/adminApi';

// Keep in sync with backend LoginAdminRequest constraints.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 64;
export const PASSWORD_MAX = 128;

export function validateAdminUsername(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Please enter an admin username.';
  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
    return `Admin username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (/\s/.test(trimmed)) return 'Admin username can’t contain spaces.';
  return undefined;
}

export function validateAdminPassword(value: string): string | undefined {
  if (!value.trim()) return 'Please enter your password.';
  if (value.length > PASSWORD_MAX) return `Password must be ${PASSWORD_MAX} characters or fewer.`;
  return undefined;
}

export function validateAdminForm(values: { username: string; password: string }): AdminFieldErrors {
  const errors: AdminFieldErrors = {};
  const username = validateAdminUsername(values.username);
  const password = validateAdminPassword(values.password);
  if (username) errors.username = username;
  if (password) errors.password = password;
  return errors;
}
