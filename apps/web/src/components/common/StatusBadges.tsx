import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { MovementType, PurchaseOrderStatus, Role, StockStatus } from '@/types/api';

type Variant = BadgeProps['variant'];

export const STOCK_STATUS: Record<StockStatus, { label: string; variant: Variant }> = {
  in_stock: { label: 'Stokta', variant: 'success' },
  low: { label: 'Kritik', variant: 'warning' },
  out: { label: 'Tükendi', variant: 'destructive' },
};

export const MOVEMENT_TYPE: Record<MovementType, { label: string; variant: Variant }> = {
  IN: { label: 'Giriş', variant: 'success' },
  OUT: { label: 'Çıkış', variant: 'destructive' },
  TRANSFER: { label: 'Transfer', variant: 'default' },
  ADJUSTMENT: { label: 'Sayım', variant: 'warning' },
};

export const PO_STATUS: Record<PurchaseOrderStatus, { label: string; variant: Variant }> = {
  DRAFT: { label: 'Taslak', variant: 'secondary' },
  ORDERED: { label: 'Sipariş Verildi', variant: 'default' },
  RECEIVED: { label: 'Teslim Alındı', variant: 'success' },
  CANCELLED: { label: 'İptal', variant: 'destructive' },
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Yönetici (Admin)',
  MANAGER: 'Depo Müdürü',
  STAFF: 'Depo Personeli',
};

export const StockStatusBadge = ({ status }: { status: StockStatus }) => (
  <Badge variant={STOCK_STATUS[status].variant}>{STOCK_STATUS[status].label}</Badge>
);

export const MovementTypeBadge = ({ type }: { type: MovementType }) => (
  <Badge variant={MOVEMENT_TYPE[type].variant}>{MOVEMENT_TYPE[type].label}</Badge>
);

export const PurchaseOrderStatusBadge = ({ status }: { status: PurchaseOrderStatus }) => (
  <Badge variant={PO_STATUS[status].variant}>{PO_STATUS[status].label}</Badge>
);
