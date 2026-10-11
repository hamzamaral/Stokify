import { fakerTR as faker } from '@faker-js/faker';
import { MovementType, Prisma, PrismaClient, PurchaseOrderStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEMO_CATEGORIES, DEMO_USERS, DEMO_WAREHOUSES } from './seed-data';

type Logger = { log: (message: string) => void };

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;
const RANDOM_MOVEMENT_COUNT = 1300;
const PURCHASE_ORDER_COUNT = 25;
const CRITICAL_PRODUCT_COUNT = 12;
const VARIANT_SUFFIXES = ['Pro', 'Eko', 'Plus'];
const DESCRIPTION_SUFFIXES = [
  'Kurumsal kullanıma uygun, 2 yıl garantili.',
  'Yüksek kaliteli malzemeden üretilmiştir.',
  'En çok tercih edilen ürünlerimizdendir.',
  'Toplu alımlarda özel fiyat uygulanır.',
  'Yerli üretim, TSE belgelidir.',
  'Uzun ömürlü ve dayanıklı yapıdadır.',
];

/** Pahalı ürünlerin stok adetleri daha düşük olsun ki toplam stok değeri gerçekçi kalsın. */
function quantityScale(cost: number): number {
  if (cost > 20000) return 0.08;
  if (cost > 5000) return 0.15;
  if (cost > 1000) return 0.35;
  return 1;
}

export async function isDatabaseEmpty(prisma: PrismaClient): Promise<boolean> {
  return (await prisma.user.count()) === 0;
}

/**
 * Deterministik demo verisi üretir. Stok hareketleri kronolojik olarak simüle edilir,
 * böylece `stocks` tablosundaki miktarlar hareket geçmişiyle birebir tutarlıdır.
 */
export async function runSeed(prisma: PrismaClient, logger: Logger = console): Promise<void> {
  faker.seed(42);
  const now = Date.now();
  const start = now - HISTORY_DAYS * DAY_MS;
  const uuid = () => faker.string.uuid();
  const money = (value: number) => new Prisma.Decimal(value.toFixed(2));

  // Kullanıcılar
  const users = await Promise.all(
    DEMO_USERS.map(async (u) => ({
      id: uuid(),
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      passwordHash: await bcrypt.hash(u.password, 10),
    })),
  );
  const operatorIds = users.map((u) => u.id);

  // Depolar
  const warehouses = DEMO_WAREHOUSES.map((w) => ({ id: uuid(), ...w }));
  const mainWarehouse = warehouses[0];

  // Kategoriler ve ürünler
  const categories: Prisma.CategoryCreateManyInput[] = [];
  const products: (Prisma.ProductCreateManyInput & { id: string; cost: number })[] = [];
  let barcodeSeq = 8690000000001;

  for (const parent of DEMO_CATEGORIES) {
    const parentId = uuid();
    categories.push({ id: parentId, name: parent.name, description: parent.description });

    for (const child of parent.children) {
      const categoryId = uuid();
      categories.push({
        id: categoryId,
        name: child.name,
        description: child.description,
        parentId,
      });

      const names = child.names.flatMap((name) =>
        faker.number.float() < 0.3
          ? [name, `${name} ${faker.helpers.arrayElement(VARIANT_SUFFIXES)}`]
          : [name],
      );

      names.forEach((name, index) => {
        const cost = faker.number.float({
          min: child.price[0],
          max: child.price[1],
          fractionDigits: 2,
        });
        const margin = faker.number.float({ min: 1.15, max: 1.6 });
        products.push({
          id: uuid(),
          sku: `${child.skuPrefix}-${String(index + 1).padStart(4, '0')}`,
          barcode: String(barcodeSeq++),
          name,
          description: `${name}. ${faker.helpers.arrayElement(DESCRIPTION_SUFFIXES)}`,
          categoryId,
          unit: child.unit,
          purchasePrice: money(cost),
          salePrice: money(cost * margin),
          minStockLevel: faker.helpers.arrayElement([5, 10, 15, 20, 25, 30, 50]),
          cost,
          createdAt: new Date(start - faker.number.int({ min: 1, max: 30 }) * DAY_MS),
        });
      });
    }
  }

  // Tedarikçiler
  const suppliers: Prisma.SupplierCreateManyInput[] = Array.from({ length: 15 }, () => ({
    id: uuid(),
    name: `${faker.company.name()}`,
    taxNumber: faker.string.numeric(10),
    contactName: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number(),
    address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
  }));

  // Hareket simülasyonu
  type Event = Prisma.StockMovementCreateManyInput & { createdAt: Date };
  const events: Event[] = [];
  const stockMap = new Map<string, number>();
  const key = (productId: string, warehouseId: string) => `${productId}|${warehouseId}`;
  const qtyOf = (p: string, w: string) => stockMap.get(key(p, w)) ?? 0;
  const addQty = (p: string, w: string, delta: number) =>
    stockMap.set(key(p, w), qtyOf(p, w) + delta);

  // Açılış stokları
  for (const product of products) {
    const qty = Math.max(
      8,
      Math.round(faker.number.int({ min: 40, max: 300 }) * quantityScale(product.cost)),
    );
    events.push({
      id: uuid(),
      type: MovementType.IN,
      productId: product.id,
      toWarehouseId: mainWarehouse.id,
      quantity: qty,
      unitCost: money(product.cost),
      referenceNo: 'ACILIS',
      note: 'Açılış stoku',
      createdById: users[0].id,
      createdAt: new Date(start + faker.number.int({ min: 0, max: 3600 }) * 1000),
    });
  }

  // Satın alma siparişleri (teslim alınanlar IN hareketi üretir)
  const purchaseOrders: Prisma.PurchaseOrderCreateManyInput[] = [];
  const purchaseOrderItems: Prisma.PurchaseOrderItemCreateManyInput[] = [];
  const pendingPoEvents: Event[] = [];

  for (let i = 0; i < PURCHASE_ORDER_COUNT; i++) {
    const id = uuid();
    const status = faker.helpers.weightedArrayElement([
      { weight: 13, value: PurchaseOrderStatus.RECEIVED },
      { weight: 5, value: PurchaseOrderStatus.ORDERED },
      { weight: 4, value: PurchaseOrderStatus.DRAFT },
      { weight: 3, value: PurchaseOrderStatus.CANCELLED },
    ]);
    const createdAt = new Date(
      start + faker.number.int({ min: 2, max: HISTORY_DAYS - 3 }) * DAY_MS,
    );
    const receivedAt =
      status === PurchaseOrderStatus.RECEIVED
        ? new Date(
            Math.min(
              createdAt.getTime() + faker.number.int({ min: 2, max: 7 }) * DAY_MS,
              now - DAY_MS,
            ),
          )
        : null;
    const warehouse = faker.helpers.arrayElement(warehouses);
    const orderNo = `PO-${new Date(createdAt).getFullYear()}-${String(i + 1).padStart(5, '0')}`;
    const createdById = faker.helpers.arrayElement(operatorIds.slice(0, 2));

    purchaseOrders.push({
      id,
      orderNo,
      supplierId: faker.helpers.arrayElement(suppliers).id!,
      warehouseId: warehouse.id,
      status,
      createdAt,
      receivedAt,
      expectedAt: new Date(createdAt.getTime() + 7 * DAY_MS),
      note: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }) ?? null,
      createdById,
    });

    for (const product of faker.helpers.arrayElements(products, { min: 2, max: 6 })) {
      const quantity = Math.max(
        2,
        Math.round(faker.number.int({ min: 10, max: 120 }) * quantityScale(product.cost)),
      );
      const unitCost = money(product.cost * faker.number.float({ min: 0.95, max: 1.05 }));
      purchaseOrderItems.push({
        id: uuid(),
        purchaseOrderId: id,
        productId: product.id,
        quantity,
        unitCost,
      });
      if (receivedAt) {
        pendingPoEvents.push({
          id: uuid(),
          type: MovementType.IN,
          productId: product.id,
          toWarehouseId: warehouse.id,
          quantity,
          unitCost,
          referenceNo: orderNo,
          note: 'Satın alma siparişi teslim alındı',
          createdById,
          createdAt: receivedAt,
        });
      }
    }
  }

  // Rastgele operasyonel hareketler, kronolojik sırayla
  const randomSlots = Array.from({ length: RANDOM_MOVEMENT_COUNT }, () => ({
    at: new Date(
      start + DAY_MS + faker.number.int({ min: 0, max: (HISTORY_DAYS - 1) * DAY_MS - 1 }),
    ),
    type: faker.helpers.weightedArrayElement([
      { weight: 55, value: MovementType.OUT },
      { weight: 15, value: MovementType.IN },
      { weight: 20, value: MovementType.TRANSFER },
      { weight: 10, value: MovementType.ADJUSTMENT },
    ]),
  }));

  // Satışlar belirli ürünlerde yoğunlaşsın ki "en çok hareket gören" raporu anlamlı olsun
  const popular = faker.helpers.arrayElements(products, 25);
  const pickProduct = () =>
    faker.number.float() < 0.5
      ? faker.helpers.arrayElement(popular)
      : faker.helpers.arrayElement(products);

  const timeline = [
    ...events.map((e) => ({ at: e.createdAt, event: e as Event | null, type: e.type })),
    ...pendingPoEvents.map((e) => ({ at: e.createdAt, event: e as Event | null, type: e.type })),
    ...randomSlots.map((s) => ({ at: s.at, event: null as Event | null, type: s.type })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const movements: Event[] = [];
  for (const slot of timeline) {
    if (slot.event) {
      addQty(slot.event.productId, slot.event.toWarehouseId!, slot.event.quantity);
      movements.push(slot.event);
      continue;
    }

    const product = pickProduct();
    const createdById = faker.helpers.arrayElement(operatorIds);
    const base = { id: uuid(), productId: product.id, createdById, createdAt: slot.at };
    const stocked = warehouses.filter((w) => qtyOf(product.id, w.id) > 0);

    if (slot.type === MovementType.OUT && stocked.length) {
      const wh = faker.helpers.arrayElement(stocked);
      const quantity = faker.number.int({
        min: 1,
        max: Math.max(1, Math.min(15, Math.floor(qtyOf(product.id, wh.id) / 3))),
      });
      addQty(product.id, wh.id, -quantity);
      movements.push({
        ...base,
        type: MovementType.OUT,
        fromWarehouseId: wh.id,
        quantity,
        referenceNo: `SAT-${faker.string.numeric(6)}`,
        note: faker.helpers.arrayElement([
          'Satış',
          'Müşteri siparişi',
          'E-ticaret siparişi',
          'Kurumsal satış',
        ]),
      });
    } else if (slot.type === MovementType.TRANSFER && stocked.length) {
      const from = faker.helpers.arrayElement(stocked);
      const to = faker.helpers.arrayElement(warehouses.filter((w) => w.id !== from.id));
      const quantity = faker.number.int({
        min: 1,
        max: Math.max(1, Math.floor(qtyOf(product.id, from.id) / 4)),
      });
      addQty(product.id, from.id, -quantity);
      addQty(product.id, to.id, quantity);
      movements.push({
        ...base,
        type: MovementType.TRANSFER,
        fromWarehouseId: from.id,
        toWarehouseId: to.id,
        quantity,
        referenceNo: `TRF-${faker.string.numeric(6)}`,
        note: 'Depolar arası transfer',
      });
    } else if (slot.type === MovementType.ADJUSTMENT && stocked.length) {
      const wh = faker.helpers.arrayElement(stocked);
      const delta = faker.helpers.arrayElement([-3, -2, -1, 1, 2]);
      const quantity = Math.max(delta, -qtyOf(product.id, wh.id));
      addQty(product.id, wh.id, quantity);
      movements.push({
        ...base,
        type: MovementType.ADJUSTMENT,
        toWarehouseId: wh.id,
        quantity,
        note: quantity < 0 ? 'Sayım farkı: eksik / hasarlı ürün' : 'Sayım farkı: fazla ürün',
      });
    } else {
      const wh = faker.helpers.arrayElement(warehouses);
      const quantity = Math.max(
        2,
        Math.round(faker.number.int({ min: 10, max: 60 }) * quantityScale(product.cost)),
      );
      addQty(product.id, wh.id, quantity);
      movements.push({
        ...base,
        type: MovementType.IN,
        toWarehouseId: wh.id,
        quantity,
        unitCost: money(product.cost),
        referenceNo: `IRS-${faker.string.numeric(6)}`,
        note: 'Tedarikçi irsaliyesi ile giriş',
      });
    }
  }

  // Bazı ürünleri bilerek kritik seviyenin altına indir (dashboard uyarıları için)
  const criticalProducts = faker.helpers.arrayElements(products, CRITICAL_PRODUCT_COUNT);
  for (const [index, product] of criticalProducts.entries()) {
    const min = product.minStockLevel ?? 0;
    // İlk üç ürün tamamen tükensin, diğerleri kritik seviyenin altında kalsın
    const target = index < 3 ? 0 : faker.number.int({ min: 1, max: Math.max(1, min - 1) });
    let total = warehouses.reduce((sum, w) => sum + qtyOf(product.id, w.id), 0);
    for (const wh of warehouses) {
      if (total <= target) break;
      const quantity = Math.min(qtyOf(product.id, wh.id), total - target);
      if (quantity <= 0) continue;
      addQty(product.id, wh.id, -quantity);
      total -= quantity;
      movements.push({
        id: uuid(),
        type: MovementType.OUT,
        productId: product.id,
        fromWarehouseId: wh.id,
        quantity,
        referenceNo: `SAT-${faker.string.numeric(6)}`,
        note: 'Toplu kurumsal satış',
        createdById: users[1].id,
        createdAt: new Date(now - faker.number.int({ min: 1, max: 48 }) * 60 * 60 * 1000),
      });
    }
  }

  const stocks: Prisma.StockCreateManyInput[] = [];
  for (const [k, quantity] of stockMap) {
    const [productId, warehouseId] = k.split('|');
    stocks.push({ id: uuid(), productId, warehouseId, quantity });
  }

  const auditLogs: Prisma.AuditLogCreateManyInput[] = Array.from({ length: 30 }, () => {
    const product = faker.helpers.arrayElement(products);
    const action = faker.helpers.arrayElement(['CREATE', 'UPDATE', 'UPDATE', 'UPDATE']);
    return {
      id: uuid(),
      userId: faker.helpers.arrayElement(operatorIds.slice(0, 2)),
      action,
      entity: 'Product',
      entityId: product.id,
      after: { name: product.name, sku: product.sku },
      ip: faker.internet.ipv4(),
      createdAt: new Date(start + faker.number.int({ min: 0, max: HISTORY_DAYS * DAY_MS })),
    };
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.user.createMany({ data: users });
      await tx.warehouse.createMany({ data: warehouses });
      await tx.category.createMany({ data: categories.filter((c) => !c.parentId) });
      await tx.category.createMany({ data: categories.filter((c) => c.parentId) });
      await tx.supplier.createMany({ data: suppliers });
      await tx.product.createMany({ data: products.map(({ cost: _cost, ...p }) => p) });
      await tx.stock.createMany({ data: stocks });
      await tx.purchaseOrder.createMany({ data: purchaseOrders });
      await tx.purchaseOrderItem.createMany({ data: purchaseOrderItems });
      await tx.stockMovement.createMany({ data: movements });
      await tx.auditLog.createMany({ data: auditLogs });
    },
    { timeout: 120_000 },
  );

  logger.log(
    `Seed tamamlandı: ${users.length} kullanıcı, ${warehouses.length} depo, ${categories.length} kategori, ` +
      `${suppliers.length} tedarikçi, ${products.length} ürün, ${movements.length} stok hareketi, ` +
      `${purchaseOrders.length} satın alma siparişi`,
  );
}
