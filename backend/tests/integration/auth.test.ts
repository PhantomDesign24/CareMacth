import request from 'supertest';
import app from '../../src/app';

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('빈 body → 401 에러', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('잘못된 이메일 → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong123' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('필수 필드 누락 → 400 에러', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' }); // password, name, phone, role 누락
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('인증 미들웨어', () => {
    it('토큰 없이 보호된 라우트 접근 → 401', async () => {
      const res = await request(app).get('/api/guardian/me');
      expect(res.status).toBe(401);
    });

    it('잘못된 토큰 → 401', async () => {
      const res = await request(app)
        .get('/api/guardian/me')
        .set('Authorization', 'Bearer invalid-token-here');
      expect(res.status).toBe(401);
    });

    it('Bearer 없는 토큰 → 401', async () => {
      const res = await request(app)
        .get('/api/guardian/me')
        .set('Authorization', 'some-token');
      expect(res.status).toBe(401);
    });
  });
});
