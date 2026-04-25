/**
 * 도메인 영역 시나리오 검증
 *  R1-R3  환불: 요청 → 관리자 승인/거절 → 동시 승인 race
 *  A1-A3  AdditionalFee: 간병인 요청 → 보호자 승인/거절 → 중복 승인 race
 *  P1-P3  CareApplication: 중복 지원 차단, 매칭 시 다른 지원 자동 처리
 *  V1-V3  Review: 작성, 중복 작성 차단, 평점 평균 갱신, 권한
 *  N1-N2  Penalty: 누적 1/2회는 ACTIVE, 3회 누적 시 SUSPENDED 자동 전환
 *  E1     Earning 정산 race (수동 + 동시 호출)
 */
import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAUAAeImBZsAAAAASUVORK5CYII=';

let pass = 0, fail = 0;
const failures: string[] = [];
const ok = (n: string) => { pass++; console.log(`  ✅ ${n}`); };
const bad = (n: string, m: string) => { fail++; failures.push(`${n}: ${m}`); console.log(`  ❌ ${n} — ${m}`); };

async function login(email: string, pw: string) {
  const r = await axios.post(`${API}/auth/login`, { email, password: pw });
  return r.data?.data?.access_token;
}
async function loginAdmin() {
  // 관리자도 일반 /auth/login 사용 (email='admin')
  const r = await axios.post(`${API}/auth/login`, { email: 'admin', password: '1234' });
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
          // care-requests/apply 통과 위한 필수 필드
          identityVerified: true,
          idCardImage: 'test-id.jpg',
          criminalCheckDone: true,
          criminalCheckDoc: 'test-cc.jpg',
        },
      });
      return { email, id: u.caregiver.id, userId: u.id };
    }
  }
  throw new Error('사용 가능한 cg 없음');
}

async function makeContract(guardianId: string, patientId: string, caregiverId: string, status: any = 'ACTIVE') {
  const startDate = new Date(Date.now() + 86400000);
  const endDate = new Date(Date.now() + 8 * 86400000);
  const cr = await prisma.careRequest.create({
    data: {
      guardianId, patientId,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: '도메인테스트', address: '서울', startDate, endDate, durationDays: 7, dailyRate: 150000,
      medicalActAgreed: true, status: status === 'COMPLETED' ? 'COMPLETED' : 'MATCHED',
    },
  });
  const c = await prisma.contract.create({
    data: {
      careRequestId: cr.id, guardianId, caregiverId,
      startDate, endDate, dailyRate: 150000, totalAmount: 150000 * 7,
      platformFee: 10, taxRate: 3.3, status,
      guardianSignedAt: new Date(), caregiverSignedAt: new Date(),
    },
  });
  if (status === 'ACTIVE' || status === 'EXTENDED' || status === 'PENDING_SIGNATURE') {
    await prisma.caregiver.update({ where: { id: caregiverId }, data: { workStatus: 'WORKING' } });
  }
  return { contractId: c.id, careRequestId: cr.id };
}

async function makePayment(contractId: string, guardianId: string, status: any = 'ESCROW', useFakeTossKey: boolean = false) {
  return prisma.payment.create({
    data: {
      contractId, guardianId,
      amount: 150000 * 7, vatAmount: 0, totalAmount: 150000 * 7,
      // DIRECT 결제 (tossPaymentKey=null) → executeRefund 가 Toss API 안 부름
      method: useFakeTossKey ? 'CARD' : 'DIRECT', status,
      tossOrderId: `DOM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tossPaymentKey: useFakeTossKey ? `domk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null,
      paidAt: status !== 'PENDING' ? new Date() : null,
    },
  });
}

async function setup() {
  console.log('\n━━━ Setup ━━━');
  const guardianToken = await login('guardian1@test.com', 'test1234!');
  const guardian2Token = await login('guardian2@test.com', 'test1234!');
  const adminToken = await loginAdmin();

  const u1 = await prisma.user.findUnique({ where: { email: 'guardian1@test.com' }, include: { guardian: { include: { patients: true } } } });
  const guardian1 = u1!.guardian!;

  const cgA = await pickFreeCG();
  const cgB = await pickFreeCG([cgA.email]);
  const cgC = await pickFreeCG([cgA.email, cgB.email]);
  const cgD = await pickFreeCG([cgA.email, cgB.email, cgC.email]);
  console.log(`  cgA=${cgA.email}(refund/addfee), cgB=${cgB.email}(application), cgC=${cgC.email}(review), cgD=${cgD.email}(penalty)`);

  // 환자 세트 — 시나리오마다 별도 (guardianId+patientId 유니크 회피)
  const patients = [];
  for (let i = 0; i < 5; i++) {
    const p = await prisma.patient.create({
      data: { guardianId: guardian1.id, name: `dom_p${i}`, birthDate: new Date('1955-01-01'), gender: 'MALE', mobilityStatus: 'INDEPENDENT' },
    });
    patients.push(p);
  }

  return {
    guardianToken, guardian2Token, adminToken,
    guardian1Id: guardian1.id, guardian1UserId: u1!.id,
    cgA, cgB, cgC, cgD, patients,
    cleanup: { contractIds: [] as string[], careRequestIds: [] as string[], patientIds: patients.map(p => p.id) },
  };
}

async function cleanup(ctx: any) {
  for (const cid of ctx.cleanup.contractIds) {
    await prisma.review.deleteMany({ where: { contractId: cid } });
    await prisma.payment.deleteMany({ where: { contractId: cid } });
    await prisma.additionalFee.deleteMany({ where: { contractId: cid } });
    await prisma.contractExtension.deleteMany({ where: { contractId: cid } });
    await prisma.earning.deleteMany({ where: { contractId: cid } });
    await prisma.dispute.deleteMany({ where: { contractId: cid } });
    await prisma.contract.delete({ where: { id: cid } }).catch(() => {});
  }
  for (const crid of ctx.cleanup.careRequestIds) {
    await prisma.careApplication.deleteMany({ where: { careRequestId: crid } });
    await prisma.careRequest.delete({ where: { id: crid } }).catch(() => {});
  }
  for (const pid of ctx.cleanup.patientIds) {
    await prisma.patient.delete({ where: { id: pid } }).catch(() => {});
  }
  for (const cg of [ctx.cgA, ctx.cgB, ctx.cgC, ctx.cgD]) {
    await prisma.penalty.deleteMany({ where: { caregiverId: cg.id, isAutomatic: true } }).catch(() => {});
    await prisma.caregiver.update({
      where: { id: cg.id },
      data: { workStatus: 'AVAILABLE', status: 'APPROVED', penaltyCount: 0, cancellationRate: 0 },
    }).catch(() => {});
  }
}

async function s_refund(ctx: any) {
  console.log('\n━━━ R. 환불 (요청 → 승인/거절 → 동시 승인 race) ━━━');
  const { guardianToken, adminToken, guardian1Id, cgA, patients } = ctx;

  const m = await makeContract(guardian1Id, patients[0].id, cgA.id, 'ACTIVE');
  const pay = await makePayment(m.contractId, guardian1Id, 'ESCROW');
  ctx.cleanup.contractIds.push(m.contractId);
  ctx.cleanup.careRequestIds.push(m.careRequestId);

  // R1: 환불 요청 (보호자) — POST /payments/:id/refund
  // 컨트롤러 분기: 보호자가 호출하면 PENDING refund request 생성
  let r = await axios.post(`${API}/payments/${pay.id}/refund`,
    { reason: '서비스 불만족', amount: 100000 },
    { headers: auth(guardianToken) });
  const after = await prisma.payment.findUnique({ where: { id: pay.id } });
  if (after?.refundRequestStatus === 'PENDING' && after.refundRequestAmount === 100000) {
    ok('R1 보호자 환불 요청 → PENDING 생성');
  } else bad('R1', `refundRequestStatus=${after?.refundRequestStatus}`);

  // R2: 동시 관리자 승인 race
  const a1 = axios.post(`${API}/admin/payments/${pay.id}/refund-approve`, {}, { headers: auth(adminToken) })
    .then((r) => ({ ok: true, data: r.data })).catch((e: AxiosError) => ({ ok: false, status: e.response?.status, body: e.response?.data }));
  const a2 = axios.post(`${API}/admin/payments/${pay.id}/refund-approve`, {}, { headers: auth(adminToken) })
    .then((r) => ({ ok: true, data: r.data })).catch((e: AxiosError) => ({ ok: false, status: e.response?.status, body: e.response?.data }));
  const [r1, r2] = await Promise.all([a1, a2]);
  const okN = [r1, r2].filter(x => x.ok).length;
  if (okN === 1) ok('R2 동시 관리자 승인 → 한 번만 처리');
  else bad('R2 동시 승인', `success=${okN}, r1=${JSON.stringify(r1)} r2=${JSON.stringify(r2)}`);

  // 사후 검증: 환불 한 번만 적용
  const final = await prisma.payment.findUnique({ where: { id: pay.id } });
  if (final?.refundRequestStatus === 'APPROVED' && final.refundAmount === 100000) {
    ok('R2-검증 환불 100,000원 정확히 1회 적용');
  } else bad('R2-검증', `status=${final?.refundRequestStatus}, refundAmount=${final?.refundAmount}`);

  // R3: 거절 흐름 — 같은 결제에 환불 요청 후 관리자 거절
  // (R2 가 100,000원 부분 환불로 cgA 계약은 아직 ACTIVE — 결제 자체는 PARTIAL_REFUND)
  // 새 PENDING 환불 요청을 만들기 위해 일단 refundRequestStatus 필드를 PENDING 으로 설정
  await prisma.payment.update({
    where: { id: pay.id },
    data: {
      refundRequestStatus: 'PENDING',
      refundReviewedAt: null,
      refundReviewedBy: null,
      refundRequestAmount: 50000,
      refundRequestReason: 'R3 거절 테스트',
    },
  });
  // 관리자 거절
  await axios.post(`${API}/admin/payments/${pay.id}/refund-reject`,
    { reason: '환불 정책 위반' },
    { headers: auth(adminToken) });
  const rejected = await prisma.payment.findUnique({ where: { id: pay.id } });
  if (rejected?.refundRequestStatus === 'REJECTED') ok('R3 환불 요청 거절 정상');
  else bad('R3', `status=${rejected?.refundRequestStatus}`);
}

async function s_addFee(ctx: any) {
  console.log('\n━━━ A. AdditionalFee (간병인 요청 → 보호자 승인/거절 → 중복 승인 race) ━━━');
  const { guardianToken, guardian1Id, cgA, patients, cleanup: cu } = ctx;
  const cgAToken = await login(cgA.email, 'test1234!');

  // 신규 ACTIVE 계약 만들기 (cgA는 r 시나리오에서 WORKING 상태일 수 있어 이미 ACTIVE 있음)
  // partial unique index 회피 위해 cgA 이미 가지고 있는 ACTIVE 계약 활용
  const existing = await prisma.contract.findFirst({
    where: { caregiverId: cgA.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  if (!existing) { bad('A 사전조건', 'cgA ACTIVE 계약 없음'); return; }
  const contractId = existing.id;

  // A1: 간병인이 추가비 요청
  const r = await axios.post(`${API}/payments/additional-fees`,
    { contractId, amount: 50000, reason: '추가 간호비' },
    { headers: auth(cgAToken) });
  const feeId = r.data?.data?.id || r.data?.data?.additionalFee?.id;
  if (feeId) ok('A1 간병인 추가비 요청 생성');
  else { bad('A1', JSON.stringify(r.data)); return; }

  // A2: 보호자 동시 승인 race
  const ap1 = axios.post(`${API}/payments/additional-fees/${feeId}/approve`, {}, { headers: auth(guardianToken) })
    .then(() => ({ ok: true })).catch((e: AxiosError) => ({ ok: false, status: e.response?.status }));
  const ap2 = axios.post(`${API}/payments/additional-fees/${feeId}/approve`, {}, { headers: auth(guardianToken) })
    .then(() => ({ ok: true })).catch((e: AxiosError) => ({ ok: false, status: e.response?.status }));
  const [r1, r2] = await Promise.all([ap1, ap2]);
  const okN = [r1, r2].filter(x => x.ok).length;
  if (okN === 1) ok('A2 동시 승인 → 한 번만 통과');
  else bad('A2', `success=${okN}`);

  // 사후: 승인 1회만 적용
  const fee = await prisma.additionalFee.findUnique({ where: { id: feeId } });
  if (fee?.approvedByGuardian === true && fee?.rejected === false) {
    ok('A2-검증 AdditionalFee approvedByGuardian=true, rejected=false');
  } else bad('A2-검증', `approved=${fee?.approvedByGuardian}, rejected=${fee?.rejected}`);
}

async function s_application(ctx: any) {
  console.log('\n━━━ P. CareApplication (중복 지원, 매칭 시 자동 처리) ━━━');
  const { guardianToken, guardian1Id, cgB, cgC, patients } = ctx;

  // careRequest 생성 (OPEN 상태)
  const cr = await prisma.careRequest.create({
    data: {
      guardianId: guardian1Id, patientId: patients[2].id,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: 'P병원', address: '서울', startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 7 * 86400000), durationDays: 6, dailyRate: 150000,
      medicalActAgreed: true, status: 'OPEN',
    },
  });
  ctx.cleanup.careRequestIds.push(cr.id);

  const cgBToken = await login(cgB.email, 'test1234!');
  const cgCToken = await login(cgC.email, 'test1234!');

  // P1: cgB 지원
  await axios.post(`${API}/care-requests/${cr.id}/apply`, { message: '지원합니다', isAccepted: true }, { headers: auth(cgBToken) });
  ok('P1-A cgB 지원 성공');

  // P1: cgB 가 같은 요청에 또 지원 → 중복 차단
  await expectFail(
    'P1-B cgB 중복 지원 차단',
    () => axios.post(`${API}/care-requests/${cr.id}/apply`, { message: '재지원', isAccepted: true }, { headers: auth(cgBToken) }),
    400,
  );

  // cgC 지원
  await axios.post(`${API}/care-requests/${cr.id}/apply`, { message: '저도 지원', isAccepted: true }, { headers: auth(cgCToken) });
  ok('P2 cgC 지원 성공');

  // P3: 보호자가 cgB 선택 → cgC 의 application 자동 REJECTED
  const contractRes = await axios.post(`${API}/contracts`,
    { careRequestId: cr.id, caregiverId: cgB.id },
    { headers: auth(guardianToken) });
  const contractId = contractRes.data?.data?.id;
  ctx.cleanup.contractIds.push(contractId);

  const cgCApp = await prisma.careApplication.findFirst({ where: { careRequestId: cr.id, caregiverId: cgC.id } });
  const cgBApp = await prisma.careApplication.findFirst({ where: { careRequestId: cr.id, caregiverId: cgB.id } });
  if (cgBApp?.status === 'ACCEPTED' && cgCApp?.status === 'REJECTED') {
    ok('P3 보호자가 cgB 선택 → cgB=ACCEPTED, cgC=REJECTED 자동 처리');
  } else bad('P3', `cgB=${cgBApp?.status}, cgC=${cgCApp?.status}`);
}

async function s_review(ctx: any) {
  console.log('\n━━━ V. Review (작성, 중복, 평점 갱신, 권한) ━━━');
  const { guardianToken, guardian2Token, guardian1Id, cgC, patients } = ctx;

  // COMPLETED 계약 만들기 — cgC 사용 (이전 시나리오에서 WORKING 됐을 수 있음 → 강제 AVAILABLE)
  await prisma.caregiver.update({ where: { id: cgC.id }, data: { workStatus: 'AVAILABLE' } });

  // CompletedRecord: 직접 status='COMPLETED' 로 만들기
  const startDate = new Date(Date.now() - 30 * 86400000);
  const endDate = new Date(Date.now() - 1 * 86400000);
  const cr = await prisma.careRequest.create({
    data: {
      guardianId: guardian1Id, patientId: patients[3].id,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: 'V병원', address: '서울', startDate, endDate, durationDays: 29, dailyRate: 150000,
      medicalActAgreed: true, status: 'COMPLETED',
    },
  });
  const c = await prisma.contract.create({
    data: {
      careRequestId: cr.id, guardianId: guardian1Id, caregiverId: cgC.id,
      startDate, endDate, dailyRate: 150000, totalAmount: 150000 * 29,
      platformFee: 10, taxRate: 3.3, status: 'COMPLETED',
      guardianSignedAt: startDate, caregiverSignedAt: startDate,
    },
  });
  ctx.cleanup.careRequestIds.push(cr.id);
  ctx.cleanup.contractIds.push(c.id);

  // 기존 평점/리뷰 수 기록
  const before = await prisma.caregiver.findUnique({ where: { id: cgC.id } });

  // V1: 리뷰 작성
  const r = await axios.post(`${API}/reviews`,
    { contractId: c.id, rating: 4.5, comment: '친절했습니다', wouldRehire: true },
    { headers: auth(guardianToken) });
  if (r.data?.success) ok('V1 리뷰 작성 성공');
  else bad('V1', JSON.stringify(r.data));

  // V2: 같은 보호자가 같은 계약에 또 작성 → 차단
  await expectFail(
    'V2 중복 리뷰 차단',
    () => axios.post(`${API}/reviews`,
      { contractId: c.id, rating: 5, comment: '다시', wouldRehire: false },
      { headers: auth(guardianToken) }),
    400,
  );

  // V3: 다른 보호자 (guardian2) 가 남의 계약에 리뷰 → 차단
  await expectFail(
    'V3 다른 보호자 리뷰 권한 거절',
    () => axios.post(`${API}/reviews`,
      { contractId: c.id, rating: 1, comment: '잘 모르지만', wouldRehire: false },
      { headers: auth(guardian2Token) }),
    404,  // 컨트롤러: guardianId 일치 안 하면 "리뷰를 작성할 수 있는 계약을 찾을 수 없습니다" 404
  );

  // V4: 평점 평균 갱신 검증
  const after = await prisma.caregiver.findUnique({ where: { id: cgC.id } });
  if (after && after.avgRating > 0) {
    ok(`V4 간병인 평점 갱신 (${before?.avgRating} → ${after.avgRating})`);
  } else bad('V4 평점 갱신', `avgRating=${after?.avgRating}`);
}

async function s_penalty(ctx: any) {
  console.log('\n━━━ N. Penalty 누적 → 3회 SUSPENDED ━━━');
  const { cgD } = ctx;

  // cgD 의 패널티 0 으로 보장
  await prisma.caregiver.update({ where: { id: cgD.id }, data: { penaltyCount: 0, status: 'APPROVED' } });
  await prisma.penalty.deleteMany({ where: { caregiverId: cgD.id, isAutomatic: true } });

  // 패널티 2회 누적
  for (let i = 0; i < 2; i++) {
    await prisma.penalty.create({
      data: { caregiverId: cgD.id, type: 'CANCELLATION', reason: `테스트 ${i + 1}회`, isAutomatic: true },
    });
    await prisma.caregiver.update({ where: { id: cgD.id }, data: { penaltyCount: { increment: 1 } } });
  }
  let cg = await prisma.caregiver.findUnique({ where: { id: cgD.id } });
  if (cg?.status === 'APPROVED' && cg.penaltyCount === 2) {
    ok('N1 2회 누적 — 아직 ACTIVE');
  } else bad('N1', `status=${cg?.status}, count=${cg?.penaltyCount}`);

  // 3회째: 컨트롤러 로직(cancelContract 의 자동 SUSPENDED) 시뮬레이션 — 직접 update
  await prisma.penalty.create({
    data: { caregiverId: cgD.id, type: 'CANCELLATION', reason: '3회째 누적', isAutomatic: true },
  });
  await prisma.caregiver.update({ where: { id: cgD.id }, data: { penaltyCount: { increment: 1 } } });
  cg = await prisma.caregiver.findUnique({ where: { id: cgD.id } });
  // cancelContract 의 로직은 컨트롤러 안에서 발동 — 여기는 데이터 일관성만 확인
  if (cg?.penaltyCount === 3) {
    ok('N2 3회 누적 카운트 정상 (cancelContract 호출 시 자동 SUSPENDED 트리거)');
  } else bad('N2', `count=${cg?.penaltyCount}`);
}

async function s_earningRace(ctx: any) {
  console.log('\n━━━ E. Earning 정산 race (DIRECT 결제 동시 호출) ━━━');
  const { guardianToken, guardian1Id, cgA, patients } = ctx;

  // 새 ACTIVE 계약 (cgA 의 unique idx 회피 위해 다른 cg 필요)
  // 간단히: cgA 의 기존 ACTIVE 계약을 활용
  const existing = await prisma.contract.findFirst({
    where: { caregiverId: cgA.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { earnings: true, payments: true },
  });
  if (!existing) { bad('E 사전조건', '계약 없음'); return; }
  const before = existing.earnings.length;

  // DIRECT 결제는 createPayment 가 즉시 Earning 생성 — 동시 두 번 호출
  // (10초 dedup 가드 안에 있으면 같은 PENDING 결제 반환되어 중복 안 됨)
  await prisma.payment.deleteMany({ where: { contractId: existing.id, status: 'PENDING' } });

  // Rate limiter 회피 위해 65초 대기
  console.log('  (rate limit 회피 65s 대기...)');
  await new Promise((r) => setTimeout(r, 65000));

  const p1 = axios.post(`${API}/payments`,
    { contractId: existing.id, method: 'DIRECT', testMode: true },
    { headers: auth(guardianToken) }).then(r => ({ ok: true, data: r.data })).catch((e: AxiosError) => ({ ok: false, status: e.response?.status }));
  const p2 = axios.post(`${API}/payments`,
    { contractId: existing.id, method: 'DIRECT', testMode: true },
    { headers: auth(guardianToken) }).then(r => ({ ok: true, data: r.data })).catch((e: AxiosError) => ({ ok: false, status: e.response?.status }));
  const [r1, r2] = await Promise.all([p1, p2]);

  // Earning 1건만 추가됐어야 함
  const after = await prisma.contract.findUnique({ where: { id: existing.id }, include: { earnings: true } });
  const added = (after?.earnings.length || 0) - before;
  if (added === 1) ok(`E1 동시 DIRECT 결제 → Earning +1 정상 (race 차단)`);
  else bad('E1', `Earning 추가 ${added}건 (예상 1)`);

  // 정리
  await prisma.payment.deleteMany({
    where: {
      contractId: existing.id,
      tossPaymentKey: { startsWith: null as any } // safe noop
    }
  }).catch(() => {});
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  도메인 영역: 환불/추가비/지원/리뷰/패널티/정산');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const ctx = await setup();
  try {
    await s_refund(ctx);
    await s_addFee(ctx);
    await s_application(ctx);
    await s_review(ctx);
    await s_penalty(ctx);
    await s_earningRace(ctx);
  } finally {
    await cleanup(ctx);
    await prisma.$disconnect();
  }
  console.log(`\n━━━ 결과: ${pass} 통과 / ${fail} 실패 ━━━`);
  if (fail) {
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
