import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UPDATES: { key: string; body: string }[] = [
  {
    key: 'WELCOME_GUARDIAN',
    body: `{{name}}님, 케어매치에 오신 것을 환영합니다.

▶ 다음 단계
환자 정보를 등록하고 간병 요청을 올려보세요.
빠른 매칭을 위해 환자 상태를 자세히 입력해주세요.`,
  },
  {
    key: 'WELCOME_CAREGIVER',
    body: `{{name}}님, 케어매치 간병인 가입을 환영합니다.

▶ 활동 시작 전 필수 등록
- 신분증
- 자격증
- 범죄이력 조회서

관리자 승인이 완료되면 매칭 알림을 받으실 수 있습니다.`,
  },
  {
    key: 'CAREGIVER_APPROVED',
    body: `간병인 승인이 완료되었습니다.

이제 간병 매칭 알림을 받으실 수 있습니다.
앱을 실행하여 활동을 시작해주세요.`,
  },
  {
    key: 'CAREGIVER_REJECTED',
    body: `간병인 가입 신청이 반려되었습니다.

▶ 사유
{{reason}}

서류 보완 후 재신청 부탁드립니다.`,
  },
  {
    key: 'PENALTY_ISSUED',
    body: `패널티가 부여되었습니다.

▶ 유형: {{penaltyType}}
▶ 사유: {{reason}}

자세한 내역은 마이페이지에서 확인해주세요.`,
  },
  {
    key: 'PENALTY_SUSPENDED',
    body: `회원님의 활동이 정지되었습니다.

▶ 사유
{{reason}}

누적 패널티 3회로 일시 정지 처리되었습니다. 문의는 고객센터로 연락주세요.`,
  },
  {
    key: 'PENALTY_BLACKLISTED',
    body: `계정이 정지(블랙리스트)되었습니다.

▶ 사유
{{reason}}

이의가 있으시면 고객센터로 연락주시기 바랍니다.`,
  },
  {
    key: 'PENALTY_UNBLACKLISTED',
    body: `블랙리스트가 해제되었습니다.

다시 정상적으로 활동하실 수 있습니다.`,
  },
  {
    key: 'MATCHING_NEW',
    body: `새로운 간병 공고가 도착했습니다.

▶ 위치: {{address}}
▶ 형태: {{scheduleType}}

지원하시려면 앱에서 공고를 확인해주세요.`,
  },
  {
    key: 'APPLICATION_GUARDIAN_NEW',
    body: `{{patientName}} 환자 공고에 새 간병인이 지원했습니다.

지원자 프로필을 확인하시고 매칭을 진행해주세요.`,
  },
  {
    key: 'MATCH_STALE_GUIDE_GUARDIAN',
    body: `{{patientName}} 환자의 간병 요청에 1시간 동안 지원자가 없습니다.

상담사와 연결하시거나 매칭을 취소하실 수 있습니다.`,
  },
  {
    key: 'CONTRACT_SIGNED_GUARDIAN',
    body: `매칭이 완료되었습니다.

▶ 간병인: {{caregiverName}}

계약 내용을 확인해주세요.`,
  },
  {
    key: 'CONTRACT_SIGNED_CAREGIVER',
    body: `간병 계약이 체결되었습니다.

▶ 환자: {{patientName}}
▶ 시작일: {{startDate}}

근무 일정을 확인해주세요.`,
  },
  {
    key: 'CONTRACT_CANCELLED_BY_GUARDIAN',
    body: `보호자가 계약을 취소했습니다.

▶ 사용일: {{usedDays}}일
▶ 정산금액: {{netEarning}}원

자세한 정산 내역은 마이페이지에서 확인해주세요.`,
  },
  {
    key: 'CONTRACT_CANCELLED_BY_CAREGIVER',
    body: `간병인이 계약을 취소했습니다.

▶ 사유
{{reason}}

새 간병인 매칭을 위해 공고를 재게시해드립니다.`,
  },
  {
    key: 'CARE_RECORD_CREATED',
    body: `{{patientName}} 환자의 간병일지가 작성되었습니다.

앱에서 일지 내용을 확인해주세요.`,
  },
  {
    key: 'PAYMENT_COMPLETED',
    body: `결제가 완료되었습니다.

▶ 결제금액: {{amount}}원

상세 내역은 결제 내역에서 확인해주세요.`,
  },
  {
    key: 'EXTENSION_REQUEST',
    body: `간병 연장 요청이 도착했습니다.

▶ 추가 일수: {{additionalDays}}일

수락 여부를 결정해주세요.`,
  },
  {
    key: 'EXTENSION_CONFIRMED',
    body: `간병 연장이 확정되었습니다.

▶ 정산 예정 금액: {{netAmount}}원

계속 안전한 간병 부탁드립니다.`,
  },
  {
    key: 'EXTENSION_REMINDER_3D',
    body: `{{patientName}} 환자의 간병이 3일 후 종료됩니다.

연장을 원하시면 마이페이지 → 연장 요청을 이용해주세요.`,
  },
  {
    key: 'EXTENSION_REMINDER_1D',
    body: `{{patientName}} 환자의 간병이 1일 후 종료됩니다.

연장이 필요하시면 빠르게 신청해주세요.`,
  },
  {
    key: 'PAYMENT_EXTENSION_REQUIRED',
    body: `연장 결제가 생성되었습니다.

▶ 결제금액: {{amount}}원

기간 내 결제를 완료해주세요.`,
  },
  {
    key: 'INSURANCE_PROCESSING',
    body: `{{patientName}} 환자분의 보험서류 신청이 접수되었습니다.

▶ 서류: {{docLabel}}

관리자가 검토 후 발급해드립니다.`,
  },
  {
    key: 'INSURANCE_COMPLETED',
    body: `{{patientName}} 환자분의 보험서류 발급이 완료되었습니다.

▶ 서류: {{docLabel}}

아래 '서류 받기' 버튼을 통해 다운로드 받으실 수 있습니다.`,
  },
  {
    key: 'INSURANCE_REJECTED',
    body: `{{patientName}} 환자분의 보험서류 신청이 거절되었습니다.

▶ 서류: {{docLabel}}
▶ 사유: {{reasonText}}

문제를 보완하신 후 재신청 부탁드립니다.`,
  },
];

(async () => {
  let updated = 0;
  for (const u of UPDATES) {
    const exists = await prisma.notificationTemplate.findUnique({ where: { key: u.key } });
    if (!exists) {
      console.log(`  [SKIP] ${u.key} — 템플릿 없음`);
      continue;
    }
    await prisma.notificationTemplate.update({
      where: { key: u.key },
      data: { body: u.body },
    });
    updated++;
    console.log(`  [OK]   ${u.key}`);
  }
  console.log(`\nUpdated ${updated}/${UPDATES.length} templates.`);
  process.exit();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
