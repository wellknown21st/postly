const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Auth Endpoints', () => {
  let userToken;

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
        name: 'Test User'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('should login an existing user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Password123!'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toHaveProperty('accessToken');
    userToken = res.body.data.accessToken;
  });

  it('should fail login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });
    
    expect(res.statusCode).toEqual(401);
  });

  it('should get current user profile with token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.email).toBe('test@example.com');
  });
});
