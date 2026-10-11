import { Injectable } from '@nestjs/common';
import { MovementType, Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toCsv } from './csv.util';

const DAY_MS = 24 * 60 * 60 * 1000;

const MOVEMENT_LABELS: Record<MovementType, string> = {
  IN: 'Giriş',
  OUT: 'Çıkış',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Sayım Düzeltme',
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(days = 30) {
    const since = new Date(Date.now() - days * DAY_MS);

    const [
      totals,
      stockStatus,
      pendingOrders,
      movementCount,
      trend,
      categories,
      topProducts,
      critical,
    ] = await Promise.all([
      this.prisma.$queryRaw<
        {
          product_count: bigint;
          total_quantity: bigint | null;
          stock_value: Prisma.Decimal | null;
          sale_value: Prisma.Decimal | null;
        }[]
      >`
          SELECT COUNT(DISTINCT p.id)                      AS product_count,
                 SUM(s.quantity)                           AS total_quantity,
                 SUM(s.quantity * p.purchase_price)        AS stock_value,
                 SUM(s.quantity * p.sale_price)            AS sale_value
          FROM products p
          LEFT JOIN stocks s ON s.product_id = p.id
          WHERE p.deleted_at IS NULL`,
      this.prisma.$queryRaw<{ low: bigint; out: bigint }[]>`
          SELECT COUNT(*) FILTER (WHERE total > 0 AND total < min_stock_level) AS low,
                 COUNT(*) FILTER (WHERE total <= 0)                            AS out
          FROM (
            SELECT p.min_stock_level, COALESCE(SUM(s.quantity), 0) AS total
            FROM products p
            LEFT JOIN stocks s ON s.product_id = p.id
            WHERE p.deleted_at IS NULL AND p.is_active
            GROUP BY p.id
          ) t`,
      this.prisma.purchaseOrder.count({
        where: { status: { in: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ORDERED] } },
      }),
      this.prisma.stockMovement.count({ where: { createdAt: { gte: since } } }),
      this.prisma.$queryRaw<{ day: Date; incoming: bigint; outgoing: bigint }[]>`
          SELECT d.day,
                 COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'IN'), 0)  AS incoming,
                 COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT'), 0) AS outgoing
          FROM generate_series(date_trunc('day', ${since}::timestamp), date_trunc('day', now()), interval '1 day') AS d(day)
          LEFT JOIN stock_movements m ON date_trunc('day', m.created_at) = d.day
          GROUP BY d.day
          ORDER BY d.day`,
      this.prisma.$queryRaw<
        { category: string; value: Prisma.Decimal | null; quantity: bigint | null }[]
      >`
          SELECT COALESCE(parent.name, c.name)      AS category,
                 SUM(s.quantity * p.purchase_price)  AS value,
                 SUM(s.quantity)                     AS quantity
          FROM stocks s
          JOIN products p ON p.id = s.product_id AND p.deleted_at IS NULL
          JOIN categories c ON c.id = p.category_id
          LEFT JOIN categories parent ON parent.id = c.parent_id
          GROUP BY 1
          ORDER BY value DESC NULLS LAST`,
      this.prisma.$queryRaw<{ id: string; sku: string; name: string; quantity: bigint }[]>`
          SELECT p.id, p.sku, p.name, SUM(m.quantity) AS quantity
          FROM stock_movements m
          JOIN products p ON p.id = m.product_id
          WHERE m.type = 'OUT' AND m.created_at >= ${since} AND p.deleted_at IS NULL
          GROUP BY p.id
          ORDER BY quantity DESC
          LIMIT 10`,
      this.criticalProducts(10),
    ]);

    const t = totals[0];
    return {
      summary: {
        productCount: Number(t.product_count),
        totalQuantity: Number(t.total_quantity ?? 0),
        stockValue: Number(t.stock_value ?? 0),
        potentialRevenue: Number(t.sale_value ?? 0),
        lowStockCount: Number(stockStatus[0].low),
        outOfStockCount: Number(stockStatus[0].out),
        pendingPurchaseOrders: pendingOrders,
        movementCount,
      },
      movementTrend: trend.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        in: Number(r.incoming),
        out: Number(r.outgoing),
      })),
      categoryDistribution: categories.map((r) => ({
        category: r.category,
        value: Number(r.value ?? 0),
        quantity: Number(r.quantity ?? 0),
      })),
      topProducts: topProducts.map((r) => ({ ...r, quantity: Number(r.quantity) })),
      criticalProducts: critical,
    };
  }

  async criticalProducts(limit = 50) {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        sku: string;
        name: string;
        unit: string;
        min_stock_level: number;
        total: bigint;
      }[]
    >`
      SELECT p.id, p.sku, p.name, p.unit, p.min_stock_level, COALESCE(SUM(s.quantity), 0) AS total
      FROM products p
      LEFT JOIN stocks s ON s.product_id = p.id
      WHERE p.deleted_at IS NULL AND p.is_active
      GROUP BY p.id
      HAVING COALESCE(SUM(s.quantity), 0) < p.min_stock_level
      ORDER BY COALESCE(SUM(s.quantity), 0)::float / NULLIF(p.min_stock_level, 0) ASC
      LIMIT ${limit}`;
    return rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      unit: r.unit,
      minStockLevel: r.min_stock_level,
      totalStock: Number(r.total),
      shortage: r.min_stock_level - Number(r.total),
    }));
  }

  async exportProductsCsv(): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      include: { category: true, stocks: true },
      orderBy: { sku: 'asc' },
    });
    return toCsv(
      [
        'SKU',
        'Barkod',
        'Ürün Adı',
        'Kategori',
        'Birim',
        'Alış Fiyatı',
        'Satış Fiyatı',
        'Min. Stok',
        'Toplam Stok',
        'Stok Değeri',
        'Durum',
      ],
      products.map((p) => {
        const total = p.stocks.reduce((sum, s) => sum + s.quantity, 0);
        return [
          p.sku,
          p.barcode ?? '',
          p.name,
          p.category.name,
          p.unit,
          Number(p.purchasePrice).toFixed(2),
          Number(p.salePrice).toFixed(2),
          p.minStockLevel,
          total,
          (total * Number(p.purchasePrice)).toFixed(2),
          p.isActive ? 'Aktif' : 'Pasif',
        ];
      }),
    );
  }

  async exportMovementsCsv(from?: string, to?: string): Promise<string> {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(`${to.slice(0, 10)}T23:59:59.999Z`) }),
        },
      },
      include: { product: true, fromWarehouse: true, toWarehouse: true, createdBy: true },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });
    return toCsv(
      [
        'Tarih',
        'Tür',
        'SKU',
        'Ürün',
        'Miktar',
        'Kaynak Depo',
        'Hedef Depo',
        'Referans',
        'Not',
        'Kullanıcı',
      ],
      movements.map((m) => [
        m.createdAt.toISOString(),
        MOVEMENT_LABELS[m.type],
        m.product.sku,
        m.product.name,
        m.quantity,
        m.fromWarehouse?.name ?? '',
        m.toWarehouse?.name ?? '',
        m.referenceNo ?? '',
        m.note ?? '',
        m.createdBy.fullName,
      ]),
    );
  }
}
