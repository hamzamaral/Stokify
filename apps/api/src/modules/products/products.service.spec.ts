import { BadRequestException } from '@nestjs/common';
import { asPrismaService, createPrismaMock } from '../../test-utils/prisma-mock';
import { StockStatus } from './dto/product.dto';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const prisma = createPrismaMock();
  const service = new ProductsService(asPrismaService(prisma));

  it.each([
    [0, 10, StockStatus.OUT],
    [5, 10, StockStatus.LOW],
    [10, 10, StockStatus.IN_STOCK],
    [3, 0, StockStatus.IN_STOCK],
  ])('stok=%i, min=%i için durum %s', (total, min, expected) => {
    expect(service.statusOf(total, min)).toBe(expected);
  });

  it('satış fiyatı alış fiyatından düşükse ürün oluşturmaz', async () => {
    await expect(
      service.create({
        sku: 'X-1',
        name: 'Test',
        categoryId: 'c',
        purchasePrice: 100,
        salePrice: 90,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });
});
