import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { CategorySelect } from '@/components/common/CategorySelect';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { Product } from '@/types/api';

const schema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,30}$/, 'SKU 3-30 karakter, harf/rakam/tire olmalı'),
    barcode: z
      .string()
      .trim()
      .regex(/^(\d{8,14})?$/, 'Barkod 8-14 haneli olmalı')
      .optional(),
    name: z.string().trim().min(2, 'En az 2 karakter').max(150),
    description: z.string().max(1000).optional(),
    categoryId: z.string().uuid('Kategori seçin'),
    unit: z.string().trim().min(1, 'Birim zorunlu').max(20),
    purchasePrice: z.coerce.number().positive('Pozitif olmalı'),
    salePrice: z.coerce.number().positive('Pozitif olmalı'),
    minStockLevel: z.coerce.number().int('Tam sayı olmalı').min(0),
  })
  .refine((v) => v.salePrice >= v.purchasePrice, {
    path: ['salePrice'],
    message: 'Satış fiyatı alış fiyatından düşük olamaz',
  });

type FormValues = z.infer<typeof schema>;

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!product;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset(
      product
        ? {
            sku: product.sku,
            barcode: product.barcode ?? '',
            name: product.name,
            description: product.description ?? '',
            categoryId: product.categoryId,
            unit: product.unit,
            purchasePrice: Number(product.purchasePrice),
            salePrice: Number(product.salePrice),
            minStockLevel: product.minStockLevel,
          }
        : {
            sku: '',
            barcode: '',
            name: '',
            description: '',
            categoryId: '',
            unit: 'adet',
            minStockLevel: 10,
          },
    );
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        ...values,
        barcode: values.barcode || undefined,
        description: values.description || undefined,
      };
      return isEdit ? api.patch(`/products/${product!.id}`, body) : api.post('/products', body);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Ürün güncellendi' : 'Ürün oluşturuldu');
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Ürünü Düzenle' : 'Yeni Ürün'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <FormField label="SKU" htmlFor="sku" error={errors.sku?.message}>
            <Input
              id="sku"
              placeholder="BLG-0100"
              aria-invalid={!!errors.sku}
              {...register('sku')}
            />
          </FormField>
          <FormField label="Barkod" htmlFor="barcode" error={errors.barcode?.message}>
            <Input
              id="barcode"
              placeholder="8690000000000"
              aria-invalid={!!errors.barcode}
              {...register('barcode')}
            />
          </FormField>
          <FormField
            label="Ürün Adı"
            htmlFor="name"
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label="Kategori" htmlFor="categoryId" error={errors.categoryId?.message}>
            <CategorySelect
              id="categoryId"
              aria-invalid={!!errors.categoryId}
              {...register('categoryId')}
            />
          </FormField>
          <FormField label="Birim" htmlFor="unit" error={errors.unit?.message}>
            <Input id="unit" placeholder="adet, koli, paket" {...register('unit')} />
          </FormField>
          <FormField
            label="Alış Fiyatı (₺)"
            htmlFor="purchasePrice"
            error={errors.purchasePrice?.message}
          >
            <Input
              id="purchasePrice"
              type="number"
              step="0.01"
              aria-invalid={!!errors.purchasePrice}
              {...register('purchasePrice')}
            />
          </FormField>
          <FormField label="Satış Fiyatı (₺)" htmlFor="salePrice" error={errors.salePrice?.message}>
            <Input
              id="salePrice"
              type="number"
              step="0.01"
              aria-invalid={!!errors.salePrice}
              {...register('salePrice')}
            />
          </FormField>
          <FormField
            label="Minimum Stok Seviyesi"
            htmlFor="minStockLevel"
            error={errors.minStockLevel?.message}
            hint="Toplam stok bu seviyenin altına düşünce kritik uyarısı verilir"
          >
            <Input id="minStockLevel" type="number" {...register('minStockLevel')} />
          </FormField>
          <FormField label="Açıklama" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" rows={3} {...register('description')} />
          </FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Kaydet' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
