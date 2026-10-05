-- =====================================================================
-- Devma Cake n' Party Management System - MySQL 8 schema
-- Project ID: ISE_WE_0101_30
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs, notifications, deliveries, payments, payment_transactions, payment_methods, order_status_history,
  cake_requirements, order_items, orders, inventory_transactions, products, categories,
  customers, staff, role_permissions, permissions, roles;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- EP01 - System User & Access Management
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL UNIQUE,
  description   VARCHAR(255) NULL,
  is_system     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(60)  NOT NULL UNIQUE,
  description   VARCHAR(255) NOT NULL,
  module        VARCHAR(60)  NOT NULL
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id       INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE staff (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name              VARCHAR(100) NOT NULL,
  email                  VARCHAR(150) NOT NULL UNIQUE,
  phone                  VARCHAR(20)  NULL,
  password_hash          VARCHAR(100) NOT NULL,
  role_id                INT UNSIGNED NOT NULL,
  is_active              TINYINT(1)   NOT NULL DEFAULT 1,
  must_change_password   TINYINT(1)   NOT NULL DEFAULT 1,
  failed_login_attempts  INT          NOT NULL DEFAULT 0,
  locked_until           DATETIME     NULL,
  last_login_at          DATETIME     NULL,
  password_changed_at    DATETIME     NULL,
  created_by             INT UNSIGNED NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_staff_creator FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- EP03 - Customers
-- ---------------------------------------------------------------------
CREATE TABLE customers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  phone         VARCHAR(20)  NOT NULL,
  address       VARCHAR(255) NULL,
  city          VARCHAR(80)  NULL,
  password_hash VARCHAR(100) NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- EP02 - Cake, Party Decoration Product & Inventory Management
-- ---------------------------------------------------------------------
-- Cards verified at checkout for "pay online" orders. The gateway keeps the card itself and gives the
-- shop a token; only the brand, last four digits and expiry are kept here (never the number or CVC).
CREATE TABLE payment_methods (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id      INT UNSIGNED  NOT NULL,
  gateway_token    VARCHAR(40)   NOT NULL UNIQUE,
  card_brand       VARCHAR(20)   NOT NULL,
  card_last4       CHAR(4)       NOT NULL,
  card_holder      VARCHAR(100)  NOT NULL,
  exp_month        TINYINT UNSIGNED  NOT NULL,
  exp_year         SMALLINT UNSIGNED NOT NULL,
  -- Sandbox only: how the simulated bank answers charges on this token (a real gateway decides this itself).
  sandbox_outcome  VARCHAR(40)   NOT NULL DEFAULT 'approved',
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pm_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE categories (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  type          ENUM('CAKE','DECORATION') NOT NULL,
  description   VARCHAR(255) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_category_name_type (name, type)
) ENGINE=InnoDB;

CREATE TABLE products (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id     INT UNSIGNED  NOT NULL,
  name            VARCHAR(120)  NOT NULL,
  sku             VARCHAR(40)   NOT NULL UNIQUE,
  description     TEXT          NULL,
  price           DECIMAL(10,2) NOT NULL,
  image_url       VARCHAR(255)  NULL,
  product_type    ENUM('CAKE','DECORATION') NOT NULL,
  is_available    TINYINT(1)    NOT NULL DEFAULT 1,
  stock_quantity  INT           NOT NULL DEFAULT 0,
  reorder_level   INT           NOT NULL DEFAULT 5,
  created_by      INT UNSIGNED  NULL,
  updated_by      INT UNSIGNED  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_price CHECK (price >= 0),
  CONSTRAINT chk_stock CHECK (stock_quantity >= 0),
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_product_created_by FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL,
  CONSTRAINT fk_product_updated_by FOREIGN KEY (updated_by) REFERENCES staff(id) ON DELETE SET NULL,
  KEY idx_product_type (product_type, is_available)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- EP03 / EP04 - Orders
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number       VARCHAR(30)   NOT NULL UNIQUE,
  customer_id        INT UNSIGNED  NOT NULL,
  status             ENUM('PENDING','CONFIRMED','IN_PREPARATION','READY','OUT_FOR_DELIVERY',
                          'READY_FOR_COLLECTION','COMPLETED','CANCELLED','REJECTED')
                     NOT NULL DEFAULT 'PENDING',
  payment_status     ENUM('UNPAID','PARTIALLY_PAID','PAID','REFUNDED') NOT NULL DEFAULT 'UNPAID',
  -- ONLINE: paid by card through the payment gateway before preparation (required for custom cakes).
  -- CASH_ON_DELIVERY: paid in cash when delivered or collected (orders without a custom cake only).
  payment_option     ENUM('ONLINE','CASH_ON_DELIVERY') NOT NULL DEFAULT 'ONLINE',
  -- The card verified at checkout for ONLINE orders; it is charged when the order is confirmed.
  payment_method_id  INT UNSIGNED  NULL,
  fulfillment_type   ENUM('DELIVERY','COLLECTION') NOT NULL,
  event_date         DATE          NOT NULL,
  subtotal           DECIMAL(10,2) NOT NULL DEFAULT 0,
  cake_quote_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_deducted     TINYINT(1)    NOT NULL DEFAULT 0,
  customer_notes     VARCHAR(500)  NULL,
  staff_notes        VARCHAR(500)  NULL,
  cancel_reason      VARCHAR(255)  NULL,
  confirmed_by       INT UNSIGNED  NULL,
  confirmed_at       DATETIME      NULL,
  completed_at       DATETIME      NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_order_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES staff(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
  KEY idx_order_status (status),
  KEY idx_order_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      INT UNSIGNED  NOT NULL,
  product_id    INT UNSIGNED  NOT NULL,
  product_name  VARCHAR(120)  NOT NULL,
  product_type  ENUM('CAKE','DECORATION') NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  quantity      INT           NOT NULL,
  line_total    DECIMAL(10,2) NOT NULL,
  notes         VARCHAR(150)  NULL,
  CONSTRAINT chk_item_qty CHECK (quantity > 0),
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE cake_requirements (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id             INT UNSIGNED  NOT NULL UNIQUE,
  occasion             VARCHAR(80)   NOT NULL,
  flavor               VARCHAR(80)   NOT NULL,
  weight_kg            DECIMAL(5,2)  NOT NULL,
  shape                VARCHAR(40)   NOT NULL,
  tiers                TINYINT       NOT NULL DEFAULT 1,
  icing_type           VARCHAR(60)   NULL,
  colors               VARCHAR(120)  NULL,
  theme                VARCHAR(150)  NULL,
  message_on_cake      VARCHAR(120)  NULL,
  dietary_notes        VARCHAR(255)  NULL,
  additional_details   VARCHAR(1000) NULL,
  reference_image_url  VARCHAR(255)  NULL,
  quoted_price         DECIMAL(10,2) NULL,
  CONSTRAINT fk_cake_req_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE order_status_history (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id             INT UNSIGNED NOT NULL,
  from_status          VARCHAR(30)  NULL,
  to_status            VARCHAR(30)  NOT NULL,
  note                 VARCHAR(500) NULL,
  changed_by_staff_id  INT UNSIGNED NULL,
  changed_by_customer  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_hist_staff FOREIGN KEY (changed_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE inventory_transactions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id    INT UNSIGNED NOT NULL,
  change_qty    INT          NOT NULL,
  type          ENUM('INITIAL','RESTOCK','ADJUSTMENT','ORDER_DEDUCT','ORDER_RESTORE') NOT NULL,
  reason        VARCHAR(255) NULL,
  balance_after INT          NOT NULL,
  staff_id      INT UNSIGNED NULL,
  order_id      INT UNSIGNED NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  KEY idx_inv_product (product_id, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- EP04 - Payments & Delivery / Collection
-- ---------------------------------------------------------------------
-- Card transactions handled by the built-in (sandbox) payment gateway. Only the brand and
-- last four digits of a card are kept: never the full number or the CVC.
CREATE TABLE payment_transactions (
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
) ENGINE=InnoDB;

-- Money in (PAYMENT) and money returned (REFUND). Amounts are always positive;
-- the amount paid on an order is SUM(payments) - SUM(refunds).
CREATE TABLE payments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id       INT UNSIGNED  NOT NULL,
  kind           ENUM('PAYMENT','REFUND') NOT NULL DEFAULT 'PAYMENT',
  amount         DECIMAL(10,2) NOT NULL,
  method         ENUM('CASH','BANK_TRANSFER','CARD','ONLINE_TRANSFER') NOT NULL,
  reference_no   VARCHAR(80)   NULL,
  transaction_id INT UNSIGNED  NULL,
  paid_at        DATETIME      NOT NULL,
  notes          VARCHAR(255)  NULL,
  recorded_by    INT UNSIGNED  NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_payment_amount CHECK (amount > 0),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_staff FOREIGN KEY (recorded_by) REFERENCES staff(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_txn FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id),
  KEY idx_payment_date (paid_at)
) ENGINE=InnoDB;

CREATE TABLE deliveries (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id             INT UNSIGNED NOT NULL UNIQUE,
  type                 ENUM('DELIVERY','COLLECTION') NOT NULL,
  recipient_name       VARCHAR(100) NOT NULL,
  contact_phone        VARCHAR(20)  NOT NULL,
  address              VARCHAR(255) NULL,
  city                 VARCHAR(80)  NULL,
  scheduled_date       DATE         NULL,
  scheduled_time_slot  VARCHAR(40)  NULL,
  assigned_staff_id    INT UNSIGNED NULL,
  status               ENUM('PENDING','SCHEDULED','OUT_FOR_DELIVERY','DELIVERED',
                            'READY_FOR_COLLECTION','COLLECTED','FAILED') NOT NULL DEFAULT 'PENDING',
  notes                VARCHAR(255) NULL,
  completed_at         DATETIME     NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_delivery_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_delivery_staff FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  KEY idx_delivery_date (scheduled_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- US24 - Customer notifications
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT UNSIGNED NOT NULL,
  order_id     INT UNSIGNED NULL,
  title        VARCHAR(120) NOT NULL,
  message      VARCHAR(500) NOT NULL,
  is_read      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  KEY idx_notif_customer (customer_id, is_read)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- US06 - Access & audit records
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_type   ENUM('STAFF','CUSTOMER','SYSTEM') NOT NULL,
  actor_id     INT UNSIGNED NULL,
  actor_name   VARCHAR(150) NULL,
  action       VARCHAR(60)  NOT NULL,
  entity_type  VARCHAR(40)  NULL,
  entity_id    INT UNSIGNED NULL,
  details      JSON         NULL,
  ip_address   VARCHAR(64)  NULL,
  user_agent   VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at),
  KEY idx_audit_actor (actor_type, actor_id)
) ENGINE=InnoDB;
