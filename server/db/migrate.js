/**
 * Brings a database created by an older version of schema.sql up to date, without losing data.
 * Every step checks first, so it is safe to run on every start (scripts/setup.js does).
 * New databases get all of this from schema.sql directly.
 */

async function columnExists(q, table, column) {
  const rows = await q(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, column]
  );
  return rows.length > 0;
}

async function tableExists(q, table) {
  const rows = await q('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table]);
  return rows.length > 0;
}

/** `q(sql, params)` runs a query and returns the rows. Returns the list of changes made. */
async function migrate(q) {
  const done = [];

  // Payment option per order (online pre-payment vs cash on delivery).
  if (!(await columnExists(q, 'orders', 'payment_option'))) {
    await q(`ALTER TABLE orders ADD COLUMN payment_option ENUM('ONLINE','CASH_ON_DELIVERY') NOT NULL DEFAULT 'ONLINE' AFTER payment_status`);
    // Existing orders: custom cakes are pre-paid online, everything else was settled on delivery/collection.
    await q(`UPDATE orders o SET o.payment_option = IF(EXISTS (SELECT 1 FROM cake_requirements c WHERE c.order_id = o.id), 'ONLINE', 'CASH_ON_DELIVERY')`);
    done.push('orders.payment_option');
  }

  // Card transactions from the built-in payment gateway.
  if (!(await tableExists(q, 'payment_transactions'))) {
    await q(`CREATE TABLE payment_transactions (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id         INT UNSIGNED  NOT NULL,
      customer_id      INT UNSIGNED  NULL,
      type             ENUM('CHARGE','REFUND') NOT NULL,
      amount           DECIMAL(10,2) NOT NULL,
      currency         CHAR(3)       NOT NULL DEFAULT 'LKR',
      status           ENUM('SUCCEEDED','FAILED') NOT NULL,
      gateway_ref      VARCHAR(40)   NOT NULL UNIQUE,
      card_brand       VARCHAR(20)   NULL,
      card_last4       CHAR(4)       NULL,
      card_holder      VARCHAR(100)  NULL,
      failure_code     VARCHAR(40)   NULL,
      failure_message  VARCHAR(255)  NULL,
      idempotency_key  VARCHAR(64)   NULL UNIQUE,
      original_txn_id  INT UNSIGNED  NULL,
      created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_txn_amount CHECK (amount > 0),
      CONSTRAINT fk_txn_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_txn_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      CONSTRAINT fk_txn_original FOREIGN KEY (original_txn_id) REFERENCES payment_transactions(id),
      KEY idx_txn_order (order_id)
    ) ENGINE=InnoDB`);
    done.push('payment_transactions');
  }

  // Cards verified at checkout for online orders (token only, never the card number).
  if (!(await tableExists(q, 'payment_methods'))) {
    await q(`CREATE TABLE payment_methods (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      customer_id      INT UNSIGNED  NOT NULL,
      gateway_token    VARCHAR(40)   NOT NULL UNIQUE,
      card_brand       VARCHAR(20)   NOT NULL,
      card_last4       CHAR(4)       NOT NULL,
      card_holder      VARCHAR(100)  NOT NULL,
      exp_month        TINYINT UNSIGNED  NOT NULL,
      exp_year         SMALLINT UNSIGNED NOT NULL,
      sandbox_outcome  VARCHAR(40)   NOT NULL DEFAULT 'approved',
      created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_pm_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    done.push('payment_methods');
  }
  if (!(await columnExists(q, 'orders', 'payment_method_id'))) {
    await q('ALTER TABLE orders ADD COLUMN payment_method_id INT UNSIGNED NULL AFTER payment_option');
    await q('ALTER TABLE orders ADD CONSTRAINT fk_order_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL');
    done.push('orders.payment_method_id');
  }

  // Refunds are stored as payments rows with kind = 'REFUND'.
  if (!(await columnExists(q, 'payments', 'kind'))) {
    await q(`ALTER TABLE payments ADD COLUMN kind ENUM('PAYMENT','REFUND') NOT NULL DEFAULT 'PAYMENT' AFTER order_id`);
    done.push('payments.kind');
  }
  if (!(await columnExists(q, 'payments', 'transaction_id'))) {
    await q('ALTER TABLE payments ADD COLUMN transaction_id INT UNSIGNED NULL AFTER reference_no');
    await q('ALTER TABLE payments ADD CONSTRAINT fk_payment_txn FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id)');
    done.push('payments.transaction_id');
  }
  return done;
}

module.exports = { migrate };
