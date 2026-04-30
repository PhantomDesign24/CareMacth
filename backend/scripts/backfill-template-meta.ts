import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 알림 템플릿별 채널/대상 메타데이터 매핑
// 정책: 신규는 PUSH 기본, WELCOME 은 알림톡(추후 ALIMTALK), 양측은 길이 2 이상
type Meta = {
  channels: string[]; // PUSH | ALIMTALK | EMAIL
  targetRoles: string[]; // GUARDIAN | CAREGIVER | ADMIN | HOSPITAL
};

const META: Record<string, Meta> = {
  // ── 회원가입 환영 — 알림톡 전용 (검수 후 활성화), 지금은 채널 비워둠
  WELCOME_GUARDIAN: { channels: [], targetRoles: ['GUARDIAN'] },
  WELCOME_CAREGIVER: { channels: [], targetRoles: ['CAREGIVER'] },

  // ── 매칭/요청
  MATCHING_NEW: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  MATCHING_RATE_RAISED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  MATCHING_REGION_EXPANDED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  CARE_REQUEST_AUTO_FAILED: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  MATCH_STALE_GUIDE_GUARDIAN: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },

  // ── 지원 (간병인 → 보호자 / 보호자 → 간병인)
  APPLICATION_GUARDIAN_NEW: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  APPLICATION_ACCEPTED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  APPLICATION_REJECTED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },

  // ── 계약 (양측발송 = targetRoles 길이 2)
  CONTRACT_CREATED: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  CONTRACT_DISSOLVED: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  CONTRACT_FORCE_CANCELLED: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  CONTRACT_RESTORED: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  CONTRACT_EMERGENCY_REMATCH: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  CONTRACT_CANCELLED_BY_CAREGIVER: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  CONTRACT_CANCELLED_BY_GUARDIAN: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  CONTRACT_SIGNED_CAREGIVER: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  CONTRACT_SIGNED_GUARDIAN: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },

  // ── 연장
  EXTENSION_REQUEST: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  EXTENSION_CONFIRMED: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  EXTENSION_REMINDER_3D: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  EXTENSION_REMINDER_1D: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },

  // ── 결제/환불
  PAYMENT_COMPLETED: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  PAYMENT_EXTENSION_REQUIRED: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  PAYMENT_EXTENSION_DIRECT: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  PAYMENT_AUTO_EXPIRED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  REFUND_APPROVED_GUARDIAN: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  REFUND_APPROVED_CAREGIVER: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  REFUND_PARTIAL_GUARDIAN: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  REFUND_PARTIAL_CAREGIVER: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  REFUND_REJECTED: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  REFUND_REQUEST_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  ADDITIONAL_FEE_APPROVED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  ADDITIONAL_FEE_REJECTED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  ADDITIONAL_FEE_REQUEST: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },

  // ── 정산
  SETTLEMENT_PAID: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  SETTLEMENT_BULK_PAID: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  SETTLEMENT_MID_CREATED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },

  // ── 간병일지
  CARE_RECORD_CREATED: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  CHECK_IN: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },
  CHECK_OUT: { channels: ['PUSH'], targetRoles: ['GUARDIAN'] },

  // ── 간병인 검수/패널티/블랙리스트
  CAREGIVER_APPROVED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  CAREGIVER_REJECTED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  CAREGIVER_AUTO_SUSPENDED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  CAREGIVER_SIGNUP_PENDING_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  CAREGIVER_WORK_STATUS_CHANGED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  PENALTY_ISSUED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  PENALTY_SUSPENDED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  PENALTY_BLACKLISTED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  PENALTY_UNBLACKLISTED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },

  // ── 보험서류
  INSURANCE_REQUESTED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  INSURANCE_PROCESSING: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  INSURANCE_COMPLETED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  INSURANCE_REJECTED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },
  INSURANCE_REREVIEW: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },

  // ── 분쟁/신고/리뷰
  DISPUTE_CREATED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  DISPUTE_STATUS_UPDATED: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
  REPORT_CREATED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  REVIEW_CREATED: { channels: ['PUSH'], targetRoles: ['CAREGIVER'] },

  // ── 서류 업로드 (관리자)
  CERTIFICATE_UPLOADED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  ID_CARD_UPLOADED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },
  CRIMINAL_CHECK_UPLOADED_ADMIN: { channels: ['PUSH'], targetRoles: ['ADMIN'] },

  // ── 시스템
  SYSTEM_SESSION_EXPIRED: { channels: ['PUSH'], targetRoles: ['GUARDIAN', 'CAREGIVER'] },
};

(async () => {
  const tpls = await prisma.notificationTemplate.findMany({ select: { key: true } });
  let updated = 0;
  let unmapped: string[] = [];
  for (const t of tpls) {
    const meta = META[t.key];
    if (!meta) {
      unmapped.push(t.key);
      continue;
    }
    await prisma.notificationTemplate.update({
      where: { key: t.key },
      data: { channels: meta.channels, targetRoles: meta.targetRoles },
    });
    updated += 1;
  }
  console.log(`✓ 업데이트: ${updated}개`);
  if (unmapped.length > 0) {
    console.log(`⚠ 매핑 안된 키 ${unmapped.length}개:`);
    unmapped.forEach((k) => console.log(`  - ${k}`));
  }
  await prisma.$disconnect();
})();
