import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { TableState } from '@/components/common/TableState';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
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
import { cleanParams, formatDate } from '@/lib/utils';
import type { AuditLog, Paginated } from '@/types/api';

const ENTITIES = [
  'Product',
  'Category',
  'Supplier',
  'Warehouse',
  'StockMovement',
  'PurchaseOrder',
  'User',
];

const actionVariant = (action: string): BadgeProps['variant'] => {
  if (action === 'CREATE' || action === 'RECEIVE') return 'success';
  if (action === 'DELETE' || action === 'CANCEL') return 'destructive';
  if (action === 'LOGIN') return 'secondary';
  return 'default';
};

/** Önceki ve sonraki değerler arasında değişen alanları listeler. */
function diff(before: unknown, after: unknown) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
    (k) => !['updatedAt', 'createdAt'].includes(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k]),
  );
  return keys.map((k) => ({ key: k, before: b[k], after: a[k] }));
}

const show = (v: unknown) =>
  v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const params = cleanParams({ page, limit: 20, entity });
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.auditLogs, params],
    queryFn: async () => (await api.get<Paginated<AuditLog>>('/audit-logs', { params })).data,
    placeholderData: keepPreviousData,
  });

  const changes = selected ? diff(selected.before, selected.after) : [];

  return (
    <>
      <PageHeader title="Denetim Kayıtları" description="Kim, neyi, ne zaman değiştirdi" />
      <Card>
        <div className="border-b p-3">
          <Select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            className="sm:w-56"
          >
            <option value="">Tüm kayıt türleri</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>İşlem</TableHead>
              <TableHead>Kayıt</TableHead>
              <TableHead className="hidden md:table-cell">IP</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState isLoading={isLoading} isEmpty={!data?.data.length} colSpan={6} />
            {data?.data.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(log.createdAt, true)}
                </TableCell>
                <TableCell>{log.user?.fullName ?? 'Sistem'}</TableCell>
                <TableCell>
                  <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{log.entity}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {log.entityId?.slice(0, 8)}
                  </span>
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                  {log.ip ?? '-'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelected(log)}
                    aria-label="Detay"
                  >
                    <Eye />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.action} · {selected?.entity}
            </DialogTitle>
          </DialogHeader>
          {changes.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alan</TableHead>
                  <TableHead>Önce</TableHead>
                  <TableHead>Sonra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="font-mono text-xs">{c.key}</TableCell>
                    <TableCell className="max-w-[200px] break-all text-xs text-destructive">
                      {show(c.before)}
                    </TableCell>
                    <TableCell className="max-w-[200px] break-all text-xs text-success">
                      {show(c.after)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Bu kayıt için alan değişikliği yok.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
