export type OrderStatusEvent = {
  orderId: string;
  status: string;
  customerName?: string;
  at: string;
};

const KEY = 'pixel-tech-order-status-event';
const EVENT = 'pixel-order-status';

export function publishOrderStatusEvent(event: Omit<OrderStatusEvent, 'at'>) {
  if (typeof window === 'undefined') return;
  const payload: OrderStatusEvent = { ...event, at: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: payload }));
}
