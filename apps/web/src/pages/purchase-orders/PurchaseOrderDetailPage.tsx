import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, PackageCheck, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PurchaseOrderStatusBadge } from '@/components/common/StatusBadges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/AuthContext';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { cn, formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/api';

type Action = 'order' | 'receive' | 'cancel' | 'delete';

const ACTION_CONFIG: Record<
  Action,
  { title: string; description: string; confirm: string; destructive?: boolean; success: string }
> = {
  order: {
    title: 'Siparişi gönder',
    description: 'Sipariş tedarikçiye gönderilmiş olarak işaretlenecek ve artık düzenlenemeyecek.',
    confirm: 'Sipariş Ver',
    success: 'Sipariş verildi',
  },
  receive: {
    title: 'Siparişi teslim al',
    description:
      'Tüm kalemler teslim deposuna stok girişi olarak işlenecek. Bu işlem geri alınamaz.',
    confirm: 'Teslim Al',
    success: 'Sipariş teslim alındı, stoklar güncellendi',
  },
  cancel: {
    title: 'Siparişi iptal et',
    description: 'Sipariş iptal edilecek. Bu işlem geri alınamaz.',
    confirm: 'İptal Et',
    destructive: true,
    success: 'Sipariş iptal edildi',
  },
  delete: {
    title: 'Taslağı sil',
    description: 'Taslak sipariş kalıcı olarak silinecek.',
    confirm: 'Sil',
    destructive: true,
    success: 'Taslak silindi',
  },
};

const STEPS: { status: PurchaseOrderStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Taslak' },
  { status: 'ORDERED', label: 'Sipariş Verildi' },
  { status: 'RECEIVED', label: 'Teslim Alındı' },
];

export function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [pending, setPending] = useState<Action | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: [...queryKeys.purchaseOrders, id],
    queryFn: async () => (await api.get<PurchaseOrder>(`/purchase-orders/${id}`)).data,
  });

  const mutation = useMutation({
    mutationFn: (action: Action) =>
      action === 'delete'
        ? api.delete(`/purchase-orders/${id}`)
        : api.post(`/purchase-orders/${id}/${action}`),
    onSuccess: (_, action) => {
      toast.success(ACTION_CONFIG[action].success);
      setPending(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders });
      if (action === 'receive') {
        queryClient.invalidateQueries({ queryKey: queryKeys.products });
        queryClient.invalidateQueries({ queryKey: queryKeys.movements });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      }
      if (action === 'delete') navigate('/purchase-orders');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading || !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const isManager = hasRole('MANAGER');
  const currentStep = STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/purchase-orders"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Satın Alma
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.orderNo}</h1>
            <PurchaseOrderStatusBadge status={order.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === 'DRAFT' && isManager && (
            <>
              <Button onClick={() => setPending('order')}>
                <Send /> Sipariş Ver
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setPending('delete')}
              >
                <Trash2 /> Sil
              </Button>
            </>
          )}
          {order.status === 'ORDERED' && (
            <Button onClick={() => setPending('receive')}>
              <PackageCheck /> Teslim Al
            </Button>
          )}
          {(order.status === 'DRAFT' || order.status === 'ORDERED') && isManager && (
            <Button variant="outline" onClick={() => setPending('cancel')}>
              <Ban /> İptal Et
            </Button>
          )}
        </div>
      </div>

      {order.status !== 'CANCELLED' && (
        <Card>
          <CardContent className="flex items-center gap-2 p-5">
            {STEPS.map((step, i) => (
              <div key={step.status} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium',
                    i <= currentStep
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {i < currentStep || order.status === 'RECEIVED' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm',
                    i <= currentStep ? 'font-medium' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn('h-0.5 flex-1', i < currentStep ? 'bg-primary' : 'bg-border')}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kalemler</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
                <TableHead className="text-right">Birim Maliyet</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      to={`/products/${item.product.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.product.name}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {item.product.sku}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(item.quantity)} {item.product.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(Number(item.unitCost) * item.quantity)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="text-right font-semibold">
                  Genel Toplam
                </TableCell>
                <TableCell className="text-right text-base font-semibold tabular-nums">
                  {formatCurrency(order.totalAmount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detaylar</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {(
                [
                  ['Tedarikçi', order.supplier.name],
                  [
                    'İletişim',
                    [order.supplier.email, order.supplier.phone].filter(Boolean).join(' · ') || '-',
                  ],
                  ['Teslim Deposu', order.warehouse.name],
                  ['Oluşturan', order.createdBy?.fullName ?? '-'],
                  ['Oluşturulma', formatDate(order.createdAt, true)],
                  ['Beklenen Teslim', formatDate(order.expectedAt)],
                  ['Teslim Alınma', formatDate(order.receivedAt, true)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {order.note && (
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{order.note}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={ACTION_CONFIG[pending].title}
          description={ACTION_CONFIG[pending].description}
          confirmText={ACTION_CONFIG[pending].confirm}
          destructive={ACTION_CONFIG[pending].destructive}
          loading={mutation.isPending}
          onConfirm={() => mutation.mutate(pending)}
        />
      )}
    </div>
  );
}
