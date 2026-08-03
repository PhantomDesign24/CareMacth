import { prisma } from '../app';

/**
 * 간병 요청(매칭) 종료 처리 — 공용 헬퍼.
 *  - 연결된 진행 계약이 있으면 함께 마감(ACTIVE/EXTENDED → COMPLETED, 서명대기 → CANCELLED)
 *  - 다른 활성 계약이 없는 간병인은 workStatus 해제(WORKING → AVAILABLE)
 *  - careRequest 를 COMPLETED 로 전환 (부분 유니크 인덱스에서 빠져 재매칭 가능해짐)
 *
 * 사용처: 자정 크론(기간 만료) · 신규 공고 생성(만료 요청 자동 정리) · 관리자 강제 종료
 */
export async function closeCareRequest(
  careRequestId: string,
  opts?: { settle?: boolean },
): Promise<{ completedContracts: number; cancelledContracts: number }> {
  const settle = opts?.settle !== false;

  const contracts = await prisma.contract.findMany({
    where: { careRequestId, status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] } },
    select: { id: true, caregiverId: true, status: true },
  });

  const completedIds: string[] = [];
  let cancelled = 0;
  const now = new Date();

  for (const c of contracts) {
    // 서명 전 계약은 성사되지 않은 건이므로 취소, 진행 계약은 완료 처리
    const target = c.status === 'PENDING_SIGNATURE' ? 'CANCELLED' : 'COMPLETED';
    const claim = await prisma.contract.updateMany({
      where: { id: c.id, status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] } },
      data: {
        status: target,
        ...(target === 'CANCELLED' ? { cancelledAt: now, cancellationReason: '간병 요청 종료' } : {}),
      },
    });
    if (claim.count === 1) {
      if (target === 'COMPLETED') completedIds.push(c.id);
      else cancelled += 1;
    }
  }

  // 간병인 근무상태 해제 — 다른 활성 계약이 없을 때만 (휴직 ON_LEAVE 는 유지)
  for (const caregiverId of new Set(contracts.map((c) => c.caregiverId))) {
    const stillActive = await prisma.contract.count({
      where: { caregiverId, status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] } },
    });
    if (stillActive === 0) {
      await prisma.caregiver.updateMany({
        where: { id: caregiverId, workStatus: 'WORKING' },
        data: { workStatus: 'AVAILABLE' },
      });
    }
  }

  // 대기중 지원은 종결 처리 (요청이 닫혔으므로 더 이상 선택될 수 없음)
  await prisma.careApplication.updateMany({
    where: { careRequestId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });

  await prisma.careRequest.updateMany({
    where: { id: careRequestId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    data: { status: 'COMPLETED' },
  });

  if (settle && completedIds.length > 0) {
    const { settleEarning } = await import('./paymentService');
    for (const id of completedIds) {
      await settleEarning(id).catch((e) => {
        console.error('[closeCareRequest] settleEarning 실패:', id, (e as Error)?.message || e);
      });
    }
  }

  return { completedContracts: completedIds.length, cancelledContracts: cancelled };
}

/**
 * 특정 보호자+환자의 "기간이 이미 끝난" 진행중 요청을 자동 종료.
 * 신규 공고 등록 시 호출 — 크론(자정)을 기다리지 않고 즉시 재매칭 가능하게 한다.
 * 반환: 정리한 요청 수
 */
export async function closeExpiredRequestsForPatient(
  guardianId: string,
  patientId: string,
): Promise<number> {
  const now = new Date();
  const expired = await prisma.careRequest.findMany({
    where: {
      guardianId,
      patientId,
      status: { in: ['OPEN', 'MATCHING', 'MATCHED', 'IN_PROGRESS'] },
      endDate: { not: null, lt: now },
    },
    select: { id: true },
  });
  for (const r of expired) {
    await closeCareRequest(r.id).catch((e) => {
      console.error('[closeExpiredRequestsForPatient] 실패:', r.id, (e as Error)?.message || e);
    });
  }
  return expired.length;
}
