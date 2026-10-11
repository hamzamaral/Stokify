import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Stokify API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const tokens: Record<string, string> = {};

  const login = async (email: string, password: string) => {
    const res = await http.post('/api/v1/auth/login').send({ email, password }).expect(200);
    return res.body.accessToken as string;
  };
  const auth = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    tokens.admin = await login('admin@stokify.com', 'Admin123!');
    tokens.manager = await login('manager@stokify.com', 'Manager123!');
    tokens.staff = await login('staff@stokify.com', 'Staff123!');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Altyapı', () => {
    it('GET /health veritabanı durumunu döner', async () => {
      const res = await http.get('/api/v1/health').expect(200);
      expect(res.body.info.database.status).toBe('up');
    });

    it('boş veritabanı açılışta demo verilerle doldurulur', async () => {
      const res = await http.get('/api/v1/reports/dashboard').set(auth('staff')).expect(200);
      expect(res.body.summary.productCount).toBeGreaterThan(100);
      expect(res.body.criticalProducts.length).toBeGreaterThan(0);
      expect(res.body.movementTrend).toHaveLength(31);
    });

    it('token olmadan korumalı endpoint 401 döner', async () => {
      const res = await http.get('/api/v1/products').expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, path: '/api/v1/products' });
      expect(res.body.requestId).toBeDefined();
    });

    it('geçersiz sorgu parametresi standart doğrulama hatası döner', async () => {
      const res = await http.get('/api/v1/products?limit=1000').set(auth('staff')).expect(400);
      expect(res.body.message).toBe('Doğrulama hatası');
      expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining('limit')]));
    });
  });

  describe('Auth', () => {
    it('hatalı şifre 401 döner', async () => {
      await http
        .post('/api/v1/auth/login')
        .send({ email: 'admin@stokify.com', password: 'yanlis-sifre' })
        .expect(401);
    });

    it('GET /auth/me oturumdaki kullanıcıyı döner', async () => {
      const res = await http.get('/api/v1/auth/me').set(auth('manager')).expect(200);
      expect(res.body).toMatchObject({ email: 'manager@stokify.com', role: 'MANAGER' });
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('STAFF kullanıcı listesine erişemez', async () => {
      await http.get('/api/v1/users').set(auth('staff')).expect(403);
    });
  });

  describe('Ürün ve stok akışı', () => {
    let productId: string;
    let warehouses: { id: string; code: string }[];

    beforeAll(async () => {
      warehouses = (await http.get('/api/v1/warehouses').set(auth('staff'))).body;
      const categories = (await http.get('/api/v1/categories?limit=1').set(auth('staff'))).body;

      const res = await http
        .post('/api/v1/products')
        .set(auth('manager'))
        .send({
          sku: 'e2e-0001',
          name: 'E2E Test Ürünü',
          categoryId: categories.data[0].id,
          purchasePrice: 10,
          salePrice: 15,
          minStockLevel: 5,
        })
        .expect(201);
      productId = res.body.id;
      expect(res.body.sku).toBe('E2E-0001');
    });

    it('STAFF ürün oluşturamaz', async () => {
      await http.post('/api/v1/products').set(auth('staff')).send({}).expect(403);
    });

    it('aynı SKU ile ikinci ürün 409 döner', async () => {
      const product = (await http.get(`/api/v1/products/${productId}`).set(auth('staff'))).body;
      await http
        .post('/api/v1/products')
        .set(auth('manager'))
        .send({
          sku: 'E2E-0001',
          name: 'Kopya',
          categoryId: product.categoryId,
          purchasePrice: 1,
          salePrice: 2,
        })
        .expect(409);
    });

    it('giriş, çıkış ve transfer sonrası depo bazlı stoklar tutarlıdır', async () => {
      const [w1, w2] = warehouses;

      await http
        .post('/api/v1/stock/in')
        .set(auth('staff'))
        .send({ productId, warehouseId: w1.id, quantity: 20 })
        .expect(201);
      await http
        .post('/api/v1/stock/out')
        .set(auth('staff'))
        .send({ productId, warehouseId: w1.id, quantity: 4 })
        .expect(201);
      await http
        .post('/api/v1/stock/transfer')
        .set(auth('staff'))
        .send({ productId, fromWarehouseId: w1.id, toWarehouseId: w2.id, quantity: 6 })
        .expect(201);

      const res = await http.get(`/api/v1/products/${productId}`).set(auth('staff')).expect(200);
      const byCode = Object.fromEntries(
        res.body.stocks.map((s: { warehouse: { code: string }; quantity: number }) => [
          s.warehouse.code,
          s.quantity,
        ]),
      );
      expect(byCode[w1.code]).toBe(10);
      expect(byCode[w2.code]).toBe(6);
      expect(res.body.totalStock).toBe(16);
      expect(res.body.stockStatus).toBe('in_stock');
    });

    it('yetersiz stokta çıkış reddedilir', async () => {
      const res = await http
        .post('/api/v1/stock/out')
        .set(auth('staff'))
        .send({ productId, warehouseId: warehouses[0].id, quantity: 999 })
        .expect(400);
      expect(res.body.message).toContain('Yetersiz stok');
    });

    it('eşzamanlı çıkışlar stoğu negatife düşürmez', async () => {
      const warehouseId = warehouses[0].id;
      const results = await Promise.all(
        Array.from({ length: 15 }, () =>
          http
            .post('/api/v1/stock/out')
            .set(auth('staff'))
            .send({ productId, warehouseId, quantity: 1 }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(10);

      const product = (await http.get(`/api/v1/products/${productId}`).set(auth('staff'))).body;
      const stock = product.stocks.find(
        (s: { warehouseId: string }) => s.warehouseId === warehouseId,
      );
      expect(stock.quantity).toBe(0);
    });

    it('sayım düzeltmesi sadece yönetici tarafından yapılabilir', async () => {
      const body = { productId, warehouseId: warehouses[1].id, countedQuantity: 4, note: 'Sayım' };
      await http.post('/api/v1/stock/adjust').set(auth('staff')).send(body).expect(403);
      const res = await http
        .post('/api/v1/stock/adjust')
        .set(auth('manager'))
        .send(body)
        .expect(201);
      expect(res.body.quantity).toBe(-2);
    });

    it('hareket geçmişi ürüne göre filtrelenebilir', async () => {
      const res = await http
        .get(`/api/v1/stock/movements?productId=${productId}&limit=50`)
        .set(auth('staff'))
        .expect(200);
      const types = res.body.data.map((m: { type: string }) => m.type);
      expect(types).toEqual(expect.arrayContaining(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT']));
      expect(res.body.meta.total).toBe(res.body.data.length);
    });

    it('ürün silindiğinde soft delete uygulanır', async () => {
      await http.delete(`/api/v1/products/${productId}`).set(auth('manager')).expect(200);
      await http.get(`/api/v1/products/${productId}`).set(auth('staff')).expect(404);
    });
  });

  describe('Satın alma siparişi akışı', () => {
    it('taslak → sipariş → teslim alındı akışında stok artar ve audit kaydı düşer', async () => {
      const [supplier] = (await http.get('/api/v1/suppliers?limit=1').set(auth('staff'))).body.data;
      const [warehouse] = (await http.get('/api/v1/warehouses').set(auth('staff'))).body;
      const [product] = (await http.get('/api/v1/products?limit=1').set(auth('staff'))).body.data;

      const before = (await http.get(`/api/v1/products/${product.id}`).set(auth('staff'))).body;

      const created = await http
        .post('/api/v1/purchase-orders')
        .set(auth('manager'))
        .send({
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          items: [{ productId: product.id, quantity: 7, unitCost: 12.5 }],
        })
        .expect(201);
      expect(created.body.status).toBe('DRAFT');
      expect(created.body.totalAmount).toBe(87.5);

      const id = created.body.id;
      await http.post(`/api/v1/purchase-orders/${id}/receive`).set(auth('staff')).expect(409);
      await http.post(`/api/v1/purchase-orders/${id}/order`).set(auth('manager')).expect(200);
      const received = await http
        .post(`/api/v1/purchase-orders/${id}/receive`)
        .set(auth('staff'))
        .expect(200);
      expect(received.body.status).toBe('RECEIVED');
      await http.post(`/api/v1/purchase-orders/${id}/receive`).set(auth('staff')).expect(409);

      const after = (await http.get(`/api/v1/products/${product.id}`).set(auth('staff'))).body;
      expect(after.totalStock).toBe(before.totalStock + 7);

      // Audit log interceptor'ı asenkron yazar
      await new Promise((r) => setTimeout(r, 200));
      const audit = await http
        .get(`/api/v1/audit-logs?entity=PurchaseOrder&entityId=${id}`)
        .set(auth('admin'))
        .expect(200);
      expect(audit.body.data.map((a: { action: string }) => a.action)).toEqual(
        expect.arrayContaining(['CREATE', 'ORDER', 'RECEIVE']),
      );
    });
  });

  describe('Raporlar', () => {
    it('ürün CSV dışa aktarımı Excel uyumludur', async () => {
      const res = await http
        .get('/api/v1/reports/export/products')
        .set(auth('manager'))
        .expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.startsWith('\uFEFFSKU;Barkod')).toBe(true);
    });
  });
});
