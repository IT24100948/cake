const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');
const { notifyCustomer } = require('../utils/notify');
const { generateOrderNumber } = require('../utils/orderNumber');
const { money, toDateString, formatLKR } = require('../utils/helpers');
const {
  ORDER_TRANSITIONS, STATUS_LABELS, STAFF_PAYMENT_METHODS, CUSTOM_CAKE_LEAD_DAYS, PAYABLE_STATUSES,
} = require('../config/constants');
const gateway = require('./paymentGateway');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function lockOrder(conn, orderId) {
  const [order] = await conn.q('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

/** Net amount paid on an order: payments received minus refunds given. */
async function paidAmount(conn, orderId) {
  const [row] = await conn.q(
    "SELECT COALESCE(SUM(IF(kind = 'REFUND', -amount, amount)),0) AS paid FROM payments WHERE order_id = ?", [orderId]
  );
  return money(row.paid);
}

/** Derives the payment status from the net amount paid against the order total. */
function derivePaymentStatus(paid, total, refunded = 0) {
  if (paid <= 0) return refunded > 0 ? 'REFUNDED' : 'UNPAID';
  if (paid + 0.001 < total) return 'PARTIALLY_PAID';
  return 'PAID';
}

async function addHistory(conn, { orderId, from, to, note, staffId = null, byCustomer = false }) {
  await conn.q(
    `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_staff_id, changed_by_customer)
     VALUES (?,?,?,?,?,?)`,
    [orderId, from, to, note || null, staffId, byCustomer ? 1 : 0]
  );
}

/** Deducts stock for every item on the order (US19). Throws 409 if any item is short. */
async function deductStock(conn, order, staffId) {
  const items = await conn.q('SELECT product_id, product_name, SUM(quantity) AS qty FROM order_items WHERE order_id = ? GROUP BY product_id, product_name', [order.id]);
  const shortages = [];
  const locked = [];
  for (const it of items) {
    const [p] = await conn.q('SELECT id, stock_quantity FROM products WHERE id = ? FOR UPDATE', [it.product_id]);
    if (p.stock_quantity < it.qty) shortages.push(`${it.product_name} (need ${it.qty}, have ${p.stock_quantity})`);
    locked.push({ ...it, stock: p.stock_quantity });
  }
  if (shortages.length) {
    throw ApiError.conflict(`Insufficient stock to confirm this order: ${shortages.join(', ')}. Restock or edit the order first.`);
  }
  for (const it of locked) {
    const balance = it.stock - Number(it.qty);
    await conn.q('UPDATE products SET stock_quantity = ? WHERE id = ?', [balance, it.product_id]);
    await conn.q(
      `INSERT INTO inventory_transactions (product_id, change_qty, type, reason, balance_after, staff_id, order_id)
       VALUES (?,?, 'ORDER_DEDUCT', ?, ?, ?, ?)`,
      [it.product_id, -Number(it.qty), `Order ${order.order_number} confirmed`, balance, staffId, order.id]
    );
  }
  await conn.q('UPDATE orders SET stock_deducted = 1 WHERE id = ?', [order.id]);
}

/** Returns previously deducted stock when a confirmed order is cancelled. */
async function restoreStock(conn, order, staffId) {
  if (!order.stock_deducted) return;
  const items = await conn.q('SELECT product_id, SUM(quantity) AS qty FROM order_items WHERE order_id = ? GROUP BY product_id', [order.id]);
  for (const it of items) {
    const [p] = await conn.q('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE', [it.product_id]);
    const balance = p.stock_quantity + Number(it.qty);
    await conn.q('UPDATE products SET stock_quantity = ? WHERE id = ?', [balance, it.product_id]);
    await conn.q(
      `INSERT INTO inventory_transactions (product_id, change_qty, type, reason, balance_after, staff_id, order_id)
       VALUES (?,?, 'ORDER_RESTORE', ?, ?, ?, ?)`,
      [it.product_id, Number(it.qty), `Order ${order.order_number} cancelled`, balance, staffId, order.id]
    );
  }
  await conn.q('UPDATE orders SET stock_deducted = 0 WHERE id = ?', [order.id]);
}

/** What the customer is told about paying when their order is confirmed. */
function paymentInstruction(order) {
  if (order.payment_option === 'ONLINE') {
    if (order.payment_method_id) return ' The card you added at checkout is charged for this total now.';
    return ' Please pay online from your order page to secure it: we start preparing as soon as payment is received.';
  }
  return ` Please pay ${formatLKR(order.total_amount)} in cash on ${order.fulfillment_type === 'DELIVERY' ? 'delivery' : 'collection'}.`;
}

const dateOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateString(d);
};

function statusMessage(order, status, note) {
  const base = {
    CONFIRMED: `Your order ${order.order_number} has been confirmed. Total: ${formatLKR(order.total_amount)}.${paymentInstruction(order)}`,
    IN_PREPARATION: `We have started preparing your order ${order.order_number}.`,
    READY: `Your order ${order.order_number} is ready.`,
    OUT_FOR_DELIVERY: `Your order ${order.order_number} is out for delivery.`,
    READY_FOR_COLLECTION: `Your order ${order.order_number} is ready for collection at our shop.`,
    COMPLETED: `Your order ${order.order_number} has been completed. Thank you for choosing Devma Cake n' Party!`,
    CANCELLED: `Your order ${order.order_number} has been cancelled.`,
    REJECTED: `Sorry, we are unable to accept your order ${order.order_number}.`,
  }[status] || `Your order ${order.order_number} status is now ${STATUS_LABELS[status]}.`;
  return note ? `${base} Note: ${note}` : base;
}

/** Allowed next statuses for an order (used by the UI and by validation). */
function allowedNextStatuses(order) {
  return (ORDER_TRANSITIONS[order.status] || []).filter((s) => {
    if (s === 'OUT_FOR_DELIVERY') return order.fulfillment_type === 'DELIVERY';
    if (s === 'READY_FOR_COLLECTION') return order.fulfillment_type === 'COLLECTION';
    return true;
  });
}

// ---------------------------------------------------------------------------
// US15 - Submit order (customer)
// ---------------------------------------------------------------------------

async function createOrder(req, payload, referenceImageUrl) {
  const customer = req.customer;
  const items = payload.items || [];
  const cake = payload.cakeRequirement || null;
  if (!items.length && !cake) {
    throw ApiError.unprocessable('Your order is empty', { items: 'Add at least one product or a custom cake request' });
  }
  const paymentOption = payload.paymentOption;
  if (!['ONLINE', 'CASH_ON_DELIVERY'].includes(paymentOption)) {
    throw ApiError.unprocessable('Choose how you will pay', { paymentOption: 'Choose online payment or cash on delivery' });
  }
  if (cake) {
    // Custom cakes are made to order: pre-ordered with notice and paid online in advance.
    if (paymentOption !== 'ONLINE') {
      throw ApiError.unprocessable('Custom cakes must be paid online', {
        paymentOption: 'Custom cakes are pre-orders and are paid online in advance. Cash on delivery is available for orders without a custom cake.',
      });
    }
    if (String(payload.eventDate) < dateOffset(CUSTOM_CAKE_LEAD_DAYS)) {
      throw ApiError.unprocessable('Custom cakes need more notice', {
        eventDate: `Custom cakes are pre-orders: choose a date at least ${CUSTOM_CAKE_LEAD_DAYS} days from today.`,
      });
    }
  }

  // Paying online needs a card at checkout. The gateway verifies it now (no money taken) and gives a
  // token; the card is charged automatically when the order is confirmed and its total is final.
  let savedCard = null;
  if (paymentOption === 'ONLINE') {
    const { card, errors } = gateway.validateCard(payload.card || {});
    if (errors) {
      throw ApiError.unprocessable('Enter your card details to pay online',
        Object.fromEntries(Object.entries(errors).map(([k, v]) => [`card.${k}`, v])));
    }
    const verification = gateway.verify(card);
    if (!verification.approved) {
      await logAudit(req, 'PAYMENT_CARD_DECLINED', {
        actor: { type: 'CUSTOMER', id: customer.id, name: customer.full_name },
        details: { stage: 'checkout', card: `${card.brand} ending ${card.last4}`, failureCode: verification.failureCode },
      });
      const err = new ApiError(402, `${verification.message} Your order has not been placed.`);
      err.code = verification.failureCode;
      throw err;
    }
    const year = Number(payload.card.expYear) < 100 ? 2000 + Number(payload.card.expYear) : Number(payload.card.expYear);
    savedCard = { ...card, token: verification.token, profile: verification.profile, expMonth: Number(payload.card.expMonth), expYear: year };
  }

  const orderId = await withTransaction(async (conn) => {
    // Validate items against current catalog; snapshot names and prices.
    const lines = [];
    const errors = {};
    for (const [i, it] of items.entries()) {
      const [p] = await conn.q('SELECT id, name, price, product_type, is_available, stock_quantity FROM products WHERE id = ?', [it.productId]);
      if (!p || !p.is_available) { errors[`items[${i}]`] = 'This product is no longer available'; continue; }
      const already = lines.filter((l) => l.product.id === p.id).reduce((s, l) => s + l.quantity, 0);
      if (already + it.quantity > p.stock_quantity) {
        errors[`items[${i}]`] = p.stock_quantity > 0
          ? `Only ${p.stock_quantity} unit(s) of ${p.name} available`
          : `${p.name} is out of stock`;
        continue;
      }
      lines.push({ product: p, quantity: it.quantity, notes: it.notes || null });
    }
    if (Object.keys(errors).length) throw ApiError.unprocessable('Some items in your cart are unavailable', errors);

    const subtotal = money(lines.reduce((s, l) => s + Number(l.product.price) * l.quantity, 0));
    const orderNumber = await generateOrderNumber(conn);
    let paymentMethodId = null;
    if (savedCard) {
      const pm = await conn.q(
        `INSERT INTO payment_methods (customer_id, gateway_token, card_brand, card_last4, card_holder, exp_month, exp_year, sandbox_outcome)
         VALUES (?,?,?,?,?,?,?,?)`,
        [customer.id, savedCard.token, savedCard.brand, savedCard.last4, savedCard.holder, savedCard.expMonth, savedCard.expYear, savedCard.profile]
      );
      paymentMethodId = pm.insertId;
    }
    const r = await conn.q(
      `INSERT INTO orders (order_number, customer_id, fulfillment_type, payment_option, payment_method_id, event_date, subtotal, total_amount, customer_notes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [orderNumber, customer.id, payload.fulfillmentType, paymentOption, paymentMethodId, payload.eventDate, subtotal, subtotal, payload.notes || null]
    );
    const id = r.insertId;

    if (lines.length) {
      await conn.q(
        `INSERT INTO order_items (order_id, product_id, product_name, product_type, unit_price, quantity, line_total, notes) VALUES ?`,
        [lines.map((l) => [id, l.product.id, l.product.name, l.product.product_type, l.product.price, l.quantity,
          money(Number(l.product.price) * l.quantity), l.notes])]
      );
    }

    // US13 - Cake requirements
    if (cake) {
      await conn.q(
        `INSERT INTO cake_requirements (order_id, occasion, flavor, weight_kg, shape, tiers, icing_type, colors, theme,
                                        message_on_cake, dietary_notes, additional_details, reference_image_url)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, cake.occasion, cake.flavor, cake.weightKg, cake.shape, cake.tiers || 1, cake.icingType || null,
          cake.colors || null, cake.theme || null, cake.messageOnCake || null, cake.dietaryNotes || null,
          cake.additionalDetails || null, referenceImageUrl]
      );
    }

    // US22 - Delivery / collection arrangement captured at checkout
    const d = payload.delivery || {};
    await conn.q(
      `INSERT INTO deliveries (order_id, type, recipient_name, contact_phone, address, city, scheduled_time_slot, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, payload.fulfillmentType, d.recipientName || customer.full_name, d.contactPhone || customer.phone,
        payload.fulfillmentType === 'DELIVERY' ? d.address : null,
        payload.fulfillmentType === 'DELIVERY' ? d.city : null,
        d.preferredTimeSlot || null, d.notes || null]
    );

    await addHistory(conn, { orderId: id, from: null, to: 'PENDING', note: 'Order submitted by customer', byCustomer: true });
    await notifyCustomer({
      conn, customerId: customer.id, orderId: id, title: 'Order received',
      message: `We have received your order ${orderNumber}. Our team will review it and confirm shortly.${savedCard
        ? ` Your ${savedCard.brand} card ending ${savedCard.last4} is verified and will be charged when we confirm the final total.`
        : ' You will pay in cash on delivery or collection.'}`,
    });
    return id;
  });

  const [order] = await query('SELECT id, order_number, status, total_amount FROM orders WHERE id = ?', [orderId]);
  await logAudit(req, 'ORDER_PLACED', {
    entityType: 'order', entityId: orderId,
    details: {
      orderNumber: order.order_number, items: items.length, customCake: !!cake, paymentOption, subtotal: order.total_amount,
      card: savedCard ? `${savedCard.brand} ending ${savedCard.last4} (verified)` : null,
    },
  });
  return order;
}

// ---------------------------------------------------------------------------
// US19 - Confirm order (staff)
// ---------------------------------------------------------------------------

async function confirmOrder(req, orderId, { cakeQuote, deliveryFee, note }) {
  const result = await withTransaction(async (conn) => {
    const order = await lockOrder(conn, orderId);
    if (order.status !== 'PENDING') throw ApiError.badRequest(`Only pending orders can be confirmed (current status: ${STATUS_LABELS[order.status]})`);
    const [cake] = await conn.q('SELECT id FROM cake_requirements WHERE order_id = ?', [order.id]);
    if (cake && !(cakeQuote > 0)) {
      throw ApiError.unprocessable('Quote required', { cakeQuote: 'Enter the price for the custom cake' });
    }
    const quote = cake ? money(cakeQuote) : 0;
    const fee = order.fulfillment_type === 'DELIVERY' ? money(deliveryFee || 0) : 0;
    const total = money(Number(order.subtotal) + quote + fee);

    await deductStock(conn, order, req.staff.id);
    if (cake) await conn.q('UPDATE cake_requirements SET quoted_price = ? WHERE order_id = ?', [quote, order.id]);
    const paid = await paidAmount(conn, order.id);
    await conn.q(
      `UPDATE orders SET status = 'CONFIRMED', cake_quote_amount = ?, delivery_fee = ?, total_amount = ?,
              payment_status = ?, confirmed_by = ?, confirmed_at = NOW() WHERE id = ?`,
      [quote, fee, total, derivePaymentStatus(paid, total), req.staff.id, order.id]
    );
    await addHistory(conn, { orderId: order.id, from: 'PENDING', to: 'CONFIRMED', note, staffId: req.staff.id });
    const updated = { ...order, total_amount: total };
    await notifyCustomer({
      conn, customerId: order.customer_id, orderId: order.id, title: 'Order confirmed',
      message: statusMessage(updated, 'CONFIRMED', note),
    });

    // Pay-online orders: charge the card verified at checkout, now that the total is final.
    let charge = null;
    if (order.payment_option === 'ONLINE' && order.payment_method_id && total - paid > 0.001) {
      const [pm] = await conn.q('SELECT * FROM payment_methods WHERE id = ?', [order.payment_method_id]);
      if (pm) {
        const amount = money(total - paid);
        const result = gateway.chargeSaved({ amount, profile: pm.sandbox_outcome });
        charge = await recordCharge(conn, updated, {
          amount, paid, result, key: `confirm-${order.id}`,
          card: { brand: pm.card_brand, last4: pm.card_last4, holder: pm.card_holder },
        });
      }
    }
    return { order, quote, fee, total, charge };
  });
  await logAudit(req, 'ORDER_CONFIRMED', {
    entityType: 'order', entityId: orderId,
    details: { orderNumber: result.order.order_number, cakeQuote: result.quote, deliveryFee: result.fee, total: result.total },
  });
  if (result.charge) await auditCharge(req, result.order, result.charge, 'saved card charged on confirmation');
}

// ---------------------------------------------------------------------------
// US17 / US23 - Status changes (shared by staff status updates and delivery updates)
// ---------------------------------------------------------------------------

/** Changes the order status inside an existing transaction. Returns the previous order row. */
async function changeStatusTx(conn, req, orderId, status, note) {
  const order = await lockOrder(conn, orderId);
  if (order.status === status) throw ApiError.badRequest(`Order is already ${STATUS_LABELS[status]}`);
  if (!allowedNextStatuses(order).includes(status)) {
    throw ApiError.badRequest(`Cannot change status from ${STATUS_LABELS[order.status]} to ${STATUS_LABELS[status]}`);
  }
  if ((status === 'REJECTED' || status === 'CANCELLED') && !note) {
    throw ApiError.unprocessable('Reason required', { note: 'Please provide a reason' });
  }
  if (status === 'IN_PREPARATION' && order.payment_option === 'ONLINE') {
    const paid = await paidAmount(conn, order.id);
    if (paid + 0.001 < Number(order.total_amount)) {
      throw ApiError.badRequest(
        `This order is paid online in advance: wait for the customer's payment of ${formatLKR(Number(order.total_amount) - paid)} before starting preparation.`
      );
    }
  }
  if (status === 'COMPLETED') {
    const paid = await paidAmount(conn, order.id);
    if (order.payment_status !== 'PAID' || paid + 0.001 < Number(order.total_amount)) {
      throw ApiError.badRequest('The order must be fully paid before it can be completed');
    }
  }

  if (status === 'CANCELLED') await restoreStock(conn, order, req.staff?.id || null);
  // Money already paid on a cancelled or rejected order goes back to the customer.
  if (status === 'CANCELLED' || status === 'REJECTED') order.refunded = await refundAll(conn, req, order, note);

  const sets = ['status = ?'];
  const params = [status];
  if (status === 'COMPLETED') sets.push('completed_at = NOW()');
  if (status === 'CANCELLED' || status === 'REJECTED') { sets.push('cancel_reason = ?'); params.push(note); }
  await conn.q(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, [...params, order.id]);

  // Keep the delivery/collection record in step with the order.
  const deliverySync = {
    OUT_FOR_DELIVERY: ['OUT_FOR_DELIVERY', null],
    READY_FOR_COLLECTION: ['READY_FOR_COLLECTION', null],
    COMPLETED: [order.fulfillment_type === 'DELIVERY' ? 'DELIVERED' : 'COLLECTED', 'NOW()'],
  }[status];
  if (deliverySync) {
    await conn.q(
      `UPDATE deliveries SET status = ?${deliverySync[1] ? ', completed_at = NOW()' : ''} WHERE order_id = ?`,
      [deliverySync[0], order.id]
    );
  }
  if (order.status === 'OUT_FOR_DELIVERY' && status === 'READY') {
    await conn.q(`UPDATE deliveries SET status = 'FAILED' WHERE order_id = ?`, [order.id]);
  }

  await addHistory(conn, { orderId: order.id, from: order.status, to: status, note, staffId: req.staff?.id || null });
  await notifyCustomer({
    conn, customerId: order.customer_id, orderId: order.id,
    title: `Order ${STATUS_LABELS[status].toLowerCase()}`,
    message: statusMessage(order, status, note),
  });
  return order;
}

async function changeStatus(req, orderId, { status, note }) {
  const order = await withTransaction((conn) => changeStatusTx(conn, req, orderId, status, note));
  await logAudit(req, 'ORDER_STATUS_CHANGED', {
    entityType: 'order', entityId: orderId,
    details: { orderNumber: order.order_number, from: order.status, to: status, note: note || null },
  });
  if (order.refunded) {
    await logAudit(req, 'PAYMENT_REFUNDED', {
      entityType: 'order', entityId: orderId, details: { orderNumber: order.order_number, amount: order.refunded, reason: note || null },
    });
  }
}

/** Customer cancels their own order while it is still pending (US18). */
async function customerCancel(req, orderId, reason) {
  const order = await withTransaction(async (conn) => {
    const o = await lockOrder(conn, orderId);
    if (o.customer_id !== req.customer.id) throw ApiError.notFound('Order not found');
    if (o.status !== 'PENDING') {
      throw ApiError.badRequest('This order has already been confirmed. Please contact us to cancel it.');
    }
    await conn.q(`UPDATE orders SET status = 'CANCELLED', cancel_reason = ? WHERE id = ?`, [reason || 'Cancelled by customer', o.id]);
    await addHistory(conn, { orderId: o.id, from: 'PENDING', to: 'CANCELLED', note: reason || 'Cancelled by customer', byCustomer: true });
    await notifyCustomer({
      conn, customerId: o.customer_id, orderId: o.id, title: 'Order cancelled',
      message: `You cancelled order ${o.order_number}.`,
    });
    return o;
  });
  await logAudit(req, 'ORDER_CANCELLED_BY_CUSTOMER', { entityType: 'order', entityId: orderId, details: { orderNumber: order.order_number, reason } });
}

// ---------------------------------------------------------------------------
// US17 - Update order details (staff)
// ---------------------------------------------------------------------------

async function updateOrderDetails(req, orderId, body) {
  const changes = {};
  const order = await withTransaction(async (conn) => {
    const o = await lockOrder(conn, orderId);
    if (!['PENDING', 'CONFIRMED', 'IN_PREPARATION'].includes(o.status)) {
      throw ApiError.badRequest(`Order details cannot be edited when the order is ${STATUS_LABELS[o.status]}`);
    }

    let subtotal = Number(o.subtotal);
    // Items can only be changed before confirmation (stock is deducted on confirmation).
    if (body.items) {
      if (o.status !== 'PENDING') throw ApiError.badRequest('Items can only be changed while the order is pending');
      const lines = [];
      for (const [i, it] of body.items.entries()) {
        const [p] = await conn.q('SELECT id, name, price, product_type, stock_quantity FROM products WHERE id = ?', [it.productId]);
        if (!p) throw ApiError.unprocessable('Invalid product', { [`items[${i}]`]: 'Product not found' });
        if (it.quantity > p.stock_quantity) {
          throw ApiError.unprocessable('Insufficient stock', { [`items[${i}]`]: `Only ${p.stock_quantity} unit(s) of ${p.name} available` });
        }
        const existing = (await conn.q('SELECT unit_price FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1', [o.id, p.id]))[0];
        const unitPrice = existing ? Number(existing.unit_price) : Number(p.price); // keep the agreed price for existing lines
        lines.push([o.id, p.id, p.name, p.product_type, unitPrice, it.quantity, money(unitPrice * it.quantity), it.notes || null]);
      }
      const [cake] = await conn.q('SELECT id FROM cake_requirements WHERE order_id = ?', [o.id]);
      if (!lines.length && !cake) throw ApiError.unprocessable('Order cannot be empty', { items: 'An order needs at least one item or a custom cake' });
      await conn.q('DELETE FROM order_items WHERE order_id = ?', [o.id]);
      if (lines.length) {
        await conn.q(`INSERT INTO order_items (order_id, product_id, product_name, product_type, unit_price, quantity, line_total, notes) VALUES ?`, [lines]);
      }
      subtotal = money(lines.reduce((s, l) => s + l[6], 0));
      changes.items = body.items;
    }

    if (body.cakeRequirement) {
      const c = body.cakeRequirement;
      const [cake] = await conn.q('SELECT id FROM cake_requirements WHERE order_id = ?', [o.id]);
      if (!cake) throw ApiError.badRequest('This order has no custom cake request');
      await conn.q(
        `UPDATE cake_requirements SET occasion = ?, flavor = ?, weight_kg = ?, shape = ?, tiers = ?, icing_type = ?,
                colors = ?, theme = ?, message_on_cake = ?, dietary_notes = ?, additional_details = ? WHERE order_id = ?`,
        [c.occasion, c.flavor, c.weightKg, c.shape, c.tiers || 1, c.icingType || null, c.colors || null, c.theme || null,
          c.messageOnCake || null, c.dietaryNotes || null, c.additionalDetails || null, o.id]
      );
      changes.cakeRequirement = 'updated';
    }

    let quote = Number(o.cake_quote_amount);
    let fee = Number(o.delivery_fee);
    if (o.status !== 'PENDING') {
      if (body.cakeQuote !== undefined) {
        const [cake] = await conn.q('SELECT id FROM cake_requirements WHERE order_id = ?', [o.id]);
        if (cake) {
          if (!(body.cakeQuote > 0)) throw ApiError.unprocessable('Invalid quote', { cakeQuote: 'Quote must be greater than 0' });
          quote = money(body.cakeQuote);
          await conn.q('UPDATE cake_requirements SET quoted_price = ? WHERE order_id = ?', [quote, o.id]);
        }
      }
      if (body.deliveryFee !== undefined && o.fulfillment_type === 'DELIVERY') fee = money(body.deliveryFee);
    }
    const total = money(subtotal + quote + fee);
    const paid = await paidAmount(conn, o.id);
    if (paid > total + 0.001) {
      throw ApiError.badRequest(`The new total (${formatLKR(total)}) is less than the amount already paid (${formatLKR(paid)})`);
    }
    const paymentStatus = o.payment_status === 'REFUNDED' ? 'REFUNDED' : derivePaymentStatus(paid, total);

    const eventDate = body.eventDate || o.event_date;
    await conn.q(
      `UPDATE orders SET event_date = ?, subtotal = ?, cake_quote_amount = ?, delivery_fee = ?, total_amount = ?,
              payment_status = ?, staff_notes = ?, customer_notes = ? WHERE id = ?`,
      [eventDate, subtotal, quote, fee, total, paymentStatus,
        body.staffNotes !== undefined ? body.staffNotes || null : o.staff_notes,
        body.customerNotes !== undefined ? body.customerNotes || null : o.customer_notes, o.id]
    );
    if (String(eventDate) !== String(o.event_date)) changes.eventDate = { from: o.event_date, to: eventDate };
    if (total !== Number(o.total_amount)) changes.total = { from: Number(o.total_amount), to: total };
    if (body.staffNotes !== undefined && body.staffNotes !== o.staff_notes) changes.staffNotes = 'updated';

    const visible = changes.items || changes.cakeRequirement || changes.eventDate || changes.total;
    if (visible) {
      await addHistory(conn, { orderId: o.id, from: o.status, to: o.status, note: 'Order details updated', staffId: req.staff.id });
      await notifyCustomer({
        conn, customerId: o.customer_id, orderId: o.id, title: 'Order updated',
        message: `Your order ${o.order_number} was updated by our team.${changes.total ? ` New total: ${formatLKR(total)}.` : ''}${changes.eventDate ? ` Event date: ${eventDate}.` : ''}`,
      });
    }
    return o;
  });
  await logAudit(req, 'ORDER_UPDATED', { entityType: 'order', entityId: orderId, details: { orderNumber: order.order_number, changes } });
}

// ---------------------------------------------------------------------------
// US20 / US21 - Payments
// ---------------------------------------------------------------------------

async function recordPayment(req, orderId, { amount, method, referenceNo, paidAt, notes }) {
  const result = await withTransaction(async (conn) => {
    const o = await lockOrder(conn, orderId);
    if (o.status === 'PENDING') throw ApiError.badRequest('Confirm the order before recording payments so the total is final');
    if (['CANCELLED', 'REJECTED'].includes(o.status)) throw ApiError.badRequest(`Cannot record a payment for a ${STATUS_LABELS[o.status].toLowerCase()} order`);
    if (o.payment_status === 'REFUNDED') throw ApiError.badRequest('This order has been refunded');
    if (!STAFF_PAYMENT_METHODS[o.payment_option].includes(method)) {
      const [cake] = await conn.q('SELECT id FROM cake_requirements WHERE order_id = ?', [o.id]);
      throw ApiError.unprocessable('Payment method not allowed for this order', {
        method: method === 'CASH' && cake
          ? 'Custom cakes are pre-orders paid online: cash is not accepted.'
          : 'This order is paid online. The customer pays by card on their order page; record only a bank or online transfer here.',
      });
    }
    const paid = await paidAmount(conn, o.id);
    const balance = money(Number(o.total_amount) - paid);
    if (balance <= 0) throw ApiError.badRequest('This order is already fully paid');
    if (amount > balance + 0.001) {
      throw ApiError.unprocessable('Amount too high', { amount: `Amount cannot exceed the balance due (${formatLKR(balance)})` });
    }
    const r = await conn.q(
      `INSERT INTO payments (order_id, amount, method, reference_no, paid_at, notes, recorded_by) VALUES (?,?,?,?,?,?,?)`,
      [o.id, money(amount), method, referenceNo || null, paidAt || new Date(), notes || null, req.staff.id]
    );
    const newPaid = money(paid + amount);
    const status = derivePaymentStatus(newPaid, Number(o.total_amount));
    await conn.q('UPDATE orders SET payment_status = ? WHERE id = ?', [status, o.id]);
    await notifyCustomer({
      conn, customerId: o.customer_id, orderId: o.id, title: 'Payment received',
      message: `We received ${formatLKR(amount)} for order ${o.order_number}. ${status === 'PAID' ? 'Your order is fully paid.' : `Balance due: ${formatLKR(Number(o.total_amount) - newPaid)}.`}`,
    });
    return { order: o, paymentId: r.insertId, status, newPaid };
  });
  await logAudit(req, 'PAYMENT_RECORDED', {
    entityType: 'order', entityId: orderId,
    details: { orderNumber: result.order.order_number, paymentId: result.paymentId, amount, method, referenceNo: referenceNo || null, paymentStatus: result.status },
  });
  return result;
}

async function updatePaymentStatus(req, orderId, { paymentStatus, note }) {
  const order = await withTransaction(async (conn) => {
    const o = await lockOrder(conn, orderId);
    if (o.payment_status === paymentStatus) throw ApiError.badRequest(`Payment status is already ${STATUS_LABELS[paymentStatus]}`);
    const paid = await paidAmount(conn, o.id);
    const total = Number(o.total_amount);
    if (paymentStatus === 'PAID' && paid + 0.001 < total) {
      throw ApiError.badRequest(`Record the remaining balance of ${formatLKR(total - paid)} before marking the order as paid`);
    }
    if (paymentStatus === 'UNPAID' && paid > 0) throw ApiError.badRequest('Payments have been recorded for this order, so it cannot be unpaid');
    if (paymentStatus === 'PARTIALLY_PAID' && (paid <= 0 || paid + 0.001 >= total)) {
      throw ApiError.badRequest('Partially paid requires some, but not all, of the total to be paid');
    }
    if (paymentStatus === 'REFUNDED' && paid <= 0) throw ApiError.badRequest('Nothing has been paid for this order, so it cannot be refunded');
    if (paymentStatus === 'REFUNDED') {
      if (!['CANCELLED', 'REJECTED'].includes(o.status)) {
        throw ApiError.badRequest('Only cancelled or rejected orders can be refunded. Cancel the order first: the payment is refunded automatically.');
      }
      o.refunded = await refundAll(conn, req, o, note);
      return o;
    }
    await conn.q('UPDATE orders SET payment_status = ? WHERE id = ?', [paymentStatus, o.id]);
    await notifyCustomer({
      conn, customerId: o.customer_id, orderId: o.id, title: 'Payment status updated',
      message: `Payment status for order ${o.order_number} is now ${STATUS_LABELS[paymentStatus]}.${note ? ` Note: ${note}` : ''}`,
    });
    return o;
  });
  if (order.refunded) {
    await logAudit(req, 'PAYMENT_REFUNDED', {
      entityType: 'order', entityId: orderId, details: { orderNumber: order.order_number, amount: order.refunded, reason: note || null },
    });
    return;
  }
  await logAudit(req, 'PAYMENT_STATUS_CHANGED', {
    entityType: 'order', entityId: orderId,
    details: { orderNumber: order.order_number, from: order.payment_status, to: paymentStatus, note: note || null },
  });
}

/**
 * Refunds everything paid on an order, inside the caller's transaction: card payments go back to
 * the same card through the gateway; cash and transfers are recorded as returned by staff.
 */
async function refundAll(conn, req, order, reason) {
  let remaining = await paidAmount(conn, order.id);
  if (remaining <= 0) return 0;
  const total = remaining;
  const payments = await conn.q(
    `SELECT p.*, t.gateway_ref, t.card_brand, t.card_last4, t.card_holder
       FROM payments p LEFT JOIN payment_transactions t ON t.id = p.transaction_id
      WHERE p.order_id = ? AND p.kind = 'PAYMENT' ORDER BY p.paid_at DESC, p.id DESC`,
    [order.id]
  );
  const staffId = req.staff?.id || null;
  const lines = [];
  for (const p of payments) {
    if (remaining <= 0) break;
    let already = 0;
    if (p.transaction_id) {
      const [r] = await conn.q(
        "SELECT COALESCE(SUM(amount),0) AS n FROM payment_transactions WHERE original_txn_id = ? AND type = 'REFUND' AND status = 'SUCCEEDED'",
        [p.transaction_id]
      );
      already = Number(r.n);
    }
    const amount = money(Math.min(Number(p.amount) - already, remaining));
    if (amount <= 0) continue;
    let txnId = null;
    let reference = p.reference_no;
    let note;
    if (p.transaction_id) {
      const result = gateway.refund({ amount, originalRef: p.gateway_ref });
      if (!result.approved) throw ApiError.badRequest(`The card refund could not be processed: ${result.message}`);
      const r = await conn.q(
        `INSERT INTO payment_transactions (order_id, customer_id, type, amount, status, gateway_ref, card_brand, card_last4, card_holder, original_txn_id)
         VALUES (?,?, 'REFUND', ?, 'SUCCEEDED', ?,?,?,?,?)`,
        [order.id, order.customer_id, amount, result.gatewayRef, p.card_brand, p.card_last4, p.card_holder, p.transaction_id]
      );
      txnId = r.insertId;
      reference = result.gatewayRef;
      note = `Refunded to ${p.card_brand} card ending ${p.card_last4}`;
    } else {
      note = p.method === 'CASH' ? 'Cash returned to the customer' : `Returned by ${p.method === 'CARD' ? 'card reversal' : 'bank transfer'}`;
    }
    await conn.q(
      `INSERT INTO payments (order_id, kind, amount, method, reference_no, transaction_id, paid_at, notes, recorded_by)
       VALUES (?, 'REFUND', ?,?,?,?, NOW(), ?, ?)`,
      [order.id, amount, p.method, reference, txnId, reason ? `${note} - ${reason}`.slice(0, 255) : note, staffId]
    );
    lines.push(note.toLowerCase());
    remaining = money(remaining - amount);
  }
  await conn.q("UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ?", [order.id]);
  await notifyCustomer({
    conn, customerId: order.customer_id, orderId: order.id, title: 'Refund issued',
    message: `We have refunded ${formatLKR(total)} for order ${order.order_number} (${[...new Set(lines)].join('; ')}).`,
  });
  return total;
}

/** Public view of a gateway transaction (a receipt). */
const receipt = (t) => ({
  id: t.id, status: t.status, amount: Number(t.amount), currency: t.currency, gatewayRef: t.gateway_ref,
  cardBrand: t.card_brand, cardLast4: t.card_last4, failureCode: t.failure_code, message: t.failure_message, createdAt: t.created_at,
});

/**
 * Records a card charge from the gateway inside the caller's transaction: the transaction log row
 * always, and when approved the payment itself, the new payment status and a receipt notification.
 * A declined charge on a confirmed order tells the customer to pay with another card.
 */
async function recordCharge(conn, order, { amount, paid, result, card, key }) {
  const r = await conn.q(
    `INSERT INTO payment_transactions (order_id, customer_id, type, amount, status, gateway_ref, card_brand, card_last4, card_holder,
                                       failure_code, failure_message, idempotency_key)
     VALUES (?,?, 'CHARGE', ?,?,?,?,?,?,?,?,?)`,
    [order.id, order.customer_id, amount, result.approved ? 'SUCCEEDED' : 'FAILED', result.gatewayRef, card.brand, card.last4, card.holder,
      result.failureCode || null, result.message || null, key]
  );
  const [txn] = await conn.q('SELECT * FROM payment_transactions WHERE id = ?', [r.insertId]);
  if (!result.approved) {
    if (key && key.startsWith('confirm-')) {
      await notifyCustomer({
        conn, customerId: order.customer_id, orderId: order.id, title: 'Payment failed',
        message: `We could not charge your ${card.brand} card ending ${card.last4} for order ${order.order_number}: ${result.message} `
          + `Please pay ${formatLKR(amount)} from your order page with another card to secure your order.`,
      });
    }
    return txn;
  }
  await conn.q(
    `INSERT INTO payments (order_id, kind, amount, method, reference_no, transaction_id, paid_at, notes, recorded_by)
     VALUES (?, 'PAYMENT', ?, 'CARD', ?, ?, NOW(), ?, NULL)`,
    [order.id, amount, result.gatewayRef, txn.id, `Paid online by ${card.brand} card ending ${card.last4}`]
  );
  const status = derivePaymentStatus(money(paid + amount), Number(order.total_amount));
  await conn.q('UPDATE orders SET payment_status = ? WHERE id = ?', [status, order.id]);
  await notifyCustomer({
    conn, customerId: order.customer_id, orderId: order.id, title: 'Payment received',
    message: `Thank you! We received ${formatLKR(amount)} for order ${order.order_number} by ${card.brand} card ending ${card.last4} `
      + `(ref ${result.gatewayRef}).${status === 'PAID' ? ' Your order is fully paid.' : ''}`,
  });
  return txn;
}

async function auditCharge(req, order, txn, how) {
  await logAudit(req, txn.status === 'SUCCEEDED' ? 'PAYMENT_ONLINE_SUCCEEDED' : 'PAYMENT_ONLINE_FAILED', {
    actor: req.customer ? { type: 'CUSTOMER', id: req.customer.id, name: req.customer.full_name } : undefined,
    entityType: 'order', entityId: order.id,
    details: {
      orderNumber: order.order_number, amount: Number(txn.amount), gatewayRef: txn.gateway_ref, how,
      card: `${txn.card_brand} ending ${txn.card_last4}`, failureCode: txn.failure_code || null,
    },
  });
}

function declined(t) {
  const err = new ApiError(402, t.failure_message || 'The payment was declined');
  err.code = t.failure_code || 'card_declined';
  return err;
}

/**
 * Customer pays the balance of a confirmed order by card through the gateway.
 * Idempotent: retrying with the same key returns the first result instead of charging again.
 */
async function payOnline(req, orderId, body) {
  const key = body.idempotencyKey;
  const replay = async () => {
    const [t] = await query('SELECT * FROM payment_transactions WHERE idempotency_key = ?', [key]);
    if (!t) return null;
    if (t.order_id !== Number(orderId) || t.customer_id !== req.customer.id) throw ApiError.conflict('This payment request was already used');
    if (t.status === 'FAILED') throw declined(t);
    return receipt(t);
  };
  const earlier = await replay();
  if (earlier) return earlier;

  const { card, errors } = gateway.validateCard(body);
  if (errors) throw ApiError.unprocessable('Please check your card details', errors);

  let result;
  try {
    result = await withTransaction(async (conn) => {
      const o = await lockOrder(conn, orderId);
      if (o.customer_id !== req.customer.id) throw ApiError.notFound('Order not found');
      if (o.status === 'PENDING') throw ApiError.badRequest('You can pay once we have confirmed your order and its final total.');
      if (!PAYABLE_STATUSES.includes(o.status)) throw ApiError.badRequest(`This order is ${STATUS_LABELS[o.status].toLowerCase()} and cannot be paid.`);
      if (o.payment_status === 'REFUNDED') throw ApiError.badRequest('This order has been refunded.');
      const paid = await paidAmount(conn, o.id);
      const balance = money(Number(o.total_amount) - paid);
      if (balance <= 0) throw ApiError.badRequest('This order is already fully paid.');
      if (body.amount !== undefined && Math.abs(Number(body.amount) - balance) > 0.001) {
        throw ApiError.conflict(`The amount due has changed to ${formatLKR(balance)}. Please review it and pay again.`);
      }

      const result = gateway.charge({ amount: balance, card });
      const txn = await recordCharge(conn, o, { amount: balance, paid, result, card, key });
      return { order: o, txn };
    });
  } catch (err) {
    // A simultaneous retry with the same key got there first: return its result.
    if (err.code === 'ER_DUP_ENTRY' && /idempotency_key/.test(err.message)) {
      const r = await replay();
      if (r) return r;
    }
    throw err;
  }

  const { order, txn } = result;
  await auditCharge(req, order, txn, 'paid by the customer on the order page');
  if (txn.status === 'FAILED') throw declined(txn);
  return receipt(txn);
}

// ---------------------------------------------------------------------------
// US22 - Delivery / collection
// ---------------------------------------------------------------------------

async function updateDelivery(req, orderId, body) {
  const result = await withTransaction(async (conn) => {
    const o = await lockOrder(conn, orderId);
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status)) {
      throw ApiError.badRequest(`Delivery details cannot be changed for a ${STATUS_LABELS[o.status].toLowerCase()} order`);
    }
    const [d] = await conn.q('SELECT * FROM deliveries WHERE order_id = ?', [o.id]);
    const type = body.type;
    if (type !== o.fulfillment_type && ['OUT_FOR_DELIVERY', 'READY_FOR_COLLECTION'].includes(o.status)) {
      throw ApiError.badRequest('The delivery method cannot be changed at this stage');
    }
    if (body.assignedStaffId) {
      const [s] = await conn.q('SELECT id FROM staff WHERE id = ? AND is_active = 1', [body.assignedStaffId]);
      if (!s) throw ApiError.unprocessable('Invalid staff', { assignedStaffId: 'Select an active staff member' });
    }
    let status = d.status;
    if (body.scheduledDate && status === 'PENDING') status = 'SCHEDULED';
    if (!body.scheduledDate && status === 'SCHEDULED') status = 'PENDING';
    await conn.q(
      `UPDATE deliveries SET type = ?, recipient_name = ?, contact_phone = ?, address = ?, city = ?, scheduled_date = ?,
              scheduled_time_slot = ?, assigned_staff_id = ?, notes = ?, status = ? WHERE order_id = ?`,
      [type, body.recipientName, body.contactPhone, type === 'DELIVERY' ? body.address : null, type === 'DELIVERY' ? body.city : null,
        body.scheduledDate || null, body.scheduledTimeSlot || null, body.assignedStaffId || null, body.notes || null, status, o.id]
    );
    let fee = Number(o.delivery_fee);
    if (type !== o.fulfillment_type) {
      if (type === 'COLLECTION') fee = 0;
      const total = money(Number(o.subtotal) + Number(o.cake_quote_amount) + fee);
      const paid = await paidAmount(conn, o.id);
      await conn.q(
        'UPDATE orders SET fulfillment_type = ?, delivery_fee = ?, total_amount = ?, payment_status = ? WHERE id = ?',
        [type, fee, total, o.payment_status === 'REFUNDED' ? 'REFUNDED' : derivePaymentStatus(paid, total), o.id]
      );
    }
    const scheduleChanged = String(body.scheduledDate || '') !== String(d.scheduled_date || '') ||
      String(body.scheduledTimeSlot || '') !== String(d.scheduled_time_slot || '') || type !== d.type;
    if (scheduleChanged && body.scheduledDate) {
      const when = `${body.scheduledDate}${body.scheduledTimeSlot ? ` (${body.scheduledTimeSlot})` : ''}`;
      await notifyCustomer({
        conn, customerId: o.customer_id, orderId: o.id,
        title: type === 'DELIVERY' ? 'Delivery scheduled' : 'Collection scheduled',
        message: type === 'DELIVERY'
          ? `Delivery for order ${o.order_number} is scheduled for ${when} to ${body.address}, ${body.city}.`
          : `Order ${o.order_number} can be collected from our shop on ${when}.`,
      });
    }
    return { order: o, before: d, status };
  });
  await logAudit(req, 'DELIVERY_UPDATED', {
    entityType: 'order', entityId: orderId,
    details: {
      orderNumber: result.order.order_number, type: body.type, scheduledDate: body.scheduledDate || null,
      timeSlot: body.scheduledTimeSlot || null, assignedStaffId: body.assignedStaffId || null, status: result.status,
    },
  });
}

/**
 * Delivery status changes from the Deliveries board. Stages that correspond to an
 * order status (out for delivery, ready for collection, delivered/collected) move the
 * order through the same transition rules; FAILED returns the order to READY.
 */
async function updateDeliveryStatus(req, deliveryId, { status, note }) {
  const out = await withTransaction(async (conn) => {
    const [d] = await conn.q('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
    if (!d) throw ApiError.notFound('Delivery record not found');
    const allowed = d.type === 'DELIVERY'
      ? ['SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']
      : ['SCHEDULED', 'READY_FOR_COLLECTION', 'COLLECTED'];
    if (!allowed.includes(status)) throw ApiError.badRequest(`Status ${STATUS_LABELS[status]} does not apply to a ${d.type.toLowerCase()}`);

    const orderStatusFor = { OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY', READY_FOR_COLLECTION: 'READY_FOR_COLLECTION', DELIVERED: 'COMPLETED', COLLECTED: 'COMPLETED' }[status];
    if (orderStatusFor) {
      const order = await changeStatusTx(conn, req, d.order_id, orderStatusFor, note);
      return { order, from: d.status };
    }
    const order = await lockOrder(conn, d.order_id);
    if (status === 'SCHEDULED' && !d.scheduled_date) {
      throw ApiError.badRequest('Set a scheduled date in the delivery details first');
    }
    if (status === 'FAILED') {
      if (d.status !== 'OUT_FOR_DELIVERY') throw ApiError.badRequest('Only deliveries that are out for delivery can be marked as failed');
      await changeStatusTx(conn, req, d.order_id, 'READY', note || 'Delivery attempt failed');
      await conn.q(`UPDATE deliveries SET notes = ? WHERE id = ?`, [note || d.notes, d.id]);
      return { order, from: d.status };
    }
    await conn.q('UPDATE deliveries SET status = ? WHERE id = ?', [status, d.id]);
    return { order, from: d.status };
  });
  await logAudit(req, 'DELIVERY_STATUS_CHANGED', {
    entityType: 'order', entityId: out.order.id,
    details: { orderNumber: out.order.order_number, from: out.from, to: status, note: note || null },
  });
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

/** Full order detail. `forCustomer` hides internal staff information. */
async function getOrderDetail(orderId, { forCustomer = false } = {}) {
  const [order] = await query(
    `SELECT o.*, c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
            c.address AS customer_address, c.city AS customer_city, s.full_name AS confirmed_by_name
       FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN staff s ON s.id = o.confirmed_by
      WHERE o.id = ?`,
    [orderId]
  );
  if (!order) throw ApiError.notFound('Order not found');
  const items = await query(
    `SELECT oi.*, p.image_url FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.id`,
    [orderId]
  );
  const [cakeRequirement] = await query('SELECT * FROM cake_requirements WHERE order_id = ?', [orderId]);
  const [delivery] = await query(
    `SELECT d.*, s.full_name AS assigned_staff_name FROM deliveries d LEFT JOIN staff s ON s.id = d.assigned_staff_id WHERE d.order_id = ?`,
    [orderId]
  );
  const history = await query(
    `SELECT h.id, h.from_status, h.to_status, h.note, h.changed_by_customer, h.created_at, s.full_name AS staff_name
       FROM order_status_history h LEFT JOIN staff s ON s.id = h.changed_by_staff_id
      WHERE h.order_id = ? ORDER BY h.created_at, h.id`,
    [orderId]
  );
  const payments = await query(
    `SELECT p.*, s.full_name AS recorded_by_name, t.card_brand, t.card_last4
       FROM payments p LEFT JOIN staff s ON s.id = p.recorded_by LEFT JOIN payment_transactions t ON t.id = p.transaction_id
      WHERE p.order_id = ? ORDER BY p.paid_at, p.id`,
    [orderId]
  );
  const [cardOnFile] = order.payment_method_id
    ? await query('SELECT card_brand, card_last4, exp_month, exp_year FROM payment_methods WHERE id = ?', [order.payment_method_id])
    : [];
  const [lastCharge] = await query(
    "SELECT status, failure_message, card_brand, card_last4 FROM payment_transactions WHERE order_id = ? AND type = 'CHARGE' ORDER BY id DESC LIMIT 1",
    [orderId]
  );
  const refunded = money(payments.filter((p) => p.kind === 'REFUND').reduce((s, p) => s + Number(p.amount), 0));
  const paid = money(payments.reduce((s, p) => s + (p.kind === 'REFUND' ? -1 : 1) * Number(p.amount), 0));
  const balance = money(Math.max(0, Number(order.total_amount) - paid));
  const detail = {
    ...order,
    stock_deducted: !!order.stock_deducted,
    items,
    cakeRequirement: cakeRequirement || null,
    delivery: delivery || null,
    history: history.map((h) => ({ ...h, changed_by_customer: !!h.changed_by_customer })),
    payments,
    amount_paid: paid,
    amount_refunded: refunded,
    balance_due: balance,
    is_custom_cake: !!cakeRequirement,
    can_pay_online: PAYABLE_STATUSES.includes(order.status) && balance > 0 && order.payment_status !== 'REFUNDED',
    awaiting_prepayment: order.payment_option === 'ONLINE' && order.status === 'CONFIRMED' && balance > 0,
    card_on_file: cardOnFile || null,
    last_payment_error: balance > 0 && lastCharge?.status === 'FAILED'
      ? `${lastCharge.card_brand} card ending ${lastCharge.card_last4}: ${lastCharge.failure_message}` : null,
    allowed_next_statuses: allowedNextStatuses(order),
  };
  if (forCustomer) {
    delete detail.staff_notes;
    delete detail.confirmed_by;
    delete detail.confirmed_by_name;
    delete detail.stock_deducted;
    delete detail.allowed_next_statuses;
    detail.history = detail.history.map(({ staff_name, ...h }) => h);
    detail.payments = detail.payments.map(({ recorded_by, recorded_by_name, notes, ...p }) => p);
    if (detail.delivery) {
      delete detail.delivery.assigned_staff_id;
      delete detail.delivery.assigned_staff_name;
    }
  }
  return detail;
}

module.exports = {
  createOrder, confirmOrder, changeStatus, customerCancel, updateOrderDetails,
  recordPayment, updatePaymentStatus, payOnline, refundAll, updateDelivery, updateDeliveryStatus,
  getOrderDetail, allowedNextStatuses, derivePaymentStatus, toDateString,
};
