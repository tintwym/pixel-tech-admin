export type ErrorPageCode =
  | '400'
  | '401'
  | '403'
  | '404'
  | '408'
  | '429'
  | '500'
  | '502'
  | '503'
  | '504';

export type ErrorPageCopy = {
  code: ErrorPageCode;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export const ERROR_PAGES: Record<ErrorPageCode, ErrorPageCopy> = {
  '400': {
    code: '400',
    title: 'Bad request',
    description:
      'The admin request couldn’t be understood. Check what you submitted and try again.',
  },
  '401': {
    code: '401',
    title: 'Admin sign-in required',
    description:
      'Sign in with an admin account to manage Pixel Tech orders, products, and inventory.',
    primaryHref: '/',
    primaryLabel: 'Back to admin',
  },
  '403': {
    code: '403',
    title: 'Access forbidden',
    description:
      'This admin action isn’t allowed for your account. Contact a store owner if you need access.',
    primaryHref: '/',
    primaryLabel: 'Back to admin',
  },
  '404': {
    code: '404',
    title: 'Page not found',
    description:
      'This link doesn’t match an admin page. Return to the dashboard to keep managing the store.',
    primaryHref: '/',
    primaryLabel: 'Back to admin',
  },
  '408': {
    code: '408',
    title: 'Request timed out',
    description:
      'The admin API took too long to respond. Check your connection and try again.',
  },
  '429': {
    code: '429',
    title: 'Too many requests',
    description:
      'You’ve hit a rate limit on admin actions. Wait a moment, then try again.',
  },
  '500': {
    code: '500',
    title: 'Something went wrong',
    description:
      'An unexpected error occurred in the admin dashboard. Try again, or return to the home screen.',
    primaryHref: '/',
    primaryLabel: 'Back to admin',
  },
  '502': {
    code: '502',
    title: 'Bad gateway',
    description:
      'Admin couldn’t reach the Pixel Tech API. The backend may be restarting — try again shortly.',
  },
  '503': {
    code: '503',
    title: 'Service unavailable',
    description:
      'The admin API is temporarily unavailable for maintenance. Please check back soon.',
  },
  '504': {
    code: '504',
    title: 'Gateway timeout',
    description:
      'A connected service didn’t respond in time. Refresh the page or try again in a minute.',
  },
};

export const ERROR_PAGE_CODES = Object.keys(ERROR_PAGES) as ErrorPageCode[];

export function isErrorPageCode(value: string): value is ErrorPageCode {
  return value in ERROR_PAGES;
}

export function getErrorPage(code: string): ErrorPageCopy {
  if (isErrorPageCode(code)) return ERROR_PAGES[code];
  return ERROR_PAGES['500'];
}
