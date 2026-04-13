import { NotificationType } from '@prisma/client';
import admin from '../config/firebase';
import { prisma } from '../app';

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * FCM 푸시 알림 발송
 */
async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  if (!admin.apps.length) {
    console.warn('[FCM] Firebase 미초기화 - 푸시 발송 건너뜀');
    return false;
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ) : undefined,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'carematch-default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
    return true;
  } catch (error: any) {
    // 토큰이 만료되었거나 유효하지 않으면 DB에서 제거
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.warn(`[FCM] 유효하지 않은 토큰 제거: ${fcmToken.substring(0, 20)}...`);
      await prisma.user.updateMany({
        where: { fcmToken },
        data: { fcmToken: null },
      });
    } else {
      console.error('[FCM] 푸시 알림 발송 실패:', error.message);
    }
    return false;
  }
}

/**
 * 알림 생성 + 푸시 발송
 */
export async function sendNotification(params: SendNotificationParams) {
  const { userId, type, title, body, data } = params;

  // 1. DB에 알림 저장
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data || {},
    },
  });

  // 2. FCM 푸시 알림 발송 + 결과 기록
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmToken: true, pushEnabled: true },
  });

  if (user?.fcmToken && user?.pushEnabled !== false) {
    const success = await sendPushNotification(user.fcmToken, title, body, {
      type,
      notificationId: notification.id,
      ...data,
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        pushSent: true,
        pushSuccess: success,
        pushError: success ? null : '푸시 발송 실패',
        pushSentAt: new Date(),
      },
    });
  } else {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        pushSent: false,
        pushSuccess: null,
        pushError: user ? 'FCM 토큰 없음' : '사용자 없음',
      },
    });
  }

  return notification;
}

// 간병 종료 3일 전 / 1일 전 알림
export async function sendExtensionReminder(contractId: string, daysLeft: number) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      guardian: { include: { user: true } },
      caregiver: { include: { user: true } },
      careRequest: { include: { patient: true } },
    },
  });

  if (!contract) return;

  const patientName = contract.careRequest.patient.name;

  // 보호자에게 알림
  await sendNotification({
    userId: contract.guardian.userId,
    type: 'EXTENSION',
    title: '간병 종료 예정 안내',
    body: `${patientName} 환자의 간병 서비스가 ${daysLeft}일 후 종료됩니다. 연장을 원하시면 마이페이지에서 연장 요청해주세요.`,
    data: { contractId, daysLeft },
  });

  // 간병인에게도 알림
  await sendNotification({
    userId: contract.caregiver.userId,
    type: 'EXTENSION',
    title: '간병 종료 예정 안내',
    body: `${patientName} 환자의 간병이 ${daysLeft}일 후 종료됩니다.`,
    data: { contractId, daysLeft },
  });
}

// 매칭 알림
export async function sendMatchingNotification(
  caregiverId: string,
  careRequestId: string,
  address: string,
  scheduleType: string
) {
  const caregiver = await prisma.caregiver.findUnique({
    where: { id: caregiverId },
    include: { user: true },
  });

  if (!caregiver) return;

  return sendNotification({
    userId: caregiver.userId,
    type: 'MATCHING',
    title: '새로운 간병 요청',
    body: `${address}에서 ${scheduleType === 'FULL_TIME' ? '24시간' : '시간제'} 간병인을 찾고 있습니다.`,
    data: { careRequestId },
  });
}

// 지원 수락/거절 알림
export async function sendApplicationStatusNotification(
  caregiverId: string,
  status: 'ACCEPTED' | 'REJECTED',
  patientName: string
) {
  const caregiver = await prisma.caregiver.findUnique({
    where: { id: caregiverId },
    include: { user: true },
  });

  if (!caregiver) return;

  const title = status === 'ACCEPTED' ? '지원이 수락되었습니다' : '지원 결과 안내';
  const body = status === 'ACCEPTED'
    ? `${patientName} 환자의 간병 지원이 수락되었습니다. 계약 내용을 확인해주세요.`
    : `${patientName} 환자의 간병 지원이 거절되었습니다.`;

  return sendNotification({
    userId: caregiver.userId,
    type: 'APPLICATION',
    title,
    body,
  });
}

// 결제 알림
export async function sendPaymentNotification(
  userId: string,
  amount: number,
  type: 'paid' | 'refund' | 'settled'
) {
  const messages = {
    paid: { title: '결제 완료', body: `${amount.toLocaleString()}원 결제가 완료되었습니다.` },
    refund: { title: '환불 완료', body: `${amount.toLocaleString()}원 환불이 완료되었습니다.` },
    settled: { title: '정산 완료', body: `${amount.toLocaleString()}원이 정산되었습니다.` },
  };

  return sendNotification({
    userId,
    type: 'PAYMENT',
    ...messages[type],
  });
}

// 패널티 알림
export async function sendPenaltyNotification(
  userId: string,
  penaltyType: string,
  reason: string
) {
  return sendNotification({
    userId,
    type: 'PENALTY',
    title: '패널티 부여 안내',
    body: `[${penaltyType}] ${reason}`,
  });
}
