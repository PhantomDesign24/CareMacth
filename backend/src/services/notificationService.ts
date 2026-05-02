import { NotificationType } from '@prisma/client';
import { USER_PUBLIC_SELECT } from '../utils/userSelect';
import admin from '../config/firebase';
import { prisma } from '../app';
import { sendAlimtalk, type AligoButton } from './aligoService';

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
    select: { fcmToken: true, pushEnabled: true, notificationPrefs: true },
  });

  // 카테고리별 설정 체크: 명시적으로 false면 발송 안 함, 그 외(true/undefined)는 발송
  const categoryAllowed =
    !user?.notificationPrefs ||
    typeof user.notificationPrefs !== 'object' ||
    (user.notificationPrefs as any)[type] !== false;

  if (user?.fcmToken && user?.pushEnabled !== false && categoryAllowed) {
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
      guardian: { include: { user: { select: USER_PUBLIC_SELECT } } },
      caregiver: { include: { user: { select: USER_PUBLIC_SELECT } } },
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
    include: { user: { select: USER_PUBLIC_SELECT } },
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
    include: { user: { select: USER_PUBLIC_SELECT } },
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

/**
 * 템플릿 기반 알림 발송
 * - NotificationTemplate 테이블에서 key로 조회
 * - {{variable}} 플레이스홀더 치환
 * - enabled=false면 발송 스킵
 * - 템플릿 없으면 fallback (title/body 직접 전달 가능)
 */
export interface TemplateVars {
  [key: string]: string | number | undefined | null;
}

/**
 * 템플릿 조회 + 변수 치환만 수행 (저장/발송 X) — 트랜잭션 내부에서 쓸 때
 * 반환: { title, body, type, enabled } | null
 */
export async function renderTemplate(key: string, vars: TemplateVars = {}): Promise<{
  title: string;
  body: string;
  type: NotificationType;
  enabled: boolean;
} | null> {
  const template = await prisma.notificationTemplate.findUnique({ where: { key } });
  if (!template) return null;
  const render = (s: string): string => {
    return s
      .replace(/\{\{(\w+)\}\}/g, (_, varName) => {
        const v = vars[varName];
        return v == null ? '' : String(v);
      })
      // 변수가 빈 값으로 치환됐을 때 남는 중복 공백/앞뒤 공백 정리
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+([.,!?])/g, '$1') // 부호 앞 공백 제거
      .trim();
  };
  return {
    title: render(template.title),
    body: render(template.body),
    type: template.type as NotificationType,
    enabled: template.enabled,
  };
}

/**
 * 관리자 전원에게 템플릿 기반 알림 발송 (adminAlert=true 자동 포함)
 */
export async function sendToAdmins(params: {
  key: string;
  vars?: TemplateVars;
  data?: Record<string, any>;
}) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      sendFromTemplate({
        userId: a.id,
        key: params.key,
        vars: params.vars,
        data: { ...(params.data || {}), adminAlert: true, forAdmin: true },
      }).catch(() => {}),
    ),
  );
}

// 알림톡 발송 헬퍼 — 템플릿의 alimtalkTemplateCode 기준으로 발송
async function sendAlimtalkForTemplate(
  userId: string,
  template: { key?: string; alimtalkTemplateCode: string | null; alimtalkButtonsJson: string | null },
  message: string,
  subject?: string,
  overrideButtons?: AligoButton[],
) {
  if (!template.alimtalkTemplateCode) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, pushEnabled: true, isActive: true },
  });
  if (!user || !user.isActive || user.pushEnabled === false) return;
  if (!user.phone) return;

  let buttons: AligoButton[] | undefined = overrideButtons;
  if (!buttons && template.alimtalkButtonsJson) {
    try {
      const parsed = JSON.parse(template.alimtalkButtonsJson);
      buttons = Array.isArray(parsed) ? parsed : parsed?.buttons;
    } catch {}
  }

  await sendAlimtalk({
    receiver: user.phone,
    tplCode: template.alimtalkTemplateCode,
    message,
    subject,
    buttons,
    meta: { userId, templateKey: template.key || null },
  });
}

export async function sendFromTemplate(params: {
  userId: string;
  key: string;
  vars?: TemplateVars;
  data?: Record<string, any>;
  fallbackTitle?: string;
  fallbackBody?: string;
  fallbackType?: NotificationType;
  overrideAlimtalkButtons?: AligoButton[];
}) {
  const { userId, key, vars = {}, data, fallbackTitle, fallbackBody, fallbackType, overrideAlimtalkButtons } = params;

  const template = await prisma.notificationTemplate.findUnique({ where: { key } });

  // 템플릿 비활성화 시 발송 건너뜀
  if (template && !template.enabled) {
    return null;
  }

  const renderVars = (str: string): string =>
    str.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      const v = vars[varName];
      return v == null ? '' : String(v);
    });

  const title = template ? renderVars(template.title) : (fallbackTitle || key);
  const body = template ? renderVars(template.body) : (fallbackBody || '');
  const type = (template?.type as NotificationType) || fallbackType || 'SYSTEM';

  // 채널 라우팅 — template.channels 가 비어있거나 PUSH 포함 시 푸시 발송
  const channels: string[] = template?.channels || [];
  const useAlimtalk = channels.includes('ALIMTALK');
  const useEmail = channels.includes('EMAIL');
  const usePush = channels.length === 0 || channels.includes('PUSH'); // 채널 미설정시 PUSH (기존 호환)

  // 알림톡 발송 (백그라운드)
  if (useAlimtalk && template?.alimtalkTemplateCode) {
    void sendAlimtalkForTemplate(userId, template, body, title, overrideAlimtalkButtons).catch(() => {});
  }

  // 이메일 발송 (백그라운드) — 사용자 이메일이 있으면 단순 텍스트 본문으로 발송
  if (useEmail) {
    void sendEmailForTemplate(userId, title, body).catch((error) => {
      console.error('[EMAIL] 템플릿 이메일 발송 실패:', error);
    });
  }

  if (!usePush) {
    // 푸시 비활성: DB 알림 레코드 + FCM 발송 모두 skip. 알림톡/이메일만 보냄.
    return null;
  }

  return sendNotification({ userId, type, title, body, data });
}

// 이메일 헬퍼 — 알림 템플릿 본문을 사용자 이메일로 발송
async function sendEmailForTemplate(userId: string, title: string, body: string) {
  const { sendEmail } = await import('./emailService');
  const user: any = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  }).catch((error) => {
    console.error('[EMAIL] 템플릿 이메일 수신자 조회 실패:', { userId, error });
    return null;
  });
  if (!user?.email) return;
  const escapedBody = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
      <h2 style="color:#0F172A;margin:0 0 16px;">${title}</h2>
      <p style="color:#334155;line-height:1.6;">${escapedBody}</p>
      <hr style="margin:24px 0;border:0;border-top:1px solid #E2E8F0;"/>
      <p style="color:#94A3B8;font-size:12px;">케어매치 알림 메일입니다.</p>
    </div>
  `;
  await sendEmail(user.email, `[케어매치] ${title}`, html).catch((error) => {
    console.error('[EMAIL] 템플릿 이메일 sendEmail 실패:', { userId, email: user.email, error });
  });
}
