import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Category, Paginated, Product, Supplier, Warehouse } from '@/types/api';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  movements: ['movements'] as const,
  categories: ['categories'] as const,
  suppliers: ['suppliers'] as const,
  warehouses: ['warehouses'] as const,
  purchaseOrders: ['purchase-orders'] as const,
  users: ['users'] as const,
  auditLogs: ['audit-logs'] as const,
};

/** Form seçim listelerinde kullanılan, nadiren değişen referans verileri. */
export const useWarehouses = () =>
  useQuery({
    queryKey: queryKeys.warehouses,
    queryFn: async () => (await api.get<Warehouse[]>('/warehouses')).data,
    staleTime: 60_000,
  });

export const useCategoryTree = () =>
  useQuery({
    queryKey: [...queryKeys.categories, 'tree'],
    queryFn: async () => (await api.get<Category[]>('/categories/tree')).data,
    staleTime: 60_000,
  });

export const useSupplierOptions = () =>
  useQuery({
    queryKey: [...queryKeys.suppliers, 'options'],
    queryFn: async () =>
      (
        await api.get<Paginated<Supplier>>('/suppliers', {
          params: { limit: 100, isActive: true, sortOrder: 'asc' },
        })
      ).data.data,
    staleTime: 60_000,
  });

export const useProductSearch = (search: string) =>
  useQuery({
    queryKey: [...queryKeys.products, 'search', search],
    queryFn: async () =>
      (
        await api.get<Paginated<Product>>('/products', {
          params: { search: search || undefined, limit: 20, isActive: true },
        })
      ).data.data,
    staleTime: 15_000,
  });
