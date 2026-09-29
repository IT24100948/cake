const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');
const { notifyCustomer } = require('../utils/notify');
const { generateOrderNumber } = require('../utils/orderNumber');
const { money, toDateString, formatLKR } = require('../utils/helpers');
const { ORDER_TRANSITIONS, STATUS_LABELS } = require('../config/constants');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function lockOrder(conn, orderId) {
  const [order] = await conn.q('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

async function paidAmount(conn, orderId) {
  const [row] = await conn.q('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE order_id = ?', [orderId]);
  return money(row.paid);
}

/** Derives the payment status from payments recorded against the order total. */
function derivePaymentStatus(paid, total) {
  if (paid <= 0) return 'UNPAID';
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

function statusMessage(order, status, note) {
  const base = {
    CONFIRMED: `Your order ${order.order_number} has been confirmed. Total: ${formatLKR(order.total_amount)}.`,
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
    const r = await conn.q(
      `INSERT INTO orders (order_number, customer_id, fulfillment_type, event_date, subtotal, total_amount, customer_notes)
       VALUES (?,?,?,?,?,?,?)`,
      [orderNumber, customer.id, payload.fulfillmentType, payload.eventDate, subtotal, subtotal, payload.notes || null]
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
      message: `We have received your order ${orderNumber}. Our team will review it and confirm shortly.`,
    });
    return id;
  });

  const [order] = await query('SELECT id, order_number, status, total_amount FROM orders WHERE id = ?', [orderId]);
  await logAudit(req, 'ORDER_PLACED', {
    entityType: 'order', entityId: orderId,
    details: { orderNumber: order.order_number, items: items.length, customCake: !!cake, subtotal: order.total_amount },
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
    return { order, quote, fee, total };
  });
  await logAudit(req, 'ORDER_CONFIRMED', {
    entityType: 'order', entityId: orderId,
    details: { orderNumber: result.order.order_number, cakeQuote: result.quote, deliveryFee: result.fee, total: result.total },
  });
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
  if (status === 'COMPLETED') {
    const paid = await paidAmount(conn, order.id);
    if (order.payment_status !== 'PAID' || paid + 0.001 < Number(order.total_amount)) {
      throw ApiError.badRequest('The order must be fully paid before it can be completed');
    }
  }

  if (status === 'CANCELLED') await restoreStock(conn, order, req.staff?.id || null);

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
    await conn.q('UPDATE orders SET payment_status = ? WHERE id = ?', [paymentStatus, o.id]);
    await notifyCustomer({
      conn, customerId: o.customer_id, orderId: o.id, title: 'Payment status updated',
      message: `Payment status for order ${o.order_number} is now ${STATUS_LABELS[paymentStatus]}.${note ? ` Note: ${note}` : ''}`,
    });
    return o;
  });
  await logAudit(req, 'PAYMENT_STATUS_CHANGED', {
    entityType: 'order', entityId: orderId,
    details: { orderNumber: order.order_number, from: order.payment_status, to: paymentStatus, note: note || null },
  });
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
    `SELECT p.*, s.full_name AS recorded_by_name FROM payments p LEFT JOIN staff s ON s.id = p.recorded_by
      WHERE p.order_id = ? ORDER BY p.paid_at, p.id`,
    [orderId]
  );
  const paid = money(payments.reduce((s, p) => s + Number(p.amount), 0));
  const detail = {
    ...order,
    stock_deducted: !!order.stock_deducted,
    items,
    cakeRequirement: cakeRequirement || null,
    delivery: delivery || null,
    history: history.map((h) => ({ ...h, changed_by_customer: !!h.changed_by_customer })),
    payments,
    amount_paid: paid,
    balance_due: money(Math.max(0, Number(order.total_amount) - paid)),
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
  recordPayment, updatePaymentStatus, updateDelivery, updateDeliveryStatus,
  getOrderDetail, allowedNextStatuses, derivePaymentStatus, toDateString,
};
