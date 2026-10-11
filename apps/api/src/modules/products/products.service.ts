import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, resolveSort } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateProductDto,
  ProductQueryDto,
  StockStatus,
  UpdateProductDto,
} from './dto/product.dto';

const SORTABLE = [
  'name',
  'sku',
  'salePrice',
  'purchasePrice',
  'minStockLevel',
  'createdAt',
] as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.categoryId && {
        OR: [{ categoryId: query.categoryId }, { category: { parentId: query.categoryId } }],
      }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.warehouseId && {
        stocks: { some: { warehouseId: query.warehouseId, quantity: { gt: 0 } } },
      }),
      ...(query.search && {
        AND: [
          {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { barcode: { contains: query.search } },
            ],
          },
        ],
      }),
    };

    if (query.stockStatus) {
      where.id = { in: await this.findIdsByStockStatus(query.stockStatus) };
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const totals = await this.getTotals(products.map((p) => p.id));
    const data = products.map((p) => {
      const totalStock = totals.get(p.id) ?? 0;
      return { ...p, totalStock, stockStatus: this.statusOf(totalStock, p.minStockLevel) };
    });
    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        stocks: {
          include: { warehouse: { select: { id: true, code: true, name: true } } },
          orderBy: { warehouse: { code: 'asc' } },
        },
      },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    const totalStock = product.stocks.reduce((sum, s) => sum + s.quantity, 0);
    return {
      ...product,
      totalStock,
      stockStatus: this.statusOf(totalStock, product.minStockLevel),
    };
  }

  async create(dto: CreateProductDto) {
    this.assertPrices(dto.purchasePrice, dto.salePrice);
    return this.prisma.product.create({ data: dto });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.findOne(id);
    this.assertPrices(
      dto.purchasePrice ?? Number(existing.purchasePrice),
      dto.salePrice ?? Number(existing.salePrice),
    );
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  /** Hareket geçmişi korunması için soft delete uygulanır. */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id };
  }

  statusOf(totalStock: number, minStockLevel: number): StockStatus {
    if (totalStock <= 0) return StockStatus.OUT;
    if (totalStock < minStockLevel) return StockStatus.LOW;
    return StockStatus.IN_STOCK;
  }

  private async getTotals(productIds: string[]): Promise<Map<string, number>> {
    if (!productIds.length) return new Map();
    const rows = await this.prisma.stock.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
  }

  private async findIdsByStockStatus(status: StockStatus): Promise<string[]> {
    const condition = {
      [StockStatus.OUT]: Prisma.sql`COALESCE(SUM(s.quantity), 0) <= 0`,
      [StockStatus.LOW]: Prisma.sql`COALESCE(SUM(s.quantity), 0) > 0 AND COALESCE(SUM(s.quantity), 0) < p.min_stock_level`,
      [StockStatus.IN_STOCK]: Prisma.sql`COALESCE(SUM(s.quantity), 0) >= p.min_stock_level AND COALESCE(SUM(s.quantity), 0) > 0`,
    }[status];
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM products p
      LEFT JOIN stocks s ON s.product_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      HAVING ${condition}`;
    return rows.map((r) => r.id);
  }

  private assertPrices(purchasePrice: number, salePrice: number) {
    if (salePrice < purchasePrice) {
      throw new BadRequestException('Satış fiyatı alış fiyatından düşük olamaz');
    }
  }
}
