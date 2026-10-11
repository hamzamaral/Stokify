import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import {
  MovementQueryDto,
  StockAdjustDto,
  StockInDto,
  StockOutDto,
  StockTransferDto,
} from './dto/stock.dto';

type Tx = Prisma.TransactionClient;

const MOVEMENT_INCLUDE = {
  product: { select: { id: true, sku: true, name: true, unit: true } },
  fromWarehouse: { select: { id: true, code: true, name: true } },
  toWarehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.StockMovementInclude;

export interface IncreaseStockInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number | Prisma.Decimal;
  referenceNo?: string;
  note?: string;
  userId: string;
}

/**
 * Tüm stok değişiklikleri bu servis üzerinden yapılır. Her işlem tek bir DB transaction'ı içinde
 * hem `stocks` tablosunu günceller hem de `stock_movements` tablosuna kayıt atar.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findMovements(query: MovementQueryDto) {
    const where: Prisma.StockMovementWhereInput = {
      ...(query.productId && { productId: query.productId }),
      ...(query.type && { type: query.type }),
      ...(query.warehouseId && {
        OR: [{ fromWarehouseId: query.warehouseId }, { toWarehouseId: query.warehouseId }],
      }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(`${query.to.slice(0, 10)}T23:59:59.999Z`) }),
        },
      }),
      ...(query.search && {
        AND: [
          {
            OR: [
              { referenceNo: { contains: query.search, mode: 'insensitive' } },
              { product: { name: { contains: query.search, mode: 'insensitive' } } },
              { product: { sku: { contains: query.search, mode: 'insensitive' } } },
            ],
          },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: { createdAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  stockIn(dto: StockInDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await this.getActiveProduct(tx, dto.productId);
      return this.increase(tx, { ...dto, unitCost: dto.unitCost ?? product.purchasePrice, userId });
    });
  }

  stockOut(dto: StockOutDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getActiveProduct(tx, dto.productId);
      await this.getActiveWarehouse(tx, dto.warehouseId);
      await this.decrement(tx, dto.productId, dto.warehouseId, dto.quantity);
      return tx.stockMovement.create({
        data: {
          type: MovementType.OUT,
          productId: dto.productId,
          fromWarehouseId: dto.warehouseId,
          quantity: dto.quantity,
          referenceNo: dto.referenceNo,
          note: dto.note,
          createdById: userId,
        },
        include: MOVEMENT_INCLUDE,
      });
    });
  }

  stockTransfer(dto: StockTransferDto, userId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Kaynak ve hedef depo aynı olamaz');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.getActiveProduct(tx, dto.productId);
      await this.getActiveWarehouse(tx, dto.fromWarehouseId);
      await this.getActiveWarehouse(tx, dto.toWarehouseId);
      await this.decrement(tx, dto.productId, dto.fromWarehouseId, dto.quantity);
      await this.upsertIncrement(tx, dto.productId, dto.toWarehouseId, dto.quantity);
      return tx.stockMovement.create({
        data: {
          type: MovementType.TRANSFER,
          productId: dto.productId,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          quantity: dto.quantity,
          referenceNo: dto.referenceNo,
          note: dto.note,
          createdById: userId,
        },
        include: MOVEMENT_INCLUDE,
      });
    });
  }

  /** Sayım düzeltmesi: hareket kaydındaki miktar, sayılan ile sistemdeki arasındaki işaretli farktır. */
  stockAdjust(dto: StockAdjustDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getActiveProduct(tx, dto.productId);
      await this.getActiveWarehouse(tx, dto.warehouseId);

      // Satırı kilitleyerek eşzamanlı hareketlerin farkı bozmasını engelle
      const [row] = await tx.$queryRaw<{ quantity: number }[]>`
        SELECT quantity FROM stocks
        WHERE product_id = ${dto.productId} AND warehouse_id = ${dto.warehouseId}
        FOR UPDATE`;
      const current = row?.quantity ?? 0;
      const delta = dto.countedQuantity - current;
      if (delta === 0) {
        throw new BadRequestException(
          'Sayılan miktar sistemdeki miktarla aynı, düzeltme gerekmiyor',
        );
      }

      await tx.stock.upsert({
        where: {
          productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId },
        },
        create: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          quantity: dto.countedQuantity,
        },
        update: { quantity: dto.countedQuantity },
      });

      return tx.stockMovement.create({
        data: {
          type: MovementType.ADJUSTMENT,
          productId: dto.productId,
          toWarehouseId: dto.warehouseId,
          quantity: delta,
          referenceNo: dto.referenceNo,
          note: dto.note,
          createdById: userId,
        },
        include: MOVEMENT_INCLUDE,
      });
    });
  }

  /** Satın alma teslim alımı gibi başka servislerin transaction'ları içinde de kullanılır. */
  async increase(tx: Tx, input: IncreaseStockInput) {
    await this.getActiveWarehouse(tx, input.warehouseId);
    await this.upsertIncrement(tx, input.productId, input.warehouseId, input.quantity);
    return tx.stockMovement.create({
      data: {
        type: MovementType.IN,
        productId: input.productId,
        toWarehouseId: input.warehouseId,
        quantity: input.quantity,
        unitCost: input.unitCost,
        referenceNo: input.referenceNo,
        note: input.note,
        createdById: input.userId,
      },
      include: MOVEMENT_INCLUDE,
    });
  }

  private upsertIncrement(tx: Tx, productId: string, warehouseId: string, quantity: number) {
    return tx.stock.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: { productId, warehouseId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  /**
   * Koşullu atomik azaltma: `quantity >= miktar` şartı sağlanmazsa hiçbir satır güncellenmez.
   * Böylece eşzamanlı çıkışlarda bile stok negatife düşmez (ek kilit gerekmez).
   */
  private async decrement(tx: Tx, productId: string, warehouseId: string, quantity: number) {
    const { count } = await tx.stock.updateMany({
      where: { productId, warehouseId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (count === 0) {
      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      });
      throw new BadRequestException(
        `Yetersiz stok. Depodaki mevcut miktar: ${stock?.quantity ?? 0}, istenen: ${quantity}`,
      );
    }
  }

  private async getActiveProduct(tx: Tx, id: string) {
    const product = await tx.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    if (!product.isActive) throw new BadRequestException('Pasif ürün için stok hareketi yapılamaz');
    return product;
  }

  private async getActiveWarehouse(tx: Tx, id: string) {
    const warehouse = await tx.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Depo bulunamadı');
    if (!warehouse.isActive) throw new BadRequestException(`${warehouse.name} pasif durumda`);
    return warehouse;
  }
}
