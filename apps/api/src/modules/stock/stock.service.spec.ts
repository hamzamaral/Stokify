import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MovementType, Prisma, Product, Warehouse } from '@prisma/client';
import { asPrismaService, createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { StockService } from './stock.service';

const product = {
  id: 'p1',
  isActive: true,
  deletedAt: null,
  purchasePrice: new Prisma.Decimal(100),
} as Product;
const warehouse = (id: string, isActive = true) => ({ id, name: id, isActive }) as Warehouse;

describe('StockService', () => {
  let prisma: PrismaMock;
  let service: StockService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new StockService(asPrismaService(prisma));
    prisma.product.findFirst.mockResolvedValue(product);
    prisma.warehouse.findUnique.mockImplementation(((args: { where: { id: string } }) =>
      Promise.resolve(warehouse(args.where.id))) as never);
  });

  describe('stockOut', () => {
    it('stok yeterliyse koşullu azaltma yapar ve OUT hareketi oluşturur', async () => {
      prisma.stock.updateMany.mockResolvedValue({ count: 1 });

      await service.stockOut({ productId: 'p1', warehouseId: 'w1', quantity: 5 }, 'u1');

      expect(prisma.stock.updateMany).toHaveBeenCalledWith({
        where: { productId: 'p1', warehouseId: 'w1', quantity: { gte: 5 } },
        data: { quantity: { decrement: 5 } },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: MovementType.OUT,
            fromWarehouseId: 'w1',
            quantity: 5,
          }),
        }),
      );
    });

    it('stok yetersizse hata fırlatır ve hareket oluşturmaz', async () => {
      prisma.stock.updateMany.mockResolvedValue({ count: 0 });
      prisma.stock.findUnique.mockResolvedValue({ quantity: 2 } as never);

      await expect(
        service.stockOut({ productId: 'p1', warehouseId: 'w1', quantity: 5 }, 'u1'),
      ).rejects.toThrow('Yetersiz stok. Depodaki mevcut miktar: 2, istenen: 5');
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('silinmiş ürün için NotFound fırlatır', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(
        service.stockOut({ productId: 'x', warehouseId: 'w1', quantity: 1 }, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('pasif depodan çıkışa izin vermez', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse('w1', false));
      await expect(
        service.stockOut({ productId: 'p1', warehouseId: 'w1', quantity: 1 }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('stockTransfer', () => {
    it('aynı depoya transferi reddeder', () => {
      expect(() =>
        service.stockTransfer(
          { productId: 'p1', fromWarehouseId: 'w1', toWarehouseId: 'w1', quantity: 1 },
          'u1',
        ),
      ).toThrow(BadRequestException);
    });

    it('kaynaktan düşer, hedefe ekler', async () => {
      prisma.stock.updateMany.mockResolvedValue({ count: 1 });

      await service.stockTransfer(
        { productId: 'p1', fromWarehouseId: 'w1', toWarehouseId: 'w2', quantity: 4 },
        'u1',
      );

      expect(prisma.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ warehouseId: 'w1' }) }),
      );
      expect(prisma.stock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_warehouseId: { productId: 'p1', warehouseId: 'w2' } },
          update: { quantity: { increment: 4 } },
        }),
      );
    });
  });

  describe('stockIn', () => {
    it('birim maliyet verilmezse ürünün alış fiyatını kullanır', async () => {
      await service.stockIn({ productId: 'p1', warehouseId: 'w1', quantity: 3 }, 'u1');
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: MovementType.IN, unitCost: product.purchasePrice }),
        }),
      );
    });
  });

  describe('stockAdjust', () => {
    it('sayılan ile sistemdeki arasındaki işaretli farkı kaydeder', async () => {
      prisma.$queryRaw.mockResolvedValue([{ quantity: 10 }]);

      await service.stockAdjust(
        { productId: 'p1', warehouseId: 'w1', countedQuantity: 7, note: 'sayım' },
        'u1',
      );

      expect(prisma.stock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { quantity: 7 } }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: MovementType.ADJUSTMENT, quantity: -3 }),
        }),
      );
    });

    it('fark yoksa hata fırlatır', async () => {
      prisma.$queryRaw.mockResolvedValue([{ quantity: 7 }]);
      await expect(
        service.stockAdjust(
          { productId: 'p1', warehouseId: 'w1', countedQuantity: 7, note: 'sayım' },
          'u1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
