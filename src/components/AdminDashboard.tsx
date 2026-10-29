'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  BarChart3,
  Boxes,
  FileText,
  Settings,
  LifeBuoy,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  CalendarDays,
  DollarSign,
  ShoppingCart,
  UserRound,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  PackageX,
  PackageCheck,
  AlertTriangle,
  Layers,
  RefreshCw,
  CheckCircle2,
  Plus,
  Zap,
  Clock,
  Brain,
  ShieldCheck,
  Cpu,
  Menu,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AdminOrder, GroceryItem, OrderStatus } from '@/types';
import ProductImage from '@/components/ProductImage';
import SignOutModal from '@/components/SignOutModal';
import Select, { SelectOption } from '@/components/Select';
import { PRODUCT_BRANDS, PRODUCT_CATEGORIES } from '@/data/catalogTaxonomy';
import type { UpdateProductFields } from '@/lib/adminApi';
import { buildOrderAnalytics, formatAxisMoney } from '@/lib/orderAnalytics';

const TREND_OPTIONS: SelectOption<'monthly' | 'weekly' | 'daily'>[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

export type OrdersLoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

interface AdminDashboardProps {
  products: GroceryItem[];
  orders: AdminOrder[];
  ordersState: OrdersLoadState;
  onRefreshOrders: () => void;
  /** Resolves false when the change was not saved (the caller has already shown why). */
  onRestock: (item: GroceryItem, amount: number) => Promise<boolean>;
  onUpdateProduct: (item: GroceryItem, fields: UpdateProductFields) => Promise<boolean>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<boolean>;
  onAddToast: (title: string, msg: string, type: 'success' | 'warning' | 'info') => void;
  /** Called after the admin confirms sign-out in the modal. */
  onSignOut: () => void;
  adminLabel?: string;
}

type View = 'overview' | 'orders' | 'products' | 'customers' | 'analytics' | 'inventory' | 'reports';

const NAV_ITEMS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'reports', label: 'Reports', icon: FileText },
];

const DONUT_COLORS = ['#0ea5e9', '#2dd4bf', '#a78bfa', '#fbbf24', '#fb7185', '#94a3b8'];

const SAMPLE_CUSTOMERS = ['Aung Kyaw', 'Su Myat Noe', 'Thiri Win', 'Kaung Htet', 'May Thu'];

function toPercentShares(rows: { name: string; value: number }[]): { name: string; value: number }[] {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0) return [];
  return rows.map((row) => ({
    name: row.name,
    value: Math.max(1, Math.round((row.value / total) * 100)),
  }));
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  processing: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  out_for_delivery: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  delivered: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  cancelled: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  out_for_delivery: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: 'processing', label: 'Pack order' },
  processing: { status: 'out_for_delivery', label: 'Dispatch rider' },
  out_for_delivery: { status: 'delivered', label: 'Mark delivered' },
};

function formatMMK(value: number, compact = true): string {
  if (compact && value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M MMK`;
  if (compact && value >= 10_000) return `${Math.round(value / 1000).toLocaleString()}K MMK`;
  return `${Math.round(value).toLocaleString()} MMK`;
}

function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function percentChange(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

type OrderRow = {
  id: string;
  customer: string;
  product: string;
  amount: number;
  status: OrderStatus;
  date: string;
  source?: AdminOrder;
};

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#121a24] shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-12px_rgb(2_132_199/0.12)] ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  action,
  onAction,
  right,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="font-sans text-[15px] font-semibold text-slate-900 dark:text-white truncate">{title}</h3>
        {children}
      </div>
      {right}
      {action && (
        <button
          onClick={onAction}
          className="text-xs font-semibold text-[#0284c7] hover:text-[#0ea5e9] dark:text-sky-400 cursor-pointer shrink-0"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function Delta({ value, suffix = 'vs last month' }: { value: number; suffix?: string }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
        <Icon className="w-3.5 h-3.5" />
        {up ? '+' : ''}
        {value.toFixed(1)}%
      </span>
      {suffix && <span className="text-slate-400">{suffix}</span>}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaSuffix,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  delta: number;
  deltaSuffix?: string;
  icon: React.ElementType;
  tone: 'emerald' | 'sky' | 'violet' | 'indigo';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">{value}</p>
        </div>
      </div>
      <div className="mt-4">
        <Delta value={delta} suffix={deltaSuffix} />
      </div>
    </Card>
  );
}

function Donut({
  data,
  centerValue,
  centerLabel,
}: {
  data: { name: string; value: number }[];
  centerValue: string;
  centerLabel: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive
            >
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{centerValue}</span>
          <span className="text-[11px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              {d.name}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{d.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: { orders: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-bold">{formatMMK(payload[0].value, false)}</p>
      <p className="text-slate-300">
        {label} · {payload[0].payload.orders} orders
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const palette = ['bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${palette[seed(name) % palette.length]}`}>
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function AdminDashboard({
  products,
  orders,
  ordersState,
  onRefreshOrders,
  onRestock,
  onUpdateProduct,
  onUpdateOrderStatus,
  onAddToast,
  onSignOut,
  adminLabel,
}: AdminDashboardProps) {
  const [view, setView] = useState<View>('overview');
  const [query, setQuery] = useState('');
  const [trendMode, setTrendMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [editingProduct, setEditingProduct] = useState<GroceryItem | null>(null);
  const [editBrand, setEditBrand] = useState('Apple');
  const [editCategory, setEditCategory] = useState('Smartphones');
  const [editSaving, setEditSaving] = useState(false);
  const [editImages, setEditImages] = useState<File[]>([]);
  const [replaceGallery, setReplaceGallery] = useState(false);
  const closeSignOut = useCallback(() => setConfirmSignOut(false), []);
  const requestSignOut = () => {
    setProfileOpen(false);
    setMobileNavOpen(false);
    setConfirmSignOut(true);
  };
  const displayName = adminLabel || 'Admin';
  const q = query.trim().toLowerCase();

  const now = useMemo(() => new Date(), []);
  const analytics = useMemo(() => buildOrderAnalytics(orders, products, now), [orders, products, now]);

  /* Product rows for inventory/products views: real sold units from checkouts. */
  const productStats = useMemo(() => {
    const sold: Record<string, number> = {};
    const revenue: Record<string, number> = {};
    analytics.activeOrders.forEach((o) =>
      o.items.forEach((ci) => {
        const key = ci.productId ?? ci.name;
        sold[key] = (sold[key] || 0) + ci.quantity;
        revenue[key] = (revenue[key] || 0) + ci.price * ci.quantity;
      })
    );
    return products.map((p) => {
      const realUnits = (p.apiId && sold[p.apiId]) || sold[p.name] || 0;
      const realRevenue = (p.apiId && revenue[p.apiId]) || revenue[p.name] || realUnits * p.price;
      return {
        item: p,
        realUnits,
        units: realUnits,
        revenue: realRevenue,
        growth: 0,
      };
    });
  }, [products, analytics.activeOrders]);

  const topProducts = useMemo(() => {
    const fromOrders = analytics.productPerformance
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((s) => ({
        item: s.product || {
          id: s.key,
          name: s.name,
          description: '',
          brand: s.brand,
          category: s.category,
          price: s.units > 0 ? Math.round(s.revenue / s.units) : 0,
          currency: 'MMK',
          imageUrl: s.imageUrl || '',
          stock: 0,
          maxStock: 0,
          availabilityZone: 'All Zones' as const,
          featuresRestrictions: [],
          isSubscriptionAvailable: false,
          rating: 0,
          unit: '1 unit',
        },
        realUnits: s.units,
        units: s.units,
        revenue: s.revenue,
        growth: 0,
      }));
    if (fromOrders.length > 0) return fromOrders;
    return [...productStats]
      .filter(
        (s) =>
          !q ||
          s.item.name.toLowerCase().includes(q) ||
          s.item.category.toLowerCase().includes(q) ||
          s.item.brand.toLowerCase().includes(q)
      )
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [analytics.productPerformance, productStats, q]);

  const trend =
    trendMode === 'daily'
      ? analytics.dailyTrend
      : trendMode === 'weekly'
        ? analytics.weeklyTrend
        : analytics.monthlyTrend;
  const trendDelta =
    trend.length >= 2
      ? percentChange(trend[trend.length - 1].revenue, trend[trend.length - 2].revenue)
      : 0;

  const brandDonut = useMemo(
    () => toPercentShares(analytics.brandBreakdown.map((b) => ({ name: b.name, value: b.value }))),
    [analytics.brandBreakdown]
  );
  const categoryBars = useMemo(
    () =>
      analytics.categoryBreakdown.map((c) => ({
        category: c.name,
        revenue: c.value,
      })),
    [analytics.categoryBreakdown]
  );
  const customerDonut = useMemo(() => {
    if (analytics.customerSegments.length > 0) {
      return toPercentShares(analytics.customerSegments);
    }
    return [{ name: 'No customers yet', value: 100 }];
  }, [analytics.customerSegments]);

  const kpis = {
    revenue: analytics.recentPeriod.revenue,
    revenueDelta: analytics.recentPeriod.revenueDelta,
    orders: analytics.recentPeriod.orders,
    ordersDelta: analytics.recentPeriod.ordersDelta,
    customers: analytics.uniqueCustomers,
    customersDelta: analytics.repeatRate,
    aov: analytics.averageOrderValue,
    deliveryRate: analytics.deliveryRate,
  };

  /* Orders: from the API, or labelled sample rows only when the API couldn't be reached. */
  const showSampleOrders = ordersState.status === 'error';
  const orderRows: OrderRow[] = useMemo(() => {
    if (!showSampleOrders) {
      return [...orders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((o) => ({
          id: `#${o.id.slice(0, 8).toUpperCase()}`,
          customer: o.customerName,
          product:
            (o.items[0]?.name.split(' — ')[0] ?? '—') +
            (o.items.length > 1 ? ` +${o.items.length - 1}` : ''),
          amount: o.totalAmount,
          status: o.status,
          date: o.createdAt,
          source: o,
        }));
    }
    const statuses: OrderStatus[] = ['delivered', 'out_for_delivery', 'processing', 'delivered', 'out_for_delivery'];
    return products.slice(0, 5).map((p, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.floor(i / 2));
      return {
        id: `#PT-${10421 - i}`,
        customer: SAMPLE_CUSTOMERS[i],
        product: p.name.split(' — ')[0],
        amount: p.price,
        status: statuses[i],
        date: d.toISOString(),
      };
    });
  }, [showSampleOrders, orders, products, now]);

  const filteredOrderRows = useMemo(
    () =>
      orderRows.filter(
        (r) =>
          !q ||
          r.id.toLowerCase().includes(q) ||
          r.customer.toLowerCase().includes(q) ||
          r.product.toLowerCase().includes(q)
      ),
    [orderRows, q]
  );

  /* Inventory */
  const outOfStock = products.filter((p) => p.stock === 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const inStock = products.filter((p) => p.stock > 5);
  const totalUnits = products.reduce((s, p) => s + p.stock, 0);

  const restockPredictions = useMemo(() => {
    return productStats
      .map(({ item, realUnits }) => {
        // Prefer real sales velocity; light fallback when a SKU has no order history yet.
        const effective = realUnits > 0 ? realUnits : item.stock <= 5 ? 2 : 1;
        const dailyVelocity = parseFloat(Math.max(0.2, effective / 14).toFixed(1));
        const daysRemaining = Math.max(0, parseFloat((item.stock / dailyVelocity).toFixed(1)));
        const urgency: 'HIGH' | 'MEDIUM' | 'LOW' =
          item.stock <= 5 || daysRemaining <= 3.5 ? 'HIGH' : daysRemaining <= 6 ? 'MEDIUM' : 'LOW';
        return {
          item,
          dailyVelocity,
          daysRemaining,
          urgency,
          recommendedRestock: Math.max(15, item.maxStock - item.stock),
          confidence: realUnits > 0 ? Math.min(98, 80 + realUnits * 3) : 62,
        };
      })
      .sort((a, b) => {
        const score = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return score[b.urgency] - score[a.urgency] || a.daysRemaining - b.daysRemaining;
      });
  }, [productStats]);

  const criticalCount = restockPredictions.filter((p) => p.urgency === 'HIGH').length;
  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing').length;
  const alertCount = criticalCount + pendingOrders;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  /* Actions */
  /** Runs a server action for `id`, ignoring repeat clicks while it is in flight. */
  const withBusy = async (id: string, action: () => Promise<boolean>): Promise<boolean> => {
    if (busyIds.has(id)) return false;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      return await action();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const restock = async (item: GroceryItem, amount: number) => {
    if (await withBusy(item.id, () => onRestock(item, amount))) {
      onAddToast('Stock replenished', `Added +${amount} units to ${item.name}.`, 'success');
    }
  };

  const restockAllCritical = async () => {
    const criticals = restockPredictions.filter((p) => p.urgency === 'HIGH');
    if (!criticals.length) {
      onAddToast('Stock healthy', 'No critical restock items detected.', 'info');
      return;
    }
    const results = await Promise.all(
      criticals.map((c) => withBusy(c.item.id, () => onRestock(c.item, c.recommendedRestock)))
    );
    const saved = results.filter(Boolean).length;
    if (saved) onAddToast('Auto-restock executed', `Replenished ${saved} of ${criticals.length} high-urgency items.`, 'success');
  };

  const advanceOrder = async (row: OrderRow) => {
    const next = NEXT_STATUS[row.status];
    const source = row.source;
    if (!source || !next) return;
    if (await withBusy(source.id, () => onUpdateOrderStatus(source.id, next.status))) {
      onAddToast('Status advanced', `Order ${row.id} moved to ${STATUS_LABELS[next.status]}.`, 'success');
    }
  };

  const cancelOrder = async (row: OrderRow) => {
    const source = row.source;
    if (!source) return;
    if (await withBusy(source.id, () => onUpdateOrderStatus(source.id, 'cancelled'))) {
      onAddToast('Order cancelled', `Order ${row.id} was cancelled.`, 'info');
    }
  };

  const go = (v: View) => {
    setView(v);
    setMobileNavOpen(false);
  };

  /* ---------------------------------------------------------------- */
  /* Section renderers                                                 */
  /* ---------------------------------------------------------------- */

  const salesTrendCard = (tall = false) => (
    <Card className="p-5">
      <CardHeader
        title="Sales Trend"
        right={
          <Select
            size="sm"
            aria-label="Sales trend period"
            value={trendMode}
            onChange={setTrendMode}
            options={TREND_OPTIONS}
            className="min-w-28 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121a24] py-1.5 pl-3 pr-2 font-medium text-slate-600 dark:text-slate-300"
          />
        }
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            trendDelta >= 0
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-600'
          }`}
        >
          <TrendingUp className="h-3 w-3" />
          {trendDelta >= 0 ? '+' : ''}
          {trendDelta.toFixed(1)}%
        </span>
      </CardHeader>
      <div className={tall ? 'h-80' : 'h-60'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => formatAxisMoney(Number(v))}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#0ea5e9', strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#0284c7"
              strokeWidth={2.5}
              fill="url(#trendFill)"
              activeDot={{ r: 5, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!analytics.hasOrders && (
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Charts fill from live storefront checkouts. No paid orders yet.
        </p>
      )}
    </Card>
  );

  const topProductsCard = (limit = 5) => (
    <Card className="p-5">
      <CardHeader title="Top Products" action={view === 'overview' ? 'View all' : undefined} onAction={() => go('products')} />
      {topProducts.length === 0 || (analytics.hasOrders && analytics.productPerformance.length === 0) ? (
        <p className="py-6 text-center text-xs text-slate-400">
          {q ? `No products match “${query}”.` : 'Top sellers appear after the first paid checkout.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {topProducts.slice(0, limit).map((s, i) => (
            <li key={s.item.id} className="flex items-center gap-3 py-3">
              <span className="w-4 text-xs font-semibold text-slate-400">{i + 1}</span>
              <ProductImage
                src={s.item.imageUrl}
                alt={s.item.name}
                className="h-10 w-10 shrink-0 rounded-lg border border-slate-100 dark:border-white/10 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{s.item.name}</p>
                <p className="text-[11px] text-slate-400">
                  {s.item.brand} · {s.item.category}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{formatMMK(s.revenue)}</p>
                <p className="text-[11px] text-slate-400">{s.units} sold</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const ordersTable = (rows: OrderRow[], withActions: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead>
          <tr className="text-[11px] text-slate-400">
            <th className="pb-2 font-medium">Order ID</th>
            <th className="pb-2 font-medium">Customer</th>
            <th className="pb-2 font-medium">Product</th>
            <th className="pb-2 font-medium">Amount</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Date</th>
            {withActions && <th className="pb-2 font-medium text-right">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {rows.map((r) => {
            const next = NEXT_STATUS[r.status];
            return (
              <tr key={r.id} className="text-slate-700 dark:text-slate-200">
                <td className="py-3 font-mono text-[11px] text-slate-500">{r.id}</td>
                <td className="py-3">
                  <span className="flex items-center gap-2">
                    <Avatar name={r.customer} />
                    <span className="font-medium">{r.customer}</span>
                  </span>
                </td>
                <td className="py-3 max-w-[180px] truncate">{r.product}</td>
                <td className="py-3 font-semibold">{formatMMK(r.amount, false)}</td>
                <td className="py-3">
                  <StatusPill status={r.status} />
                </td>
                <td className="py-3 text-slate-500">{formatDate(r.date)}</td>
                {withActions && (
                  <td className="py-3 text-right">
                    {r.source && next ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => advanceOrder(r)}
                          disabled={busyIds.has(r.source.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#0284c7] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0ea5e9] disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                        >
                          <RefreshCw className={`h-3 w-3 ${busyIds.has(r.source.id) ? 'animate-spin' : ''}`} />
                          {next.label}
                        </button>
                        <button
                          onClick={() => cancelOrder(r)}
                          disabled={busyIds.has(r.source.id)}
                          aria-label={`Cancel order ${r.id}`}
                          title="Cancel order"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 disabled:opacity-60 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : r.status === 'delivered' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Closed
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="py-6 text-center text-xs text-slate-400">
          {ordersState.status === 'loading'
            ? 'Loading orders…'
            : q
              ? `No orders match “${query}”.`
              : 'No orders yet. Paid storefront checkouts will appear here.'}
        </p>
      )}
    </div>
  );

  const sampleBadge = showSampleOrders && (
    <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      Sample
    </span>
  );

  const inventoryTiles = (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: 'Out of Stock', value: outOfStock.length, icon: PackageX, tone: 'text-rose-500 bg-rose-50 dark:bg-rose-500/15', note: outOfStock.length ? 'Needs action' : 'All good', noteTone: outOfStock.length ? 'text-rose-500' : 'text-emerald-600' },
        { label: 'Low Stock', value: lowStock.length, icon: AlertTriangle, tone: 'text-amber-500 bg-amber-50 dark:bg-amber-500/15', note: '≤ 5 units', noteTone: 'text-amber-600' },
        { label: 'In Stock', value: inStock.length, icon: PackageCheck, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15', note: `${totalUnits} units`, noteTone: 'text-emerald-600' },
        { label: 'Total Products', value: products.length, icon: Layers, tone: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/15', note: `${new Set(products.map((p) => p.category)).size} categories`, noteTone: 'text-slate-500' },
      ].map((t) => (
        <div key={t.label} className="rounded-xl border border-slate-100 dark:border-white/10 p-3.5">
          <div className="flex items-center justify-between">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.tone}`}>
              <t.icon className="h-4.5 w-4.5" />
            </span>
            <span className="text-[11px] text-slate-400">{t.label}</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{t.value}</p>
          <p className={`text-[11px] font-medium ${t.noteTone}`}>{t.note}</p>
        </div>
      ))}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Revenue (this month)" value={formatMMK(kpis.revenue)} delta={kpis.revenueDelta} icon={DollarSign} tone="emerald" />
        <KpiCard label="Orders (this month)" value={kpis.orders.toLocaleString()} delta={kpis.ordersDelta} icon={ShoppingCart} tone="sky" />
        <KpiCard
          label="Customers"
          value={kpis.customers.toLocaleString()}
          delta={kpis.customersDelta}
          deltaSuffix="repeat rate"
          icon={UserRound}
          tone="violet"
        />
        <KpiCard
          label="Avg order value"
          value={formatMMK(kpis.aov)}
          delta={kpis.deliveryRate}
          deltaSuffix="delivered"
          icon={Percent}
          tone="indigo"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">{salesTrendCard()}</div>
        <Card className="p-5">
          <CardHeader title="Revenue by Brand" action="View all" onAction={() => go('analytics')} />
          {brandDonut.length > 0 ? (
            <Donut
              data={brandDonut}
              centerValue={formatMMK(analytics.totalRevenue)}
              centerLabel="All-time sales"
            />
          ) : (
            <p className="py-10 text-center text-xs text-slate-400">Brand mix appears after first sales.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">{topProductsCard()}</div>
        <Card className="p-5">
          <CardHeader title="Customer Segments" action="View all" onAction={() => go('customers')} />
          <Donut
            data={customerDonut}
            centerValue={analytics.uniqueCustomers.toLocaleString()}
            centerLabel="Customers"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="p-5 xl:col-span-2">
          <CardHeader title="Recent Orders" action="View all" onAction={() => go('orders')}>
            {sampleBadge}
          </CardHeader>
          {ordersTable(filteredOrderRows.slice(0, 5), false)}
        </Card>
        <Card className="p-5">
          <CardHeader title="Inventory Snapshot" action="View all" onAction={() => go('inventory')} />
          {inventoryTiles}
        </Card>
      </div>
    </div>
  );

  const renderOrders = () => (
    <Card className="p-5">
      <CardHeader
        title={`All Orders (${filteredOrderRows.length})`}
        right={
          <button
            onClick={onRefreshOrders}
            disabled={ordersState.status === 'loading'}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${ordersState.status === 'loading' ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      >
        {sampleBadge}
      </CardHeader>
      {ordersState.status === 'error' && (
        <p
          className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Couldn’t load orders: {ordersState.message} Showing sample rows until the server responds.</span>
        </p>
      )}
      {ordersTable(filteredOrderRows, true)}
    </Card>
  );

  const openProductEditor = (item: GroceryItem) => {
    setEditingProduct(item);
    setEditBrand(item.brand || 'Other');
    setEditCategory(item.category || 'Accessories');
    setEditImages([]);
    setReplaceGallery(false);
  };

  const closeProductEditor = () => {
    if (editSaving) return;
    setEditingProduct(null);
    setEditImages([]);
    setReplaceGallery(false);
  };

  const saveProductEditor = async () => {
    if (!editingProduct) return;
    if (replaceGallery && editImages.length === 0) {
      onAddToast(
        'Add images',
        'Select at least one image when replacing the gallery.',
        'warning'
      );
      return;
    }
    setEditSaving(true);
    const ok = await onUpdateProduct(editingProduct, {
      name: editingProduct.name,
      description: editingProduct.description,
      brand: editBrand,
      category: editCategory,
      price: editingProduct.price,
      stock: editingProduct.stock,
      images: editImages.length > 0 ? editImages : undefined,
      replaceImages: replaceGallery,
    });
    setEditSaving(false);
    if (ok) {
      onAddToast(
        'Product updated',
        editImages.length > 0
          ? `${editingProduct.name} saved with ${editImages.length} new image${editImages.length === 1 ? '' : 's'}.`
          : `${editingProduct.name} brand/category saved.`,
        'success'
      );
      closeProductEditor();
    }
  };

  const renderProducts = () => {
    const rows = productStats.filter(
      (s) =>
        !q ||
        s.item.name.toLowerCase().includes(q) ||
        s.item.category.toLowerCase().includes(q) ||
        s.item.brand.toLowerCase().includes(q)
    );
    return (
      <>
        <Card className="p-5">
          <CardHeader title={`Products (${rows.length})`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead>
                <tr className="text-[11px] text-slate-400">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Brand</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Price</th>
                  <th className="pb-2 font-medium">Stock</th>
                  <th className="pb-2 font-medium">Sold</th>
                  <th className="pb-2 font-medium">Revenue</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((s) => {
                  const ratio = Math.min(100, (s.item.stock / Math.max(1, s.item.maxStock)) * 100);
                  const low = s.item.stock <= 5;
                  return (
                    <tr key={s.item.id} className="text-slate-700 dark:text-slate-200">
                      <td className="py-3">
                        <span className="flex items-center gap-3">
                          <ProductImage src={s.item.imageUrl} alt={s.item.name} className="h-10 w-10 rounded-lg object-cover border border-slate-100 dark:border-white/10" />
                          <span className="max-w-[220px] truncate font-semibold">{s.item.name}</span>
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">{s.item.brand}</td>
                      <td className="py-3 text-slate-500">{s.item.category}</td>
                      <td className="py-3 font-medium">{formatMMK(s.item.price, false)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                            <div className={`h-full rounded-full ${low ? 'bg-rose-500' : 'bg-sky-500'}`} style={{ width: `${ratio}%` }} />
                          </div>
                          <span className={`font-mono text-[11px] ${low ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                            {s.item.stock}/{s.item.maxStock}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">{s.units}</td>
                      <td className="py-3 font-semibold">{formatMMK(s.revenue)}</td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openProductEditor(s.item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-sky-400 hover:text-sky-600 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => restock(s.item, 15)}
                            disabled={busyIds.has(s.item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-sky-400 hover:text-sky-600 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                          >
                            <Plus className="h-3 w-3" /> 15
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {editingProduct && (
          <div className="fixed inset-0 z-999 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close editor"
              className="absolute inset-0 bg-black/60 cursor-pointer"
              onClick={closeProductEditor}
            />
            <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1220] p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">Edit product</p>
                  <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {editingProduct.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeProductEditor}
                  disabled={editSaving}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Brand
                  <select
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121a24] px-3 py-2.5 text-sm text-slate-900 dark:text-white"
                  >
                    {PRODUCT_BRANDS.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Category
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121a24] px-3 py-2.5 text-sm text-slate-900 dark:text-white"
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Current gallery</p>
                  <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                    {(editingProduct.imageUrls?.length
                      ? editingProduct.imageUrls
                      : [editingProduct.imageUrl]
                    ).map((src, i) => (
                      <ProductImage
                        key={`${src}-${i}`}
                        src={src}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-white/10"
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                    First image is the catalog card. For colors, put the finish in the filename
                    (e.g. <span className="font-mono">…-select-starwhite-…</span>,{' '}
                    <span className="font-mono">…-select-nightsky-…</span>). Shared heroes can use{' '}
                    <span className="font-mono">unselect</span>.
                  </p>
                </div>

                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Upload images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={editSaving}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setEditImages(files);
                    }}
                    className="mt-1.5 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#e0f2fe] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0369a1] dark:file:bg-sky-950/50 dark:file:text-sky-300 cursor-pointer"
                  />
                </label>
                {editImages.length > 0 && (
                  <ul className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121a24] px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-1 max-h-28 overflow-y-auto">
                    {editImages.map((file) => (
                      <li key={file.name + file.size} className="truncate font-mono">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                )}

                <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceGallery}
                    disabled={editSaving}
                    onChange={(e) => setReplaceGallery(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#0284c7] focus:ring-[#0284c7]"
                  />
                  <span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Replace existing gallery</span>
                    <span className="block text-slate-400 mt-0.5">
                      Clears current photos before uploading the new ones. Leave unchecked to append.
                    </span>
                  </span>
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeProductEditor}
                  disabled={editSaving}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveProductEditor}
                  disabled={editSaving}
                  className="rounded-xl bg-[#0284c7] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0ea5e9] disabled:opacity-60 cursor-pointer"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderCustomers = () => {
    const customers = analytics.topCustomers.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Unique customers"
            value={analytics.uniqueCustomers.toLocaleString()}
            delta={analytics.repeatRate}
            deltaSuffix="repeat rate"
            icon={UserRound}
            tone="violet"
          />
          <KpiCard
            label="Repeat buyers"
            value={analytics.repeatCustomers.toLocaleString()}
            delta={analytics.repeatRate}
            deltaSuffix="of customers"
            icon={Users}
            tone="sky"
          />
          <KpiCard
            label="Top spend"
            value={formatMMK(customers[0]?.spend || 0)}
            delta={0}
            deltaSuffix="leading customer"
            icon={DollarSign}
            tone="emerald"
          />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Card className="p-5">
            <CardHeader title="Customer Segments" />
            <Donut
              data={customerDonut}
              centerValue={analytics.uniqueCustomers.toLocaleString()}
              centerLabel="Customers"
            />
          </Card>
          <Card className="p-5 xl:col-span-2">
            <CardHeader title={`Customers from checkouts (${customers.length})`} />
            {customers.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold">No customer orders yet</p>
                <p className="text-xs">Customers appear here after their first checkout.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="text-[11px] text-slate-400">
                      <th className="pb-2 font-medium">Customer</th>
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Orders</th>
                      <th className="pb-2 font-medium">Total Spend</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Last Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {customers.map((c) => (
                      <tr key={c.key} className="text-slate-700 dark:text-slate-200">
                        <td className="py-3">
                          <span className="flex items-center gap-2">
                            <Avatar name={c.name} />
                            <span className="font-medium">{c.name}</span>
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{c.email}</td>
                        <td className="py-3">{c.orders}</td>
                        <td className="py-3 font-semibold">{formatMMK(c.spend, false)}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              c.isRepeat
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                            }`}
                          >
                            {c.isRepeat ? 'Repeat' : 'New'}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{formatDate(c.lastOrderAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    const funnelMax = Math.max(1, ...analytics.funnel.map((f) => f.count));
    const topPerf = analytics.productPerformance.slice(0, 8);

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="All-time revenue" value={formatMMK(analytics.totalRevenue)} delta={kpis.revenueDelta} icon={DollarSign} tone="emerald" />
          <KpiCard label="Paid orders" value={analytics.totalOrders.toLocaleString()} delta={kpis.ordersDelta} icon={ShoppingCart} tone="sky" />
          <KpiCard
            label="Avg order value"
            value={formatMMK(analytics.averageOrderValue)}
            delta={analytics.deliveryRate}
            deltaSuffix="delivered"
            icon={Percent}
            tone="indigo"
          />
          <KpiCard
            label="Cancelled"
            value={analytics.cancelledCount.toLocaleString()}
            delta={
              analytics.hasOrders
                ? (analytics.cancelledCount / Math.max(1, orders.length)) * 100
                : 0
            }
            deltaSuffix="of all orders"
            icon={PackageX}
            tone="violet"
          />
        </div>

        {salesTrendCard(true)}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Card className="p-5 xl:col-span-2">
            <CardHeader title="Order funnel" />
            {analytics.hasOrders ? (
              <ul className="space-y-3">
                {analytics.funnel.map((step) => (
                  <li key={step.status}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{step.label}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{step.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#0284c7]"
                        style={{ width: `${Math.max(4, (step.count / funnelMax) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-10 text-center text-xs text-slate-400">Funnel fills once checkouts start arriving.</p>
            )}
          </Card>
          <Card className="p-5">
            <CardHeader title="Revenue by Brand" />
            {brandDonut.length > 0 ? (
              <Donut
                data={brandDonut}
                centerValue={formatMMK(analytics.totalRevenue)}
                centerLabel="Sales mix"
              />
            ) : (
              <p className="py-10 text-center text-xs text-slate-400">Brand mix appears after first sales.</p>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Card className="p-5">
            <CardHeader title="Revenue by Category" />
            {categoryBars.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">Category sales appear after first checkouts.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBars} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => formatAxisMoney(Number(v))}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      formatter={(v) => formatMMK(Number(v), false)}
                      cursor={{ fill: 'rgba(14,165,233,0.06)' }}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {categoryBars.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card className="p-5">
            <CardHeader title="Top products by revenue" />
            {topPerf.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">Product performance appears after first sales.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {topPerf.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-3 py-2.5">
                    <span className="w-4 text-xs font-semibold text-slate-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{s.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {s.brand} · {s.units} sold
                      </p>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{formatMMK(s.revenue)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    const rows = restockPredictions.filter(
      (p) => !q || p.item.name.toLowerCase().includes(q) || p.item.category.toLowerCase().includes(q)
    );
    const urgencyStyles = {
      HIGH: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
      MEDIUM: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
      LOW: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    };
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="p-5 h-fit">
          <CardHeader title="Inventory Snapshot" />
          {inventoryTiles}
        </Card>
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-sans flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
                <Brain className="h-4 w-4 text-violet-500" /> Restock Predictions
              </h3>
              <p className="text-xs text-slate-400">Days until stockout, based on order velocity.</p>
            </div>
            <button
              onClick={restockAllCritical}
              disabled={busyIds.size > 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284c7] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0ea5e9] disabled:opacity-60 disabled:cursor-wait cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" /> Restock all critical ({criticalCount})
            </button>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((p) => (
              <li key={p.item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ProductImage src={p.item.imageUrl} alt={p.item.name} className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-100 dark:border-white/10" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{p.item.name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyStyles[p.urgency]}`}>{p.urgency}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Stock {p.item.stock}/{p.item.maxStock} · {p.dailyVelocity}/day · {p.confidence}% confidence
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    {p.daysRemaining <= 0 ? 'Stockout' : `~${p.daysRemaining} days`}
                  </span>
                  <button
                    onClick={() => restock(p.item, p.recommendedRestock)}
                    disabled={busyIds.has(p.item.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0284c7] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0ea5e9] disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> {p.recommendedRestock}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  };

  const renderReports = () => (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Compliance & Audit Log</p>
            <p className="leading-relaxed">
              Private customer data (emails, phone numbers, delivery coordinates) is isolated. Transient telemetry is scrubbed within 48 hours.
            </p>
          </div>
        </div>
      </Card>
      <div className="h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#0B1220] p-4 font-mono text-xs leading-relaxed text-sky-300 space-y-2">
        <div>[04:12:08 UTC] <span className="font-bold text-blue-400">INFO:</span> PCI-DSS secure handshake verified with KBZPay API endpoint.</div>
        <div>[04:12:09 UTC] <span className="font-bold text-sky-400">AUDIT:</span> Verified Google OAuth2 credential.</div>
        <div>[05:30:15 UTC] <span className="font-bold text-blue-400">INFO:</span> TLS verified on all active user channels.</div>
        {lowStock.slice(0, 3).map((p) => (
          <div key={p.id}>
            [06:45:00 UTC] <span className="font-bold text-amber-400">WARN:</span> Low stock event for {p.name} ({p.stock} left).
          </div>
        ))}
        <div>[08:12:11 UTC] <span className="font-bold text-violet-400">GDPR:</span> Cleared telemetry coordinates older than 48 hours.</div>
        <div>[08:15:22 UTC] <span className="font-bold text-violet-400">GDPR:</span> Consent preference stored for new user profiles.</div>
        <div className="animate-pulse">[...] Awaiting live platform events…</div>
      </div>
    </div>
  );

  const sections: Record<View, () => React.ReactNode> = {
    overview: renderOverview,
    orders: renderOrders,
    products: renderProducts,
    customers: renderCustomers,
    analytics: renderAnalytics,
    inventory: renderInventory,
    reports: renderReports,
  };

  /* ---------------------------------------------------------------- */
  /* Layout                                                            */
  /* ---------------------------------------------------------------- */

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-[#0284c7] to-[#0ea5e9] text-white shadow-md shadow-sky-500/25">
          <Cpu className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Pixel Tech</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Admin</p>
        </div>
      </div>
      {NAV_ITEMS.map((n) => {
        const active = view === n.id;
        const badge = n.id === 'inventory' ? criticalCount : n.id === 'orders' ? pendingOrders : 0;
        return (
          <button
            key={n.id}
            onClick={() => go(n.id)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors cursor-pointer ${
              active
                ? 'bg-sky-50 text-[#0284c7] dark:bg-sky-500/15 dark:text-sky-300'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
            }`}
          >
            <n.icon className="h-4 w-4" />
            <span className="flex-1 text-left">{n.label}</span>
            {badge > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{badge}</span>
            )}
          </button>
        );
      })}
      <div className="mt-auto space-y-1 border-t border-slate-100 dark:border-white/10 pt-4">
        <button
          onClick={() => onAddToast('Settings', 'Store settings are coming soon.', 'info')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
        >
          <Settings className="h-4 w-4" /> Settings
        </button>
        <button
          onClick={() => onAddToast('Help & Support', 'Contact the Pixel Tech dev team for admin support.', 'info')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
        >
          <LifeBuoy className="h-4 w-4" /> Help & Support
        </button>
        <button
          onClick={requestSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  const pageTitle = NAV_ITEMS.find((n) => n.id === view)?.label ?? 'Overview';

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#0B1220] font-sans">
      <SignOutModal open={confirmSignOut} adminName={displayName} onCancel={closeSignOut} onConfirm={onSignOut} />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block sticky top-0 h-screen w-60 shrink-0 border-r border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#0f1722]">
          {sidebar}
        </aside>

        {/* Mobile sidebar */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-[#0f1722] shadow-xl">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 dark:border-white/10 bg-white/85 dark:bg-[#0f1722]/85 px-4 py-3 backdrop-blur-md sm:px-6">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, orders, or customers..."
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121a24] py-2.5 pl-9 pr-3 text-[13px] text-slate-700 dark:text-slate-200 outline-hidden placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => go(criticalCount ? 'inventory' : 'orders')}
                className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                aria-label={`${alertCount} alerts`}
              >
                <Bell className="h-5 w-5" />
                {alertCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0f1722]" />}
              </button>
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex items-center gap-2.5 rounded-xl p-1 pr-2 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-sky-500 to-indigo-500 text-xs font-bold text-white">
                    {initials(displayName) || 'A'}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-[13px] font-semibold text-slate-800 dark:text-white leading-tight">Hi, {displayName}</span>
                    <span className="block text-[11px] text-slate-400">Store Manager</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121a24] p-1 shadow-xl">
                    <button
                      onClick={requestSignOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 space-y-5 p-4 sm:p-6">
            {/* Page heading */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {view === 'overview' ? (
                  <>
                    <p className="text-sm text-slate-500">{greeting},</p>
                    <h1 className="font-sans text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Here’s what’s happening with your store
                    </h1>
                    <p className="mt-0.5 text-[13px] text-slate-500">Track your sales, orders, customers and growth in real-time.</p>
                  </>
                ) : (
                  <h1 className="font-sans text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{pageTitle}</h1>
                )}
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121a24] px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 sm:self-auto">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                {formatDate(monthStart)} – {formatDate(now)}
              </div>
            </div>

            {sections[view]()}
          </main>
        </div>
      </motion.div>
    </div>
  );
}
