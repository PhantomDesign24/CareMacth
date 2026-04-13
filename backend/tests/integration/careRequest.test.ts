import request from 'supertest';
import app from '../../src/app';
import { generateTestToken } from '../helpers/auth';

describe('Care Request API', () => {
  describe('GET /api/care-requests', () => {
    it('인증 없이 → 401', async () => {
      const res = await request(app).get('/api/care-requests');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/care-requests', () => {
    it('인증 없이 → 401', async () => {
      const res = await request(app)
        .post('/api/care-requests')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('매칭 API', () => {
    it('POST /api/matching/auto/:id 인증 없이 → 401', async () => {
      const res = await request(app)
        .post('/api/matching/auto/fake-id');
      expect(res.status).toBe(401);
    });

    it('GET /api/matching/candidates/:id 인증 없이 → 401', async () => {
      const res = await request(app)
        .get('/api/matching/candidates/fake-id');
      expect(res.status).toBe(401);
    });
  });
});
