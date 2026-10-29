'use client';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import AdminLogin from '@/components/AdminLogin';
import AdminDashboard, { OrdersLoadState } from '@/components/AdminDashboard';
import ToastContainer, { ToastMessage } from '@/components/ToastContainer';
import { AdminOrder, GroceryItem, OrderStatus } from '@/types';
import { INITIAL_GROCERIES } from '@/data/products';
import { fetchCatalogProducts } from '@/lib/productsApi';
import { AdminSession, clearAdminAuth, getAdminSession } from '@/lib/adminAuth';
import {
  AdminApiError,
  actionErrorMessage,
  fetchAdminOrders,
  restockProduct,
  updateAdminOrderStatus,
  updateProduct,
  type UpdateProductFields,
} from '@/lib/adminApi';

const noopSubscribe = () => () => {};

export default function AdminHomePage() {
  // False during SSR and hydration, so browser-only storage is never read into the server-matching render.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [sessionOverride, setSessionOverride] = useState<AdminSession | null | undefined>(undefined);
  const session = sessionOverride !== undefined ? sessionOverride : isClient ? getAdminSession() : null;
  const sessionUser = session?.username ?? null;
  const [products, setProducts] = useState<GroceryItem[]>(INITIAL_GROCERIES);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersState, setOrdersState] = useState<OrdersLoadState>({ status: 'loading' });
  const [ordersReload, setOrdersReload] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const handleAddToast = useCallback((title: string, message: string, type: 'success' | 'warning' | 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const endSession = useCallback(() => {
    clearAdminAuth();
    setSessionOverride(null);
    setOrders([]);
    setOrdersState({ status: 'loading' });
  }, []);

  /** Shows a toast for a failed action; an expired session signs the admin out. */
  const reportError = useCallback(
    (title: string, error: unknown) => {
      if (error instanceof AdminApiError && error.status === 401) {
        endSession();
        handleAddToast('Session expired', 'Please sign in again to continue.', 'warning');
        return;
      }
      handleAddToast(title, actionErrorMessage(error), 'warning');
    },
    [endSession, handleAddToast]
  );

  useEffect(() => {
    let cancelled = false;
    fetchCatalogProducts().then((items) => {
      if (!cancelled) setProducts(items.length ? items : INITIAL_GROCERIES);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    const controller = new AbortController();
    fetchAdminOrders(controller.signal)
      .then((list) => {
        setOrders(list);
        setOrdersState({ status: 'ready' });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof AdminApiError && error.status === 401) {
          reportError('Could not load orders', error);
          return;
        }
        setOrdersState({ status: 'error', message: actionErrorMessage(error) });
      });
    return () => controller.abort();
  }, [sessionUser, ordersReload, reportError]);

  const handleRefreshOrders = () => {
    setOrdersState({ status: 'loading' });
    setOrdersReload((n) => n + 1);
  };

  const handleRestock = async (item: GroceryItem, amount: number): Promise<boolean> => {
    if (!item.apiId) {
      handleAddToast(
        'Restock not saved',
        `${item.name} isn’t linked to the server catalog, so its stock can’t be updated.`,
        'warning'
      );
      return false;
    }
    try {
      const stock = await restockProduct(item.apiId, amount);
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, stock, maxStock: Math.max(p.maxStock, stock) } : p))
      );
      return true;
    } catch (error) {
      reportError(`Couldn’t restock ${item.name}`, error);
      return false;
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus): Promise<boolean> => {
    try {
      const updated = await updateAdminOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      return true;
    } catch (error) {
      reportError('Couldn’t update order', error);
      return false;
    }
  };

  const handleUpdateProduct = async (
    item: GroceryItem,
    fields: UpdateProductFields
  ): Promise<boolean> => {
    if (!item.apiId) {
      handleAddToast(
        'Update not saved',
        `${item.name} isn’t linked to the server catalog, so it can’t be updated.`,
        'warning'
      );
      return false;
    }
    try {
      await updateProduct(item.apiId, fields);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                name: fields.name,
                description: fields.description,
                brand: fields.brand,
                category: fields.category,
                price: fields.price,
                stock: fields.stock,
                maxStock: Math.max(p.maxStock, fields.stock),
              }
            : p
        )
      );
      return true;
    } catch (error) {
      reportError(`Couldn’t update ${item.name}`, error);
      return false;
    }
  };

  const handleSignOut = () => {
    endSession();
    handleAddToast('Signed out', 'You have been signed out of the admin dashboard.', 'info');
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      {!isClient ? (
        <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#0B1220]" />
      ) : session ? (
        <AdminDashboard
          products={products}
          orders={orders}
          ordersState={ordersState}
          onRefreshOrders={handleRefreshOrders}
          adminLabel={session.username}
          onRestock={handleRestock}
          onUpdateProduct={handleUpdateProduct}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onAddToast={handleAddToast}
          onSignOut={handleSignOut}
        />
      ) : (
        <AdminLogin onSignedIn={setSessionOverride} onAddToast={handleAddToast} />
      )}
    </>
  );
}
