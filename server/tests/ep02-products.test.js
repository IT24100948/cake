const path = require('path');
const fs = require('fs');
const { request, app, pool, resetAndSeed, staffAgent, stockOf, productId } = require('./helpers');

beforeAll(resetAndSeed);
afterAll(() => pool.end());

describe('EP02 - Cake, Party Decoration Product & Inventory Management', () => {
  let admin;
  let createdId;
  beforeAll(async () => { admin = await staffAgent(); });

  test('US07 - admin adds a product with an image', async () => {
    const cats = (await request(app).get('/api/categories?type=DECORATION')).body.data;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const res = await admin.post('/api/products')
      .field('name', 'Confetti Balloons (10)')
      .field('sku', 'dc-bal-conf')
      .field('price', '1500')
      .field('productType', 'DECORATION')
      .field('categoryId', String(cats[0].id))
      .field('stockQuantity', '20')
      .field('reorderLevel', '5')
      .field('description', 'Clear balloons filled with gold confetti')
      .attach('image', png, { filename: 'b.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.product.sku).toBe('DC-BAL-CONF');
    expect(res.body.product.image_url).toMatch(/^\/uploads\/.+\.png$/);
    createdId = res.body.product.id;
    const file = path.join(__dirname, '..', 'uploads', path.basename(res.body.product.image_url));
    expect(fs.existsSync(file)).toBe(true);
    const hist = await admin.get(`/api/inventory/${createdId}/history`);
    expect(hist.body.data[0].type).toBe('INITIAL');
  });

  test('US07 - validation: bad price, wrong category type, duplicate SKU, non-image file', async () => {
    const cakeCat = (await request(app).get('/api/categories?type=CAKE')).body.data[0];
    const base = { name: 'Test', sku: 'TST-001', price: 100, productType: 'DECORATION', categoryId: cakeCat.id, stockQuantity: 1, reorderLevel: 1 };
    expect((await admin.post('/api/products').send({ ...base, price: -5 })).status).toBe(422);
    const mismatch = await admin.post('/api/products').send(base);
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.errors.categoryId).toBeDefined();
    expect((await admin.post('/api/products').send({ ...base, productType: 'CAKE', sku: 'DC-BAL-CONF' })).status).toBe(409);
    const txt = await admin.post('/api/products').field('name', 'X').attach('image', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(422);
  });

  test('US08 - staff view and search products', async () => {
    const staff = await staffAgent('staff@devma.lk');
    const res = await staff.get('/api/products?search=balloon');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p) => /balloon/i.test(p.name + p.description + p.category_name))).toBe(true);
    const low = await staff.get('/api/products?lowStock=true');
    expect(low.body.data.every((p) => p.is_low_stock)).toBe(true);
    // Shop staff can view but not add products.
    expect((await staff.post('/api/products').send({})).status).toBe(403);
  });

  test('US09 - admin updates price, description and availability', async () => {
    const before = (await admin.get(`/api/products/${createdId}`)).body.product;
    const res = await admin.put(`/api/products/${createdId}`).send({
      name: before.name, sku: before.sku, description: 'Updated description', price: 1650, productType: 'DECORATION',
      categoryId: before.category_id, reorderLevel: 6, isAvailable: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.product.price).toBe(1650);
    expect(res.body.product.stock_quantity).toBe(20); // stock is managed only through inventory
    await admin.patch(`/api/products/${createdId}/availability`).send({ isAvailable: false }).expect(200);
    const pub = await request(app).get(`/api/catalog/products/${createdId}`);
    expect(pub.status).toBe(404);
  });

  test('US10 - manage inventory quantities; stock never goes negative', async () => {
    const id = await productId('DC-BAN-HBD');
    const start = await stockOf('DC-BAN-HBD');
    await admin.post(`/api/inventory/${id}/adjust`).send({ type: 'RESTOCK', quantity: 10, reason: 'Supplier delivery' }).expect(200);
    expect(await stockOf('DC-BAN-HBD')).toBe(start + 10);
    await admin.post(`/api/inventory/${id}/adjust`).send({ type: 'ADJUSTMENT', mode: 'REMOVE', quantity: 2, reason: 'Damaged' }).expect(200);
    expect(await stockOf('DC-BAN-HBD')).toBe(start + 8);
    await admin.post(`/api/inventory/${id}/adjust`).send({ type: 'ADJUSTMENT', mode: 'SET', quantity: 30, reason: 'Stock take' }).expect(200);
    expect(await stockOf('DC-BAN-HBD')).toBe(30);
    const neg = await admin.post(`/api/inventory/${id}/adjust`).send({ type: 'ADJUSTMENT', mode: 'REMOVE', quantity: 999, reason: 'Oops' });
    expect(neg.status).toBe(422);
    expect(await stockOf('DC-BAN-HBD')).toBe(30);
    const noReason = await admin.post(`/api/inventory/${id}/adjust`).send({ type: 'RESTOCK', quantity: 1 });
    expect(noReason.status).toBe(422);
    const hist = await admin.get(`/api/inventory/${id}/history`);
    expect(hist.body.data.slice(0, 3).map((h) => h.change_qty)).toEqual([30 - (start + 8), -2, 10]);
    const inv = await admin.get('/api/inventory?status=low');
    expect(inv.body.summary.total_products).toBeGreaterThan(0);
  });

  test('US11 - customers browse only available products, with filters', async () => {
    const all = await request(app).get('/api/catalog/products?limit=100');
    expect(all.status).toBe(200);
    expect(all.body.data.every((p) => p.is_available)).toBe(true);
    expect(all.body.data[0].reorder_level).toBeUndefined();
    const cakes = await request(app).get('/api/catalog/products?type=CAKE&sort=price_asc&limit=100');
    const prices = cakes.body.data.map((p) => p.price);
    expect(cakes.body.data.every((p) => p.product_type === 'CAKE')).toBe(true);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const search = await request(app).get('/api/catalog/products?search=ribbon');
    expect(search.body.data[0].sku).toBe('CK-RIBBON');
  });
});
