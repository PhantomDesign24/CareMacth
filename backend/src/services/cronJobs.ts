import cron from 'node-cron';
import { sendExtensionReminder } from './notificationService';
import { settleEarning } from './paymentService';
import { prisma } from '../app';

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

  // 매일 자정: 간병 종료 계약 상태 변경
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] 계약 상태 업데이트...');
    try {
      const now = new Date();

      const result = await prisma.contract.updateMany({
        where: {
          status: { in: ['ACTIVE', 'EXTENDED'] },
          endDate: { lt: now },
        },
        data: { status: 'COMPLETED' },
      });

      console.log(`[CRON] 완료 처리된 계약: ${result.count}건`);
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
  cron.schedule('*/2 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000);
      const result = await prisma.payment.updateMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: cutoff },
        },
        data: { status: 'FAILED' },
      });
      if (result.count > 0) {
        console.log(`[CRON] PENDING 결제 만료 처리: ${result.count}건`);
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
      }

      console.log(`[CRON] 노쇼 패널티 처리: ${caregiversToSuspend.length}명`);
    } catch (error) {
      console.error('[CRON] 노쇼 패널티 오류:', error);
    }
  });

  console.log('[CRON] 스케줄 작업 설정 완료');
}
