import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField';
import { ProductPicker } from '@/components/common/ProductPicker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys, useSupplierOptions, useWarehouses } from '@/lib/queries';
import { formatCurrency } from '@/lib/utils';
import type { Product, PurchaseOrder } from '@/types/api';

const schema = z.object({
  supplierId: z.string().uuid('Tedarikçi seçin'),
  warehouseId: z.string().uuid('Depo seçin'),
  expectedAt: z.string().optional(),
  note: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Ürün seçin'),
        quantity: z.coerce.number().int().positive('> 0'),
        unitCost: z.coerce.number().positive('> 0'),
      }),
    )
    .min(1, 'En az bir kalem ekleyin')
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      'Aynı ürün birden fazla eklenemez',
    ),
});

type FormValues = z.infer<typeof schema>;

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: suppliers = [] } = useSupplierOptions();
  const { data: warehouses = [] } = useWarehouses();
  const [products, setProducts] = useState<Record<string, Product | null>>({});

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (open) {
      reset({
        supplierId: '',
        warehouseId: '',
        expectedAt: '',
        note: '',
        items: [{ productId: '', quantity: 10, unitCost: 0 }],
      });
      setProducts({});
    }
  }, [open, reset]);

  const items = watch('items') ?? [];
  const total = items.reduce(
    (sum, i) => sum + Number(i.quantity || 0) * Number(i.unitCost || 0),
    0,
  );

  const mutation = useMutation({
    mutationFn: async (values: FormValues) =>
      (
        await api.post<PurchaseOrder>('/purchase-orders', {
          ...values,
          expectedAt: values.expectedAt || undefined,
          note: values.note || undefined,
        })
      ).data,
    onSuccess: (order) => {
      toast.success(`${order.orderNo} oluşturuldu`);
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders });
      onOpenChange(false);
      navigate(`/purchase-orders/${order.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Yeni Satın Alma Siparişi</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Tedarikçi" error={errors.supplierId?.message}>
              <Select aria-invalid={!!errors.supplierId} {...register('supplierId')}>
                <option value="">Seçin</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Teslim Deposu" error={errors.warehouseId?.message}>
              <Select aria-invalid={!!errors.warehouseId} {...register('warehouseId')}>
                <option value="">Seçin</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Beklenen Teslim">
              <Input type="date" {...register('expectedAt')} />
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Kalemler</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ productId: '', quantity: 10, unitCost: 0 })}
              >
                <Plus /> Kalem Ekle
              </Button>
            </div>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-12 items-start gap-2 rounded-lg border p-2"
              >
                <div className="col-span-12 sm:col-span-6">
                  <Controller
                    control={control}
                    name={`items.${index}.productId`}
                    render={({ field: f }) => (
                      <ProductPicker
                        value={products[field.id]}
                        invalid={!!errors.items?.[index]?.productId}
                        onChange={(p) => {
                          setProducts((prev) => ({ ...prev, [field.id]: p }));
                          f.onChange(p?.id ?? '');
                          if (p) setValue(`items.${index}.unitCost`, Number(p.purchasePrice));
                        }}
                      />
                    )}
                  />
                </div>
                <Input
                  className="col-span-4 sm:col-span-2"
                  type="number"
                  placeholder="Miktar"
                  aria-invalid={!!errors.items?.[index]?.quantity}
                  {...register(`items.${index}.quantity`)}
                />
                <Input
                  className="col-span-5 sm:col-span-3"
                  type="number"
                  step="0.01"
                  placeholder="Birim maliyet"
                  aria-invalid={!!errors.items?.[index]?.unitCost}
                  {...register(`items.${index}.unitCost`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="col-span-3 text-destructive sm:col-span-1"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                  aria-label="Kalemi sil"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {(errors.items?.message || errors.items?.root?.message) && (
              <p className="text-xs text-destructive">
                {errors.items?.message ?? errors.items?.root?.message}
              </p>
            )}
            <p className="text-right text-sm">
              Toplam: <span className="font-semibold">{formatCurrency(total)}</span>
            </p>
          </div>

          <FormField label="Not">
            <Textarea rows={2} {...register('note')} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Taslak Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
