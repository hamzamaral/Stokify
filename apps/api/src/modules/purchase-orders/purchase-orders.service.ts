import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { paginate, resolveSort } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { StockService } from '../stock/stock.service';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  UpdatePurchaseOrderDto,
} from './dto/purchase-order.dto';

const SORTABLE = ['orderNo', 'createdAt', 'expectedAt', 'status'] as const;

const DETAIL_INCLUDE = {
  supplier: { select: { id: true, name: true, email: true, phone: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
} satisfies Prisma.PurchaseOrderInclude;

/** Geçerli durum geçişleri */
const TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: [PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.CANCELLED],
  ORDERED: [PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CANCELLED],
  RECEIVED: [],
  CANCELLED: [],
};

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async findAll(query: PurchaseOrderQueryDto) {
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.supplierId && { supplierId: query.supplierId }),
      ...(query.search && {
        OR: [
          { orderNo: { contains: query.search, mode: 'insensitive' } },
          { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          items: { select: { quantity: true, unitCost: true } },
        },
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    const data = orders.map(({ items, ...order }) => ({
      ...order,
      itemCount: items.length,
      totalAmount: this.total(items),
    }));
    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Satın alma siparişi bulunamadı');
    return { ...order, totalAmount: this.total(order.items) };
  }

  async create(dto: CreatePurchaseOrderDto, userId: string) {
    await this.assertProductsExist(dto.items.map((i) => i.productId));
    const { items, expectedAt, ...data } = dto;
    const order = await this.prisma.purchaseOrder.create({
      data: {
        ...data,
        orderNo: await this.nextOrderNo(),
        expectedAt: expectedAt ? new Date(expectedAt) : undefined,
        createdById: userId,
        items: { create: items },
      },
    });
    return this.findOne(order.id);
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    const order = await this.findOne(id);
    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new ConflictException('Sadece taslak siparişler düzenlenebilir');
    }
    const { items, expectedAt, ...data } = dto;
    if (items) await this.assertProductsExist(items.map((i) => i.productId));

    await this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.createMany({
          data: items.map((item) => ({ ...item, purchaseOrderId: id })),
        });
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { ...data, ...(expectedAt !== undefined && { expectedAt: new Date(expectedAt) }) },
      });
    });
    return this.findOne(id);
  }

  async markOrdered(id: string) {
    await this.transition(id, PurchaseOrderStatus.ORDERED);
    return this.findOne(id);
  }

  async cancel(id: string) {
    await this.transition(id, PurchaseOrderStatus.CANCELLED);
    return this.findOne(id);
  }

  /** Siparişi teslim alır ve her kalem için hedef depoya stok girişi yapar (tek transaction). */
  async receive(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.transition(id, PurchaseOrderStatus.RECEIVED, tx);
      const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
      for (const item of items) {
        await this.stockService.increase(tx, {
          productId: item.productId,
          warehouseId: order.warehouseId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          referenceNo: order.orderNo,
          note: 'Satın alma siparişi teslim alındı',
          userId,
        });
      }
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const order = await this.findOne(id);
    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new ConflictException('Sadece taslak siparişler silinebilir');
    }
    await this.prisma.purchaseOrder.delete({ where: { id } });
    return { id };
  }

  /**
   * Durum geçişini, mevcut durum koşuluyla atomik olarak uygular.
   * Aynı sipariş iki kez eşzamanlı teslim alınmaya çalışılırsa yalnızca biri başarılı olur.
   */
  private async transition(
    id: string,
    target: PurchaseOrderStatus,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const order = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Satın alma siparişi bulunamadı');
    if (!TRANSITIONS[order.status].includes(target)) {
      throw new ConflictException(
        `${order.status} durumundaki sipariş ${target} durumuna geçirilemez`,
      );
    }
    const { count } = await tx.purchaseOrder.updateMany({
      where: { id, status: order.status },
      data: {
        status: target,
        ...(target === PurchaseOrderStatus.RECEIVED && { receivedAt: new Date() }),
      },
    });
    if (count === 0) throw new ConflictException('Sipariş başka bir işlem tarafından güncellendi');
    return order;
  }

  private async assertProductsExist(productIds: string[]) {
    const count = await this.prisma.product.count({
      where: { id: { in: productIds }, deletedAt: null },
    });
    if (count !== new Set(productIds).size) {
      throw new BadRequestException('Siparişteki ürünlerden bazıları bulunamadı');
    }
  }

  private async nextOrderNo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const last = await this.prisma.purchaseOrder.findFirst({
      where: { orderNo: { startsWith: prefix } },
      orderBy: { orderNo: 'desc' },
      select: { orderNo: true },
    });
    const next = last ? Number(last.orderNo.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private total(items: { quantity: number; unitCost: Prisma.Decimal }[]): number {
    return Number(
      items
        .reduce((sum, i) => sum.add(i.unitCost.mul(i.quantity)), new Prisma.Decimal(0))
        .toFixed(2),
    );
  }
}
