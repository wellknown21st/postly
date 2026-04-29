const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

jest.mock('../src/services/aiEngine', () => ({
  generate: jest.fn().mockResolvedValue({
    platforms: {
      TWITTER: "Mock Twitter content #ai",
      LINKEDIN: "Mock LinkedIn content. #professional"
    },
    metadata: { charCounts: {}, tokensUsed: {}, model: 'MOCK' }
  })
}));

describe('Content API validation', () => {
  let userToken;

  beforeAll(async () => {
    // Register to get a token
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'content@example.com',
        username: 'contentuser',
        password: 'Password123!'
      });
    userToken = res.body.data.accessToken;
  });

  it('should reject generation request without required fields', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    
    expect(res.statusCode).toEqual(422);
    expect(res.body.error).toHaveProperty('details');
  });

  it('should successfully mock generate content', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        idea: "A new AI tool that helps developers",
        platforms: ["TWITTER", "LINKEDIN"]
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.platforms).toHaveProperty('TWITTER');
  });
});
