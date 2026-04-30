import cron from 'node-cron';
import { USER_PUBLIC_SELECT } from '../utils/userSelect';
import krHolidays from '../data/kr-holidays.json';

const KR_HOLIDAY_MAP: Record<string, string[]> = krHolidays as any;
function isKrHoliday(date: Date): boolean {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return !!KR_HOLIDAY_MAP[`${y}-${m}-${d}`];
}
import { sendExtensionReminder, sendToAdmins, sendFromTemplate } from './notificationService';
import { settleEarning } from './paymentService';
import { prisma } from '../app';

function toYMD(date: Date): Date {
  // UTC 기준 날짜만 남기기 (시간 00:00:00Z)
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return new Date(Date.UTC(y, m, d));
}

// 한국 기준 주말/공휴일 판정 (관리자 override 적용)
// 우선순위: EXCLUDE override → 주말 → CUSTOM override → 공식 공휴일 라이브러리
export async function isNonBusinessDay(date: Date = new Date()): Promise<boolean> {
  const ymd = toYMD(date);
  const override = await prisma.holiday.findUnique({ where: { date: ymd } });
  if (override?.type === 'EXCLUDE') return false;
  if (override?.type === 'CUSTOM') return true;

  const day = date.getDay();
  if (day === 0 || day === 6) return true;

  return isKrHoliday(date);
}

export function setupCronJobs() {
  // 매일 오전 9시: 간병 종료 3일 전, 1일 전 알림
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] 간병 종료 예정 알림 체크...');
    try {
      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneDayLater = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

      // 3일 전 종료 예정 계약
      const contractsIn3Days = await prisma.contract.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: new Date(threeDaysLater.setHours(0, 0, 0, 0)),
            lt: new Date(threeDaysLater.setHours(23, 59, 59, 999)),
          },
        },
      });

      for (const contract of contractsIn3Days) {
        await sendExtensionReminder(contract.id, 3);
      }

      // 1일 전 종료 예정 계약
      const contractsIn1Day = await prisma.contract.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: new Date(oneDayLater.setHours(0, 0, 0, 0)),
            lt: new Date(oneDayLater.setHours(23, 59, 59, 999)),
          },
        },
      });

      for (const contract of contractsIn1Day) {
        await sendExtensionReminder(contract.id, 1);
      }

      console.log(`[CRON] 3일 전 알림: ${contractsIn3Days.length}건, 1일 전 알림: ${contractsIn1Day.length}건`);
    } catch (error) {
      console.error('[CRON] 종료 알림 오류:', error);
    }
  });

  // 매일 오전 10시: 완료된 간병 정산 처리 (종료 후 익일)
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] 정산 처리 시작...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const completedContracts = await prisma.contract.findMany({
        where: {
          status: 'COMPLETED',
          cancelledAt: null,  // 취소된 계약 제외
          endDate: {
            gte: new Date(yesterday.setHours(0, 0, 0, 0)),
            lt: new Date(yesterday.setHours(23, 59, 59, 999)),
          },
        },
      });

      for (const contract of completedContracts) {
        const existingEarning = await prisma.earning.findFirst({
          where: { contractId: contract.id },
        });
        if (!existingEarning) {
          await settleEarning(contract.id);
        }
      }

      console.log(`[CRON] 정산 처리: ${completedContracts.length}건`);
    } catch (error) {
      console.error('[CRON] 정산 처리 오류:', error);
    }
  });

  // 매일 자정: 간병 종료 계약 상태 변경 + 간병인 workStatus 해제
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] 계약 상태 업데이트...');
    try {
      const now = new Date();

      // 종료된 계약 조회 후 개별 처리 (간병인별 다른 활성 계약 여부 확인 필요)
      const expiredContracts = await prisma.contract.findMany({
        where: {
          status: { in: ['ACTIVE', 'EXTENDED'] },
          endDate: { lt: now },
        },
        select: { id: true, caregiverId: true },
      });

      let completed = 0;
      const cgsToCheck = new Set<string>();
      for (const c of expiredContracts) {
        const claim = await prisma.contract.updateMany({
          where: { id: c.id, status: { in: ['ACTIVE', 'EXTENDED'] } },
          data: { status: 'COMPLETED' },
        });
        if (claim.count === 1) {
          completed += 1;
          cgsToCheck.add(c.caregiverId);
        }
      }

      // 다른 활성 계약 없으면 workStatus AVAILABLE 로
      for (const caregiverId of cgsToCheck) {
        const stillActive = await prisma.contract.count({
          where: {
            caregiverId,
            status: { in: ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'] },
          },
        });
        if (stillActive === 0) {
          await prisma.caregiver.update({
            where: { id: caregiverId },
            data: { workStatus: 'AVAILABLE' },
          });
        }
      }

      console.log(`[CRON] 완료 처리된 계약: ${completed}건, workStatus 해제: ${cgsToCheck.size}명`);
    } catch (error) {
      console.error('[CRON] 계약 상태 업데이트 오류:', error);
    }
  });

  // 매일 자정: 우수 간병사 뱃지 자동 부여 (매칭 10회 이상)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] 우수 간병사 뱃지 체크...');
    try {
      const platformConfig = await prisma.platformConfig.findUnique({
        where: { id: 'default' },
      });
      const threshold = platformConfig?.badgeThreshold || 10;

      const result = await prisma.caregiver.updateMany({
        where: {
          totalMatches: { gte: threshold },
          hasBadge: false,
          status: 'APPROVED',
        },
        data: {
          hasBadge: true,
          badgeGrantedAt: new Date(),
        },
      });

      console.log(`[CRON] 뱃지 부여: ${result.count}명`);
    } catch (error) {
      console.error('[CRON] 뱃지 부여 오류:', error);
    }
  });

  // 매월 1일: 월별 통계 생성
  cron.schedule('0 1 1 * *', async () => {
    console.log('[CRON] 월별 통계 생성...');
    try {
      const now = new Date();
      const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const startOfMonth = new Date(year, lastMonth - 1, 1);
      const endOfMonth = new Date(year, lastMonth, 0, 23, 59, 59);

      const [requests, matches, earnings, caregivers, guardians, reviews] = await Promise.all([
        prisma.careRequest.count({
          where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        }),
        prisma.contract.count({
          where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        }),
        prisma.earning.aggregate({
          where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true, platformFee: true },
        }),
        prisma.caregiver.count({
          where: { status: 'APPROVED', updatedAt: { gte: startOfMonth } },
        }),
        prisma.guardian.count({
          where: { updatedAt: { gte: startOfMonth } },
        }),
        prisma.review.aggregate({
          where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
          _avg: { rating: true },
        }),
      ]);

      await prisma.monthlyStats.upsert({
        where: { year_month: { year, month: lastMonth } },
        create: {
          year,
          month: lastMonth,
          totalRequests: requests,
          totalMatches: matches,
          totalRevenue: earnings._sum.amount || 0,
          totalPlatformFee: earnings._sum.platformFee || 0,
          activeCaregivers: caregivers,
          activeGuardians: guardians,
          avgRating: reviews._avg.rating || 0,
        },
        update: {
          totalRequests: requests,
          totalMatches: matches,
          totalRevenue: earnings._sum.amount || 0,
          totalPlatformFee: earnings._sum.platformFee || 0,
          activeCaregivers: caregivers,
          activeGuardians: guardians,
          avgRating: reviews._avg.rating || 0,
        },
      });

      console.log(`[CRON] ${year}년 ${lastMonth}월 통계 생성 완료`);
    } catch (error) {
      console.error('[CRON] 통계 생성 오류:', error);
    }
  });

  // 매 2분: 5분 이상 PENDING 상태인 결제 자동 실패 처리 (토스 세션 만료 후처리)
  // - tossPaymentKey 가 이미 클레임된 행은 건드리지 않음 (confirm 진행 중이거나 DB sync 실패 격리)
  // - 트랜잭션으로 status=FAILED + 차감된 포인트 복구
  cron.schedule('*/2 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000);
      const expiredPayments = await prisma.payment.findMany({
        where: {
          status: 'PENDING',
          tossPaymentKey: null,
          createdAt: { lt: cutoff },
        },
        include: {
          guardian: { include: { user: { select: USER_PUBLIC_SELECT } } },
        },
      });

      let processed = 0;
      for (const p of expiredPayments) {
        let claimedThisRun = false;
        try {
          await prisma.$transaction(async (tx) => {
            // 트랜지션 락: 여전히 PENDING + tossPaymentKey null 인 경우에만 1회 FAILED
            const lock = await tx.payment.updateMany({
              where: { id: p.id, status: 'PENDING', tossPaymentKey: null },
              data: { status: 'FAILED' },
            });
            if (lock.count === 0) return; // 이미 다른 경로에서 처리됨
            // 차감된 포인트 복구
            if (p.pointsUsed && p.pointsUsed > 0 && p.guardian?.userId) {
              await tx.user.update({
                where: { id: p.guardian.userId },
                data: { points: { increment: p.pointsUsed } },
              });
            }
            claimedThisRun = true;
            processed += 1;
          });

          // cron 이 실제로 클레임한 경우에만 관리자 알림 (다른 경로가 먼저 처리한 건 알림 X)
          if (claimedThisRun) {
            await sendToAdmins({
              key: 'PAYMENT_AUTO_EXPIRED_ADMIN',
              vars: {
                guardianName: p.guardian?.user?.name || '알 수 없음',
                amount: p.totalAmount.toLocaleString(),
              },
              data: { paymentId: p.id, guardianId: p.guardianId },
            }).catch(() => {});
          }
        } catch (e) {
          console.error('[CRON] 단건 결제 만료 처리 실패 paymentId=', p.id, e);
        }
      }

      if (processed > 0) {
        console.log(`[CRON] PENDING 결제 만료 처리: ${processed}건`);
      }
    } catch (error) {
      console.error('[CRON] PENDING 결제 만료 오류:', error);
    }
  });

  // 노쇼 3회 이상 자동 패널티
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] 노쇼 패널티 체크...');
    try {
      const platformConfig = await prisma.platformConfig.findUnique({
        where: { id: 'default' },
      });
      const threshold = platformConfig?.noShowPenaltyThreshold || 3;

      const caregiversToSuspend = await prisma.caregiver.findMany({
        where: {
          noShowCount: { gte: threshold },
          status: 'APPROVED',
        },
        include: { user: { select: USER_PUBLIC_SELECT } },
      });

      for (const cg of caregiversToSuspend) {
        await prisma.caregiver.update({
          where: { id: cg.id },
          data: { status: 'SUSPENDED' },
        });

        await prisma.penalty.create({
          data: {
            caregiverId: cg.id,
            type: 'NO_SHOW',
            reason: `노쇼 ${cg.noShowCount}회 초과로 자동 활동 정지`,
            isAutomatic: true,
          },
        });

        await sendToAdmins({
          key: 'CAREGIVER_AUTO_SUSPENDED_ADMIN',
          vars: {
            caregiverName: cg.user?.name || '알 수 없음',
            phone: cg.user?.phone || '-',
            reason: `노쇼 ${cg.noShowCount}회 누적`,
          },
          data: { caregiverId: cg.id },
        }).catch(() => {});
      }

      console.log(`[CRON] 노쇼 패널티 처리: ${caregiversToSuspend.length}명`);
    } catch (error) {
      console.error('[CRON] 노쇼 패널티 오류:', error);
    }
  });

  // 매 5분: 주말/공휴일 미선택 간병 요청 1시간 경과 시 자동 실패
  cron.schedule('*/5 * * * *', async () => {
    try {
      if (!(await isNonBusinessDay())) return; // 평일은 보호자가 직접 선택

      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const stale = await prisma.careRequest.findMany({
        where: {
          status: { in: ['OPEN', 'MATCHING'] },
          createdAt: { lt: cutoff },
        },
        include: {
          guardian: { include: { user: { select: { id: true, name: true } } } },
          patient: { select: { name: true } },
        },
      });

      if (stale.length === 0) return;

      let processed = 0;
      for (const r of stale) {
        // 전이 락: stale 조회 직후 보호자가 간병인 선택해 MATCHED 로 바뀐 행은 건너뜀.
        const claim = await prisma.careRequest.updateMany({
          where: { id: r.id, status: { in: ['OPEN', 'MATCHING'] }, createdAt: { lt: cutoff } },
          data: { status: 'CANCELLED' },
        });
        if (claim.count !== 1) continue;
        processed += 1;
        await prisma.careApplication.updateMany({
          where: { careRequestId: r.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });

        if (r.guardian?.user?.id) {
          await sendFromTemplate({
            userId: r.guardian.user.id,
            key: 'CARE_REQUEST_AUTO_FAILED',
            vars: { patientName: r.patient?.name || '환자' },
            fallbackTitle: '매칭 자동 실패',
            fallbackBody: `${r.patient?.name || '환자'} 환자의 간병 요청이 1시간 내 매칭되지 않아 자동 실패 처리되었습니다. (주말/공휴일)`,
            fallbackType: 'MATCHING',
            data: { careRequestId: r.id, autoFailed: true },
          }).catch(() => {});
        }
      }

      if (processed > 0) {
        console.log(`[CRON] 주말/공휴일 자동 매칭 실패 처리: ${processed}건`);
      }
    } catch (error) {
      console.error('[CRON] 자동 매칭 실패 처리 오류:', error);
    }
  });

  // 매 5분: 연장 결제 미완료(1시간 초과) 자동 만료
  cron.schedule('*/5 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const stale = await prisma.contractExtension.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: { lt: cutoff },
        },
        include: {
          contract: {
            include: {
              guardian: { select: { userId: true } },
              caregiver: { select: { userId: true } },
              careRequest: { include: { patient: { select: { name: true } } } },
            },
          },
        },
      });
      if (stale.length === 0) return;

      let expired = 0;
      for (const ext of stale) {
        // 트랜지션 락: PENDING_PAYMENT 인 경우에만 1회 EXPIRED 로 전이.
        // (보호자 confirm/reject 와 race 시 한쪽만 통과 — count===1 일 때만 알림)
        const lock = await prisma.contractExtension.updateMany({
          where: { id: ext.id, status: 'PENDING_PAYMENT' },
          data: { status: 'EXPIRED', expiredAt: new Date() },
        });
        if (lock.count !== 1) continue;
        expired += 1;

        await sendFromTemplate({
          userId: ext.contract.guardian.userId,
          key: 'EXTENSION_CONFIRMED',
          vars: {
            patientName: ext.contract.careRequest.patient.name,
            additionalDays: String(ext.additionalDays),
          },
          fallbackTitle: '연장 신청이 만료되었습니다',
          fallbackBody: `결제 미완료로 ${ext.contract.careRequest.patient.name} 환자 연장 신청이 자동 만료되었습니다.`,
          fallbackType: 'EXTENSION',
          data: { contractId: ext.contractId, extensionId: ext.id, autoExpired: true },
        }).catch(() => {});
      }
      if (expired > 0) {
        console.log(`[CRON] 연장 결제 자동 만료: ${expired}건`);
      }
    } catch (error) {
      console.error('[CRON] 연장 결제 만료 오류:', error);
    }
  });

  // 매 10분: 간병인 수락 미응답(24시간 초과) 자동 만료
  cron.schedule('*/10 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const stale = await prisma.contractExtension.findMany({
        where: {
          status: 'PENDING_CAREGIVER_APPROVAL',
          createdAt: { lt: cutoff },
        },
        include: {
          contract: {
            include: {
              guardian: { select: { userId: true } },
              caregiver: { select: { userId: true } },
              careRequest: { include: { patient: { select: { name: true } } } },
            },
          },
        },
      });
      if (stale.length === 0) return;

      let expired = 0;
      for (const ext of stale) {
        // 트랜지션 락: PENDING_CAREGIVER_APPROVAL 인 경우에만 1회 EXPIRED
        const lock = await prisma.contractExtension.updateMany({
          where: { id: ext.id, status: 'PENDING_CAREGIVER_APPROVAL' },
          data: { status: 'EXPIRED', expiredAt: new Date() },
        });
        if (lock.count !== 1) continue;
        expired += 1;

        // 보호자에게 만료 안내
        await sendFromTemplate({
          userId: ext.contract.guardian.userId,
          key: 'EXTENSION_CONFIRMED',
          vars: {
            patientName: ext.contract.careRequest.patient.name,
            additionalDays: String(ext.additionalDays),
          },
          fallbackTitle: '연장 요청이 만료되었습니다',
          fallbackBody: `간병인 응답 시간(24시간) 초과로 ${ext.contract.careRequest.patient.name} 환자 연장 요청이 자동 만료되었습니다.`,
          fallbackType: 'EXTENSION',
          data: { contractId: ext.contractId, extensionId: ext.id, autoExpired: true },
        }).catch(() => {});
      }
      if (expired > 0) {
        console.log(`[CRON] 간병인 연장 수락 자동 만료: ${expired}건`);
      }
    } catch (error) {
      console.error('[CRON] 간병인 연장 수락 만료 오류:', error);
    }
  });

  console.log('[CRON] 스케줄 작업 설정 완료');
}
