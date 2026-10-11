import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { CategorySelect } from '@/components/common/CategorySelect';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SearchInput } from '@/components/common/SearchInput';
import { TableState } from '@/components/common/TableState';
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
import type { Category, Paginated } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'En az 2 karakter').max(80),
  description: z.string().max(500).optional(),
  parentId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: Category | null;
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
        name: category?.name ?? '',
        description: category?.description ?? '',
        parentId: category?.parentId ?? '',
      });
  }, [open, category, reset]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const body = { ...v, parentId: v.parentId || null, description: v.description || undefined };
      return category
        ? api.patch(`/categories/${category.id}`, body)
        : api.post('/categories', body);
    },
    onSuccess: () => {
      toast.success(category ? 'Kategori güncellendi' : 'Kategori oluşturuldu');
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      onOpenChange(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <FormField label="Ad" error={errors.name?.message}>
            <Input aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label="Üst Kategori">
            <CategorySelect
              placeholder="Yok (ana kategori)"
              excludeId={category?.id}
              {...register('parentId')}
            />
          </FormField>
          <FormField label="Açıklama">
            <Textarea rows={3} {...register('description')} />
          </FormField>
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

export function CategoriesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('MANAGER');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const debouncedSearch = useDebounce(search);

  const params = cleanParams({ page, limit: 20, search: debouncedSearch, sortOrder: 'asc' });
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.categories, params],
    queryFn: async () => (await api.get<Paginated<Category>>('/categories', { params })).data,
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Kategori silindi');
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      setDeleting(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Kategoriler"
        description="Hiyerarşik ürün kategorileri"
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Yeni Kategori
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
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Üst Kategori</TableHead>
              <TableHead className="hidden md:table-cell">Açıklama</TableHead>
              <TableHead className="text-right">Ürün</TableHead>
              <TableHead className="text-right">Alt Kategori</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState isLoading={isLoading} isEmpty={!data?.data.length} colSpan={6} />
            {data?.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/products?categoryId=${c.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.parent?.name ?? '-'}</TableCell>
                <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                  {c.description}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c._count?.products}</TableCell>
                <TableCell className="text-right tabular-nums">{c._count?.children}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(c);
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
                      onClick={() => setDeleting(c)}
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

      <CategoryDialog open={formOpen} onOpenChange={setFormOpen} category={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Kategoriyi sil"
        description={`"${deleting?.name}" kategorisi silinecek. Ürün içeren kategoriler silinemez.`}
        confirmText="Sil"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
