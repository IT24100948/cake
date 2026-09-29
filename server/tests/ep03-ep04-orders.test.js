const { request, app, pool, query, resetAndSeed, staffAgent, customerAgent, productId, stockOf, dayOffset } = require('./helpers');

beforeAll(resetAndSeed);
afterAll(() => pool.end());

const unread = async (agent) => (await agent.get('/api/my/notifications/unread-count')).body.count;

describe('EP03 - Customer & Cake Order Management', () => {
  let customer;
  let staff;
  let orderId;
  let simpleOrderId;

  test('US12 - customer registers, is logged in, and can update the profile', async () => {
    const agent = request.agent(app);
    const bad = await agent.post('/api/auth/customer/register').send({ fullName: 'N', email: 'x', phone: '12', password: 'short', confirmPassword: 'nope' });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.errors)).toEqual(expect.arrayContaining(['fullName', 'email', 'phone', 'password', 'confirmPassword']));
    const res = await agent.post('/api/auth/customer/register').send({
      fullName: 'Nethmi Test', email: 'nethmi@example.com', phone: '0771234000', address: '1 Main St', city: 'Galle',
      password: 'Secret123', confirmPassword: 'Secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body.customer.password_hash).toBeUndefined();
    expect((await agent.get('/api/auth/customer/me')).body.customer.email).toBe('nethmi@example.com');
    const dup = await request(app).post('/api/auth/customer/register').send({
      fullName: 'Other', email: 'nethmi@example.com', phone: '0771234001', password: 'Secret123', confirmPassword: 'Secret123',
    });
    expect(dup.status).toBe(422);
    const upd = await agent.put('/api/customer/profile').send({ fullName: 'Nethmi Updated', phone: '0771234002', address: '2 Main St', city: 'Galle' });
    expect(upd.body.customer.full_name).toBe('Nethmi Updated');
    // Customer tokens cannot reach staff APIs.
    expect((await agent.get('/api/orders')).status).toBe(401);
    customer = agent;
    staff = await staffAgent('staff@devma.lk');
  });

  test('US15 - order validation: empty order, past date, missing address, over-stock', async () => {
    const empty = await customer.post('/api/orders').send({ items: [], fulfillmentType: 'COLLECTION', eventDate: dayOffset(3) });
    expect(empty.status).toBe(422);
    const past = await customer.post('/api/orders').send({ items: [{ productId: await productId('CK-RIBBON'), quantity: 1 }], fulfillmentType: 'COLLECTION', eventDate: dayOffset(0) });
    expect(past.status).toBe(422);
    expect(past.body.errors.eventDate).toBeDefined();
    const noAddr = await customer.post('/api/orders').send({ items: [{ productId: await productId('CK-RIBBON'), quantity: 1 }], fulfillmentType: 'DELIVERY', eventDate: dayOffset(3) });
    expect(noAddr.status).toBe(422);
    expect(noAddr.body.errors['delivery.address']).toBeDefined();
    const over = await customer.post('/api/orders').send({ items: [{ productId: await productId('CK-REDVEL'), quantity: 50 }], fulfillmentType: 'COLLECTION', eventDate: dayOffset(3) });
    expect(over.status).toBe(422);
    const outOfStock = await customer.post('/api/orders').send({ items: [{ productId: await productId('CK-JAR-6'), quantity: 1 }], fulfillmentType: 'COLLECTION', eventDate: dayOffset(3) });
    expect(outOfStock.status).toBe(422);
    const unavailable = await customer.post('/api/orders').send({ items: [{ productId: await productId('CK-WED-PCS'), quantity: 1 }], fulfillmentType: 'COLLECTION', eventDate: dayOffset(3) });
    expect(unavailable.status).toBe(422);
  });

  test('US13 + US14 + US15 - submit order with cake requirements, decorations and a reference image', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const payload = {
      items: [
        { productId: await productId('DC-BAL-PST25'), quantity: 2 },
        { productId: await productId('DC-TBL-CNDL'), quantity: 1, notes: 'Number 5' },
      ],
      cakeRequirement: {
        occasion: 'Birthday', flavor: 'Chocolate', weightKg: 2, shape: 'Round', tiers: 1,
        icingType: 'Buttercream', colors: 'Blue', theme: 'Space', messageOnCake: 'Happy 5th Birthday Dinuk',
      },
      fulfillmentType: 'DELIVERY', eventDate: dayOffset(4), notes: 'Ring the bell twice',
      delivery: { address: '2 Main St', city: 'Galle', preferredTimeSlot: '9am - 12pm' },
    };
    const res = await customer.post('/api/orders').field('payload', JSON.stringify(payload)).attach('referenceImage', png, { filename: 'ref.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.order.order_number).toMatch(/^DCP-\d{8}-\d{4}$/);
    expect(res.body.order.status).toBe('PENDING');
    orderId = res.body.order.id;
    const detail = (await customer.get(`/api/my/orders/${orderId}`)).body.order;
    expect(detail.items).toHaveLength(2);
    expect(detail.subtotal).toBe(2 * 1200 + 250);
    expect(detail.cakeRequirement.message_on_cake).toBe('Happy 5th Birthday Dinuk');
    expect(detail.cakeRequirement.reference_image_url).toMatch(/^\/uploads\//);
    expect(detail.delivery.address).toBe('2 Main St');
    expect(detail.staff_notes).toBeUndefined();
    // Stock is NOT deducted until confirmation.
    expect(await stockOf('DC-BAL-PST25')).toBe(40);

    const simple = await customer.post('/api/orders').send({
      items: [{ productId: await productId('CK-RIBBON'), quantity: 1 }], fulfillmentType: 'COLLECTION', eventDate: dayOffset(2),
    });
    simpleOrderId = simple.body.order.id;
  });

  test('US18 - customer sees only their own orders and history', async () => {
    const list = await customer.get('/api/my/orders');
    expect(list.body.data.map((o) => o.id).sort()).toEqual([orderId, simpleOrderId].sort());
    const other = await customerAgent();
    expect((await other.get(`/api/my/orders/${orderId}`)).status).toBe(404);
    expect((await other.get('/api/my/orders')).body.data).toHaveLength(0);
  });

  test('US16 - staff view customer and order details', async () => {
    const list = await staff.get('/api/orders?status=PENDING&search=Nethmi');
    expect(list.body.data).toHaveLength(2);
    const detail = (await staff.get(`/api/orders/${orderId}`)).body.order;
    expect(detail.customer_name).toBe('Nethmi Updated');
    expect(detail.allowed_next_statuses).toEqual(['REJECTED', 'CANCELLED']);
    const customers = await staff.get('/api/customers?search=Nethmi');
    expect(customers.body.data[0].order_count).toBe(2);
    const cust = await staff.get(`/api/customers/${customers.body.data[0].id}`);
    expect(cust.body.orders).toHaveLength(2);
  });

  test('US17 - staff update order details while pending', async () => {
    const res = await staff.put(`/api/orders/${orderId}`).send({
      items: [{ productId: await productId('DC-BAL-PST25'), quantity: 3 }, { productId: await productId('DC-TBL-CNDL'), quantity: 1, notes: 'Number 5' }],
      staffNotes: 'Customer called to add one more balloon pack',
    });
    expect(res.status).toBe(200);
    expect(res.body.order.subtotal).toBe(3 * 1200 + 250);
    expect(res.body.order.staff_notes).toMatch(/balloon/);
  });

  describe('EP04 - Order Confirmation, Payment & Delivery Management', () => {
    test('US19 - confirming a custom-cake order requires a quote, then deducts stock', async () => {
      const noQuote = await staff.patch(`/api/orders/${orderId}/confirm`).send({ deliveryFee: 400 });
      expect(noQuote.status).toBe(422);
      const before = await unread(customer);
      const res = await staff.patch(`/api/orders/${orderId}/confirm`).send({ cakeQuote: 6500, deliveryFee: 400, note: 'Space theme approved' });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('CONFIRMED');
      expect(res.body.order.total_amount).toBe(3 * 1200 + 250 + 6500 + 400);
      expect(await stockOf('DC-BAL-PST25')).toBe(37);
      expect(await stockOf('DC-TBL-CNDL')).toBe(59);
      expect(await unread(customer)).toBe(before + 1);
      const again = await staff.patch(`/api/orders/${orderId}/confirm`).send({ cakeQuote: 1 });
      expect(again.status).toBe(400);
    });

    test('US17 - invalid status transitions are rejected', async () => {
      const res = await staff.patch(`/api/orders/${orderId}/status`).send({ status: 'COMPLETED' });
      expect(res.status).toBe(400);
      const collection = await staff.patch(`/api/orders/${orderId}/status`).send({ status: 'READY_FOR_COLLECTION' });
      expect(collection.status).toBe(400);
    });

    test('US20 - record payments: pending orders blocked, overpayment rejected, reference required', async () => {
      const pending = await staff.post(`/api/orders/${simpleOrderId}/payments`).send({ amount: 100, method: 'CASH' });
      expect(pending.status).toBe(400);
      const noRef = await staff.post(`/api/orders/${orderId}/payments`).send({ amount: 1000, method: 'BANK_TRANSFER' });
      expect(noRef.status).toBe(422);
      const over = await staff.post(`/api/orders/${orderId}/payments`).send({ amount: 999999, method: 'CASH' });
      expect(over.status).toBe(422);
      const part = await staff.post(`/api/orders/${orderId}/payments`).send({ amount: 5000, method: 'BANK_TRANSFER', referenceNo: 'BOC-1' });
      expect(part.status).toBe(201);
      expect(part.body.order.payment_status).toBe('PARTIALLY_PAID');
      expect(part.body.order.balance_due).toBe(10750 - 5000);
    });

    test('US21 - manual payment status updates are validated against recorded payments', async () => {
      const toPaid = await staff.patch(`/api/orders/${orderId}/payment-status`).send({ paymentStatus: 'PAID' });
      expect(toPaid.status).toBe(400);
      const toUnpaid = await staff.patch(`/api/orders/${orderId}/payment-status`).send({ paymentStatus: 'UNPAID' });
      expect(toUnpaid.status).toBe(400);
    });

    test('US22 - schedule delivery, assign staff and notify the customer', async () => {
      const bad = await staff.put(`/api/orders/${orderId}/delivery`).send({ type: 'DELIVERY', recipientName: 'Nethmi', contactPhone: '0771234002' });
      expect(bad.status).toBe(422);
      const before = await unread(customer);
      const res = await staff.put(`/api/orders/${orderId}/delivery`).send({
        type: 'DELIVERY', recipientName: 'Nethmi Updated', contactPhone: '0771234002', address: '2 Main St', city: 'Galle',
        scheduledDate: dayOffset(4), scheduledTimeSlot: '9am - 12pm', assignedStaffId: 2, notes: 'Fragile',
      });
      expect(res.status).toBe(200);
      expect(res.body.order.delivery.status).toBe('SCHEDULED');
      expect(res.body.order.delivery.assigned_staff_name).toBe('Nimali Perera');
      expect(await unread(customer)).toBe(before + 1);
      const board = await staff.get(`/api/deliveries?date=${dayOffset(4)}`);
      expect(board.body.data.map((d) => d.order_id)).toContain(orderId);
    });

    test('US23 - status moves through to completion; completion requires full payment', async () => {
      for (const s of ['IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY']) {
        const r = await staff.patch(`/api/orders/${orderId}/status`).send({ status: s });
        expect(r.status).toBe(200);
      }
      const early = await staff.patch(`/api/orders/${orderId}/status`).send({ status: 'COMPLETED' });
      expect(early.status).toBe(400);
      expect(early.body.message).toMatch(/fully paid/);
      await staff.post(`/api/orders/${orderId}/payments`).send({ amount: 5750, method: 'CASH' }).expect(201);
      const delivery = (await staff.get(`/api/orders/${orderId}`)).body.order.delivery;
      const done = await staff.patch(`/api/deliveries/${delivery.id}/status`).send({ status: 'DELIVERED' });
      expect(done.status).toBe(200);
      const final = (await staff.get(`/api/orders/${orderId}`)).body.order;
      expect(final.status).toBe('COMPLETED');
      expect(final.payment_status).toBe('PAID');
      expect(final.delivery.status).toBe('DELIVERED');
      expect(final.allowed_next_statuses).toEqual([]);
      expect(final.history.map((h) => h.to_status)).toEqual(
        ['PENDING', 'PENDING', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
      );
    });

    test('US24 - customer receives notifications for every stage', async () => {
      const res = await customer.get('/api/my/notifications?limit=50');
      const titles = res.body.data.map((n) => n.title);
      expect(titles).toEqual(expect.arrayContaining([
        'Order received', 'Order updated', 'Order confirmed', 'Payment received', 'Delivery scheduled',
        'Order in preparation', 'Order ready', 'Order out for delivery', 'Order completed',
      ]));
      await customer.patch('/api/my/notifications/read-all').expect(200);
      expect(await unread(customer)).toBe(0);
      const history = (await customer.get(`/api/my/orders/${orderId}`)).body.order.history;
      expect(history[history.length - 1].to_status).toBe('COMPLETED');
      expect(history[0].staff_name).toBeUndefined();
    });

    test('Cancelling a confirmed order restores stock; customers can cancel only pending orders', async () => {
      const staffOrder = await customer.post('/api/orders').send({
        items: [{ productId: await productId('DC-BAL-ARCH'), quantity: 2 }], fulfillmentType: 'COLLECTION', eventDate: dayOffset(6),
      });
      const id = staffOrder.body.order.id;
      await staff.patch(`/api/orders/${id}/confirm`).send({}).expect(200);
      expect(await stockOf('DC-BAL-ARCH')).toBe(10);
      expect((await customer.patch(`/api/my/orders/${id}/cancel`).send({})).status).toBe(400);
      expect((await staff.patch(`/api/orders/${id}/status`).send({ status: 'CANCELLED' })).status).toBe(422);
      await staff.patch(`/api/orders/${id}/status`).send({ status: 'CANCELLED', note: 'Event postponed' }).expect(200);
      expect(await stockOf('DC-BAL-ARCH')).toBe(12);

      await customer.patch(`/api/my/orders/${simpleOrderId}/cancel`).send({ reason: 'Changed my mind' }).expect(200);
      const o = (await customer.get(`/api/my/orders/${simpleOrderId}`)).body.order;
      expect(o.status).toBe('CANCELLED');
      expect(o.cancel_reason).toBe('Changed my mind');
    });

    test('Confirmation fails cleanly when stock ran out after the order was placed', async () => {
      const o = await customer.post('/api/orders').send({
        items: [{ productId: await productId('CK-REDVEL'), quantity: 2 }], fulfillmentType: 'COLLECTION', eventDate: dayOffset(5),
      });
      const admin = await staffAgent();
      await admin.post(`/api/inventory/${await productId('CK-REDVEL')}/adjust`).send({ type: 'ADJUSTMENT', mode: 'SET', quantity: 1, reason: 'Sold in shop' }).expect(200);
      const res = await staff.patch(`/api/orders/${o.body.order.id}/confirm`).send({});
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Insufficient stock/);
      const [row] = await query('SELECT status, stock_deducted FROM orders WHERE id = ?', [o.body.order.id]);
      expect(row).toEqual({ status: 'PENDING', stock_deducted: 0 });
      expect(await stockOf('CK-REDVEL')).toBe(1);
    });

    test('Audit trail records order, payment and delivery actions', async () => {
      const admin = await staffAgent();
      const actions = (await admin.get('/api/audit-logs?limit=100')).body.data.map((a) => a.action);
      expect(actions).toEqual(expect.arrayContaining([
        'ORDER_PLACED', 'ORDER_UPDATED', 'ORDER_CONFIRMED', 'PAYMENT_RECORDED', 'DELIVERY_UPDATED',
        'ORDER_STATUS_CHANGED', 'DELIVERY_STATUS_CHANGED', 'ORDER_CANCELLED_BY_CUSTOMER', 'STOCK_ADJUSTED',
      ]));
    });
  });
});

describe('Management & Reporting', () => {
  test('dashboard reports return consistent figures', async () => {
    const admin = await staffAgent();
    const summary = (await admin.get('/api/reports/summary')).body;
    expect(summary.revenue_today).toBe(10750);
    expect(summary.pending_orders).toBe(1);
    const sales = (await admin.get('/api/reports/sales')).body;
    expect(sales.series).toHaveLength(30);
    expect(sales.totals.revenue).toBe(10750);
    const top = (await admin.get('/api/reports/top-products')).body.data;
    expect(top[0].product_name).toMatch(/Balloon|Candles|Red Velvet/);
    const low = (await admin.get('/api/reports/low-stock')).body.data;
    expect(low.every((p) => p.stock_quantity <= p.reorder_level)).toBe(true);
    const staff = await staffAgent('staff@devma.lk');
    expect((await staff.get('/api/reports/summary')).status).toBe(403);
  });
});
