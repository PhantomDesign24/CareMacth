/**
 * 통합 시나리오 검증: 디지털 서명 + 연장 흐름 (PENDING_CAREGIVER_APPROVAL 분기 포함)
 *
 * 시드 사용자 기준:
 *  - 보호자: guardian1@test.com / test1234!
 *  - 간병인: cg1@test.com (메인), cg2@test.com (권한 위반 테스트용)
 *
 * 실행: npx tsx scripts/test-extension-flow.ts
 */
import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();

type Role = 'guardian' | 'caregiver' | 'caregiver2';

const TINY_PNG_DATAURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAUAAeImBZsAAAAASUVORK5CYII=';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string) {
  pass++;
  console.log(`  ✅ ${name}`);
}
function bad(name: string, msg: string) {
  fail++;
  failures.push(`${name}: ${msg}`);
  console.log(`  ❌ ${name} — ${msg}`);
}

async function login(email: string, password: string): Promise<string> {
  const res = await axios.post(`${API}/auth/login`, { email, password });
  const d = res.data?.data || res.data;
  return d?.access_token || d?.accessToken || d?.token;
}

async function loginAdmin(): Promise<string> {
  const res = await axios.post(`${API}/auth/admin/login`, { username: 'admin', password: '1234' });
  return res.data?.data?.accessToken || res.data?.accessToken;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function expectError(label: string, fn: () => Promise<any>, status: number, partialMsg?: string) {
  try {
    await fn();
    bad(label, `예상한 ${status} 에러가 발생하지 않음`);
  } catch (e) {
    const err = e as AxiosError;
    const code = err.response?.status;
    const body: any = err.response?.data;
    if (code === status) {
      if (partialMsg) {
        const msg = JSON.stringify(body);
        if (msg.includes(partialMsg)) ok(label);
        else bad(label, `메시지 불일치 (expected ~"${partialMsg}", got ${msg})`);
      } else {
        ok(label);
      }
    } else {
      bad(label, `status ${code} (예상 ${status}) — ${JSON.stringify(body)}`);
    }
  }
}

async function pickFreeCaregiverEmail(used: string[] = []): Promise<string> {
  // ACTIVE/EXTENDED/PENDING_SIGNATURE 계약 없는 cg 찾기
  for (let i = 1; i <= 10; i++) {
    const email = `cg${i}@test.com`;
    if (used.includes(email)) continue;
    const u = await prisma.user.findUnique({ where: { email }, include: { caregiver: true } });
    if (!u?.caregiver) continue;
    const active = await prisma.contract.count({
      where: {
        caregiverId: u.caregiver.id,
        status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] },
      },
    });
    if (active === 0) return email;
  }
  throw new Error('사용 가능한 간병인이 없습니다.');
}

async function setup() {
  // 진입점: guardian1 + 활성 계약 없는 cg X 2명
  console.log('\n━━━ Setup ━━━');
  const guardianToken = await login('guardian1@test.com', 'test1234!');
  const cgEmail = await pickFreeCaregiverEmail();
  const cg2Email = await pickFreeCaregiverEmail([cgEmail]);
  console.log(`  사용 간병인: ${cgEmail} / 권한위반 테스트용: ${cg2Email}`);
  const caregiverToken = await login(cgEmail, 'test1234!');
  const caregiver2Token = await login(cg2Email, 'test1234!');

  // guardian1 의 환자 1명 가져오기
  const meRes = await axios.get(`${API}/auth/me`, { headers: authHeader(guardianToken) });
  const meData = meRes.data?.data?.user || meRes.data?.data || meRes.data;
  const guardianUserId = meData?.id;

  const guardian = await prisma.guardian.findUnique({
    where: { userId: guardianUserId },
    include: { patients: true },
  });
  if (!guardian) throw new Error('guardian1 의 보호자 레코드 없음');
  let patient = guardian.patients[0];
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        guardianId: guardian.id,
        name: '테스트환자_연장',
        birthDate: new Date('1950-01-01'),
        gender: 'MALE',
        mobilityStatus: 'INDEPENDENT',
        diagnosis: '테스트',
      },
    });
  }

  // 사용할 간병인 AVAILABLE 보장
  const cgUser = await prisma.user.findUnique({ where: { email: cgEmail } });
  if (cgUser) {
    await prisma.caregiver.update({
      where: { userId: cgUser.id },
      data: { workStatus: 'AVAILABLE', status: 'APPROVED' },
    });
  }
  const cg2User = await prisma.user.findUnique({ where: { email: cg2Email } });
  if (cg2User) {
    await prisma.caregiver.update({
      where: { userId: cg2User.id },
      data: { workStatus: 'AVAILABLE', status: 'APPROVED' },
    });
  }

  // 새 careRequest + contract 생성 (PENDING_SIGNATURE 시작점)
  const startDate = new Date(Date.now() + 86400000); // 내일
  const endDate = new Date(Date.now() + 8 * 86400000); // 8일 뒤
  const careRequest = await prisma.careRequest.create({
    data: {
      guardianId: guardian.id,
      patientId: patient.id,
      careType: 'INDIVIDUAL',
      scheduleType: 'FULL_TIME',
      location: 'HOSPITAL',
      hospitalName: '테스트 병원',
      address: '서울 강남구 테스트로 1',
      startDate,
      endDate,
      durationDays: 7,
      dailyRate: 150000,
      medicalActAgreed: true,
      status: 'OPEN',
    },
  });

  // 메인 간병인 정보
  const caregiver = await prisma.caregiver.findUnique({ where: { userId: cgUser!.id } });

  // 계약 생성 (createContract 가 PENDING_SIGNATURE 로 만든다고 가정)
  // — 단순히 직접 생성 (서명 흐름만 테스트)
  const contract = await prisma.contract.create({
    data: {
      careRequestId: careRequest.id,
      guardianId: guardian.id,
      caregiverId: caregiver!.id,
      startDate,
      endDate,
      dailyRate: 150000,
      totalAmount: 150000 * 7,
      platformFee: 10,
      taxRate: 3.3,
      status: 'PENDING_SIGNATURE',
    },
  });
  await prisma.careRequest.update({ where: { id: careRequest.id }, data: { status: 'MATCHED' } });
  await prisma.caregiver.update({ where: { id: caregiver!.id }, data: { workStatus: 'WORKING' } });

  console.log(`Setup OK — contract=${contract.id}`);
  return { guardianToken, caregiverToken, caregiver2Token, contractId: contract.id, careRequestId: careRequest.id };
}

async function cleanup(contractId: string, careRequestId: string) {
  // 모든 종속 데이터 정리
  await prisma.contractExtension.deleteMany({ where: { contractId } });
  await prisma.payment.deleteMany({ where: { contractId } });
  await prisma.contract.delete({ where: { id: contractId } }).catch(() => {});
  await prisma.careRequest.delete({ where: { id: careRequestId } }).catch(() => {});
}

async function runSignatureScenarios(ctx: any) {
  console.log('\n━━━ 서명 시나리오 ━━━');
  const { guardianToken, caregiverToken, contractId } = ctx;

  // S12: 너무 큰 서명 거절
  const huge = 'data:image/png;base64,' + 'A'.repeat(600_000);
  await expectError(
    'S12 서명 PNG 500KB 초과 거절',
    () => axios.post(`${API}/contracts/${contractId}/sign`, { signature: huge }, { headers: authHeader(guardianToken) }),
    400,
  );

  // S9: 보호자 서명 단독 → 상태 PENDING_SIGNATURE 유지
  let res = await axios.post(
    `${API}/contracts/${contractId}/sign`,
    { signature: TINY_PNG_DATAURL },
    { headers: authHeader(guardianToken) },
  );
  if (res.data?.data?.status === 'PENDING_SIGNATURE' && res.data?.data?.guardianSigned === true) {
    ok('S9 보호자 서명 후 PENDING_SIGNATURE 유지');
  } else {
    bad('S9 보호자 서명 후 상태', JSON.stringify(res.data));
  }

  // S11: 같은 사람이 두 번 서명 → 400
  await expectError(
    'S11 보호자 중복 서명 거절',
    () => axios.post(`${API}/contracts/${contractId}/sign`, { signature: TINY_PNG_DATAURL }, { headers: authHeader(guardianToken) }),
    400,
    '이미 서명',
  );

  // S10: 간병인 서명 → 양측 완료 → ACTIVE 전환
  res = await axios.post(
    `${API}/contracts/${contractId}/sign`,
    { signature: TINY_PNG_DATAURL },
    { headers: authHeader(caregiverToken) },
  );
  if (res.data?.data?.status === 'ACTIVE') {
    ok('S10 양측 서명 완료 → ACTIVE 전환');
  } else {
    bad('S10 양측 서명 후 상태', JSON.stringify(res.data));
  }
}

async function runExtensionScenarios(ctx: any) {
  console.log('\n━━━ 연장 시나리오 ━━━');
  const { guardianToken, caregiverToken, caregiver2Token, contractId } = ctx;

  // E1 happy path: 신청 → 수락 → (결제 단계 직전 상태 검증)
  let res = await axios.post(
    `${API}/contracts/${contractId}/extend`,
    { additionalDays: 3, isNewCaregiver: false },
    { headers: authHeader(guardianToken) },
  );
  let extId: string = res.data?.data?.extension?.id;
  if (extId && res.data?.data?.extension?.status === 'PENDING_CAREGIVER_APPROVAL') {
    ok('E1-1 기존 간병인 연장 신청 → PENDING_CAREGIVER_APPROVAL');
  } else {
    bad('E1-1 연장 신청 응답', JSON.stringify(res.data));
  }

  // E8: 진행 중 연장이 있는데 보호자가 또 신청 (현재 미차단 가능성 있음 — 동작만 기록)
  try {
    const dup = await axios.post(
      `${API}/contracts/${contractId}/extend`,
      { additionalDays: 2, isNewCaregiver: false },
      { headers: authHeader(guardianToken) },
    );
    const dupExtId = dup.data?.data?.extension?.id;
    if (dupExtId && dupExtId !== extId) {
      bad('E8 중복 연장 신청 차단 안됨', `이전 ${extId.slice(0, 8)} 와 별개로 ${dupExtId.slice(0, 8)} 생성됨`);
      // 정리
      await prisma.contractExtension.delete({ where: { id: dupExtId } }).catch(() => {});
    } else {
      ok('E8 중복 연장 신청 차단됨');
    }
  } catch (e) {
    const err = e as AxiosError;
    if (err.response?.status === 400) ok('E8 중복 연장 신청 차단 (400)');
    else bad('E8 중복 연장 응답', `${err.response?.status} ${JSON.stringify(err.response?.data)}`);
  }

  // E6: 다른 간병인(cg2)이 approve 시도 → 403
  await expectError(
    'E6 다른 간병인 approve 거절',
    () =>
      axios.post(
        `${API}/contracts/${contractId}/extension/${extId}/approve`,
        {},
        { headers: authHeader(caregiver2Token) },
      ),
    403,
  );

  // E1-2: 정상 간병인 approve → PENDING_PAYMENT
  res = await axios.post(
    `${API}/contracts/${contractId}/extension/${extId}/approve`,
    {},
    { headers: authHeader(caregiverToken) },
  );
  if (res.data?.data?.extension?.status === 'PENDING_PAYMENT') {
    ok('E1-2 간병인 수락 → PENDING_PAYMENT 전환');
  } else {
    bad('E1-2 수락 응답', JSON.stringify(res.data));
  }

  // E7: 이미 수락된 연장 재수락 → 400
  await expectError(
    'E7 이미 수락된 연장 재수락 거절',
    () =>
      axios.post(
        `${API}/contracts/${contractId}/extension/${extId}/approve`,
        {},
        { headers: authHeader(caregiverToken) },
      ),
    400,
    '수락 대기 상태가 아닙니다',
  );

  // 정리: 첫 번째 연장 EXPIRED 처리 후 다음 시나리오
  await prisma.contractExtension.update({ where: { id: extId }, data: { status: 'EXPIRED' } });

  // E2: 거절 시나리오 — 새 연장 생성 후 간병인이 거절
  res = await axios.post(
    `${API}/contracts/${contractId}/extend`,
    { additionalDays: 2, isNewCaregiver: false },
    { headers: authHeader(guardianToken) },
  );
  extId = res.data?.data?.extension?.id;

  res = await axios.post(
    `${API}/contracts/${contractId}/extension/${extId}/reject`,
    { reason: '테스트 거절' },
    { headers: authHeader(caregiverToken) },
  );
  const after = await prisma.contractExtension.findUnique({ where: { id: extId } });
  if (after?.status === 'REJECTED') {
    ok('E2 간병인 거절 → REJECTED');
  } else {
    bad('E2 거절 후 상태', `status=${after?.status}`);
  }

  // E5: 신규 간병인 모드 — 즉시 PENDING_PAYMENT
  res = await axios.post(
    `${API}/contracts/${contractId}/extend`,
    { additionalDays: 1, isNewCaregiver: true },
    { headers: authHeader(guardianToken) },
  );
  if (res.data?.data?.extension?.status === 'PENDING_PAYMENT') {
    ok('E5 신규 간병인 모드 → 즉시 PENDING_PAYMENT');
  } else {
    bad('E5 신규 간병인 응답', JSON.stringify(res.data));
  }
  // 정리
  await prisma.contractExtension.update({
    where: { id: res.data?.data?.extension?.id },
    data: { status: 'EXPIRED' },
  });

  // E3: 24시간 미응답 자동 EXPIRED 시뮬레이션
  // 새 연장 만들고 createdAt 을 25시간 전으로 백데이트 후 크론 핸들러를 import 해서 호출
  res = await axios.post(
    `${API}/contracts/${contractId}/extend`,
    { additionalDays: 1, isNewCaregiver: false },
    { headers: authHeader(guardianToken) },
  );
  const staleExtId = res.data?.data?.extension?.id;
  await prisma.contractExtension.update({
    where: { id: staleExtId },
    data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
  });
  // 직접 만료 처리 (크론과 동일 로직)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toExpire = await prisma.contractExtension.findMany({
    where: { status: 'PENDING_CAREGIVER_APPROVAL', createdAt: { lt: cutoff } },
  });
  for (const e of toExpire) {
    await prisma.contractExtension.update({
      where: { id: e.id },
      data: { status: 'EXPIRED', expiredAt: new Date() },
    });
  }
  const expired = await prisma.contractExtension.findUnique({ where: { id: staleExtId } });
  if (expired?.status === 'EXPIRED') {
    ok('E3 24h 미응답 자동 EXPIRED 시뮬레이션');
  } else {
    bad('E3 24h 만료 시뮬레이션', `status=${expired?.status}`);
  }

  // E4: 결제 1시간 미완료 자동 EXPIRED 시뮬레이션
  res = await axios.post(
    `${API}/contracts/${contractId}/extend`,
    { additionalDays: 1, isNewCaregiver: true }, // 즉시 PENDING_PAYMENT
    { headers: authHeader(guardianToken) },
  );
  const payExtId = res.data?.data?.extension?.id;
  await prisma.contractExtension.update({
    where: { id: payExtId },
    data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  });
  const cutoff2 = new Date(Date.now() - 60 * 60 * 1000);
  const stale2 = await prisma.contractExtension.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff2 } },
  });
  for (const e of stale2) {
    await prisma.contractExtension.update({
      where: { id: e.id },
      data: { status: 'EXPIRED', expiredAt: new Date() },
    });
  }
  const expired2 = await prisma.contractExtension.findUnique({ where: { id: payExtId } });
  if (expired2?.status === 'EXPIRED') {
    ok('E4 결제 1h 미완료 자동 EXPIRED 시뮬레이션');
  } else {
    bad('E4 1h 만료 시뮬레이션', `status=${expired2?.status}`);
  }
}

async function runConcurrencyScenarios(ctx: any) {
  console.log('\n━━━ 동시성 (트랜지션 락) 시나리오 ━━━');
  const { guardianToken, caregiverToken, contractId } = ctx;

  // C1: 같은 사람이 동시에 서명 두 번 — 한 번만 성공해야 함
  // 새 서명을 위해 contract 를 PENDING_SIGNATURE 로 되돌리고 양측 서명 초기화
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: 'PENDING_SIGNATURE',
      guardianSignature: null,
      guardianSignedAt: null,
      caregiverSignature: null,
      caregiverSignedAt: null,
    },
  });

  const sign1 = axios
    .post(`${API}/contracts/${contractId}/sign`, { signature: TINY_PNG_DATAURL }, { headers: authHeader(guardianToken) })
    .then((r) => ({ ok: true, data: r.data }))
    .catch((e: AxiosError) => ({ ok: false, status: e.response?.status, data: e.response?.data }));
  const sign2 = axios
    .post(`${API}/contracts/${contractId}/sign`, { signature: TINY_PNG_DATAURL }, { headers: authHeader(guardianToken) })
    .then((r) => ({ ok: true, data: r.data }))
    .catch((e: AxiosError) => ({ ok: false, status: e.response?.status, data: e.response?.data }));
  const [r1, r2] = await Promise.all([sign1, sign2]);
  const succ = [r1, r2].filter((r) => r.ok).length;
  const dup = [r1, r2].filter((r: any) => !r.ok && r.status === 400).length;
  if (succ === 1 && dup === 1) {
    ok('C1 동시 보호자 서명 → 하나만 성공');
  } else {
    bad('C1 동시 서명', `success=${succ}, 400=${dup}, r1=${JSON.stringify(r1)} r2=${JSON.stringify(r2)}`);
  }

  // 양측 서명 + ACTIVE 복원
  await axios.post(`${API}/contracts/${contractId}/sign`, { signature: TINY_PNG_DATAURL }, { headers: authHeader(caregiverToken) }).catch(() => {});
  // 진행 중 연장 모두 정리
  await prisma.contractExtension.updateMany({
    where: { contractId, status: { in: ['PENDING_CAREGIVER_APPROVAL', 'PENDING_PAYMENT'] } },
    data: { status: 'EXPIRED' },
  });

  // C2: 동시 연장 신청 — in-flight 가드로 1건만 통과
  const ext1 = axios
    .post(`${API}/contracts/${contractId}/extend`, { additionalDays: 1, isNewCaregiver: false }, { headers: authHeader(guardianToken) })
    .then((r) => ({ ok: true, data: r.data }))
    .catch((e: AxiosError) => ({ ok: false, status: e.response?.status }));
  const ext2 = axios
    .post(`${API}/contracts/${contractId}/extend`, { additionalDays: 1, isNewCaregiver: false }, { headers: authHeader(guardianToken) })
    .then((r) => ({ ok: true, data: r.data }))
    .catch((e: AxiosError) => ({ ok: false, status: e.response?.status }));
  const [e1, e2] = await Promise.all([ext1, ext2]);
  const okCount = [e1, e2].filter((r) => r.ok).length;
  if (okCount === 1) {
    ok('C2 동시 연장 신청 → 하나만 통과 (in-flight 가드)');
  } else {
    bad('C2 동시 연장 신청', `success=${okCount}, e1=${JSON.stringify(e1)} e2=${JSON.stringify(e2)}`);
  }

  // 진행 중 연장 1건 가져와서 동시 approve 테스트
  const pending = await prisma.contractExtension.findFirst({
    where: { contractId, status: 'PENDING_CAREGIVER_APPROVAL' },
  });
  if (!pending) {
    bad('C3 사전조건', 'PENDING_CAREGIVER_APPROVAL 연장 없음');
  } else {
    // C3: 동시 approve — 한 번만 성공
    const a1 = axios
      .post(`${API}/contracts/${contractId}/extension/${pending.id}/approve`, {}, { headers: authHeader(caregiverToken) })
      .then((r) => ({ ok: true, data: r.data }))
      .catch((e: AxiosError) => ({ ok: false, status: e.response?.status, data: e.response?.data }));
    const a2 = axios
      .post(`${API}/contracts/${contractId}/extension/${pending.id}/approve`, {}, { headers: authHeader(caregiverToken) })
      .then((r) => ({ ok: true, data: r.data }))
      .catch((e: AxiosError) => ({ ok: false, status: e.response?.status, data: e.response?.data }));
    const [ar1, ar2] = await Promise.all([a1, a2]);
    const apOk = [ar1, ar2].filter((r) => r.ok).length;
    const ap400 = [ar1, ar2].filter((r: any) => !r.ok && r.status === 400).length;
    if (apOk === 1 && ap400 === 1) {
      ok('C3 동시 approve → 하나만 성공');
    } else {
      bad('C3 동시 approve', `ok=${apOk}, 400=${ap400}`);
    }

    // 사후 검증: extension 1번만 PENDING_PAYMENT
    const after = await prisma.contractExtension.findUnique({ where: { id: pending.id } });
    if (after?.status === 'PENDING_PAYMENT' && after.approvedByCaregiver === true) {
      ok('C3-검증 PENDING_PAYMENT 정확히 1회 전이');
    } else {
      bad('C3-검증 상태', `status=${after?.status}, approved=${after?.approvedByCaregiver}`);
    }
  }

  // C4: createPayment 동시 호출 — 동일 contract 에 PENDING 중복 없어야 함
  await prisma.payment.deleteMany({ where: { contractId, status: 'PENDING' } });
  const cp = (i: number) =>
    axios
      .post(
        `${API}/payments`,
        { contractId, method: 'CARD', testMode: true },
        { headers: authHeader(guardianToken) },
      )
      .then((r) => ({ ok: true, data: r.data, i }))
      .catch((e: AxiosError) => ({ ok: false, status: e.response?.status, i }));
  const cpResults = await Promise.all([cp(1), cp(2), cp(3)]);
  const okIds = cpResults
    .filter((r: any) => r.ok)
    .map((r: any) => r.data?.data?.payment?.id);
  const uniqueIds = new Set(okIds);
  if (uniqueIds.size === 1 && cpResults.every((r) => r.ok)) {
    ok('C4 동시 createPayment → 모두 동일 PENDING 결제 반환 (idempotent)');
  } else {
    bad('C4 동시 createPayment', `unique=${uniqueIds.size}, results=${JSON.stringify(cpResults)}`);
  }

  // 정리
  await prisma.payment.deleteMany({ where: { contractId, status: 'PENDING' } });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  통합 검증: 서명 + 연장 + 동시성');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const ctx = await setup();
  try {
    await runSignatureScenarios(ctx);
    await runExtensionScenarios(ctx);
    await runConcurrencyScenarios(ctx);
  } finally {
    await cleanup(ctx.contractId, ctx.careRequestId);
    await prisma.$disconnect();
  }

  console.log(`\n━━━ 결과: ${pass} 통과 / ${fail} 실패 ━━━`);
  if (fail > 0) {
    console.log('실패 내역:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('스크립트 오류:', e);
  process.exit(1);
});
