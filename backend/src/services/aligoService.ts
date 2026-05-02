import axios from 'axios';
import { prisma } from '../app';

// 알리고 알림톡 발송 — https://kakaoapi.aligo.in/
// 카카오 비즈채널 검수가 통과한 템플릿만 발송 가능 (TPL_CODE 필요)
const ALIGO_API_KEY = process.env.ALIGO_API_KEY;
const ALIGO_USER_ID = process.env.ALIGO_USER_ID;
const ALIGO_SENDER_KEY = process.env.ALIGO_SENDER_KEY;
const ALIGO_SENDER_PHONE = (process.env.ALIGO_SENDER_PHONE || '').replace(/-/g, '');

const ALIGO_ENDPOINT = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';

export interface AligoButton {
  name: string;
  linkType: 'WL' | 'AL' | 'BK' | 'MD' | 'DS' | 'BC' | 'BT' | 'AC';
  linkMo?: string; // 모바일 URL (tel: 가능)
  linkPc?: string; // PC URL
  schemeAndroid?: string;
  schemeIos?: string;
}

export interface SendAlimtalkParams {
  receiver: string; // 수신자 휴대폰번호 (- 자동 제거)
  tplCode: string; // 카카오 승인된 템플릿 코드
  message: string; // 본문 (변수 치환 완료된 상태)
  subject?: string; // 강조표기형 제목 (선택)
  buttons?: AligoButton[]; // 버튼 (선택)
  failoverSms?: { type: 'SMS' | 'LMS'; subject?: string; message?: string }; // 발송 실패 시 SMS 대체
  // 로그 추적용 메타 (옵션) — 로그 테이블에 templateKey/userId 기록
  meta?: {
    userId?: string | null;
    templateKey?: string | null;
  };
}

export function isAligoConfigured(): boolean {
  return !!(ALIGO_API_KEY && ALIGO_USER_ID && ALIGO_SENDER_KEY && ALIGO_SENDER_PHONE);
}

export async function sendAlimtalk(params: SendAlimtalkParams): Promise<{ success: boolean; reason?: string; raw?: any; logId?: string }> {
  const phone = (params.receiver || '').replace(/-/g, '');

  // 1) PENDING 로그 사전 INSERT — 환경변수 미설정/번호 없음도 모두 기록
  let logId: string | undefined;
  try {
    const log = await prisma.alimtalkLog.create({
      data: {
        userId: params.meta?.userId || null,
        phone: phone || (params.receiver || ''),
        templateKey: params.meta?.templateKey || null,
        templateCode: params.tplCode || null,
        title: params.subject || null,
        message: params.message || '',
        buttonsJson: params.buttons ? (params.buttons as any) : undefined,
        status: 'PENDING',
      },
    });
    logId = log.id;
  } catch (e: any) {
    // 로그 INSERT 실패가 발송을 막지는 않음
    console.error('[aligoService] log INSERT 실패:', e?.message || e);
  }

  const finalize = async (status: 'SUCCESS' | 'FAILED', extras: { aligoMsgId?: string | null; errorReason?: string | null }) => {
    if (!logId) return;
    try {
      await prisma.alimtalkLog.update({
        where: { id: logId },
        data: {
          status,
          aligoMsgId: extras.aligoMsgId || null,
          errorReason: extras.errorReason || null,
          sentAt: new Date(),
        },
      });
    } catch (e: any) {
      console.error('[aligoService] log UPDATE 실패:', e?.message || e);
    }
  };

  if (!isAligoConfigured()) {
    await finalize('FAILED', { errorReason: 'aligo 환경변수 미설정' });
    return { success: false, reason: 'aligo 환경변수 미설정', logId };
  }
  if (!phone) {
    await finalize('FAILED', { errorReason: '수신자 번호 없음' });
    return { success: false, reason: '수신자 번호 없음', logId };
  }

  const form = new URLSearchParams();
  form.append('apikey', ALIGO_API_KEY!);
  form.append('userid', ALIGO_USER_ID!);
  form.append('senderkey', ALIGO_SENDER_KEY!);
  form.append('tpl_code', params.tplCode);
  form.append('sender', ALIGO_SENDER_PHONE);
  form.append('receiver_1', phone);
  form.append('subject_1', params.subject || '');
  form.append('message_1', params.message);

  if (params.buttons && params.buttons.length > 0) {
    form.append('button_1', JSON.stringify({ button: params.buttons }));
  }

  if (params.failoverSms) {
    form.append('failover_1', 'Y');
    form.append('fsubject_1', params.failoverSms.subject || params.subject || '');
    form.append('fmessage_1', params.failoverSms.message || params.message);
    form.append('ftype_1', params.failoverSms.type);
  }

  try {
    const res = await axios.post(ALIGO_ENDPOINT, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      timeout: 10000,
    });
    const data = res.data;
    // 알리고 응답: { code: 0, message: '성공', info: { msg_id: '...' } } / 실패는 code != 0
    if (data && data.code === 0) {
      await finalize('SUCCESS', { aligoMsgId: data?.info?.msg_id ? String(data.info.msg_id) : (data?.msg_id ? String(data.msg_id) : null) });
      return { success: true, raw: data, logId };
    }
    await finalize('FAILED', { errorReason: data?.message || '알리고 발송 실패' });
    return { success: false, reason: data?.message || '알리고 발송 실패', raw: data, logId };
  } catch (err: any) {
    console.error('[aligoService] 발송 예외:', err?.message || err);
    await finalize('FAILED', { errorReason: err?.message || '알리고 호출 중 오류' });
    return { success: false, reason: err?.message || '알리고 호출 중 오류', logId };
  }
}
