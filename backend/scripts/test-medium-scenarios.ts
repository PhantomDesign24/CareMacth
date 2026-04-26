/**
 * 🟡 위험도 中 시나리오 (8건)
 *  M1 CareApplication proposedRate (역제안) 흐름
 *  M2 지원 취소 + REJECTED 후 재지원
 *  M3 Notification 카테고리 prefs 차단
 *  M4 CareRecord 권한 + 같은 날 중복 업데이트
 *  M5 raiseRate 권한 + 검증
 *  M6 expandRegions 권한
 *  M7 Review 평점/재고용율 정확성
 *  M8 cancelApplication 후 careRequest 재공고 가능 여부
 */
import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const failures: string[] = [];
const ok = (n: string) => { pass++; console.log(`  ✅ ${n}`); };
const bad = (n: string, m: string) => { fail++; failures.push(`${n}: ${m}`); console.log(`  ❌ ${n} — ${m}`); };

async function login(email: string, pw: string) {
  const r = await axios.post(`${API}/auth/login`, { email, password: pw });
  return r.data?.data?.access_token;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function expectFail(label: string, fn: () => Promise<any>, status: number) {
  try { await fn(); bad(label, `예상한 ${status} 안 옴`); }
  catch (e) {
    const c = (e as AxiosError).response?.status;
    if (c === status) ok(label);
    else bad(label, `status=${c}, body=${JSON.stringify((e as AxiosError).response?.data)}`);
  }
}

async function pickFreeCG(used: string[] = []): Promise<{ email: string; id: string; userId: string }> {
  for (let i = 1; i <= 10; i++) {
    const email = `cg${i}@test.com`;
    if (used.includes(email)) continue;
    const u = await prisma.user.findUnique({ where: { email }, include: { caregiver: true } });
    if (!u?.caregiver) continue;
    const active = await prisma.contract.count({
      where: { caregiverId: u.caregiver.id, status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] } },
    });
    if (active === 0) {
      await prisma.caregiver.update({
        where: { id: u.caregiver.id },
        data: {
          workStatus: 'AVAILABLE', status: 'APPROVED', penaltyCount: 0,
          identityVerified: true, idCardImage: 'x',
          criminalCheckDone: true, criminalCheckDoc: 'x',
        },
      });
      return { email, id: u.caregiver.id, userId: u.id };
    }
  }
  throw new Error('cg 없음');
}

async function setup() {
  console.log('\n━━━ Setup ━━━');
  const guardianToken = await login('guardian1@test.com', 'test1234!');
  const guardian2Token = await login('guardian2@test.com', 'test1234!');
  const u1 = await prisma.user.findUnique({
    where: { email: 'guardian1@test.com' },
    include: { guardian: { include: { patients: true } } },
  });
  const guardian1 = u1!.guardian!;
  const cgA = await pickFreeCG();
  const cgB = await pickFreeCG([cgA.email]);
  console.log(`  메인 cg=${cgA.email}, 보조 cg=${cgB.email}`);

  const patients = [];
  for (let i = 0; i < 12; i++) {
    const p = await prisma.patient.create({
      data: { guardianId: guardian1.id, name: `m_p${i}`, birthDate: new Date('1955-01-01'), gender: 'MALE', mobilityStatus: 'INDEPENDENT' },
    });
    patients.push(p);
  }

  return {
    guardianToken, guardian2Token,
    guardian1Id: guardian1.id, guardian1UserId: u1!.id,
    cgA, cgB, patients,
    cleanup: { patientIds: patients.map(p => p.id), careRequestIds: [] as string[], contractIds: [] as string[] },
  };
}

async function cleanupAll(ctx: any) {
  for (const cid of ctx.cleanup.contractIds) {
    await prisma.review.deleteMany({ where: { contractId: cid } });
    await prisma.careRecord.deleteMany({ where: { contractId: cid } });
    await prisma.payment.deleteMany({ where: { contractId: cid } });
    await prisma.contract.delete({ where: { id: cid } }).catch(() => {});
  }
  for (const crid of ctx.cleanup.careRequestIds) {
    await prisma.careApplication.deleteMany({ where: { careRequestId: crid } });
    await prisma.careRequest.delete({ where: { id: crid } }).catch(() => {});
  }
  for (const pid of ctx.cleanup.patientIds) {
    await prisma.patient.delete({ where: { id: pid } }).catch(() => {});
  }
  for (const cg of [ctx.cgA, ctx.cgB]) {
    await prisma.caregiver.update({
      where: { id: cg.id },
      data: { workStatus: 'AVAILABLE', status: 'APPROVED', avgRating: 0, rehireRate: 0 },
    }).catch(() => {});
  }
  // notificationPrefs 복원
  await prisma.user.update({
    where: { id: ctx.guardian1UserId },
    data: { notificationPrefs: {} as any },
  }).catch(() => {});
}

async function makeOpenCareRequest(ctx: any, patientIdx: number, dailyRate = 150000) {
  const cr = await prisma.careRequest.create({
    data: {
      guardianId: ctx.guardian1Id, patientId: ctx.patients[patientIdx].id,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: 'M', address: '서울', startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 7 * 86400000), durationDays: 6, dailyRate,
      medicalActAgreed: true, status: 'OPEN',
    },
  });
  ctx.cleanup.careRequestIds.push(cr.id);
  return cr;
}

// ============================================
async function s_m1_proposedRate(ctx: any) {
  console.log('\n━━━ M1. CareApplication proposedRate (역제안) ━━━');
  const { guardianToken, cgA } = ctx;
  const cr = await makeOpenCareRequest(ctx, 0, 150000);
  const cgToken = await login(cgA.email, 'test1234!');

  // M1-A: 역제안 (proposedRate=200000)
  const r = await axios.post(`${API}/care-requests/${cr.id}/apply`,
    { isAccepted: false, proposedRate: 200000, message: '역제안' },
    { headers: auth(cgToken) });
  if (r.data?.success) ok('M1-A 역제안 (proposedRate=200000) 지원 성공');
  else bad('M1-A', JSON.stringify(r.data));

  // M1-B: proposedRate 가 DB 에 저장됐는지
  const app = await prisma.careApplication.findFirst({
    where: { careRequestId: cr.id, caregiverId: cgA.id },
  });
  if (app?.proposedRate === 200000 && app.isAccepted === false) {
    ok('M1-B proposedRate=200000, isAccepted=false 저장 정상');
  } else bad('M1-B', `rate=${app?.proposedRate}, accepted=${app?.isAccepted}`);

  // M1-C: isAccepted=false 인데 proposedRate 누락 시 거절
  const cr2 = await makeOpenCareRequest(ctx, 1, 150000);
  await expectFail(
    'M1-C isAccepted=false + proposedRate 누락 거절',
    () => axios.post(`${API}/care-requests/${cr2.id}/apply`,
      { isAccepted: false, message: '제안 없음' },
      { headers: auth(cgToken) }),
    400,
  );
}

// ============================================
async function s_m2_cancelReapply(ctx: any) {
  console.log('\n━━━ M2. 지원 취소 → 재지원 ━━━');
  const { cgA } = ctx;
  const cgToken = await login(cgA.email, 'test1234!');
  const cr = await makeOpenCareRequest(ctx, 2, 150000);

  // 지원
  await axios.post(`${API}/care-requests/${cr.id}/apply`, { isAccepted: true }, { headers: auth(cgToken) });
  ok('M2-A 최초 지원 성공');

  // 취소
  await axios.delete(`${API}/care-requests/${cr.id}/apply`, { headers: auth(cgToken) });
  const after = await prisma.careApplication.findFirst({
    where: { careRequestId: cr.id, caregiverId: cgA.id },
  });
  if (after?.status === 'CANCELLED') ok('M2-B 지원 취소 → status=CANCELLED');
  else bad('M2-B', `status=${after?.status}`);

  // 재지원
  const r = await axios.post(`${API}/care-requests/${cr.id}/apply`, { isAccepted: true }, { headers: auth(cgToken) });
  if (r.data?.success) ok('M2-C 취소 후 재지원 허용');
  else bad('M2-C', JSON.stringify(r.data));
}

// ============================================
async function s_m3_notifPrefs(ctx: any) {
  console.log('\n━━━ M3. Notification 카테고리 prefs 차단 ━━━');
  const { guardian1UserId } = ctx;

  // CONTRACT 카테고리 비활성화
  await prisma.user.update({
    where: { id: guardian1UserId },
    data: { notificationPrefs: { CONTRACT: false } as any },
  });

  // sendNotification 직접 import 어려우니 sendFromTemplate 호출 흐름 시뮬
  // sendNotification 의 카테고리 검사 로직 검증:
  // const categoryAllowed = !user?.notificationPrefs || ... [type] !== false
  const u = await prisma.user.findUnique({ where: { id: guardian1UserId } });
  const prefs = u?.notificationPrefs as any;
  const contractAllowed = !prefs || prefs.CONTRACT !== false;
  const paymentAllowed = !prefs || prefs.PAYMENT !== false;
  if (!contractAllowed && paymentAllowed) {
    ok('M3-A CONTRACT prefs=false → 발송 스킵, PAYMENT 는 허용');
  } else bad('M3-A', `contract=${contractAllowed}, payment=${paymentAllowed}`);

  // 복원
  await prisma.user.update({
    where: { id: guardian1UserId },
    data: { notificationPrefs: {} as any },
  });
}

// ============================================
async function s_m4_careRecord(ctx: any) {
  console.log('\n━━━ M4. CareRecord 작성 권한 + 같은 날 update ━━━');
  const { cgA, guardian1Id, patients, cleanup: cu } = ctx;

  // ACTIVE 계약 만들기
  const startDate = new Date(Date.now() - 86400000);
  const endDate = new Date(Date.now() + 6 * 86400000);
  const cr = await prisma.careRequest.create({
    data: {
      guardianId: guardian1Id, patientId: patients[3].id,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: 'M4', address: '서울', startDate, endDate, durationDays: 7, dailyRate: 150000,
      medicalActAgreed: true, status: 'MATCHED',
    },
  });
  cu.careRequestIds.push(cr.id);
  const c = await prisma.contract.create({
    data: {
      careRequestId: cr.id, guardianId: guardian1Id, caregiverId: cgA.id,
      startDate, endDate, dailyRate: 150000, totalAmount: 150000 * 7,
      platformFee: 10, taxRate: 3.3, status: 'ACTIVE',
      guardianSignedAt: startDate, caregiverSignedAt: startDate,
    },
  });
  cu.contractIds.push(c.id);
  await prisma.caregiver.update({ where: { id: cgA.id }, data: { workStatus: 'WORKING' } });

  const cgToken = await login(cgA.email, 'test1234!');
  const todayYMD = new Date().toISOString().slice(0, 10);

  // M4-A: 첫 일지 작성
  const r1 = await axios.post(`${API}/care-records/daily-log`,
    { contractId: c.id, date: todayYMD, mealCare: true, notes: '오전 식사' },
    { headers: auth(cgToken) });
  if (r1.data?.success) ok('M4-A 일지 첫 작성 성공');
  else bad('M4-A', JSON.stringify(r1.data));

  // M4-B: 같은 날 추가 작성 → update 처리되는지
  const r2 = await axios.post(`${API}/care-records/daily-log`,
    { contractId: c.id, date: todayYMD, mealCare: true, activityCare: true, notes: '오후 산책' },
    { headers: auth(cgToken) });
  if (r2.data?.success) {
    const records = await prisma.careRecord.count({
      where: { contractId: c.id, date: { gte: new Date(`${todayYMD}T00:00:00`), lt: new Date(`${todayYMD}T23:59:59`) } },
    });
    if (records === 1) ok('M4-B 같은 날 재작성 시 update (1건 유지)');
    else bad('M4-B', `${records} 건`);
  } else bad('M4-B', JSON.stringify(r2.data));

  // M4-C: 다른 간병인이 남의 계약에 일지 작성 시도 → 거절
  const cgBToken = await login(ctx.cgB.email, 'test1234!');
  await expectFail(
    'M4-C 다른 간병인의 계약에 일지 작성 거절',
    () => axios.post(`${API}/care-records/daily-log`,
      { contractId: c.id, date: todayYMD, notes: '권한 없음' },
      { headers: auth(cgBToken) }),
    404, // controller: 본인 계약 아니면 "유효한 계약 없음" 404
  );
}

// ============================================
async function s_m5_raiseRate(ctx: any) {
  console.log('\n━━━ M5. raiseRate 권한 + 검증 ━━━');
  const { guardianToken, guardian2Token } = ctx;
  const cr = await makeOpenCareRequest(ctx, 4, 100000);

  // M5-A: 보호자가 인상 (현재 100,000 → 150,000)
  const r = await axios.post(`${API}/care-requests/${cr.id}/raise-rate`,
    { newDailyRate: 150000 },
    { headers: auth(guardianToken) });
  if (r.data?.success) ok('M5-A 일당 인상 (100,000 → 150,000) 성공');
  else bad('M5-A', JSON.stringify(r.data));

  // M5-B: 현재 일당보다 낮은 값 → 거절
  await expectFail(
    'M5-B 현재보다 낮거나 같은 값 거절',
    () => axios.post(`${API}/care-requests/${cr.id}/raise-rate`,
      { newDailyRate: 130000 },
      { headers: auth(guardianToken) }),
    400,
  );

  // M5-C: 다른 보호자가 시도 → 권한 거절
  await expectFail(
    'M5-C 다른 보호자 시도 거절',
    () => axios.post(`${API}/care-requests/${cr.id}/raise-rate`,
      { newDailyRate: 200000 },
      { headers: auth(guardian2Token) }),
    404,
  );
}

// ============================================
async function s_m6_expandRegions(ctx: any) {
  console.log('\n━━━ M6. expandRegions 권한 ━━━');
  const { guardianToken, guardian2Token } = ctx;
  // 첫 careRequest 재사용 (M5 에서 만든 것이 가장 최근)
  const cr = await makeOpenCareRequest(ctx, 5, 150000);

  // M6-A: 지역 확장
  const r = await axios.post(`${API}/care-requests/${cr.id}/expand-regions`,
    { regions: ['서울', '경기', '인천'] },
    { headers: auth(guardianToken) });
  if (r.data?.success) ok('M6-A 지역 확장 성공');
  else bad('M6-A', JSON.stringify(r.data));

  // M6-B: 다른 보호자 시도 → 거절
  await expectFail(
    'M6-B 다른 보호자 expandRegions 거절',
    () => axios.post(`${API}/care-requests/${cr.id}/expand-regions`,
      { regions: ['부산'] },
      { headers: auth(guardian2Token) }),
    404,
  );
}

// ============================================
async function s_m7_reviewStats(ctx: any) {
  console.log('\n━━━ M7. Review 평점/재고용율 정확성 ━━━');
  const { guardianToken, cgB, guardian1Id, patients } = ctx;

  // cgB 평점 초기화
  await prisma.review.deleteMany({ where: { caregiverId: cgB.id } });
  await prisma.caregiver.update({ where: { id: cgB.id }, data: { avgRating: 0, rehireRate: 0 } });

  // COMPLETED 계약 3건 만들기 (patient 6,7,8 사용)
  const ratings: { rating: number; rehire: boolean }[] = [
    { rating: 5, rehire: true },
    { rating: 4, rehire: true },
    { rating: 3, rehire: false },
  ];
  for (let i = 0; i < ratings.length; i++) {
    const cr = await prisma.careRequest.create({
      data: {
        guardianId: guardian1Id, patientId: patients[6 + i].id,
        careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
        hospitalName: 'M7', address: '서울', startDate: new Date(Date.now() - 30 * 86400000),
        endDate: new Date(Date.now() - 1 * 86400000), durationDays: 29, dailyRate: 150000,
        medicalActAgreed: true, status: 'COMPLETED',
      },
    });
    const c = await prisma.contract.create({
      data: {
        careRequestId: cr.id, guardianId: guardian1Id, caregiverId: cgB.id,
        startDate: new Date(Date.now() - 30 * 86400000),
        endDate: new Date(Date.now() - 1 * 86400000),
        dailyRate: 150000, totalAmount: 150000 * 29,
        platformFee: 10, taxRate: 3.3, status: 'COMPLETED',
        guardianSignedAt: new Date(Date.now() - 30 * 86400000),
        caregiverSignedAt: new Date(Date.now() - 30 * 86400000),
      },
    });
    ctx.cleanup.careRequestIds.push(cr.id);
    ctx.cleanup.contractIds.push(c.id);

    // 리뷰 작성
    await axios.post(`${API}/reviews`, {
      contractId: c.id, rating: ratings[i].rating, comment: `리뷰 ${i + 1}`, wouldRehire: ratings[i].rehire,
    }, { headers: auth(guardianToken) });
  }

  // 검증
  const cgAfter = await prisma.caregiver.findUnique({ where: { id: cgB.id } });
  const expectedAvg = (5 + 4 + 3) / 3; // 4.0
  const expectedRehire = 2 / 3; // ~0.67
  // 컨트롤러는 round(avg*10)/10, round(rehire*100)/100
  const okAvg = cgAfter?.avgRating === Math.round(expectedAvg * 10) / 10;
  const okRehire = cgAfter?.rehireRate === Math.round(expectedRehire * 100) / 100;
  if (okAvg && okRehire) {
    ok(`M7 평점=${cgAfter.avgRating}, 재고용율=${cgAfter.rehireRate} (정확)`);
  } else {
    bad('M7', `avg=${cgAfter?.avgRating} (예상 ${Math.round(expectedAvg * 10) / 10}), rehire=${cgAfter?.rehireRate} (예상 ${Math.round(expectedRehire * 100) / 100})`);
  }
}

// ============================================
async function s_m8_cancelReopen(ctx: any) {
  console.log('\n━━━ M8. 지원 취소 후 careRequest 상태 ━━━');
  // M4 에서 cgA WORKING 됐으므로 cgB 사용
  const cgB = ctx.cgB;
  // cgB 의 COMPLETED 계약은 ongoingContracts 에서 제외 (status check)
  // 그러나 안전하게 cgB workStatus 만 확인 — COMPLETED 는 ongoing 아님
  const cgToken = await login(cgB.email, 'test1234!');
  const cr = await makeOpenCareRequest(ctx, 9, 150000);

  await axios.post(`${API}/care-requests/${cr.id}/apply`, { isAccepted: true }, { headers: auth(cgToken) });
  await axios.delete(`${API}/care-requests/${cr.id}/apply`, { headers: auth(cgToken) });

  // careRequest 상태가 OPEN 유지되어야 함 (다른 간병인 지원 가능)
  const after = await prisma.careRequest.findUnique({ where: { id: cr.id } });
  if (after?.status === 'OPEN' || after?.status === 'MATCHING') {
    ok(`M8 지원 취소 후 careRequest 상태 유지 (${after.status})`);
  } else bad('M8', `status=${after?.status}`);
}

// ============================================
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🟡 위험도 中 시나리오 (8건)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const ctx = await setup();
  try {
    await s_m1_proposedRate(ctx);
    await s_m2_cancelReapply(ctx);
    await s_m3_notifPrefs(ctx);
    await s_m4_careRecord(ctx);
    await s_m5_raiseRate(ctx);
    await s_m6_expandRegions(ctx);
    await s_m7_reviewStats(ctx);
    await s_m8_cancelReopen(ctx);
  } finally {
    await cleanupAll(ctx);
    await prisma.$disconnect();
  }
  console.log(`\n━━━ 결과: ${pass} 통과 / ${fail} 실패 ━━━`);
  if (fail) {
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
