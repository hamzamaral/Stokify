import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';

const page = <T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(async () => ({ default: (await loader())[name] }));

const DashboardPage = page(() => import('@/pages/DashboardPage'), 'DashboardPage');
const ProductsPage = page(() => import('@/pages/products/ProductsPage'), 'ProductsPage');
const ProductDetailPage = page(
  () => import('@/pages/products/ProductDetailPage'),
  'ProductDetailPage',
);
const StockOperationsPage = page(
  () => import('@/pages/stock/StockOperationsPage'),
  'StockOperationsPage',
);
const MovementsPage = page(() => import('@/pages/stock/MovementsPage'), 'MovementsPage');
const PurchaseOrdersPage = page(
  () => import('@/pages/purchase-orders/PurchaseOrdersPage'),
  'PurchaseOrdersPage',
);
const PurchaseOrderDetailPage = page(
  () => import('@/pages/purchase-orders/PurchaseOrderDetailPage'),
  'PurchaseOrderDetailPage',
);
const CategoriesPage = page(() => import('@/pages/CategoriesPage'), 'CategoriesPage');
const SuppliersPage = page(() => import('@/pages/SuppliersPage'), 'SuppliersPage');
const WarehousesPage = page(() => import('@/pages/WarehousesPage'), 'WarehousesPage');
const UsersPage = page(() => import('@/pages/UsersPage'), 'UsersPage');
const AuditLogsPage = page(() => import('@/pages/AuditLogsPage'), 'AuditLogsPage');
const NotFoundPage = page(() => import('@/pages/NotFoundPage'), 'NotFoundPage');

const Fallback = () => (
  <div className="flex h-64 items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<Fallback />}>
    <Component />
  </Suspense>
);

const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { index: true, element: withSuspense(DashboardPage) },
            { path: 'products', element: withSuspense(ProductsPage) },
            { path: 'products/:id', element: withSuspense(ProductDetailPage) },
            { path: 'stock/operations', element: withSuspense(StockOperationsPage) },
            { path: 'stock/movements', element: withSuspense(MovementsPage) },
            { path: 'purchase-orders', element: withSuspense(PurchaseOrdersPage) },
            { path: 'purchase-orders/:id', element: withSuspense(PurchaseOrderDetailPage) },
            { path: 'categories', element: withSuspense(CategoriesPage) },
            { path: 'suppliers', element: withSuspense(SuppliersPage) },
            { path: 'warehouses', element: withSuspense(WarehousesPage) },
            {
              element: <ProtectedRoute roles={['ADMIN']} />,
              children: [
                { path: 'users', element: withSuspense(UsersPage) },
                { path: 'audit-logs', element: withSuspense(AuditLogsPage) },
              ],
            },
            { path: '*', element: withSuspense(NotFoundPage) },
          ],
        },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);

export function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
