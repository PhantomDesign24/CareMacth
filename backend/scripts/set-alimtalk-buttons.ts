import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// 도메인 변경에 강건하도록 변수화 — 발송 시 {{webBase}} → 실제 도메인 치환
const BASE = 'https://{{webBase}}';

// 키별 버튼 정의 — WL(웹링크) 위주, 일부 AC(채널추가)·BC(상담말하기) 포함
const BUTTONS: Record<string, any[]> = {
  // WELCOME 은 비즈채널이 채널추가 버튼 미지원이라 WL 만
  WELCOME_GUARDIAN: [
    { name: '앱 시작하기', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  WELCOME_CAREGIVER: [
    { name: '프로필 등록', linkType: 'WL', linkMo: `${BASE}/dashboard/caregiver/documents`, linkPc: `${BASE}/dashboard/caregiver/documents` },
  ],
  CAREGIVER_APPROVED: [
    { name: '지원하기', linkType: 'WL', linkMo: `${BASE}/find-work`, linkPc: `${BASE}/find-work` },
  ],
  CAREGIVER_REJECTED: [
    { name: '내역 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/caregiver`, linkPc: `${BASE}/dashboard/caregiver` },
  ],
  PENALTY_ISSUED: [
    { name: '내역 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/caregiver`, linkPc: `${BASE}/dashboard/caregiver` },
  ],
  PENALTY_SUSPENDED: [
    { name: '내역 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/caregiver`, linkPc: `${BASE}/dashboard/caregiver` },
    { name: '고객센터', linkType: 'BC' },
  ],
  PENALTY_BLACKLISTED: [
    { name: '내역 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/caregiver`, linkPc: `${BASE}/dashboard/caregiver` },
    { name: '고객센터', linkType: 'BC' },
  ],
  PENALTY_UNBLACKLISTED: [
    { name: '활동 시작', linkType: 'WL', linkMo: `${BASE}/find-work`, linkPc: `${BASE}/find-work` },
  ],
  MATCHING_NEW: [
    { name: '공고 보기', linkType: 'WL', linkMo: `${BASE}/find-work`, linkPc: `${BASE}/find-work` },
  ],
  APPLICATION_GUARDIAN_NEW: [
    { name: '지원자 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  MATCH_STALE_GUIDE_GUARDIAN: [
    { name: '상담 연결', linkType: 'BC' },
    { name: '매칭 상태', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  CONTRACT_SIGNED_GUARDIAN: [
    { name: '계약 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  CONTRACT_SIGNED_CAREGIVER: [
    { name: '계약 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/caregiver`, linkPc: `${BASE}/dashboard/caregiver` },
  ],
  CONTRACT_CANCELLED_BY_GUARDIAN: [
    { name: '내역 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/caregiver`, linkPc: `${BASE}/dashboard/caregiver` },
  ],
  CONTRACT_CANCELLED_BY_CAREGIVER: [
    { name: '내역 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  CARE_RECORD_CREATED: [
    { name: '일지 보기', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  PAYMENT_COMPLETED: [
    { name: '결제 내역', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  EXTENSION_REQUEST: [
    { name: '수락/거절', linkType: 'WL', linkMo: `${BASE}/dashboard/caregiver`, linkPc: `${BASE}/dashboard/caregiver` },
  ],
  EXTENSION_CONFIRMED: [
    { name: '내역 확인', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  EXTENSION_REMINDER_3D: [
    { name: '연장 신청', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  EXTENSION_REMINDER_1D: [
    { name: '연장 신청', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  PAYMENT_EXTENSION_REQUIRED: [
    { name: '결제하기', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  INSURANCE_PROCESSING: [
    { name: '신청 내역', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  INSURANCE_COMPLETED: [
    // 실제 발송 시점에 동적 토큰 URL 로 override 됨 (insuranceController). 알리고 등록용은 도메인+placeholder.
    { name: '서류 받기', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
  INSURANCE_REJECTED: [
    { name: '다시 신청', linkType: 'WL', linkMo: `${BASE}/dashboard/guardian`, linkPc: `${BASE}/dashboard/guardian` },
  ],
};

(async () => {
  let updated = 0;
  for (const [key, buttons] of Object.entries(BUTTONS)) {
    const exists = await prisma.notificationTemplate.findUnique({ where: { key } });
    if (!exists) {
      console.log(`  [SKIP] ${key} — 템플릿 없음`);
      continue;
    }
    await prisma.notificationTemplate.update({
      where: { key },
      data: { alimtalkButtonsJson: JSON.stringify(buttons) },
    });
    updated++;
    console.log(`  [OK]   ${key} — ${buttons.length}개 버튼`);
  }
  console.log(`\n총 ${updated}개 템플릿 버튼 저장 완료.`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
