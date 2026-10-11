import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import type { Paginated } from '@/types/api';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: Paginated<unknown>['meta'];
  onPageChange: (page: number) => void;
}) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex items-center justify-between gap-2 border-t px-3 py-3 text-sm text-muted-foreground">
      <span>
        {formatNumber(meta.total)} kayıttan {formatNumber(from)}-{formatNumber(to)} arası
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label="Sonraki sayfa"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
