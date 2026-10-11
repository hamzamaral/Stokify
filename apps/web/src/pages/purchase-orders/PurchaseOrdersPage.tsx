import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SearchInput } from '@/components/common/SearchInput';
import { PO_STATUS, PurchaseOrderStatusBadge } from '@/components/common/StatusBadges';
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
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { cleanParams, formatCurrency, formatDate } from '@/lib/utils';
import type { Paginated, PurchaseOrder, PurchaseOrderStatus } from '@/types/api';
import { PurchaseOrderFormDialog } from './PurchaseOrderFormDialog';

export function PurchaseOrdersPage() {
  const { hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PurchaseOrderStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebounce(search);

  const params = cleanParams({ page, limit: 15, search: debouncedSearch, status });
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.purchaseOrders, params],
    queryFn: async () =>
      (await api.get<Paginated<PurchaseOrder>>('/purchase-orders', { params })).data,
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Satın Alma Siparişleri"
        description="Tedarikçi siparişleri ve teslim alma süreci"
        actions={
          hasRole('MANAGER') && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus /> Yeni Sipariş
            </Button>
          )
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Sipariş no veya tedarikçi..."
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as PurchaseOrderStatus | '');
              setPage(1);
            }}
            className="sm:w-48"
          >
            <option value="">Tüm durumlar</option>
            {Object.entries(PO_STATUS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sipariş No</TableHead>
              <TableHead>Tedarikçi</TableHead>
              <TableHead className="hidden md:table-cell">Depo</TableHead>
              <TableHead className="hidden sm:table-cell">Tarih</TableHead>
              <TableHead className="text-right">Kalem</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState isLoading={isLoading} isEmpty={!data?.data.length} colSpan={7} />
            {data?.data.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link
                    to={`/purchase-orders/${o.id}`}
                    className="font-mono text-sm font-medium hover:text-primary hover:underline"
                  >
                    {o.orderNo}
                  </Link>
                </TableCell>
                <TableCell>{o.supplier.name}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {o.warehouse.code}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {formatDate(o.createdAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{o.itemCount}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(o.totalAmount)}
                </TableCell>
                <TableCell>
                  <PurchaseOrderStatusBadge status={o.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </Card>
      <PurchaseOrderFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
