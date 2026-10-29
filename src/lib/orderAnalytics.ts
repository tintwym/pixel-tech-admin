import type { AdminOrder, GroceryItem, OrderStatus } from '@/types';

export type TrendPoint = {
  label: string;
  revenue: number;
  orders: number;
};

export type ProductPerf = {
  key: string;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string;
  units: number;
  revenue: number;
  product?: GroceryItem;
};

export type NamedAmount = {
  name: string;
  value: number;
  color?: string;
};

export type CustomerInsight = {
  key: string;
  name: string;
  email: string;
  orders: number;
  spend: number;
  lastOrderAt: string;
  isRepeat: boolean;
};

export type FunnelStep = {
  status: OrderStatus;
  label: string;
  count: number;
};

export type OrderAnalytics = {
  hasOrders: boolean;
  activeOrders: AdminOrder[];
  /** All-time active (non-cancelled) revenue */
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  uniqueCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  deliveredCount: number;
  deliveryRate: number;
  cancelledCount: number;
  monthlyTrend: TrendPoint[];
  weeklyTrend: TrendPoint[];
  dailyTrend: TrendPoint[];
  productPerformance: ProductPerf[];
  brandBreakdown: NamedAmount[];
  categoryBreakdown: NamedAmount[];
  customerSegments: NamedAmount[];
  topCustomers: CustomerInsight[];
  funnel: FunnelStep[];
  recentPeriod: {
    revenue: number;
    orders: number;
    previousRevenue: number;
    previousOrders: number;
    revenueDelta: number;
    ordersDelta: number;
  };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FUNNEL_ORDER: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'processing', label: 'Processing' },
  { status: 'out_for_delivery', label: 'Out for delivery' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'cancelled', label: 'Cancelled' },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function percentChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function customerKey(order: AdminOrder): string {
  return (order.customerEmail || order.customerName || 'guest').trim().toLowerCase();
}

function resolveProductMeta(
  itemName: string,
  productId: string | undefined,
  products: GroceryItem[]
): Pick<ProductPerf, 'brand' | 'category' | 'imageUrl' | 'product' | 'name'> {
  const byId = productId ? products.find((p) => p.apiId === productId || p.id === productId) : undefined;
  const byName = products.find((p) => p.name === itemName);
  const product = byId || byName;
  return {
    name: product?.name || itemName,
    brand: product?.brand || 'Other',
    category: product?.category || 'Accessories',
    imageUrl: product?.imageUrl,
    product,
  };
}

function buildBucketTrend(
  orders: AdminOrder[],
  buckets: { key: string; label: string; start: Date; end: Date }[]
): TrendPoint[] {
  return buckets.map((bucket) => {
    let revenue = 0;
    let count = 0;
    for (const order of orders) {
      const t = new Date(order.createdAt).getTime();
      if (t >= bucket.start.getTime() && t < bucket.end.getTime()) {
        revenue += order.totalAmount;
        count += 1;
      }
    }
    return { label: bucket.label, revenue, orders: count };
  });
}

export function buildOrderAnalytics(
  orders: AdminOrder[],
  products: GroceryItem[],
  now = new Date()
): OrderAnalytics {
  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const cancelledCount = orders.filter((o) => o.status === 'cancelled').length;
  const totalRevenue = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrders = activeOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const byCustomer = new Map<string, CustomerInsight>();
  for (const order of activeOrders) {
    const key = customerKey(order);
    const prev = byCustomer.get(key);
    byCustomer.set(key, {
      key,
      name: order.customerName || 'Guest',
      email: order.customerEmail || '—',
      orders: (prev?.orders || 0) + 1,
      spend: (prev?.spend || 0) + order.totalAmount,
      lastOrderAt:
        !prev || new Date(order.createdAt) > new Date(prev.lastOrderAt)
          ? order.createdAt
          : prev.lastOrderAt,
      isRepeat: false,
    });
  }
  const topCustomers = [...byCustomer.values()]
    .map((c) => ({ ...c, isRepeat: c.orders > 1 }))
    .sort((a, b) => b.spend - a.spend);
  const uniqueCustomers = topCustomers.length;
  const repeatCustomers = topCustomers.filter((c) => c.isRepeat).length;
  const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
  const deliveryRate = orders.length > 0 ? (deliveredCount / orders.length) * 100 : 0;

  const monthlyBuckets = [];
  for (let i = 11; i >= 0; i--) {
    const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - i, 1));
    const end = startOfMonth(new Date(now.getFullYear(), now.getMonth() - i + 1, 1));
    monthlyBuckets.push({
      key: `${start.getFullYear()}-${start.getMonth()}`,
      label: MONTHS[start.getMonth()],
      start,
      end,
    });
  }

  const weeklyBuckets = [];
  for (let i = 7; i >= 0; i--) {
    const end = startOfDay(addDays(now, -i * 7 + 1));
    const start = addDays(end, -7);
    weeklyBuckets.push({
      key: start.toISOString(),
      label: `${MONTHS[start.getMonth()]} ${start.getDate()}`,
      start,
      end,
    });
  }

  const dailyBuckets = [];
  for (let i = 13; i >= 0; i--) {
    const start = startOfDay(addDays(now, -i));
    const end = addDays(start, 1);
    dailyBuckets.push({
      key: start.toISOString(),
      label: `${start.getDate()} ${MONTHS[start.getMonth()]}`,
      start,
      end,
    });
  }

  const monthlyTrend = buildBucketTrend(activeOrders, monthlyBuckets);
  const weeklyTrend = buildBucketTrend(activeOrders, weeklyBuckets);
  const dailyTrend = buildBucketTrend(activeOrders, dailyBuckets);

  const productMap = new Map<string, ProductPerf>();
  for (const order of activeOrders) {
    for (const item of order.items) {
      const meta = resolveProductMeta(item.name, item.productId, products);
      const key = item.productId || meta.name;
      const prev = productMap.get(key);
      const lineRevenue = item.price * item.quantity;
      productMap.set(key, {
        key,
        name: meta.name,
        brand: meta.brand,
        category: meta.category,
        imageUrl: meta.imageUrl,
        product: meta.product,
        units: (prev?.units || 0) + item.quantity,
        revenue: (prev?.revenue || 0) + lineRevenue,
      });
    }
  }
  const productPerformance = [...productMap.values()].sort((a, b) => b.revenue - a.revenue);

  const sumBy = (picker: (p: ProductPerf) => string): NamedAmount[] => {
    const map = new Map<string, number>();
    for (const p of productPerformance) {
      const name = picker(p);
      map.set(name, (map.get(name) || 0) + p.revenue);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const brandBreakdown = sumBy((p) => p.brand);
  const categoryBreakdown = sumBy((p) => p.category);

  const customerSegments: NamedAmount[] = [
    { name: 'New', value: Math.max(0, uniqueCustomers - repeatCustomers) },
    { name: 'Repeat', value: repeatCustomers },
  ].filter((s) => s.value > 0);

  const funnel: FunnelStep[] = FUNNEL_ORDER.map(({ status, label }) => ({
    status,
    label,
    count: orders.filter((o) => o.status === status).length,
  }));

  const thisMonth = monthlyTrend[monthlyTrend.length - 1] || { revenue: 0, orders: 0, label: '' };
  const prevMonth = monthlyTrend[monthlyTrend.length - 2] || { revenue: 0, orders: 0, label: '' };

  return {
    hasOrders: orders.length > 0,
    activeOrders,
    totalRevenue,
    totalOrders,
    averageOrderValue,
    uniqueCustomers,
    repeatCustomers,
    repeatRate,
    deliveredCount,
    deliveryRate,
    cancelledCount,
    monthlyTrend,
    weeklyTrend,
    dailyTrend,
    productPerformance,
    brandBreakdown,
    categoryBreakdown,
    customerSegments,
    topCustomers,
    funnel,
    recentPeriod: {
      revenue: thisMonth.revenue,
      orders: thisMonth.orders,
      previousRevenue: prevMonth.revenue,
      previousOrders: prevMonth.orders,
      revenueDelta: percentChange(thisMonth.revenue, prevMonth.revenue),
      ordersDelta: percentChange(thisMonth.orders, prevMonth.orders),
    },
  };
}

export function formatAxisMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${Math.round(value)}`;
}
