import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const KEEP_EMAILS = new Set([
  'admin',
  'guardian1@test.com',
  'guardian2@test.com',
  'cg1@test.com',
  'cg2@test.com',
  'cg3@test.com',
  'leasezone@nate.com',
  'leasezone24@naver.com',
]);

(async () => {
  console.log('▶ 삭제 시작');

  // 1. 거래 데이터 전부 삭제 (FK 순서)
  const delNotif = await prisma.notification.deleteMany();
  console.log(`  notification: ${delNotif.count}건 삭제`);

  const delReview = await prisma.review.deleteMany();
  console.log(`  review: ${delReview.count}건 삭제`);

  const delDispute = await prisma.dispute.deleteMany();
  console.log(`  dispute: ${delDispute.count}건 삭제`);

  const delPenalty = await prisma.penalty.deleteMany();
  console.log(`  penalty: ${delPenalty.count}건 삭제`);

  const delEarning = await prisma.earning.deleteMany();
  console.log(`  earning: ${delEarning.count}건 삭제`);

  const delAdditionalFee = await prisma.additionalFee.deleteMany();
  console.log(`  additionalFee: ${delAdditionalFee.count}건 삭제`);

  // ContractExtension 은 contract 삭제 전에
  const delExt = await prisma.contractExtension.deleteMany();
  console.log(`  contractExtension: ${delExt.count}건 삭제`);

  const delPayment = await prisma.payment.deleteMany();
  console.log(`  payment: ${delPayment.count}건 삭제`);

  const delCareRecord = await prisma.careRecord.deleteMany();
  console.log(`  careRecord: ${delCareRecord.count}건 삭제`);

  const delContract = await prisma.contract.deleteMany();
  console.log(`  contract: ${delContract.count}건 삭제`);

  const delApp = await prisma.careApplication.deleteMany();
  console.log(`  careApplication: ${delApp.count}건 삭제`);

  const delReq = await prisma.careRequest.deleteMany();
  console.log(`  careRequest: ${delReq.count}건 삭제`);

  const delPatient = await prisma.patient.deleteMany();
  console.log(`  patient: ${delPatient.count}건 삭제`);

  // 추가: Caregiver/Guardian 참조하는 누락 테이블들
  try {
    const r = await (prisma as any).associationFeePayment?.deleteMany?.();
    if (r) console.log(`  associationFeePayment: ${r.count}건 삭제`);
  } catch {}
  try {
    const r = await (prisma as any).consultMemo?.deleteMany?.();
    if (r) console.log(`  consultMemo: ${r.count}건 삭제`);
  } catch {}
  try {
    const r = await (prisma as any).educationRecord?.deleteMany?.();
    if (r) console.log(`  educationRecord: ${r.count}건 삭제`);
  } catch {}
  try {
    const r = await (prisma as any).matchScore?.deleteMany?.();
    if (r) console.log(`  matchScore: ${r.count}건 삭제`);
  } catch {}

  // UserBlock, audit log 등도 정리
  try {
    const delBlock = await (prisma as any).userBlock?.deleteMany?.();
    if (delBlock) console.log(`  userBlock: ${delBlock.count}건 삭제`);
  } catch {}
  try {
    const delAudit = await (prisma as any).adminActionLog?.deleteMany?.();
    if (delAudit) console.log(`  adminActionLog: ${delAudit.count}건 삭제`);
  } catch {}

  // 2. 사용자 정리 — 보존 목록 외 전부 삭제
  const targets = await prisma.user.findMany({
    where: { email: { notIn: Array.from(KEEP_EMAILS) } },
    select: { id: true, email: true, role: true },
  });
  console.log(`\n▶ 삭제 대상 사용자 ${targets.length}명`);

  for (const u of targets) {
    // 자식 레코드: certificates, etc. (caregiver 관련)
    const cg = await prisma.caregiver.findUnique({ where: { userId: u.id } });
    if (cg) {
      await prisma.certificate.deleteMany({ where: { caregiverId: cg.id } });
      await prisma.caregiver.delete({ where: { id: cg.id } });
    }
    const gd = await prisma.guardian.findUnique({ where: { userId: u.id } });
    if (gd) {
      await prisma.guardian.delete({ where: { id: gd.id } });
    }
    const hp = await (prisma as any).hospital?.findUnique?.({ where: { userId: u.id } });
    if (hp) {
      await (prisma as any).hospital.delete({ where: { id: hp.id } });
    }
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`  - ${u.email} (${u.role}) 삭제됨`);
  }

  // 3. 보존 사용자의 guardian/caregiver 레코드는 그대로 두되 환자 등은 위에서 이미 비움
  console.log('\n▶ 완료. 최종 카운트:');
  const finalCounts = {
    user: await prisma.user.count(),
    guardian: await prisma.guardian.count(),
    caregiver: await prisma.caregiver.count(),
    patient: await prisma.patient.count(),
    careRequest: await prisma.careRequest.count(),
    contract: await prisma.contract.count(),
    payment: await prisma.payment.count(),
    notification: await prisma.notification.count(),
  };
  console.log(JSON.stringify(finalCounts, null, 2));

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('❌ 오류:', e);
  await prisma.$disconnect();
  process.exit(1);
});
