const { pool, query, resetAndSeed, staffAgent, customerAgent, productId, dayOffset } = require('./helpers');

beforeAll(resetAndSeed);
afterAll(() => pool.end());

const CAKE = { occasion: 'Birthday', flavor: 'Chocolate', weightKg: 1, shape: 'Round', tiers: 1 };
const card = (number, extra = {}) => ({
  cardholderName: 'Test Customer', cardNumber: number, expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', ...extra,
});
/** Accepted when verified at checkout, declined (insufficient funds) when charged on confirmation. */
const CHARGE_FAILS = '4000000000009995';
let keySeq = 0;
const key = () => `test-key-${Date.now()}-${(keySeq += 1)}`;
const countOrders = async () => (await query('SELECT COUNT(*) AS n FROM orders'))[0].n;

describe('Payments - options, card at checkout, gateway, cash on delivery and refunds', () => {
  let customer;
  let staff;
  let admin;

  beforeAll(async () => {
    customer = await customerAgent();
    staff = await staffAgent('staff@devma.lk');
    admin = await staffAgent();
  });

  // Pastel balloons: LKR 1,200 each, 40 in stock (enough for every order in this file).
  const decorations = async (qty = 1) => [{ productId: await productId('DC-BAL-PST25'), quantity: qty }];
  const placeCod = async (qty = 1) => (await customer.post('/api/orders').send({
    items: await decorations(qty), fulfillmentType: 'COLLECTION', eventDate: dayOffset(2), paymentOption: 'CASH_ON_DELIVERY',
  })).body.order.id;
  const placeOnline = async (number = '4242424242424242', qty = 1) => {
    const res = await customer.post('/api/orders').send({
      items: await decorations(qty), fulfillmentType: 'COLLECTION', eventDate: dayOffset(2), paymentOption: 'ONLINE', card: card(number),
    });
    expect(res.status).toBe(201);
    return res.body.order.id;
  };
  const pay = (orderId, body) => customer.post(`/api/my/orders/${orderId}/pay`).send({ idempotencyKey: key(), ...body });

  test('paying online needs a valid card at checkout; declined cards place no order', async () => {
    const base = { items: await decorations(), fulfillmentType: 'COLLECTION', eventDate: dayOffset(2) };

    const noOption = await customer.post('/api/orders').send(base);
    expect(noOption.status).toBe(422);
    expect(noOption.body.errors.paymentOption).toBeDefined();

    const before = await countOrders();
    const noCard = await customer.post('/api/orders').send({ ...base, paymentOption: 'ONLINE' });
    expect(noCard.status).toBe(422);
    expect(Object.keys(noCard.body.errors)).toEqual(expect.arrayContaining(['card.cardNumber', 'card.expiry', 'card.cvc', 'card.cardholderName']));

    const invalid = await customer.post('/api/orders').send({ ...base, paymentOption: 'ONLINE', card: card('4242 4242 4242 4241', { cvc: '1' }) });
    expect(invalid.status).toBe(422);
    expect(Object.keys(invalid.body.errors)).toEqual(expect.arrayContaining(['card.cardNumber', 'card.cvc']));

    for (const [number, code] of [['4111111111111111', 'not_a_test_card'], ['4000000000000002', 'card_declined'],
      ['4000000000000069', 'expired_card'], ['4000000000000127', 'incorrect_cvc']]) {
      const r = await customer.post('/api/orders').send({ ...base, paymentOption: 'ONLINE', card: card(number) });
      expect(r.status).toBe(402);
      expect(r.body.code).toBe(code);
      expect(r.body.message).toMatch(/not been placed/);
    }
    expect(await countOrders()).toBe(before);

    // A good card: the order is placed, the card is verified and kept as a token - nothing is charged yet.
    const id = await placeOnline('4242 4242 4242 4242');
    const detail = (await customer.get(`/api/my/orders/${id}`)).body.order;
    expect(detail).toMatchObject({ payment_option: 'ONLINE', payment_status: 'UNPAID', can_pay_online: false });
    expect(detail.card_on_file).toMatchObject({ card_brand: 'Visa', card_last4: '4242' });
    expect(await query('SELECT * FROM payment_transactions WHERE order_id = ?', [id])).toHaveLength(0);

    // The card number and CVC are never stored, only a gateway token and the last four digits.
    const [pm] = await query('SELECT pm.* FROM payment_methods pm JOIN orders o ON o.payment_method_id = pm.id WHERE o.id = ?', [id]);
    expect(pm.gateway_token).toMatch(/^pm_/);
    expect(JSON.stringify(pm)).not.toMatch(/4242424242424242|"123"/);
    const audits = (await admin.get('/api/audit-logs?limit=50')).body.data.map((a) => a.action);
    expect(audits).toContain('PAYMENT_CARD_DECLINED');
  });

  test('custom cakes are pre-orders: online payment only, with at least 3 days notice', async () => {
    const cod = await customer.post('/api/orders').send({
      cakeRequirement: CAKE, fulfillmentType: 'COLLECTION', eventDate: dayOffset(5), paymentOption: 'CASH_ON_DELIVERY',
    });
    expect(cod.status).toBe(422);
    expect(cod.body.errors.paymentOption).toMatch(/paid online in advance/);

    const tooSoon = await customer.post('/api/orders').send({
      cakeRequirement: CAKE, fulfillmentType: 'COLLECTION', eventDate: dayOffset(2), paymentOption: 'ONLINE', card: card('4242424242424242'),
    });
    expect(tooSoon.status).toBe(422);
    expect(tooSoon.body.errors.eventDate).toMatch(/at least 3 days/);

    const ok = await customer.post('/api/orders').send({
      cakeRequirement: CAKE, fulfillmentType: 'COLLECTION', eventDate: dayOffset(3), paymentOption: 'ONLINE', card: card('4242424242424242'),
    });
    expect(ok.status).toBe(201);
  });

  test('decoration orders can be cash on delivery (no card) or online', async () => {
    const bad = await customer.post('/api/orders').send({
      items: await decorations(), fulfillmentType: 'COLLECTION', eventDate: dayOffset(2), paymentOption: 'CHEQUE',
    });
    expect(bad.status).toBe(422);
    const cod = await placeCod();
    const detail = (await customer.get(`/api/my/orders/${cod}`)).body.order;
    expect(detail).toMatchObject({ payment_option: 'CASH_ON_DELIVERY', card_on_file: null });
    const online = await placeOnline();
    expect((await customer.get(`/api/my/orders/${online}`)).body.order.payment_option).toBe('ONLINE');
  });

  test('confirming a pay-online order charges the card from checkout automatically', async () => {
    const id = await placeOnline('5555 5555 5555 4444', 2);
    const res = await staff.patch(`/api/orders/${id}/confirm`).send({});
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ payment_status: 'PAID', balance_due: 0, awaiting_prepayment: false, last_payment_error: null });
    expect(res.body.order.payments).toHaveLength(1);
    expect(res.body.order.payments[0]).toMatchObject({ kind: 'PAYMENT', method: 'CARD', card_brand: 'Mastercard', card_last4: '4444', amount: 2400 });
    // Already paid, so preparation can start straight away.
    await staff.patch(`/api/orders/${id}/status`).send({ status: 'IN_PREPARATION' }).expect(200);
    const titles = (await customer.get('/api/my/notifications?limit=20')).body.data.map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining(['Order confirmed', 'Payment received']));
  });

  test('if the charge on confirmation fails, the customer pays from the order page (validated, idempotent)', async () => {
    const id = await placeOnline(CHARGE_FAILS, 2);
    const due = 2 * 1200;
    expect((await pay(id, card('4242424242424242'))).status).toBe(400); // still pending: total not final
    const confirmed = await staff.patch(`/api/orders/${id}/confirm`).send({});
    expect(confirmed.body.order).toMatchObject({ payment_status: 'UNPAID', awaiting_prepayment: true, can_pay_online: true, balance_due: due });
    expect(confirmed.body.order.last_payment_error).toMatch(/insufficient funds/);
    expect((await customer.get('/api/my/notifications?limit=5')).body.data.map((n) => n.title)).toContain('Payment failed');
    expect((await staff.patch(`/api/orders/${id}/status`).send({ status: 'IN_PREPARATION' })).status).toBe(400);

    const invalid = await pay(id, card('4242 4242 4242 4241', { expMonth: 1, expYear: 2020, cvc: '1' }));
    expect(invalid.status).toBe(422);
    expect(Object.keys(invalid.body.errors)).toEqual(expect.arrayContaining(['cardNumber', 'expiry', 'cvc']));

    const realCard = await pay(id, card('4111111111111111'));
    expect(realCard.status).toBe(402);
    expect(realCard.body.code).toBe('not_a_test_card');
    for (const [number, code] of [['4000000000000002', 'card_declined'], [CHARGE_FAILS, 'insufficient_funds'], ['4000000000000069', 'expired_card'], ['4000000000000127', 'incorrect_cvc']]) {
      const r = await pay(id, card(number));
      expect(r.status).toBe(402);
      expect(r.body.code).toBe(code);
    }
    expect((await customer.get(`/api/my/orders/${id}`)).body.order.payments).toHaveLength(0);

    expect((await pay(id, card('4242424242424242', { amount: due - 100 }))).status).toBe(409); // amount shown is out of date

    const idem = key();
    const ok = await customer.post(`/api/my/orders/${id}/pay`).send({ ...card('5555 5555 5555 4444'), amount: due, idempotencyKey: idem });
    expect(ok.status).toBe(201);
    expect(ok.body.transaction).toMatchObject({ status: 'SUCCEEDED', amount: due, cardBrand: 'Mastercard', cardLast4: '4444' });
    expect(ok.body.transaction.gatewayRef).toMatch(/^ch_/);
    expect(ok.body.order).toMatchObject({ payment_status: 'PAID', balance_due: 0, last_payment_error: null });

    // Same request again (double-click or network retry): same result, charged once.
    const again = await customer.post(`/api/my/orders/${id}/pay`).send({ ...card('5555 5555 5555 4444'), amount: due, idempotencyKey: idem });
    expect(again.status).toBe(201);
    expect(again.body.transaction.id).toBe(ok.body.transaction.id);
    expect((await customer.get(`/api/my/orders/${id}`)).body.order.payments).toHaveLength(1);
    expect((await pay(id, card('4242424242424242'))).status).toBe(400); // already paid

    const rows = await query('SELECT * FROM payment_transactions WHERE order_id = ?', [id]);
    expect(rows).toHaveLength(7); // failed confirmation charge + real card + 4 test declines + 1 success
    expect(rows.filter((r) => r.status === 'SUCCEEDED')).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toMatch(/5555555555554444|4000000000000002/);
  });

  test('two payments at the same moment cannot both charge the order', async () => {
    const id = await placeOnline(CHARGE_FAILS);
    await staff.patch(`/api/orders/${id}/confirm`).send({}).expect(200);
    const results = await Promise.all([pay(id, card('4242424242424242')), pay(id, card('4242424242424242'))]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM payments WHERE order_id = ? AND kind = 'PAYMENT'", [id]);
    expect(n).toBe(1);
  });

  test('another customer cannot pay an order', async () => {
    const id = await placeOnline(CHARGE_FAILS);
    await staff.patch(`/api/orders/${id}/confirm`).send({}).expect(200);
    await query("UPDATE orders SET customer_id = (SELECT id FROM customers WHERE email = 'ravindu@example.com') WHERE id = ?", [id]);
    expect((await customer.post(`/api/my/orders/${id}/pay`).send({ ...card('4242424242424242'), idempotencyKey: key() })).status).toBe(404);
  });

  test('pre-ordered custom cake: no preparation and no cash until paid online', async () => {
    const id = (await customer.post('/api/orders').send({
      cakeRequirement: CAKE, fulfillmentType: 'DELIVERY', eventDate: dayOffset(4), paymentOption: 'ONLINE', card: card(CHARGE_FAILS),
      delivery: { address: '1 Cake Street', city: 'Colombo' },
    })).body.order.id;
    await staff.patch(`/api/orders/${id}/confirm`).send({ cakeQuote: 6000, deliveryFee: 500 }).expect(200);
    const detail = (await customer.get(`/api/my/orders/${id}`)).body.order;
    expect(detail).toMatchObject({ awaiting_prepayment: true, can_pay_online: true, balance_due: 6500, is_custom_cake: true });

    expect((await staff.patch(`/api/orders/${id}/status`).send({ status: 'IN_PREPARATION' })).status).toBe(400);
    expect((await staff.post(`/api/orders/${id}/payments`).send({ amount: 6500, method: 'CASH' })).status).toBe(422);
    expect((await staff.post(`/api/orders/${id}/payments`).send({ amount: 6500, method: 'CARD', referenceNo: 'POS-1' })).status).toBe(422);

    await pay(id, card('4242424242424242', { amount: 6500 })).then((r) => expect(r.status).toBe(201));
    await staff.patch(`/api/orders/${id}/status`).send({ status: 'IN_PREPARATION' }).expect(200);

    // The total goes up after payment (e.g. a bigger cake): the customer pays only the difference.
    const upd = await staff.put(`/api/orders/${id}`).send({ cakeQuote: 7000 });
    expect(upd.body.order).toMatchObject({ payment_status: 'PARTIALLY_PAID', balance_due: 1000 });
    const diff = await pay(id, card('4242424242424242', { amount: 1000 }));
    expect(diff.status).toBe(201);
    expect(diff.body.order).toMatchObject({ payment_status: 'PAID', amount_paid: 7500 }); // 7000 cake + 500 delivery
  });

  test('cash on delivery: prepared without payment, completed only after the cash is recorded', async () => {
    const id = await placeCod();
    await staff.patch(`/api/orders/${id}/confirm`).send({}).expect(200);
    for (const s of ['IN_PREPARATION', 'READY', 'READY_FOR_COLLECTION']) {
      await staff.patch(`/api/orders/${id}/status`).send({ status: s }).expect(200);
    }
    const early = await staff.patch(`/api/orders/${id}/status`).send({ status: 'COMPLETED' });
    expect(early.status).toBe(400);
    expect(early.body.message).toMatch(/fully paid/);
    const cash = await staff.post(`/api/orders/${id}/payments`).send({ amount: 1200, method: 'CASH', notes: 'Paid on collection' });
    expect(cash.status).toBe(201);
    expect(cash.body.order.payment_status).toBe('PAID');
    await staff.patch(`/api/orders/${id}/status`).send({ status: 'COMPLETED' }).expect(200);
  });

  test('cancelling a paid order refunds it automatically (card back to the card, cash returned)', async () => {
    const online = await placeOnline();
    const confirmed = await staff.patch(`/api/orders/${online}/confirm`).send({});
    const chargeTxnId = confirmed.body.order.payments[0].transaction_id;

    // Refunds are only for cancelled or rejected orders.
    expect((await staff.patch(`/api/orders/${online}/payment-status`).send({ paymentStatus: 'REFUNDED' })).status).toBe(400);

    await staff.patch(`/api/orders/${online}/status`).send({ status: 'CANCELLED', note: 'Shop closed that day' }).expect(200);
    const detail = (await customer.get(`/api/my/orders/${online}`)).body.order;
    expect(detail).toMatchObject({ payment_status: 'REFUNDED', amount_paid: 0, amount_refunded: 1200, can_pay_online: false });
    const refund = detail.payments.find((p) => p.kind === 'REFUND');
    expect(refund).toMatchObject({ method: 'CARD', card_last4: '4242', reference_no: expect.stringMatching(/^re_/) });
    const [txn] = await query("SELECT * FROM payment_transactions WHERE order_id = ? AND type = 'REFUND'", [online]);
    expect(txn.original_txn_id).toBe(chargeTxnId);

    const cod = await placeCod();
    await staff.patch(`/api/orders/${cod}/confirm`).send({}).expect(200);
    await staff.post(`/api/orders/${cod}/payments`).send({ amount: 500, method: 'CASH', notes: 'Deposit' }).expect(201);
    await staff.patch(`/api/orders/${cod}/status`).send({ status: 'CANCELLED', note: 'Customer request' }).expect(200);
    const codDetail = (await staff.get(`/api/orders/${cod}`)).body.order;
    expect(codDetail).toMatchObject({ payment_status: 'REFUNDED', amount_paid: 0 });
    expect(codDetail.payments.find((p) => p.kind === 'REFUND').notes).toMatch(/Cash returned/);

    const titles = (await customer.get('/api/my/notifications?limit=100')).body.data.map((n) => n.title);
    expect(titles).toContain('Refund issued');
    const actions = (await admin.get('/api/audit-logs?limit=300')).body.data.map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['PAYMENT_ONLINE_SUCCEEDED', 'PAYMENT_ONLINE_FAILED', 'PAYMENT_REFUNDED']));
  });

  test('reports and the payments list count refunds against revenue', async () => {
    const [{ net }] = await query("SELECT SUM(IF(kind = 'REFUND', -amount, amount)) AS net FROM payments");
    const summary = (await admin.get('/api/reports/summary')).body;
    expect(summary.revenue_today).toBe(Number(net));
    const list = (await admin.get('/api/payments?limit=100')).body;
    expect(list.totalAmount).toBe(Number(net));
    expect(list.data.some((p) => p.kind === 'REFUND')).toBe(true);
  });

  test('the payment form can list the gateway test cards', async () => {
    const res = await customer.get('/api/my/payments/test-cards');
    expect(res.body.data.map((c) => c.number)).toContain('4242424242424242');
  });
});
