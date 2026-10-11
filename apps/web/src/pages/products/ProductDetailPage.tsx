import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowLeftRight, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { MovementsTable } from '@/components/common/MovementsTable';
import { StockStatusBadge } from '@/components/common/StatusBadges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/AuthContext';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { ProductDetail } from '@/types/api';
import { ProductFormDialog } from './ProductFormDialog';

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.product(id),
    queryFn: async () => (await api.get<ProductDetail>(`/products/${id}`)).data,
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Ürün silindi');
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      navigate('/products');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isError) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg font-medium">Ürün bulunamadı</p>
        <Button asChild variant="link">
          <Link to="/products">Ürünlere dön</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !product) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const margin =
    ((Number(product.salePrice) - Number(product.purchasePrice)) / Number(product.purchasePrice)) *
    100;
  const details: [string, React.ReactNode][] = [
    ['Kategori', product.category.name],
    ['Barkod', product.barcode ?? '-'],
    ['Birim', product.unit],
    ['Alış Fiyatı', formatCurrency(product.purchasePrice)],
    ['Satış Fiyatı', formatCurrency(product.salePrice)],
    ['Kâr Marjı', `%${margin.toFixed(1)}`],
    ['Min. Stok', `${product.minStockLevel} ${product.unit}`],
    ['Stok Değeri', formatCurrency(product.totalStock * Number(product.purchasePrice))],
    ['Oluşturulma', formatDate(product.createdAt)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/products"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Ürünler
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{product.sku}</span>
            <StockStatusBadge status={product.stockStatus} />
            {!product.isActive && <span className="text-xs text-muted-foreground">(pasif)</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/stock/operations?productId=${product.id}`}>
              <ArrowLeftRight /> Stok İşlemi
            </Link>
          </Button>
          {hasRole('MANAGER') && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Düzenle
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ürün Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {product.description && (
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                {product.description}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Depo Bazlı Stok</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {product.stocks.map((s) => (
              <div key={s.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{s.warehouse.name}</span>
                  <span className="font-medium tabular-nums">
                    {formatNumber(s.quantity)} {product.unit}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${product.totalStock ? (s.quantity / product.totalStock) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {product.stocks.length === 0 && (
              <p className="text-sm text-muted-foreground">Henüz stok kaydı yok</p>
            )}
            <div className="flex justify-between border-t pt-3 text-sm font-semibold">
              <span>Toplam</span>
              <span className="tabular-nums">
                {formatNumber(product.totalStock)} {product.unit}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hareket Geçmişi</CardTitle>
        </CardHeader>
        <MovementsTable productId={product.id} hideProduct />
      </Card>

      <ProductFormDialog open={editOpen} onOpenChange={setEditOpen} product={product} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Ürünü sil"
        description="Ürün pasife alınacak ve listelerden kaldırılacak. Hareket geçmişi korunur."
        confirmText="Sil"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
