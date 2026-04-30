import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const templates = [
  // 1. 보호자 가입 환영
  {
    key: 'WELCOME_GUARDIAN',
    name: '보호자 가입 환영',
    type: 'SYSTEM',
    title: '케어매치에 오신 것을 환영합니다',
    body: '{name}님, 가입을 환영합니다. 환자 정보를 등록하고 간병 요청을 올려보세요.',
    description: '보호자 회원가입 직후 본인에게 발송',
    enabled: true,
    isSystem: true,
  },
  // 2. 간병인 가입 환영
  {
    key: 'WELCOME_CAREGIVER',
    name: '간병인 가입 환영',
    type: 'SYSTEM',
    title: '케어매치 간병인 가입 환영',
    body: '{name}님, 가입을 환영합니다. 신분증·자격증·범죄이력 등록 후 관리자 승인이 완료되면 활동을 시작할 수 있습니다.',
    description: '간병인 회원가입 직후 본인에게 발송 (서류 등록 안내 포함)',
    enabled: true,
    isSystem: true,
  },
  // 3. 상담사 연결 안내 (평일 1시간 경과)
  {
    key: 'MATCH_STALE_GUIDE_GUARDIAN',
    name: '매칭 1시간 경과 안내 (보호자)',
    type: 'MATCHING',
    title: '간병인 매칭 안내',
    body: '{patientName} 환자의 간병 요청에 1시간 동안 지원자가 없습니다. 상담사와 연결하시거나 매칭을 취소하실 수 있습니다.',
    description: '평일 OPEN/MATCHING 1시간 경과 시 1회만 발송 (지원자 0명일 때)',
    enabled: true,
    isSystem: true,
  },
  // 4. 간병사 본인 근무상태 변경 (관리자 모니터링용)
  {
    key: 'CAREGIVER_WORK_STATUS_CHANGED_ADMIN',
    name: '간병사 근무상태 변경 (관리자)',
    type: 'SYSTEM',
    title: '간병사 근무상태 변경',
    body: '{caregiverName} 간병사가 근무상태를 {prevStatus} → {newStatus} 로 변경했습니다.',
    description: '간병사가 본인 workStatus 변경 시 관리자 전원에게 알림 (모니터링)',
    enabled: true,
    isSystem: true,
  },
];

(async () => {
  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        type: t.type,
        title: t.title,
        body: t.body,
        description: t.description,
        enabled: t.enabled,
        isSystem: t.isSystem,
      },
      create: t,
    });
    console.log(`✓ ${t.key}`);
  }
  console.log(`\n${templates.length}개 템플릿 upsert 완료`);
  await prisma.$disconnect();
})();
