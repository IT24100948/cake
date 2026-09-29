process.env.NODE_ENV = 'test';
process.env.SEED_PASSWORD = 'TestPass123';
const request = require('supertest');
const app = require('../src/app');
const { pool, query } = require('../src/config/db');
const { resetDatabase } = require('../db/reset');
const { seed } = require('../db/seed');

const PASSWORD = 'TestPass123';

async function resetAndSeed() {
  await resetDatabase({ silent: true });
  await seed({ silent: true, withSampleOrders: false });
}

/** Returns a supertest agent logged in as the given staff member. */
async function staffAgent(email = 'admin@devma.lk', password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/staff/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

async function customerAgent(email = 'customer@devma.lk', password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/customer/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Customer login failed: ${res.status}`);
  return agent;
}

const productId = async (sku) => (await query('SELECT id FROM products WHERE sku = ?', [sku]))[0].id;
const stockOf = async (sku) => (await query('SELECT stock_quantity FROM products WHERE sku = ?', [sku]))[0].stock_quantity;

function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { request, app, pool, query, resetAndSeed, staffAgent, customerAgent, productId, stockOf, dayOffset, PASSWORD };
