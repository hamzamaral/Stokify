import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { cleanParams, cn, formatDate, formatNumber } from '@/lib/utils';
import type { MovementType, Paginated, StockMovement } from '@/types/api';
import { Pagination } from './Pagination';
import { MovementTypeBadge } from './StatusBadges';
import { TableState } from './TableState';

export interface MovementFilters {
  productId?: string;
  warehouseId?: string;
  type?: MovementType | '';
  from?: string;
  to?: string;
  search?: string;
}

function quantityLabel(m: StockMovement) {
  if (m.type === 'IN') return { text: `+${formatNumber(m.quantity)}`, className: 'text-success' };
  if (m.type === 'OUT')
    return { text: `-${formatNumber(m.quantity)}`, className: 'text-destructive' };
  if (m.type === 'ADJUSTMENT')
    return {
      text: `${m.quantity > 0 ? '+' : ''}${formatNumber(m.quantity)}`,
      className: m.quantity < 0 ? 'text-destructive' : 'text-success',
    };
  return { text: formatNumber(m.quantity), className: 'text-primary' };
}

export function MovementsTable({
  hideProduct,
  ...filters
}: MovementFilters & { hideProduct?: boolean }) {
  const [page, setPage] = useState(1);
  const filterKey = JSON.stringify(filters);

  useEffect(() => setPage(1), [filterKey]);

  const params = cleanParams({ ...filters, page, limit: 15 });
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...queryKeys.movements, params],
    queryFn: async () =>
      (await api.get<Paginated<StockMovement>>('/stock/movements', { params })).data,
    placeholderData: keepPreviousData,
  });

  const colSpan = hideProduct ? 6 : 7;

  return (
    <>
      <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Tür</TableHead>
              {!hideProduct && <TableHead>Ürün</TableHead>}
              <TableHead className="text-right">Miktar</TableHead>
              <TableHead>Depo</TableHead>
              <TableHead className="hidden lg:table-cell">Referans / Not</TableHead>
              <TableHead className="hidden md:table-cell">Kullanıcı</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState
              isLoading={isLoading}
              isEmpty={!data?.data.length}
              colSpan={colSpan}
              emptyText="Hareket bulunamadı"
            />
            {data?.data.map((m) => {
              const qty = quantityLabel(m);
              return (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(m.createdAt, true)}
                  </TableCell>
                  <TableCell>
                    <MovementTypeBadge type={m.type} />
                  </TableCell>
                  {!hideProduct && (
                    <TableCell>
                      <Link
                        to={`/products/${m.product.id}`}
                        className="font-medium hover:underline"
                      >
                        {m.product.name}
                      </Link>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {m.product.sku}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className={cn('text-right font-medium tabular-nums', qty.className)}>
                    {qty.text}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {m.type === 'TRANSFER' ? (
                      <span className="inline-flex items-center gap-1">
                        {m.fromWarehouse?.code} <ArrowRight className="h-3 w-3" />{' '}
                        {m.toWarehouse?.code}
                      </span>
                    ) : (
                      (m.fromWarehouse ?? m.toWarehouse)?.code
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-xs lg:table-cell">
                    {m.referenceNo && (
                      <span className="block font-mono text-xs">{m.referenceNo}</span>
                    )}
                    {m.note && (
                      <span className="block truncate text-xs text-muted-foreground">{m.note}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {m.createdBy.fullName}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {data && <Pagination meta={data.meta} onPageChange={setPage} />}
    </>
  );
}
