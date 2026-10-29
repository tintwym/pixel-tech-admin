import type { AdminOrder, OrderStatus } from '@/types';
import { getAdminToken, setAdminToken } from '@/lib/adminAuth';

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  '/api';

export type AdminFieldErrors = {
  username?: string;
  password?: string;
};

/** API failure with the server's message and any per-field validation errors. */
export class AdminApiError extends Error {
  status: number;
  fieldErrors: AdminFieldErrors;
  constructor(status: number, message: string, fieldErrors: AdminFieldErrors = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function apiUrl(path: string): string {
  const base = String(API_BASE).replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseError(res: Response): Promise<AdminApiError> {
  let message = '';
  let fieldErrors: AdminFieldErrors = {};
  try {
    const data = await res.clone().json();
    if (typeof data?.message === 'string') message = data.message;
    else if (typeof data?.error === 'string') message = data.error;
    if (data?.errors && typeof data.errors === 'object') {
      fieldErrors = {
        username: typeof data.errors.username === 'string' ? data.errors.username : undefined,
        password: typeof data.errors.password === 'string' ? data.errors.password : undefined,
      };
    }
  } catch {
    try {
      const text = await res.text();
      if (text && text.length < 300 && !text.trimStart().startsWith('<')) message = text;
    } catch {
      /* ignore */
    }
  }
  return new AdminApiError(res.status, message, fieldErrors);
}

export async function loginAdmin(username: string, password: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(apiUrl('/auth/admins/login'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new AdminApiError(0, 'Network error');
  }

  if (!res.ok) throw await parseError(res);

  const data = (await res.json()) as { token?: string };
  if (!data?.token) throw new AdminApiError(500, 'The server did not return a session token.');
  return data.token;
}

type ApiAdminOrder = {
  id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  totalPrice?: number | string | null;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  createdAt?: string | null;
  items?: { productId?: string | null; productName?: string | null; quantity?: number; price?: number | string | null }[];
};

const ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'out_for_delivery', 'delivered', 'cancelled'];

function mapOrder(api: ApiAdminOrder): AdminOrder {
  const status = ORDER_STATUSES.includes(api.fulfillmentStatus as OrderStatus)
    ? (api.fulfillmentStatus as OrderStatus)
    : 'pending';
  return {
    id: api.id,
    customerName: api.customerName || 'Guest',
    customerEmail: api.customerEmail || undefined,
    totalAmount: Number(api.totalPrice) || 0,
    paymentStatus: api.paymentStatus || undefined,
    status,
    createdAt: api.createdAt || new Date(0).toISOString(),
    items: (api.items ?? []).map((item) => ({
      productId: item.productId || undefined,
      name: item.productName || 'Product',
      quantity: item.quantity ?? 0,
      price: Number(item.price) || 0,
    })),
  };
}

/** Authenticated request; keeps the refreshed token the API sends back. */
async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new AdminApiError(401, 'Your admin session has expired. Please sign in again.');

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new AdminApiError(0, 'Network error');
  }

  const refreshed = res.headers.get('Authorization');
  if (refreshed?.startsWith('Bearer ')) setAdminToken(refreshed.slice(7));

  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export async function fetchAdminOrders(signal?: AbortSignal): Promise<AdminOrder[]> {
  const data = await adminRequest<ApiAdminOrder[]>('/admin/orders', { signal });
  return Array.isArray(data) ? data.map(mapOrder) : [];
}

export async function updateAdminOrderStatus(orderId: string, status: OrderStatus): Promise<AdminOrder> {
  const data = await adminRequest<ApiAdminOrder>(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return mapOrder(data);
}

/** Returns the product's new stock level. */
export async function restockProduct(productApiId: string, amount: number): Promise<number> {
  const data = await adminRequest<{ stock?: number }>(`/admin/products/${encodeURIComponent(productApiId)}/restock`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
  return Number(data?.stock) || 0;
}

export type UpdateProductFields = {
  name: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  /** New gallery files to upload to Cloudinary (FormData field `images`). */
  images?: File[];
  /** When true, clears existing gallery before attaching new uploads. */
  replaceImages?: boolean;
};

export type UpdatedProductImages = {
  imageUrl: string;
  imageUrls: string[];
};

/** Update product metadata and optional gallery via multipart form fields. */
export async function updateProduct(
  productId: string,
  fields: UpdateProductFields
): Promise<UpdatedProductImages | null> {
  const token = getAdminToken();
  if (!token) throw new AdminApiError(401, 'Not signed in.');

  const body = new FormData();
  body.append('name', fields.name);
  body.append('description', fields.description);
  body.append('brand', fields.brand);
  body.append('category', fields.category);
  body.append('price', String(fields.price));
  body.append('stock', String(fields.stock));
  body.append('replaceImages', fields.replaceImages ? 'true' : 'false');
  for (const file of fields.images || []) {
    body.append('images', file);
  }

  let res: Response;
  try {
    res = await fetch(apiUrl(`/products/update/${productId}`), {
      method: 'PUT',
      headers: { Accept: 'application/json', Authorization: token },
      body,
    });
  } catch {
    throw new AdminApiError(0, 'Network error');
  }
  if (!res.ok) throw await parseError(res);

  try {
    const data = (await res.json()) as {
      images?: { path?: string }[];
    };
    const urls =
      data.images
        ?.map((img) => img.path)
        .filter((path): path is string => Boolean(path)) ?? [];
    if (urls.length === 0) return null;
    return { imageUrl: urls[0], imageUrls: urls };
  } catch {
    return null;
  }
}

/** Friendly copy for failed dashboard actions (orders, restock). */
export function actionErrorMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return 'Something went wrong. Please try again.';
  switch (true) {
    case error.status === 0:
      return 'Can’t reach the server. Check your connection or that the API is running.';
    case error.status === 403:
      return 'This account doesn’t have admin access.';
    case error.status === 404:
      return error.message || 'That item no longer exists. Refresh and try again.';
    case error.status >= 500:
      return 'The server ran into a problem. Please try again shortly.';
    default:
      return error.message || `Request failed (${error.status}).`;
  }
}

/** Friendly copy for the form-level error banner. */
export function serverErrorMessage(error: AdminApiError): string {
  switch (true) {
    case error.status === 0:
      return 'Can’t reach the server. Check your connection or that the API is running.';
    case error.status === 400 || error.status === 422:
      return error.message || 'Please check the highlighted fields.';
    case error.status === 401:
      return error.message || 'Incorrect admin username or password.';
    case error.status === 403:
      return 'This account doesn’t have admin access.';
    case error.status === 429:
      return 'Too many sign-in attempts. Please wait a minute and try again.';
    case error.status >= 500:
      return 'The server ran into a problem. Please try again shortly.';
    default:
      return error.message || `Sign-in failed (${error.status}). Please try again.`;
  }
}
