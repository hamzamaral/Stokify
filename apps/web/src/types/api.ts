export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';
export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
export type StockStatus = 'in_stock' | 'low' | 'out';

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  _count?: { products: number; children: number };
  children?: Category[];
}

export interface Supplier {
  id: string;
  name: string;
  taxNumber: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  _count?: { purchaseOrders: number };
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  totalQuantity?: number;
  stockValue?: number;
  productCount?: number;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  category: { id: string; name: string };
  unit: string;
  purchasePrice: string;
  salePrice: string;
  minStockLevel: number;
  isActive: boolean;
  createdAt: string;
  totalStock: number;
  stockStatus: StockStatus;
}

export interface ProductDetail extends Product {
  stocks: {
    id: string;
    warehouseId: string;
    quantity: number;
    warehouse: { id: string; code: string; name: string };
  }[];
}

type WarehouseRef = { id: string; code: string; name: string } | null;

export interface StockMovement {
  id: string;
  type: MovementType;
  quantity: number;
  unitCost: string | null;
  referenceNo: string | null;
  note: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string; unit: string };
  fromWarehouse: WarehouseRef;
  toWarehouse: WarehouseRef;
  createdBy: { id: string; fullName: string };
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitCost: string;
  product: { id: string; sku: string; name: string; unit: string };
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  status: PurchaseOrderStatus;
  expectedAt: string | null;
  receivedAt: string | null;
  note: string | null;
  createdAt: string;
  supplier: { id: string; name: string; email?: string; phone?: string };
  warehouse: { id: string; code: string; name: string };
  createdBy?: { id: string; fullName: string };
  items?: PurchaseOrderItem[];
  itemCount?: number;
  totalAmount: number;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string } | null;
}

export interface CriticalProduct {
  id: string;
  sku: string;
  name: string;
  unit: string;
  minStockLevel: number;
  totalStock: number;
  shortage: number;
}

export interface Dashboard {
  summary: {
    productCount: number;
    totalQuantity: number;
    stockValue: number;
    potentialRevenue: number;
    lowStockCount: number;
    outOfStockCount: number;
    pendingPurchaseOrders: number;
    movementCount: number;
  };
  movementTrend: { date: string; in: number; out: number }[];
  categoryDistribution: { category: string; value: number; quantity: number }[];
  topProducts: { id: string; sku: string; name: string; quantity: number }[];
  criticalProducts: CriticalProduct[];
}
