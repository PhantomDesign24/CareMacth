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
  opts?: { settle?: boolean; notify?: boolean; reason?: string },
): Promise<{ completedContracts: number; cancelledContracts: number; notified: number }> {
  const settle = opts?.settle !== false;
  const notify = opts?.notify === true; // 관리자 강제 종료 등 "예상 밖 종료"에서만 알림

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

  // 미종결 지원은 모두 종결 처리 (요청이 닫혔으므로 더 이상 선택될 수 없음)
  //  — 다른 취소 경로(계약취소·강제취소·블랙리스트)와 동일하게 PENDING + ACCEPTED 를 함께 정리
  //  알림 대상 파악을 위해 종결 전에 지원자를 먼저 조회한다.
  const affectedApplicants = notify
    ? await prisma.careApplication.findMany({
        where: { careRequestId, status: { in: ['PENDING', 'ACCEPTED'] } },
        select: { caregiver: { select: { userId: true } } },
      })
    : [];
  await prisma.careApplication.updateMany({
    where: { careRequestId, status: { in: ['PENDING', 'ACCEPTED'] } },
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

  // 종료 사실을 양측에 안내 (관리자 강제 종료 등)
  let notified = 0;
  if (notify) {
    try {
      const cr = await prisma.careRequest.findUnique({
        where: { id: careRequestId },
        select: {
          guardian: { select: { userId: true } },
          patient: { select: { name: true } },
          contracts: {
            where: { status: { in: ['COMPLETED', 'CANCELLED'] } },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { caregiver: { select: { userId: true } } },
          },
        },
      });
      if (cr) {
        const { sendFromTemplate } = await import('./notificationService');
        const patientName = cr.patient?.name || '';
        const vars = { patientName, reason: opts?.reason || '' };
        // 보호자 + 계약 간병사 + (계약 전이라면) 지원했던 간병사 모두에게 안내
        const targets = new Set<string>();
        if (cr.guardian?.userId) targets.add(cr.guardian.userId);
        const cgUserId = cr.contracts?.[0]?.caregiver?.userId;
        if (cgUserId) targets.add(cgUserId);
        for (const a of affectedApplicants) {
          if (a.caregiver?.userId) targets.add(a.caregiver.userId);
        }
        for (const userId of targets) {
          const sent = await sendFromTemplate({
            userId,
            key: 'CARE_REQUEST_CLOSED',
            vars,
            fallbackTitle: '매칭이 종료되었습니다',
            fallbackBody: `${patientName ? patientName + ' 환자의 ' : ''}간병 매칭이 종료되었습니다.${opts?.reason ? `\n사유: ${opts.reason}` : ''}`,
            fallbackType: 'MATCHING',
            data: { careRequestId },
          }).then(() => true).catch(() => false);
          if (sent) notified += 1; // 실제 발송된 건만 집계
        }
      }
    } catch (e) {
      console.error('[closeCareRequest] 종료 알림 실패:', (e as Error)?.message || e);
    }
  }

  return { completedContracts: completedIds.length, cancelledContracts: cancelled, notified };
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
    // settle:false — 사용자 요청(공고 등록) 처리 중에 외부 결제사 정산 호출을 하지 않는다.
    //  정산은 자정/매시간 크론에 위임 (응답 지연·부수효과 방지)
    await closeCareRequest(r.id, { settle: false }).catch((e) => {
      console.error('[closeExpiredRequestsForPatient] 실패:', r.id, (e as Error)?.message || e);
    });
  }
  return expired.length;
}
