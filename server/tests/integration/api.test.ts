import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app.js';

jest.mock('../../src/utils/database.js', () => ({ connectDB: jest.fn() }));

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('should return 200 with health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ─── Auth endpoints ────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password123',
  };

  it('should register a new user and return access token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.headers['set-cookie']).toBeDefined(); // refresh token cookie
  });

  it('should reject weak passwords', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
  });

  it('should reject duplicate emails', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Login Test',
      email: 'login@example.com',
      password: 'Password123',
    });
  });

  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPass999' });
    expect(res.status).toBe(401);
  });

  it('should reject non-existent user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123' });
    expect(res.status).toBe(401);
  });
});

// ─── Protected routes ─────────────────────────────────────────────────────────
describe('GET /api/v1/auth/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Me Test',
      email: 'me@example.com',
      password: 'Password123',
    });
    accessToken = res.body.data.accessToken;
  });

  it('should return current user when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@example.com');
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── Groups ───────────────────────────────────────────────────────────────────
describe('Group APIs', () => {
  let accessToken: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Group Owner',
      email: 'owner@example.com',
      password: 'Password123',
    });
    accessToken = res.body.data.accessToken;
  });

  it('should create a group', async () => {
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Trip Group', currency: 'USD' });
    expect(res.status).toBe(201);
    expect(res.body.data.group.name).toBe('Trip Group');
    expect(res.body.data.group.inviteCode).toBeDefined();
  });

  it('should list my groups', async () => {
    await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'My Group', currency: 'INR' });

    const res = await request(app)
      .get('/api/v1/groups')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.groups.length).toBeGreaterThan(0);
  });

  it('should not allow access to groups without auth', async () => {
    const res = await request(app).get('/api/v1/groups');
    expect(res.status).toBe(401);
  });
});
