const { request, app, pool, query, resetAndSeed, staffAgent, PASSWORD } = require('./helpers');

beforeAll(resetAndSeed);
afterAll(() => pool.end());

describe('EP01 - System User & Access Management', () => {
  let admin;
  let newStaffId;
  beforeAll(async () => { admin = await staffAgent(); });

  test('US03 - login succeeds with valid credentials and sets an httpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/staff/login').send({ email: 'staff@devma.lk', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.staff.role_name).toBe('Shop Staff');
    expect(res.body.staff.permissions).toContain('orders.confirm');
    expect(res.headers['set-cookie'][0]).toMatch(/devma_staff=.*HttpOnly/);
    expect(res.body.staff.password_hash).toBeUndefined();
  });

  test('US03 - wrong password is rejected with a generic message', async () => {
    const res = await request(app).post('/api/auth/staff/login').send({ email: 'staff@devma.lk', password: 'wrong-pass1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('US03 - protected routes require login', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
  });

  test('US01 - admin creates a staff account (must change password on first login)', async () => {
    const roles = (await admin.get('/api/roles')).body.data;
    const shopStaff = roles.find((r) => r.name === 'Shop Staff');
    const res = await admin.post('/api/staff').send({
      fullName: 'Sanduni Test', email: 'sanduni@devma.lk', phone: '0771112223', roleId: shopStaff.id, password: 'TempPass123',
    });
    expect(res.status).toBe(201);
    expect(res.body.staff.must_change_password).toBe(1);
    newStaffId = res.body.staff.id;
  });

  test('US01 - validation errors and duplicate email', async () => {
    const bad = await admin.post('/api/staff').send({ fullName: 'A', email: 'bad', roleId: 0, password: 'short' });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.errors)).toEqual(expect.arrayContaining(['fullName', 'email', 'roleId', 'password']));
    const dup = await admin.post('/api/staff').send({ fullName: 'Dup User', email: 'sanduni@devma.lk', roleId: 1, password: 'TempPass123' });
    expect(dup.status).toBe(409);
  });

  test('US04 - new staff must change password before using the system', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/staff/login').send({ email: 'sanduni@devma.lk', password: 'TempPass123' }).expect(200);
    const blocked = await agent.get('/api/orders');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    const weak = await agent.put('/api/auth/staff/password').send({ currentPassword: 'TempPass123', newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' });
    expect(weak.status).toBe(422);
    const wrongCurrent = await agent.put('/api/auth/staff/password').send({ currentPassword: 'nope1234', newPassword: 'NewPass456', confirmPassword: 'NewPass456' });
    expect(wrongCurrent.status).toBe(422);
    const ok = await agent.put('/api/auth/staff/password').send({ currentPassword: 'TempPass123', newPassword: 'NewPass456', confirmPassword: 'NewPass456' });
    expect(ok.status).toBe(200);
    expect((await agent.get('/api/orders')).status).toBe(200);
  });

  test('US02 - role permissions are enforced by the API', async () => {
    const staff = await staffAgent('staff@devma.lk');
    expect((await staff.get('/api/staff')).status).toBe(403);
    expect((await staff.post('/api/roles').send({ name: 'X', permissions: [] })).status).toBe(403);
    expect((await staff.get('/api/audit-logs')).status).toBe(403);
    expect((await staff.get('/api/orders')).status).toBe(200);
    const support = await staffAgent('support@devma.lk');
    expect((await support.get('/api/orders')).status).toBe(403);
    expect((await support.get('/api/audit-logs')).status).toBe(200);
  });

  test('US02 - admin creates a custom role and assigns it; access changes immediately', async () => {
    const role = await admin.post('/api/roles').send({ name: 'Delivery Driver', description: 'Deliveries only', permissions: ['deliveries.manage'] });
    expect(role.status).toBe(201);
    expect(role.body.role.permissions).toEqual(['deliveries.manage']);
    const bad = await admin.post('/api/roles').send({ name: 'Bad', permissions: ['not.real'] });
    expect(bad.status).toBe(422);

    const sanduni = await staffAgent('sanduni@devma.lk', 'NewPass456');
    expect((await sanduni.get('/api/orders')).status).toBe(200);
    await admin.patch(`/api/staff/${newStaffId}/role`).send({ roleId: role.body.role.id }).expect(200);
    expect((await sanduni.get('/api/orders')).status).toBe(403);
    expect((await sanduni.get('/api/deliveries')).status).toBe(200);

    // Role in use cannot be deleted; system roles cannot be deleted.
    expect((await admin.delete(`/api/roles/${role.body.role.id}`)).status).toBe(409);
    expect((await admin.delete('/api/roles/1')).status).toBe(400);
  });

  test('US05 - deactivated staff are signed out on their next request and cannot log in', async () => {
    const sanduni = await staffAgent('sanduni@devma.lk', 'NewPass456');
    await admin.patch(`/api/staff/${newStaffId}/status`).send({ isActive: false, reason: 'Left the business' }).expect(200);
    expect((await sanduni.get('/api/deliveries')).status).toBe(401);
    const login = await request(app).post('/api/auth/staff/login').send({ email: 'sanduni@devma.lk', password: 'NewPass456' });
    expect(login.status).toBe(403);
  });

  test('US05 - admin cannot deactivate their own account', async () => {
    const res = await admin.patch('/api/staff/1/status').send({ isActive: false });
    expect(res.status).toBe(400);
  });

  test('US03 - account locks after 5 failed attempts', async () => {
    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/auth/staff/login').send({ email: 'support@devma.lk', password: 'Wrong1234' }).expect(401);
    }
    const fifth = await request(app).post('/api/auth/staff/login').send({ email: 'support@devma.lk', password: 'Wrong1234' });
    expect(fifth.status).toBe(423);
    const correct = await request(app).post('/api/auth/staff/login').send({ email: 'support@devma.lk', password: PASSWORD });
    expect(correct.status).toBe(423);
    // Admin password reset unlocks the account.
    await admin.post('/api/staff/3/reset-password').send({ password: 'Reset1234' }).expect(200);
    const after = await request(app).post('/api/auth/staff/login').send({ email: 'support@devma.lk', password: 'Reset1234' });
    expect(after.status).toBe(200);
    expect(after.body.staff.must_change_password).toBe(true);
  });

  test('US06 - access and audit records are captured and filterable', async () => {
    const res = await admin.get('/api/audit-logs?category=access&limit=100');
    expect(res.status).toBe(200);
    const actions = res.body.data.map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'LOGIN_BLOCKED', 'PASSWORD_CHANGED']));
    const all = (await admin.get('/api/audit-logs?limit=100')).body.data.map((a) => a.action);
    expect(all).toEqual(expect.arrayContaining(['STAFF_CREATED', 'ROLE_CREATED', 'STAFF_ROLE_CHANGED', 'STAFF_DEACTIVATED', 'STAFF_PASSWORD_RESET']));
    const [row] = await query(`SELECT ip_address FROM audit_logs WHERE action = 'LOGIN_SUCCESS' LIMIT 1`);
    expect(row.ip_address).toBeTruthy();
  });
});
