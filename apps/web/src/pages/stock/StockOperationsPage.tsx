import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { ProductPicker } from '@/components/common/ProductPicker';
import { StockStatusBadge } from '@/components/common/StatusBadges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { useAuth } from '@/features/auth/AuthContext';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys, useWarehouses } from '@/lib/queries';
import { cn, formatNumber } from '@/lib/utils';
import type { Product, ProductDetail } from '@/types/api';

type Operation = 'in' | 'out' | 'transfer' | 'adjust';

const OPERATIONS: {
  id: Operation;
  label: string;
  description: string;
  icon: typeof ArrowDownToLine;
  managerOnly?: boolean;
}[] = [
  {
    id: 'in',
    label: 'Stok Girişi',
    description: 'Tedarikçiden veya iadeden gelen ürünler',
    icon: ArrowDownToLine,
  },
  {
    id: 'out',
    label: 'Stok Çıkışı',
    description: 'Satış, sarf veya fire çıkışları',
    icon: ArrowUpFromLine,
  },
  {
    id: 'transfer',
    label: 'Transfer',
    description: 'Depolar arası ürün aktarımı',
    icon: ArrowLeftRight,
  },
  {
    id: 'adjust',
    label: 'Sayım Düzeltme',
    description: 'Fiziksel sayım sonucunu sisteme işle',
    icon: ClipboardCheck,
    managerOnly: true,
  },
];

const schema = z
  .object({
    operation: z.enum(['in', 'out', 'transfer', 'adjust']),
    productId: z.string().uuid('Ürün seçin'),
    warehouseId: z.string().optional(),
    toWarehouseId: z.string().optional(),
    quantity: z.coerce.number().int('Tam sayı olmalı').min(0),
    unitCost: z.union([z.literal(''), z.coerce.number().positive('Pozitif olmalı')]).optional(),
    referenceNo: z.string().max(50).optional(),
    note: z.string().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.warehouseId)
      ctx.addIssue({ code: 'custom', path: ['warehouseId'], message: 'Depo seçin' });
    if (v.operation === 'transfer') {
      if (!v.toWarehouseId)
        ctx.addIssue({ code: 'custom', path: ['toWarehouseId'], message: 'Hedef depo seçin' });
      else if (v.toWarehouseId === v.warehouseId)
        ctx.addIssue({
          code: 'custom',
          path: ['toWarehouseId'],
          message: 'Kaynak ve hedef depo aynı olamaz',
        });
    }
    if (v.operation !== 'adjust' && v.quantity < 1)
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Miktar en az 1 olmalı' });
    if (v.operation === 'adjust' && !v.note?.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Sayım düzeltmesi için açıklama zorunlu',
      });
  });

type FormValues = z.infer<typeof schema>;

function toPayload(v: FormValues) {
  const common = {
    productId: v.productId,
    referenceNo: v.referenceNo || undefined,
    note: v.note || undefined,
  };
  switch (v.operation) {
    case 'in':
      return {
        ...common,
        warehouseId: v.warehouseId,
        quantity: v.quantity,
        unitCost: v.unitCost || undefined,
      };
    case 'out':
      return { ...common, warehouseId: v.warehouseId, quantity: v.quantity };
    case 'transfer':
      return {
        ...common,
        fromWarehouseId: v.warehouseId,
        toWarehouseId: v.toWarehouseId,
        quantity: v.quantity,
      };
    case 'adjust':
      return { ...common, warehouseId: v.warehouseId, countedQuantity: v.quantity };
  }
}

export function StockOperationsPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { data: warehouses = [] } = useWarehouses();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const operations = OPERATIONS.filter((o) => !o.managerOnly || hasRole('MANAGER'));

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { operation: 'in', productId: params.get('productId') ?? '', quantity: 1 },
  });

  const operation = watch('operation');
  const productId = watch('productId');
  const warehouseId = watch('warehouseId');

  const { data: productDetail } = useQuery({
    queryKey: queryKeys.product(productId),
    queryFn: async () => (await api.get<ProductDetail>(`/products/${productId}`)).data,
    enabled: !!productId,
  });

  useEffect(() => {
    if (productDetail && !selectedProduct) setSelectedProduct(productDetail);
  }, [productDetail, selectedProduct]);

  const stockByWarehouse = useMemo(
    () => new Map(productDetail?.stocks.map((s) => [s.warehouseId, s.quantity])),
    [productDetail],
  );
  const currentQty = warehouseId ? (stockByWarehouse.get(warehouseId) ?? 0) : undefined;

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post(`/stock/${values.operation}`, toPayload(values)),
    onSuccess: (_, values) => {
      toast.success(`${OPERATIONS.find((o) => o.id === values.operation)?.label} kaydedildi`);
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      queryClient.invalidateQueries({ queryKey: queryKeys.movements });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses });
      reset({
        ...values,
        quantity: values.operation === 'adjust' ? values.quantity : 1,
        referenceNo: '',
        note: '',
      });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const quantityLabel = operation === 'adjust' ? 'Sayılan Miktar' : 'Miktar';

  return (
    <>
      <PageHeader title="Stok İşlemleri" description="Giriş, çıkış, transfer ve sayım düzeltmesi" />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {operations.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setValue('operation', id)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
              operation === id
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'hover:bg-accent',
            )}
          >
            <div
              className={cn(
                'rounded-lg p-2',
                operation === id ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{OPERATIONS.find((o) => o.id === operation)?.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((v) => mutation.mutate(v))}
              className="grid gap-4 sm:grid-cols-2"
              noValidate
            >
              <FormField label="Ürün" error={errors.productId?.message} className="sm:col-span-2">
                <Controller
                  control={control}
                  name="productId"
                  render={({ field }) => (
                    <ProductPicker
                      value={selectedProduct}
                      invalid={!!errors.productId}
                      onChange={(p) => {
                        setSelectedProduct(p);
                        field.onChange(p?.id ?? '');
                      }}
                    />
                  )}
                />
              </FormField>

              <FormField
                label={operation === 'transfer' ? 'Kaynak Depo' : 'Depo'}
                error={errors.warehouseId?.message}
                hint={
                  currentQty !== undefined
                    ? `Bu depodaki mevcut stok: ${formatNumber(currentQty)}`
                    : undefined
                }
              >
                <Select aria-invalid={!!errors.warehouseId} {...register('warehouseId')}>
                  <option value="">Depo seçin</option>
                  {warehouses
                    .filter((w) => w.isActive)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </Select>
              </FormField>

              {operation === 'transfer' ? (
                <FormField label="Hedef Depo" error={errors.toWarehouseId?.message}>
                  <Select aria-invalid={!!errors.toWarehouseId} {...register('toWarehouseId')}>
                    <option value="">Depo seçin</option>
                    {warehouses
                      .filter((w) => w.isActive && w.id !== warehouseId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </Select>
                </FormField>
              ) : (
                <div className="hidden sm:block" />
              )}

              <FormField label={quantityLabel} error={errors.quantity?.message}>
                <Input
                  type="number"
                  min={0}
                  aria-invalid={!!errors.quantity}
                  {...register('quantity')}
                />
              </FormField>

              {operation === 'in' ? (
                <FormField
                  label="Birim Maliyet (₺)"
                  error={errors.unitCost?.message}
                  hint="Boş bırakılırsa ürünün alış fiyatı kullanılır"
                >
                  <Input type="number" step="0.01" {...register('unitCost')} />
                </FormField>
              ) : (
                <FormField label="Referans No" error={errors.referenceNo?.message}>
                  <Input placeholder="SAT-000123" {...register('referenceNo')} />
                </FormField>
              )}

              {operation === 'in' && (
                <FormField label="Referans No (İrsaliye/Fatura)" className="sm:col-span-2">
                  <Input placeholder="IRS-000123" {...register('referenceNo')} />
                </FormField>
              )}

              <FormField
                label={operation === 'adjust' ? 'Açıklama (zorunlu)' : 'Not'}
                error={errors.note?.message}
                className="sm:col-span-2"
              >
                <Textarea rows={2} aria-invalid={!!errors.note} {...register('note')} />
              </FormField>

              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" loading={mutation.isPending}>
                  Kaydet
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Güncel Stok</CardTitle>
            <CardDescription>
              {productDetail ? productDetail.name : 'Bir ürün seçin'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {productDetail ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Durum</span>
                  <StockStatusBadge status={productDetail.stockStatus} />
                </div>
                {warehouses.map((w) => (
                  <div
                    key={w.id}
                    className={cn(
                      'flex justify-between rounded-md px-2 py-1.5 text-sm',
                      (w.id === warehouseId ||
                        (operation === 'transfer' && w.id === watch('toWarehouseId'))) &&
                        'bg-primary/10',
                    )}
                  >
                    <span>{w.name}</span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(stockByWarehouse.get(w.id) ?? 0)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-3 text-sm font-semibold">
                  <span>Toplam</span>
                  <span className="tabular-nums">
                    {formatNumber(productDetail.totalStock)} {productDetail.unit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum seviye: {productDetail.minStockLevel}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seçilen ürünün depo bazlı stokları burada görünür.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
