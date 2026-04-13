import request from 'supertest';
import app from '../../src/app';

describe('보안 테스트', () => {
  describe('보안 헤더', () => {
    it('X-Content-Type-Options: nosniff 포함', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('X-Frame-Options 헤더 포함', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('X-Powered-By 헤더 제거됨 (helmet)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('XSS 방어', () => {
    it('스크립트 태그 포함 요청 → 서버 안전 처리', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: '<script>alert("xss")</script>',
          password: 'test123',
        });
      // 서버가 안전하게 에러 반환 (크래시 없음)
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('대용량 요청 방어', () => {
    it('초대형 JSON body → 413 또는 400', async () => {
      const largePayload = { data: 'x'.repeat(15 * 1024 * 1024) }; // 15MB
      const res = await request(app)
        .post('/api/auth/login')
        .send(largePayload);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('존재하지 않는 라우트', () => {
    it('GET /api/nonexistent → 404', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('SQL Injection 방어', () => {
    it('로그인에 SQL 주입 시도 → 정상 에러 응답', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin' OR '1'='1",
          password: "' OR '1'='1",
        });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('결제 API 보안', () => {
    it('인증 없이 결제 접근 → 401', async () => {
      const res = await request(app).get('/api/payments');
      expect(res.status).toBe(401);
    });
  });

  describe('관리자 API 보안', () => {
    it('인증 없이 관리자 라우트 접근 → 401', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
    });
  });
});
