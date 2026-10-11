import { ConflictException } from '@nestjs/common';
import { Prisma, PurchaseOrder, PurchaseOrderStatus } from '@prisma/client';
import { asPrismaService, createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { StockService } from '../stock/stock.service';
import { PurchaseOrdersService } from './purchase-orders.service';

const order = (status: PurchaseOrderStatus) =>
  ({ id: 'po1', orderNo: 'PO-2026-00001', warehouseId: 'w1', status }) as PurchaseOrder;

describe('PurchaseOrdersService', () => {
  let prisma: PrismaMock;
  let stockService: jest.Mocked<Pick<StockService, 'increase'>>;
  let service: PurchaseOrdersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    stockService = { increase: jest.fn() };
    service = new PurchaseOrdersService(
      asPrismaService(prisma),
      stockService as unknown as StockService,
    );
    prisma.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
  });

  it('taslak sipariş doğrudan teslim alınamaz', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue(order(PurchaseOrderStatus.DRAFT));
    await expect(service.receive('po1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(stockService.increase).not.toHaveBeenCalled();
  });

  it('teslim alınan sipariş her kalem için stok girişi yapar', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue(order(PurchaseOrderStatus.ORDERED));
    prisma.purchaseOrderItem.findMany.mockResolvedValue([
      { productId: 'p1', quantity: 10, unitCost: new Prisma.Decimal(5) },
      { productId: 'p2', quantity: 3, unitCost: new Prisma.Decimal(8) },
    ] as never);

    await service.receive('po1', 'u1');

    expect(prisma.purchaseOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'po1', status: PurchaseOrderStatus.ORDERED },
        data: expect.objectContaining({ status: PurchaseOrderStatus.RECEIVED }),
      }),
    );
    expect(stockService.increase).toHaveBeenCalledTimes(2);
    expect(stockService.increase).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        productId: 'p1',
        warehouseId: 'w1',
        quantity: 10,
        referenceNo: 'PO-2026-00001',
      }),
    );
  });

  it('eşzamanlı güncelleme durumunda (koşullu update 0 satır) çakışma hatası verir', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue(order(PurchaseOrderStatus.ORDERED));
    prisma.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.receive('po1', 'u1')).rejects.toThrow('başka bir işlem');
    expect(stockService.increase).not.toHaveBeenCalled();
  });

  it.each([PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CANCELLED])(
    '%s durumundaki sipariş iptal edilemez',
    async (status) => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(order(status));
      await expect(service.cancel('po1')).rejects.toBeInstanceOf(ConflictException);
    },
  );
});
