const THRESHOLD_KEY = 'pixel-tech-admin-stock-threshold';
const DISMISSED_BANNER_KEY = 'pixel-tech-admin-stock-banner-dismissed';

export const DEFAULT_STOCK_THRESHOLD = 5;

export function getStockThreshold(): number {
  if (typeof window === 'undefined') return DEFAULT_STOCK_THRESHOLD;
  try {
    const raw = localStorage.getItem(THRESHOLD_KEY);
    const n = raw ? Number(raw) : DEFAULT_STOCK_THRESHOLD;
    if (!Number.isFinite(n) || n < 1) return DEFAULT_STOCK_THRESHOLD;
    return Math.min(50, Math.floor(n));
  } catch {
    return DEFAULT_STOCK_THRESHOLD;
  }
}

export function setStockThreshold(value: number): number {
  const next = Math.min(50, Math.max(1, Math.floor(value)));
  try {
    localStorage.setItem(THRESHOLD_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function isStockBannerDismissedFor(countKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISSED_BANNER_KEY) === countKey;
  } catch {
    return false;
  }
}

export function dismissStockBanner(countKey: string) {
  try {
    localStorage.setItem(DISMISSED_BANNER_KEY, countKey);
  } catch {
    /* ignore */
  }
}

export function clearStockBannerDismissal() {
  try {
    localStorage.removeItem(DISMISSED_BANNER_KEY);
  } catch {
    /* ignore */
  }
}
