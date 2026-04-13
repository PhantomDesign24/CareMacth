import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'carematch-secret-key';

export function generateTestToken(payload: {
  id: string;
  email: string;
  role: string;
}): string {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
}

export const mockGuardian = {
  id: 'test-guardian-user-id',
  email: 'guardian@test.com',
  role: 'GUARDIAN',
};

export const mockCaregiver = {
  id: 'test-caregiver-user-id',
  email: 'caregiver@test.com',
  role: 'CAREGIVER',
};

export const mockAdmin = {
  id: 'test-admin-user-id',
  email: 'admin@test.com',
  role: 'ADMIN',
};
