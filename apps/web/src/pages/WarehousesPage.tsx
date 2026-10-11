import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Warehouse as WarehouseIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/AuthContext';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys, useWarehouses } from '@/lib/queries';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Warehouse } from '@/types/api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, '2-20 karakter, harf/rakam/tire'),
  name: z.string().trim().min(2, 'En az 2 karakter').max(100),
  location: z.string().max(200).optional(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function WarehouseDialog({
  open,
  onOpenChange,
  warehouse,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  warehouse: Warehouse | null;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open)
      reset({
        code: warehouse?.code ?? '',
        name: warehouse?.name ?? '',
        location: warehouse?.location ?? '',
        isActive: warehouse?.isActive ?? true,
      });
  }, [open, warehouse, reset]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const body = { ...v, location: v.location || undefined };
      return warehouse
        ? api.patch(`/warehouses/${warehouse.id}`, body)
        : api.post('/warehouses', body);
    },
    onSuccess: () => {
      toast.success(warehouse ? 'Depo güncellendi' : 'Depo oluşturuldu');
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses });
      onOpenChange(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{warehouse ? 'Depoyu Düzenle' : 'Yeni Depo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Kod" error={errors.code?.message}>
              <Input placeholder="BRS-01" aria-invalid={!!errors.code} {...register('code')} />
            </FormField>
            <FormField label="Ad" error={errors.name?.message} className="sm:col-span-2">
              <Input aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
          </div>
          <FormField label="Konum">
            <Input placeholder="İlçe, İl" {...register('location')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" {...register('isActive')} />{' '}
            Aktif (pasif depolarda stok hareketi yapılamaz)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WarehousesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('MANAGER');
  const { data = [], isLoading } = useWarehouses();
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const totalValue = data.reduce((s, w) => s + (w.stockValue ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Depolar"
        description={`Toplam ${data.length} depo · ${formatCurrency(totalValue)} stok değeri`}
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Yeni Depo
            </Button>
          )
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48" />)}
        {data.map((w) => {
          const share = totalValue ? ((w.stockValue ?? 0) / totalValue) * 100 : 0;
          return (
            <Card key={w.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <WarehouseIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{w.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{w.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={w.isActive ? 'success' : 'secondary'}>
                    {w.isActive ? 'Aktif' : 'Pasif'}
                  </Badge>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(w);
                        setFormOpen(true);
                      }}
                      aria-label="Düzenle"
                    >
                      <Pencil />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {w.location && (
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {w.location}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {formatNumber(w.productCount)}
                    </p>
                    <p className="text-xs text-muted-foreground">Ürün çeşidi</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {formatNumber(w.totalQuantity)}
                    </p>
                    <p className="text-xs text-muted-foreground">Birim</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-semibold tabular-nums">%{share.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Değer payı</p>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Stok değeri</span>
                    <span className="font-medium">{formatCurrency(w.stockValue)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={`/products?warehouseId=${w.id}`}>Depodaki ürünleri gör</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <WarehouseDialog open={formOpen} onOpenChange={setFormOpen} warehouse={editing} />
    </>
  );
}
