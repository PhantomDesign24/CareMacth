import crypto from 'crypto';

export const generateReferralCode = (): string => {
  return 'CM' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

export const generateOrderId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `ORD-${timestamp}-${random}`.toUpperCase();
};
