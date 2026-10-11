import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

type WarehouseSummaryRow = {
  warehouse_id: string;
  total_quantity: bigint | null;
  stock_value: Prisma.Decimal | null;
  product_count: bigint;
};

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const [warehouses, summary] = await Promise.all([
      this.prisma.warehouse.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.$queryRaw<WarehouseSummaryRow[]>`
        SELECT s.warehouse_id,
               SUM(s.quantity)                      AS total_quantity,
               SUM(s.quantity * p.purchase_price)   AS stock_value,
               COUNT(*) FILTER (WHERE s.quantity > 0) AS product_count
        FROM stocks s
        JOIN products p ON p.id = s.product_id AND p.deleted_at IS NULL
        GROUP BY s.warehouse_id`,
    ]);
    const byId = new Map(summary.map((row) => [row.warehouse_id, row]));
    return warehouses.map((w) => {
      const row = byId.get(w.id);
      return {
        ...w,
        totalQuantity: Number(row?.total_quantity ?? 0),
        stockValue: Number(row?.stock_value ?? 0),
        productCount: Number(row?.product_count ?? 0),
      };
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Depo bulunamadı');
    return warehouse;
  }

  create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findOne(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const remaining = await this.prisma.stock.aggregate({
      where: { warehouseId: id },
      _sum: { quantity: true },
    });
    if ((remaining._sum.quantity ?? 0) > 0) {
      throw new ConflictException('İçinde stok bulunan depo silinemez');
    }
    const [movements, orders] = await Promise.all([
      this.prisma.stockMovement.count({
        where: { OR: [{ fromWarehouseId: id }, { toWarehouseId: id }] },
      }),
      this.prisma.purchaseOrder.count({ where: { warehouseId: id } }),
    ]);
    if (movements + orders > 0) {
      throw new ConflictException('Geçmiş hareketi olan depo silinemez, pasifleştirebilirsiniz');
    }
    await this.prisma.$transaction([
      this.prisma.stock.deleteMany({ where: { warehouseId: id } }),
      this.prisma.warehouse.delete({ where: { id } }),
    ]);
    return { id };
  }
}
