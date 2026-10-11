import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SearchInput } from '@/components/common/SearchInput';
import { TableState } from '@/components/common/TableState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
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
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { cleanParams } from '@/lib/utils';
import type { Paginated, Supplier } from '@/types/api';

const optional = (schema: z.ZodString) => schema.optional().or(z.literal(''));

const schema = z.object({
  name: z.string().trim().min(2, 'En az 2 karakter').max(150),
  taxNumber: optional(z.string().regex(/^\d{10,11}$/, '10 veya 11 haneli olmalı')),
  contactName: optional(z.string().max(100)),
  email: optional(z.string().email('Geçerli e-posta girin')),
  phone: optional(z.string().max(30)),
  address: optional(z.string().max(300)),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function SupplierDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier: Supplier | null;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      name: supplier?.name ?? '',
      taxNumber: supplier?.taxNumber ?? '',
      contactName: supplier?.contactName ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      address: supplier?.address ?? '',
      isActive: supplier?.isActive ?? true,
    });
  }, [open, supplier, reset]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const body = Object.fromEntries(
        Object.entries(v).map(([k, val]) => [k, val === '' ? undefined : val]),
      );
      return supplier ? api.patch(`/suppliers/${supplier.id}`, body) : api.post('/suppliers', body);
    },
    onSuccess: () => {
      toast.success(supplier ? 'Tedarikçi güncellendi' : 'Tedarikçi oluşturuldu');
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
      onOpenChange(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Tedarikçiyi Düzenle' : 'Yeni Tedarikçi'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <FormField label="Firma Adı" error={errors.name?.message} className="sm:col-span-2">
            <Input aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label="Vergi No" error={errors.taxNumber?.message}>
            <Input aria-invalid={!!errors.taxNumber} {...register('taxNumber')} />
          </FormField>
          <FormField label="Yetkili Kişi">
            <Input {...register('contactName')} />
          </FormField>
          <FormField label="E-posta" error={errors.email?.message}>
            <Input type="email" aria-invalid={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label="Telefon">
            <Input {...register('phone')} />
          </FormField>
          <FormField label="Adres" className="sm:col-span-2">
            <Textarea rows={2} {...register('address')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-primary" {...register('isActive')} />{' '}
            Aktif
          </label>
          <DialogFooter className="sm:col-span-2">
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

export function SuppliersPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('MANAGER');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const debouncedSearch = useDebounce(search);

  const params = cleanParams({ page, limit: 15, search: debouncedSearch, sortOrder: 'asc' });
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.suppliers, params],
    queryFn: async () => (await api.get<Paginated<Supplier>>('/suppliers', { params })).data,
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      toast.success('Tedarikçi silindi');
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
      setDeleting(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Tedarikçiler"
        description="Tedarikçi firmalar ve iletişim bilgileri"
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Yeni Tedarikçi
            </Button>
          )
        }
      />
      <Card>
        <div className="border-b p-3">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Firma, vergi no, yetkili..."
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firma</TableHead>
              <TableHead className="hidden md:table-cell">Vergi No</TableHead>
              <TableHead>Yetkili</TableHead>
              <TableHead className="hidden lg:table-cell">İletişim</TableHead>
              <TableHead className="text-right">Sipariş</TableHead>
              <TableHead>Durum</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState isLoading={isLoading} isEmpty={!data?.data.length} colSpan={7} />
            {data?.data.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="hidden font-mono text-xs md:table-cell">
                  {s.taxNumber ?? '-'}
                </TableCell>
                <TableCell>{s.contactName ?? '-'}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  <span className="block">{s.email}</span>
                  <span className="block">{s.phone}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s._count?.purchaseOrders ?? 0}
                </TableCell>
                <TableCell>
                  <Badge variant={s.isActive ? 'success' : 'secondary'}>
                    {s.isActive ? 'Aktif' : 'Pasif'}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(s);
                        setFormOpen(true);
                      }}
                      aria-label="Düzenle"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleting(s)}
                      aria-label="Sil"
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </Card>

      <SupplierDialog open={formOpen} onOpenChange={setFormOpen} supplier={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Tedarikçiyi sil"
        description={`"${deleting?.name}" silinecek. Siparişi olan tedarikçiler silinemez, pasifleştirilebilir.`}
        confirmText="Sil"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
