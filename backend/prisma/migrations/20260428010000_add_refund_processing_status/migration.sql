-- Add PROCESSING value to RefundRequestStatus enum
-- (관리자 직접 환불 락 — executeRefund 진행 중 다른 시도 차단)
ALTER TYPE "RefundRequestStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
