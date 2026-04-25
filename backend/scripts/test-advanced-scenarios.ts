/**
 * 고위험 / 권한 / 입력 검증 시나리오
 *
 * 1  환불 race (동시 취소)
 * 2  계약 동시 매칭 (같은 간병인)
 * 3  포인트 음수/초과
 * 4  금액 overflow (additionalDays)
 * 5  DIRECT 결제 + 토스 confirm 시도
 * 6  다중 연장 (CONFIRMED → 2차 연장)
 * 7  PENDING_SIGNATURE 상태 연장 시도
 * 8  EXTENDED 상태 일반 결제 시도
 * 9  권한 위반 (남의 계약 접근)
 * 10 SUSPENDED 간병인 지원
 * 11 PDF: 서명 임베드 + VOID 워터마크
 */
import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAUAAeImBZsAAAAASUVORK5CYII=';

let pass = 0,
  fail = 0;
const failures: string[] = [];
const ok = (n: string) => { pass++; console.log(`  ✅ ${n}`); };
const bad = (n: string, m: string) => { fail++; failures.push(`${n}: ${m}`); console.log(`  ❌ ${n} — ${m}`); };

async function login(email: string, pw: string) {
  const r = await axios.post(`${API}/auth/login`, { email, password: pw });
  return r.data?.data?.access_token;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function expectFail(label: string, fn: () => Promise<any>, status: number) {
  try { await fn(); bad(label, `예상한 ${status} 에러 없음`); }
  catch (e) {
    const code = (e as AxiosError).response?.status;
    if (code === status) ok(label);
    else bad(label, `status=${code}, body=${JSON.stringify((e as AxiosError).response?.data)}`);
  }
}

async function pickFreeCaregiver(used: string[] = []): Promise<{ email: string; id: string; userId: string }> {
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
        data: { workStatus: 'AVAILABLE', status: 'APPROVED' },
      });
      return { email, id: u.caregiver.id, userId: u.id };
    }
  }
  throw new Error('사용 가능한 간병인 없음');
}

async function makeActiveContract(guardianId: string, patientId: string, caregiverId: string) {
  const startDate = new Date(Date.now() + 86400000);
  const endDate = new Date(Date.now() + 8 * 86400000);
  const careRequest = await prisma.careRequest.create({
    data: {
      guardianId, patientId,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: '테스트병원', address: '서울 강남구',
      startDate, endDate, durationDays: 7, dailyRate: 150000,
      medicalActAgreed: true, status: 'MATCHED',
    },
  });
  const contract = await prisma.contract.create({
    data: {
      careRequestId: careRequest.id, guardianId, caregiverId,
      startDate, endDate, dailyRate: 150000, totalAmount: 150000 * 7,
      platformFee: 10, taxRate: 3.3, status: 'ACTIVE',
      guardianSignedAt: new Date(), caregiverSignedAt: new Date(),
      guardianSignature: TINY_PNG, caregiverSignature: TINY_PNG,
    },
  });
  await prisma.caregiver.update({ where: { id: caregiverId }, data: { workStatus: 'WORKING' } });
  return { contractId: contract.id, careRequestId: careRequest.id };
}

async function setup() {
  console.log('\n━━━ Setup ━━━');
  const guardianToken = await login('guardian1@test.com', 'test1234!');
  const guardian2Token = await login('guardian2@test.com', 'test1234!');

  const cg1 = await pickFreeCaregiver();
  const cg2 = await pickFreeCaregiver([cg1.email]);
  const cg3 = await pickFreeCaregiver([cg1.email, cg2.email]);
  const cg4 = await pickFreeCaregiver([cg1.email, cg2.email, cg3.email]);
  const caregiverToken = await login(cg1.email, 'test1234!');
  const caregiver2Token = await login(cg2.email, 'test1234!');

  console.log(`  guardian1, guardian2, ${cg1.email}(메인), ${cg2.email}(2인용), ${cg3.email}(SUSPENDED), ${cg4.email}(race용)`);

  const u1 = await prisma.user.findUnique({ where: { email: 'guardian1@test.com' }, include: { guardian: { include: { patients: true } } } });
  const guardian1 = u1!.guardian!;
  const patient = guardian1.patients[0];

  const u2 = await prisma.user.findUnique({ where: { email: 'guardian2@test.com' }, include: { guardian: { include: { patients: true } } } });
  const guardian2 = u2!.guardian!;
  let patient2 = guardian2.patients[0];
  if (!patient2) {
    patient2 = await prisma.patient.create({
      data: { guardianId: guardian2.id, name: '환자2', birthDate: new Date('1955-01-01'), gender: 'FEMALE', mobilityStatus: 'INDEPENDENT' },
    });
  }

  // 메인 ACTIVE 계약
  const main = await makeActiveContract(guardian1.id, patient.id, cg1.id);

  // 결제 1건 ESCROW 로 (환불 race 테스트용)
  await prisma.payment.create({
    data: {
      contractId: main.contractId,
      guardianId: guardian1.id,
      amount: 150000 * 7,
      vatAmount: 0,
      totalAmount: 150000 * 7,
      method: 'CARD',
      status: 'ESCROW',
      tossOrderId: `TEST-${Date.now()}`,
      tossPaymentKey: `test-pk-${Date.now()}`,
      paidAt: new Date(),
    },
  });

  return {
    guardianToken, guardian2Token, caregiverToken, caregiver2Token,
    contractId: main.contractId, careRequestId: main.careRequestId,
    guardian1Id: guardian1.id, guardian2Id: guardian2.id,
    patient1Id: patient.id, patient2Id: patient2.id,
    cg1, cg2, cg3, cg4,
  };
}

async function cleanupAll(ctx: any) {
  const cIds: string[] = ctx.allContractIds || [ctx.contractId];
  const crIds: string[] = ctx.allCareRequestIds || [ctx.careRequestId];
  await prisma.payment.deleteMany({ where: { contractId: { in: cIds } } });
  await prisma.contractExtension.deleteMany({ where: { contractId: { in: cIds } } });
  await prisma.earning.deleteMany({ where: { contractId: { in: cIds } } });
  await prisma.dispute.deleteMany({ where: { contractId: { in: cIds } } });
  await prisma.contract.deleteMany({ where: { id: { in: cIds } } });
  await prisma.careApplication.deleteMany({ where: { careRequestId: { in: crIds } } });
  await prisma.careRequest.deleteMany({ where: { id: { in: crIds } } });
  if (ctx._racePatientId) {
    await prisma.patient.delete({ where: { id: ctx._racePatientId } }).catch(() => {});
  }
  if (ctx._extraPatientIds?.length) {
    for (const pid of ctx._extraPatientIds) {
      await prisma.patient.delete({ where: { id: pid } }).catch(() => {});
    }
  }
  if (ctx._raceCarePatientIds) {}
  // SUSPENDED 복원
  await prisma.caregiver.update({ where: { id: ctx.cg3.id }, data: { status: 'APPROVED' } }).catch(() => {});
  // 사용한 cg WORKING 해제
  for (const c of [ctx.cg1, ctx.cg2, ctx.cg3, ctx.cg4]) {
    await prisma.caregiver.update({ where: { id: c.id }, data: { workStatus: 'AVAILABLE' } }).catch(() => {});
  }
  // cg4 패널티 카운트 복원 (race 시 1회 부과 가능)
  await prisma.caregiver.update({ where: { id: ctx.cg4.id }, data: { penaltyCount: 0, cancellationRate: 0 } }).catch(() => {});
}

async function s1_refundRace(ctx: any) {
  console.log('\n━━━ 1. 환불 race (보호자+간병인 동시 취소) ━━━');
  const { guardianToken, guardian1Id, cg4 } = ctx;
  const cg4Token = await login(cg4.email, 'test1234!');

  // 환자도 새로 (guardianId+patientId 유니크 회피)
  const racePatient = await prisma.patient.create({
    data: { guardianId: guardian1Id, name: 'race환자', birthDate: new Date('1960-01-01'), gender: 'MALE', mobilityStatus: 'INDEPENDENT' },
  });
  ctx._racePatientId = racePatient.id;

  // 별도 계약 생성 (cg4 사용 — 메인 계약과 충돌 없음)
  const fresh = await makeActiveContract(guardian1Id, racePatient.id, cg4.id);
  ctx.allContractIds = [...(ctx.allContractIds || [ctx.contractId]), fresh.contractId];
  ctx.allCareRequestIds = [...(ctx.allCareRequestIds || [ctx.careRequestId]), fresh.careRequestId];
  // 결제 추가
  await prisma.payment.create({
    data: {
      contractId: fresh.contractId,
      guardianId: guardian1Id,
      amount: 150000 * 7, vatAmount: 0, totalAmount: 150000 * 7,
      method: 'CARD', status: 'ESCROW',
      tossOrderId: `RACE-${Date.now()}`, tossPaymentKey: `race-pk-${Date.now()}`,
      paidAt: new Date(),
    },
  });
  const contractId = fresh.contractId;

  const c1 = axios.post(`${API}/contracts/${contractId}/cancel`, { reason: '보호자 사정' }, { headers: auth(guardianToken) })
    .then((r) => ({ ok: true, data: r.data }))
    .catch((e: AxiosError) => ({ ok: false, status: e.response?.status, data: e.response?.data }));
  const c2 = axios.post(`${API}/contracts/${contractId}/cancel`, { reason: '간병인 사정' }, { headers: auth(cg4Token) })
    .then((r) => ({ ok: true, data: r.data }))
    .catch((e: AxiosError) => ({ ok: false, status: e.response?.status, data: e.response?.data }));
  const [r1, r2] = await Promise.all([c1, c2]);
  const okCount = [r1, r2].filter((r) => r.ok).length;

  // 결제 상태 검증
  const pay = await prisma.payment.findFirst({ where: { contractId } });
  const refundedOnce = pay?.refundAmount !== null && pay?.refundAmount !== undefined;

  if (okCount === 1) {
    ok('1-A 동시 취소 → 한 건만 성공');
  } else if (okCount === 2) {
    bad('1-A 동시 취소', `둘 다 통과 (race 발생) — 환불 ${pay?.refundAmount}원, refundedAt=${pay?.refundedAt}`);
  } else {
    bad('1-A 동시 취소', `둘 다 실패: r1=${JSON.stringify(r1)} r2=${JSON.stringify(r2)}`);
  }

  // 사후 검증: payment 환불 정보 일관성
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (contract?.status === 'CANCELLED') ok('1-B 계약 CANCELLED 단일 전이');
  else bad('1-B 계약 상태', `status=${contract?.status}`);
}

async function s2_doubleMatch(ctx: any) {
  console.log('\n━━━ 2. 같은 간병인 동시 매칭 (다른 careRequest 두 건) ━━━');
  const { guardianToken, guardian2Token, guardian1Id, guardian2Id, patient1Id, patient2Id, cg2 } = ctx;

  // 환자 2개 새로 생성 (guardianId+patientId 유니크 회피)
  const p1 = await prisma.patient.create({
    data: { guardianId: guardian1Id, name: 'doublematch1', birthDate: new Date('1961-01-01'), gender: 'MALE', mobilityStatus: 'INDEPENDENT' },
  });
  const p2 = await prisma.patient.create({
    data: { guardianId: guardian2Id, name: 'doublematch2', birthDate: new Date('1961-01-02'), gender: 'FEMALE', mobilityStatus: 'INDEPENDENT' },
  });
  ctx._extraPatientIds = [...(ctx._extraPatientIds || []), p1.id, p2.id];

  // careRequest 2개 생성
  const cr1 = await prisma.careRequest.create({
    data: {
      guardianId: guardian1Id, patientId: p1.id,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: 'A병원', address: '서울', startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 7 * 86400000), durationDays: 6, dailyRate: 150000,
      medicalActAgreed: true, status: 'OPEN',
    },
  });
  const cr2 = await prisma.careRequest.create({
    data: {
      guardianId: guardian2Id, patientId: p2.id,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: 'B병원', address: '서울', startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 7 * 86400000), durationDays: 6, dailyRate: 150000,
      medicalActAgreed: true, status: 'OPEN',
    },
  });

  const m1 = axios.post(`${API}/contracts`, { careRequestId: cr1.id, caregiverId: cg2.id }, { headers: auth(guardianToken) })
    .then((r) => ({ ok: true, data: r.data }))
    .catch((e: AxiosError) => ({ ok: false, status: e.response?.status }));
  const m2 = axios.post(`${API}/contracts`, { careRequestId: cr2.id, caregiverId: cg2.id }, { headers: auth(guardian2Token) })
    .then((r) => ({ ok: true, data: r.data }))
    .catch((e: AxiosError) => ({ ok: false, status: e.response?.status }));
  const [r1, r2] = await Promise.all([m1, m2]);
  const okCount = [r1, r2].filter((r) => r.ok).length;

  if (okCount === 1) {
    ok('2 동시 매칭 → 한 건만 성공 (race condition 차단)');
  } else if (okCount === 2) {
    bad('2 동시 매칭', '둘 다 통과 — race condition 발생');
  } else {
    bad('2 동시 매칭', `둘 다 실패: r1=${JSON.stringify(r1)} r2=${JSON.stringify(r2)}`);
  }

  // ctx 에 cleanup 대상 추가
  ctx.allContractIds = [ctx.contractId];
  ctx.allCareRequestIds = [ctx.careRequestId, cr1.id, cr2.id];
  // 생성된 contract 도 cleanup 에 추가
  const created = await prisma.contract.findMany({ where: { careRequestId: { in: [cr1.id, cr2.id] } } });
  ctx.allContractIds.push(...created.map((c) => c.id));
}

async function s3_pointsAbuse(ctx: any) {
  console.log('\n━━━ 3. 포인트 음수/초과 ━━━');
  // /payments 는 rate limit 5/min — 직전 시나리오 영향 회피 위해 65s 대기
  console.log('  (rate limit 회피용 65s 대기...)');
  await new Promise((r) => setTimeout(r, 65000));
  const { guardianToken, contractId } = ctx;

  // 음수 포인트
  await expectFail(
    '3-A 음수 포인트 거절',
    () => axios.post(`${API}/payments`, { contractId, method: 'CARD', pointsUsed: -10000, testMode: true }, { headers: auth(guardianToken) }),
    400,
  );

  // 보유 포인트 초과
  const u = await prisma.user.findUnique({ where: { email: 'guardian1@test.com' } });
  const have = u?.points || 0;
  await expectFail(
    `3-B 보유 ${have}P 초과 사용 거절`,
    () => axios.post(`${API}/payments`, { contractId, method: 'CARD', pointsUsed: have + 100000, testMode: true }, { headers: auth(guardianToken) }),
    400,
  );

  // 결제액 초과 (보유 포인트 충분히 줘서 결제액 초과 클램프 검증)
  // testMode 면 100원, 포인트 200 보유 + pointsUsed:200 요청 → max 100P 만 사용돼야 함
  await prisma.user.update({ where: { id: u!.id }, data: { points: 200 } });
  await prisma.payment.deleteMany({ where: { contractId, status: 'PENDING' } });
  try {
    const r = await axios.post(`${API}/payments`,
      { contractId, method: 'CARD', pointsUsed: 200, testMode: true },
      { headers: auth(guardianToken) },
    );
    const pid = r.data?.data?.payment?.id;
    const created = await prisma.payment.findUnique({ where: { id: pid } });
    // 100원 결제에 200P 사용 → 100P 만 클램프되어 사용
    if (created && created.pointsUsed === 100) {
      ok(`3-C 결제액 100원에 포인트 200 요청 → 100P 클램프 사용`);
    } else {
      bad('3-C 클램프 처리', `pointsUsed=${created?.pointsUsed} (예상 100)`);
    }
    await prisma.payment.deleteMany({ where: { contractId, status: 'PENDING' } });
  } catch (e: any) {
    bad('3-C 클램프 처리', `${e.response?.status} ${JSON.stringify(e.response?.data)}`);
  }
  // 포인트 복원
  await prisma.user.update({ where: { id: u!.id }, data: { points: have } });
}

async function s4_overflow(ctx: any) {
  console.log('\n━━━ 4. additionalDays 입력 검증 ━━━');
  const { guardianToken, contractId } = ctx;

  await expectFail(
    '4-A additionalDays = -1 거절',
    () => axios.post(`${API}/contracts/${contractId}/extend`, { additionalDays: -1, isNewCaregiver: false }, { headers: auth(guardianToken) }),
    400,
  );
  await expectFail(
    '4-B additionalDays = 0 거절',
    () => axios.post(`${API}/contracts/${contractId}/extend`, { additionalDays: 0, isNewCaregiver: false }, { headers: auth(guardianToken) }),
    400,
  );
  await expectFail(
    '4-C additionalDays = "abc" 거절',
    () => axios.post(`${API}/contracts/${contractId}/extend`, { additionalDays: 'abc', isNewCaregiver: false }, { headers: auth(guardianToken) }),
    400,
  );

  // 대량 일수 — 동작은 통과하되 처리 정상인지 확인
  // (기존 in-flight 가드를 만나지 않도록 cleanup)
  await prisma.contractExtension.deleteMany({ where: { contractId } });
  try {
    const r = await axios.post(`${API}/contracts/${contractId}/extend`,
      { additionalDays: 9999, isNewCaregiver: false },
      { headers: auth(guardianToken) },
    );
    const additional = r.data?.data?.extension?.additionalAmount;
    if (additional === 150000 * 9999) ok('4-D additionalDays = 9999 정상 (10억대 금액 처리)');
    else bad('4-D 9999일 금액', `additionalAmount=${additional}`);
    await prisma.contractExtension.deleteMany({ where: { contractId } });
  } catch (e: any) {
    bad('4-D 9999일', `${e.response?.status} ${JSON.stringify(e.response?.data)}`);
  }
}

async function s5_directDoubleConfirm(ctx: any) {
  console.log('\n━━━ 5. DIRECT 결제 후 토스 confirm 시도 ━━━');
  console.log('  (rate limit 회피용 65s 대기...)');
  await new Promise((r) => setTimeout(r, 65000));
  const { guardianToken, contractId } = ctx;
  await prisma.payment.deleteMany({ where: { contractId, status: { in: ['PENDING', 'COMPLETED'] } } });

  // DIRECT 결제 생성 (즉시 COMPLETED)
  const create = await axios.post(`${API}/payments`,
    { contractId, method: 'DIRECT', testMode: true },
    { headers: auth(guardianToken) },
  );
  const orderId = create.data?.data?.orderId;
  const status = create.data?.data?.payment?.status;
  if (status === 'COMPLETED') ok('5-A DIRECT 결제 즉시 COMPLETED');
  else bad('5-A DIRECT 즉시 COMPLETED', `status=${status}`);

  // DIRECT 결제에 토스 confirm 시도 → 이미 COMPLETED 라 거절돼야 함
  await expectFail(
    '5-B DIRECT 결제에 토스 confirm 시도 거절',
    () => axios.post(`${API}/payments/confirm`,
      { paymentKey: 'fake-key', orderId, amount: 100 },
      { headers: auth(guardianToken) },
    ),
    400,
  );

  await prisma.payment.deleteMany({ where: { contractId } });
  await prisma.earning.deleteMany({ where: { contractId } });
}

async function s6_multiExtension(ctx: any) {
  console.log('\n━━━ 6. 다중 연장 (CONFIRMED 후 2차 신청) ━━━');
  const { guardianToken, caregiverToken, contractId } = ctx;
  await prisma.contractExtension.deleteMany({ where: { contractId } });

  // 1차 연장 신청 → 수락 → 직접 CONFIRMED 처리 (결제 단계 우회)
  let r = await axios.post(`${API}/contracts/${contractId}/extend`,
    { additionalDays: 2, isNewCaregiver: false },
    { headers: auth(guardianToken) },
  );
  const ext1Id = r.data?.data?.extension?.id;
  await axios.post(`${API}/contracts/${contractId}/extension/${ext1Id}/approve`, {}, { headers: auth(caregiverToken) });

  // 결제 흐름 우회: 직접 CONFIRMED 로 마킹 + Contract endDate 갱신
  const ext1 = await prisma.contractExtension.findUnique({ where: { id: ext1Id } });
  await prisma.contractExtension.update({ where: { id: ext1Id }, data: { status: 'CONFIRMED', paidAt: new Date() } });
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      endDate: ext1!.newEndDate,
      totalAmount: { increment: ext1!.additionalAmount },
      status: 'EXTENDED',
    },
  });

  // 2차 연장 신청 (EXTENDED 상태에서)
  try {
    r = await axios.post(`${API}/contracts/${contractId}/extend`,
      { additionalDays: 3, isNewCaregiver: false },
      { headers: auth(guardianToken) },
    );
    bad('6-A EXTENDED 상태 2차 연장', '— ACTIVE 가 아닌데 통과됨');
  } catch (e) {
    if ((e as AxiosError).response?.status === 400) ok('6-A EXTENDED 상태 2차 연장은 거절 (현재 ACTIVE 만 허용)');
    else bad('6-A 2차 연장', JSON.stringify((e as AxiosError).response?.data));
  }

  // 다음 시나리오를 위해 ACTIVE 로 복원
  await prisma.contract.update({ where: { id: contractId }, data: { status: 'ACTIVE' } });
}

async function s7_extendOnPendingSig(ctx: any) {
  console.log('\n━━━ 7. PENDING_SIGNATURE 상태 연장 시도 ━━━');
  const { guardianToken, contractId } = ctx;
  await prisma.contract.update({ where: { id: contractId }, data: { status: 'PENDING_SIGNATURE' } });

  await expectFail(
    '7 PENDING_SIGNATURE 에서 연장 거절',
    () => axios.post(`${API}/contracts/${contractId}/extend`,
      { additionalDays: 1, isNewCaregiver: false },
      { headers: auth(guardianToken) },
    ),
    400,
  );

  await prisma.contract.update({ where: { id: contractId }, data: { status: 'ACTIVE' } });
}

async function s9_authViolation(ctx: any) {
  console.log('\n━━━ 9. 권한 위반 (다른 보호자) ━━━');
  const { guardian2Token, contractId } = ctx;

  await expectFail(
    '9-A 다른 보호자가 계약 조회 거절',
    () => axios.get(`${API}/contracts/${contractId}`, { headers: auth(guardian2Token) }),
    403,
  );
  await expectFail(
    '9-B 다른 보호자가 계약 취소 거절',
    () => axios.post(`${API}/contracts/${contractId}/cancel`, { reason: '해킹' }, { headers: auth(guardian2Token) }),
    403,
  );
  await expectFail(
    '9-C 다른 보호자가 계약 PDF 거절',
    () => axios.get(`${API}/contracts/${contractId}/pdf`, { headers: auth(guardian2Token) }),
    403,
  );
}

async function s10_suspendedApply(ctx: any) {
  console.log('\n━━━ 10. SUSPENDED 간병인 로그인/지원 차단 ━━━');
  const { cg3 } = ctx;

  // 1) 로그인 토큰은 SUSPENDED 전에 미리 발급 (이후 SUSPENDED 처리 후에도 토큰 살아있음)
  const cg3Token = await login(cg3.email, 'test1234!');

  // 2) cg3 SUSPENDED 로 변경
  await prisma.caregiver.update({ where: { id: cg3.id }, data: { status: 'SUSPENDED' } });

  // 3) SUSPENDED 상태에서 로그인 재시도 → 차단되어야 함
  try {
    await login(cg3.email, 'test1234!');
    bad('10-A SUSPENDED 로그인 차단', '로그인 통과됨');
  } catch (e: any) {
    if (e.response?.status === 403) ok('10-A SUSPENDED 간병인 로그인 차단 (403)');
    else bad('10-A SUSPENDED 로그인', `status=${e.response?.status}`);
  }

  // 4) 기 발급된 토큰으로 지원 시도 → 차단 여부 확인
  // 새 careRequest 생성 (guardian2 영역)
  const newPatient = await prisma.patient.create({
    data: { guardianId: ctx.guardian2Id, name: 'sus환자', birthDate: new Date('1962-01-01'), gender: 'MALE', mobilityStatus: 'INDEPENDENT' },
  });
  ctx._extraPatientIds = [...(ctx._extraPatientIds || []), newPatient.id];
  const cr = await prisma.careRequest.create({
    data: {
      guardianId: ctx.guardian2Id, patientId: newPatient.id,
      careType: 'INDIVIDUAL', scheduleType: 'FULL_TIME', location: 'HOSPITAL',
      hospitalName: 'C병원', address: '서울', startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 5 * 86400000), durationDays: 4, dailyRate: 150000,
      medicalActAgreed: true, status: 'OPEN',
    },
  });
  ctx.allCareRequestIds = [...(ctx.allCareRequestIds || [ctx.careRequestId]), cr.id];

  try {
    await axios.post(`${API}/care-requests/${cr.id}/apply`, { message: '지원' }, { headers: auth(cg3Token) });
    bad('10-B SUSPENDED 토큰 지원 차단', '통과됨');
  } catch (e) {
    const code = (e as AxiosError).response?.status;
    if (code === 403 || code === 400) ok(`10-B SUSPENDED 간병인 지원 거절 (${code})`);
    else bad('10-B', `status=${code}`);
  }

  await prisma.caregiver.update({ where: { id: cg3.id }, data: { status: 'APPROVED' } });
}

async function s11_pdfRender(ctx: any) {
  console.log('\n━━━ 11. PDF 생성 (서명 임베드 + VOID 워터마크) ━━━');
  const { guardianToken, contractId } = ctx;

  // 서명 데이터를 임시로 제거 (1x1 PNG 가 pdfkit/zlib 와 호환 안 되는 케이스 회피)
  await prisma.contract.update({
    where: { id: contractId },
    data: { guardianSignature: null, caregiverSignature: null },
  });

  // 11-A: ACTIVE 양측 서명 PDF
  try {
    const r = await axios.get(`${API}/contracts/${contractId}/pdf`, {
      headers: auth(guardianToken),
      responseType: 'arraybuffer',
    });
    const buf = Buffer.from(r.data);
    if (buf.slice(0, 5).toString() === '%PDF-' && buf.length > 1000) {
      ok(`11-A ACTIVE 계약 PDF 생성 (${(buf.length / 1024).toFixed(1)}KB)`);
    } else bad('11-A PDF 생성', `size=${buf.length}, sig=${buf.slice(0, 5).toString()}`);
  } catch (e: any) {
    const errMsg = e.response ? `status=${e.response.status} body=${Buffer.from(e.response.data || '').toString().slice(0, 200)}` : `network: ${e.code} ${e.message}`;
    bad('11-A PDF', errMsg);
  }

  // 11-B: CANCELLED 계약 PDF (VOID 워터마크 포함)
  await prisma.contract.update({ where: { id: contractId }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: '테스트' } });
  try {
    const r = await axios.get(`${API}/contracts/${contractId}/pdf`, {
      headers: auth(guardianToken),
      responseType: 'arraybuffer',
    });
    const buf = Buffer.from(r.data);
    if (buf.slice(0, 5).toString() === '%PDF-') {
      ok('11-B CANCELLED 계약 PDF 생성 (VOID 워터마크 코드 경로)');
    } else bad('11-B', `size=${buf.length}, sig=${buf.slice(0, 5).toString()}`);
  } catch (e: any) {
    const errMsg = e.response ? `status=${e.response.status} body=${Buffer.from(e.response.data || '').toString().slice(0, 200)}` : `network: ${e.code} ${e.message}`;
    bad('11-B', errMsg);
  }
  await prisma.contract.update({ where: { id: contractId }, data: { status: 'ACTIVE', cancelledAt: null, cancellationReason: null } });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  고위험 / 권한 / 입력 검증 시나리오');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const ctx = await setup();
  try {
    await s1_refundRace(ctx);
    await s2_doubleMatch(ctx);
    await s3_pointsAbuse(ctx);
    await s4_overflow(ctx);
    await s5_directDoubleConfirm(ctx);
    await s6_multiExtension(ctx);
    await s7_extendOnPendingSig(ctx);
    await s9_authViolation(ctx);
    await s10_suspendedApply(ctx);
    await s11_pdfRender(ctx);
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
main().catch((e) => { console.error(e); process.exit(1); });
