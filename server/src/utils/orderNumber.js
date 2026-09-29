/** Generates an order number such as DCP-20260928-0007 (sequence restarts each day). */
async function generateOrderNumber(conn) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `DCP-${ymd}-`;
  const [rows] = await conn.query(
    'SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1 FOR UPDATE',
    [`${prefix}%`]
  );
  const next = rows.length ? Number(rows[0].order_number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

module.exports = { generateOrderNumber };
