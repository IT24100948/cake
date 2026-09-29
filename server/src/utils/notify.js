const { pool } = require('../config/db');

/** Create an in-app notification for a customer (US24). */
async function notifyCustomer({ customerId, orderId = null, title, message, conn }) {
  await (conn || pool).query(
    'INSERT INTO notifications (customer_id, order_id, title, message) VALUES (?,?,?,?)',
    [customerId, orderId, title, message]
  );
}

module.exports = { notifyCustomer };
