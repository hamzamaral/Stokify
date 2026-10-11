import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { SearchInput } from '@/components/common/SearchInput';
import { ROLE_LABEL } from '@/components/common/StatusBadges';
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
import { Input, Select } from '@/components/ui/input';
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
import { cleanParams, formatDate } from '@/lib/utils';
import type { Paginated, Role, User } from '@/types/api';

const passwordRule = z
  .string()
  .min(8, 'En az 8 karakter')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Büyük harf, küçük harf ve rakam içermeli');

const buildSchema = (isEdit: boolean) =>
  z.object({
    fullName: z.string().trim().min(2, 'En az 2 karakter').max(100),
    email: z.string().email('Geçerli e-posta girin'),
    role: z.enum(['ADMIN', 'MANAGER', 'STAFF']),
    password: isEdit ? passwordRule.optional().or(z.literal('')) : passwordRule,
    isActive: z.boolean(),
  });
type FormValues = z.infer<ReturnType<typeof buildSchema>>;

function UserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: User | null;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(!!user)),
  });

  useEffect(() => {
    if (open)
      reset({
        fullName: user?.fullName ?? '',
        email: user?.email ?? '',
        role: user?.role ?? 'STAFF',
        password: '',
        isActive: user?.isActive ?? true,
      });
  }, [open, user, reset]);

  const mutation = useMutation({
    mutationFn: async ({ password, isActive, ...v }: FormValues) => {
      if (user)
        await api.patch(`/users/${user.id}`, { ...v, isActive, ...(password && { password }) });
      else await api.post('/users', { ...v, password });
    },
    onSuccess: () => {
      toast.success(user ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu');
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      onOpenChange(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <FormField label="Ad Soyad" error={errors.fullName?.message}>
            <Input aria-invalid={!!errors.fullName} {...register('fullName')} />
          </FormField>
          <FormField label="E-posta" error={errors.email?.message}>
            <Input type="email" aria-invalid={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label="Rol">
            <Select {...register('role')}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label={user ? 'Yeni Şifre (opsiyonel)' : 'Şifre'}
            error={errors.password?.message}
            hint={user ? 'Değiştirilirse kullanıcının tüm oturumları kapatılır' : undefined}
          >
            <Input
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </FormField>
          {user && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary" {...register('isActive')} />{' '}
              Aktif
            </label>
          )}
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

export function UsersPage() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [editing, setEditing] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebounce(search);

  const params = cleanParams({ page, limit: 15, search: debouncedSearch, role });
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.users, params],
    queryFn: async () => (await api.get<Paginated<User>>('/users', { params })).data,
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        description="Sistem kullanıcıları ve rol tabanlı yetkiler"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Yeni Kullanıcı
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Ad veya e-posta..."
          />
          <Select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role | '');
              setPage(1);
            }}
            className="sm:w-48"
          >
            <option value="">Tüm roller</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad Soyad</TableHead>
              <TableHead>E-posta</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden md:table-cell">Son Giriş</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState isLoading={isLoading} isEmpty={!data?.data.length} colSpan={6} />
            {data?.data.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.fullName}
                  {u.id === me?.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(siz)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
                    {ROLE_LABEL[u.role]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(u.lastLoginAt, true)}
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? 'success' : 'secondary'}>
                    {u.isActive ? 'Aktif' : 'Pasif'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(u);
                      setFormOpen(true);
                    }}
                    aria-label="Düzenle"
                  >
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </Card>
      <UserDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />
    </>
  );
}
