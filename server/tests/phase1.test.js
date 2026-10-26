const request = require('supertest');
const app = require('../src/app');
const Shop = require('../src/models/Shop');
const User = require('../src/models/User');
const { setupDB } = require('./setup');

setupDB();

describe('Phase 1: Foundation Checks', () => {
  describe('Health Route', () => {
    it('GET /api/health should return 200 with status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('database');
    });
  });

  describe('Auth & Role Permissions', () => {
    let testShopA;

    beforeEach(async () => {
      testShopA = await Shop.create({
        name: 'Shop Alpha',
        code: 'shop-alpha',
        address: 'Building A, Room 101',
        phone: '1111111111'
      });
    });

    it('should register a student successfully', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Student One',
        email: 'student1@example.com',
        password: 'password123',
        role: 'student'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('student1@example.com');
      expect(res.body.user.role).toBe('student');
      expect(res.body).toHaveProperty('token');
    });

    it('should reject duplicate email registration with 409', async () => {
      await User.create({
        name: 'Existing User',
        email: 'duplicate@example.com',
        password: 'password123',
        role: 'student'
      });

      const res = await request(app).post('/api/auth/register').send({
        name: 'Duplicate Guy',
        email: 'duplicate@example.com',
        password: 'password123',
        role: 'student'
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('should require shopId when registering an operator or owner', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Operator Without Shop',
        email: 'operator_fail@example.com',
        password: 'password123',
        role: 'operator'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Shop ID is required/i);
    });

    it('should register an operator with a valid shopId', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Operator Alpha',
        email: 'op_alpha@example.com',
        password: 'password123',
        role: 'operator',
        shopId: testShopA._id.toString()
      });

      expect(res.status).toBe(201);
      expect(res.body.user.shopId).toBe(testShopA._id.toString());
      expect(res.body.user.role).toBe('operator');
    });

    it('should authenticate with login and return cookie & user object', async () => {
      await User.create({
        name: 'Login Test',
        email: 'logintest@example.com',
        password: 'password123',
        role: 'student'
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'logintest@example.com',
        password: 'password123'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.body.user.email).toBe('logintest@example.com');
    });

    it('should reject invalid password with 401', async () => {
      await User.create({
        name: 'Login Test',
        email: 'logintest@example.com',
        password: 'password123',
        role: 'student'
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'logintest@example.com',
        password: 'wrongpassword'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should get current profile with /api/auth/me', async () => {
      await User.create({
        name: 'Me Test',
        email: 'me@example.com',
        password: 'password123',
        role: 'student'
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'me@example.com',
        password: 'password123'
      });

      const token = loginRes.body.token;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('me@example.com');
    });
  });

  describe('Shop Isolation & Role Middleware', () => {
    let shopA, shopB;
    let studentToken, operatorAToken, ownerAToken;

    beforeEach(async () => {
      shopA = await Shop.create({
        name: 'Shop A',
        code: 'shop-a',
        address: 'Campus North',
        phone: '123'
      });

      shopB = await Shop.create({
        name: 'Shop B',
        code: 'shop-b',
        address: 'Campus South',
        phone: '456'
      });

      // Student
      const studentRes = await request(app).post('/api/auth/register').send({
        name: 'Student',
        email: 'student@test.com',
        password: 'password123',
        role: 'student'
      });
      studentToken = studentRes.body.token;

      // Operator for Shop A
      const opRes = await request(app).post('/api/auth/register').send({
        name: 'Operator A',
        email: 'op_a@test.com',
        password: 'password123',
        role: 'operator',
        shopId: shopA._id.toString()
      });
      operatorAToken = opRes.body.token;

      // Owner for Shop A
      const ownerRes = await request(app).post('/api/auth/register').send({
        name: 'Owner A',
        email: 'owner_a@test.com',
        password: 'password123',
        role: 'owner',
        shopId: shopA._id.toString()
      });
      ownerAToken = ownerRes.body.token;
    });

    it('should deny student access to shop staff dashboard (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/shops/${shopA._id}/dashboard`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow Operator A to access Shop A dashboard', async () => {
      const res = await request(app)
        .get(`/api/shops/${shopA._id}/dashboard`)
        .set('Authorization', `Bearer ${operatorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('stats');
    });

    it('STRICT ISOLATION: should DENY Operator A from accessing Shop B dashboard (403)', async () => {
      const res = await request(app)
        .get(`/api/shops/${shopB._id}/dashboard`)
        .set('Authorization', `Bearer ${operatorAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Access denied: Cannot access or modify another shop's data/i);
    });

    it('STRICT ISOLATION: should DENY Operator A from updating Shop B settings (403)', async () => {
      const res = await request(app)
        .put(`/api/shops/${shopB._id}/settings`)
        .set('Authorization', `Bearer ${operatorAToken}`)
        .send({
          pricing: { bwPerPage: 5 }
        });

      expect(res.status).toBe(403);
    });

    it('should restrict agent key retrieval to Shop Owner only (Operator gets 403)', async () => {
      const opRes = await request(app)
        .get(`/api/shops/${shopA._id}/agent-key`)
        .set('Authorization', `Bearer ${operatorAToken}`);

      expect(opRes.status).toBe(403);

      const ownerRes = await request(app)
        .get(`/api/shops/${shopA._id}/agent-key`)
        .set('Authorization', `Bearer ${ownerAToken}`);

      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body).toHaveProperty('agentKey');
    });
  });
});
