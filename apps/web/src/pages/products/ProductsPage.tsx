import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CategorySelect } from '@/components/common/CategorySelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SearchInput } from '@/components/common/SearchInput';
import { StockStatusBadge } from '@/components/common/StatusBadges';
import { TableState } from '@/components/common/TableState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { api, downloadFile, getErrorMessage } from '@/lib/api';
import { queryKeys, useWarehouses } from '@/lib/queries';
import { cleanParams, cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { Paginated, Product } from '@/types/api';
import { ProductFormDialog } from './ProductFormDialog';

export function ProductsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('MANAGER');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const { data: warehouses = [] } = useWarehouses();

  const filters = {
    page: Number(params.get('page') ?? 1),
    categoryId: params.get('categoryId') ?? '',
    warehouseId: params.get('warehouseId') ?? '',
    stockStatus: params.get('stockStatus') ?? '',
    sortBy: params.get('sortBy') ?? 'createdAt',
    sortOrder: params.get('sortOrder') ?? 'desc',
  };

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const query = cleanParams({ ...filters, search: debouncedSearch, limit: 15 });
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...queryKeys.products, 'list', query],
    queryFn: async () => (await api.get<Paginated<Product>>('/products', { params: query })).data,
    placeholderData: keepPreviousData,
  });

  const exportCsv = () =>
    downloadFile('/reports/export/products', 'urunler.csv').catch((e) =>
      toast.error(getErrorMessage(e)),
    );

  return (
    <>
      <PageHeader
        title="Ürünler"
        description="Ürün kataloğu ve depo bazlı toplam stok durumu"
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={exportCsv}>
                <Download />
                CSV
              </Button>
              <Button onClick={() => setFormOpen(true)}>
                <Plus />
                Yeni Ürün
              </Button>
            </>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              if (filters.page !== 1) setFilter('page', '');
            }}
            placeholder="Ad, SKU veya barkod ara..."
          />
          <CategorySelect
            value={filters.categoryId}
            onChange={(e) => setFilter('categoryId', e.target.value)}
            placeholder="Tüm kategoriler"
            className="lg:w-52"
          />
          <Select
            value={filters.warehouseId}
            onChange={(e) => setFilter('warehouseId', e.target.value)}
            className="lg:w-52"
          >
            <option value="">Tüm depolar</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.stockStatus}
            onChange={(e) => setFilter('stockStatus', e.target.value)}
            className="lg:w-44"
          >
            <option value="">Tüm stok durumları</option>
            <option value="in_stock">Stokta</option>
            <option value="low">Kritik</option>
            <option value="out">Tükendi</option>
          </Select>
          <Select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split(':');
              const next = new URLSearchParams(params);
              next.set('sortBy', sortBy);
              next.set('sortOrder', sortOrder);
              setParams(next, { replace: true });
            }}
            className="lg:w-48"
          >
            <option value="createdAt:desc">En yeni</option>
            <option value="name:asc">Ada göre (A-Z)</option>
            <option value="salePrice:desc">Fiyat (yüksek)</option>
            <option value="salePrice:asc">Fiyat (düşük)</option>
            <option value="sku:asc">SKU</option>
          </Select>
        </div>

        <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead className="hidden md:table-cell">Kategori</TableHead>
                <TableHead className="text-right">Satış Fiyatı</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Min.</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState isLoading={isLoading} isEmpty={!data?.data.length} colSpan={7} />
              {data?.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>
                    <Link
                      to={`/products/${p.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    {!p.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">(pasif)</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {p.category.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.salePrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatNumber(p.totalStock)}{' '}
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                    {p.minStockLevel}
                  </TableCell>
                  <TableCell>
                    <StockStatusBadge status={p.stockStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data && <Pagination meta={data.meta} onPageChange={(p) => setFilter('page', String(p))} />}
      </Card>

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
