import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * /api/* is rewritten server-side to the Spring API, so the browser never calls it cross-origin.
 * Drop the browser Origin so the API's CORS filter doesn't reject requests from the admin host.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete('origin');
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: '/api/:path*',
};
