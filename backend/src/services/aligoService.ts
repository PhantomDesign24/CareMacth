import axios from 'axios';
import { prisma } from '../app';

// 알리고 알림톡 발송 — https://kakaoapi.aligo.in/
// 카카오 비즈채널 검수가 통과한 템플릿만 발송 가능 (TPL_CODE 필요)
const ALIGO_API_KEY = process.env.ALIGO_API_KEY;
const ALIGO_USER_ID = process.env.ALIGO_USER_ID;
const ALIGO_SENDER_KEY = process.env.ALIGO_SENDER_KEY;
const ALIGO_SENDER_PHONE = (process.env.ALIGO_SENDER_PHONE || '').replace(/-/g, '');

const ALIGO_ENDPOINT = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';
const ALIGO_TEMPLATE_ADD_ENDPOINT = 'https://kakaoapi.aligo.in/akv10/template/add/';

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

// ============================================
// 알림톡 템플릿 등록 / 검수 요청 / 조회 (알리고)
// ============================================
// 워크플로우:
//   1) /akv10/template/add/    → 신규 템플릿 등록 (status: R, inspStatus: REG)
//   2) /akv10/template/request/ → 검수 요청 (inspStatus: REQ → 4-5일 후 APR/REJ)
//   3) /akv10/template/list/   → 상태 확인 (APR=승인, REJ=반려)

const ALIGO_TEMPLATE_REQUEST_ENDPOINT = 'https://kakaoapi.aligo.in/akv10/template/request/';
const ALIGO_TEMPLATE_LIST_ENDPOINT = 'https://kakaoapi.aligo.in/akv10/template/list/';
const ALIGO_TEMPLATE_DEL_ENDPOINT = 'https://kakaoapi.aligo.in/akv10/template/del/';

// 알리고 템플릿 등록용 버튼 — 발송 API 와 키가 다름(linkM/P/I/A)
function buttonsToAligoRegisterFormat(buttons?: AligoButton[]) {
  if (!buttons || buttons.length === 0) return undefined;
  return {
    button: buttons.map((b) => ({
      name: b.name,
      linkType: b.linkType,
      ...(b.linkMo && { linkM: b.linkMo }),
      ...(b.linkPc && { linkP: b.linkPc }),
      ...(b.schemeIos && { linkI: b.schemeIos }),
      ...(b.schemeAndroid && { linkA: b.schemeAndroid }),
    })),
  };
}

export interface RegisterTemplateParams {
  /** 우리 시스템 키 (예: WELCOME_GUARDIAN) — alimtalk DB key */
  tplCode: string;
  /** 알리고/카카오 표시용 템플릿 이름 */
  tplName: string;
  /** 본문 — #{var} 형식 (DB의 {{var}}는 호출 전 변환) */
  tplContent: string;
  /** 보안 템플릿 여부 */
  tplSecure?: 'Y' | 'N';
  /** 메시지 타입: BA(기본) | EX(부가정보) | AD(광고추가) | MI(복합형) */
  tplType?: 'BA' | 'EX' | 'AD' | 'MI';
  /** 강조 타입: NONE | TEXT | IMAGE */
  tplEmType?: 'NONE' | 'TEXT' | 'IMAGE';
  /** 강조표기 핵심정보 (TEXT 강조형일 때) */
  tplTitle?: string;
  /** 강조표기 보조문구 */
  tplStitle?: string;
  /** 부가 정보 (EX 타입일 때) */
  tplExtra?: string;
  /** 광고추가 문구 (AD 타입일 때 필수) */
  tplAdvert?: string;
  /** 버튼 정보 (등록은 linkM/P/I/A 형식) */
  buttons?: AligoButton[];
}

/** 알림톡 템플릿 신규 등록 — POST /akv10/template/add/ */
export async function registerAlimtalkTemplate(
  params: RegisterTemplateParams,
): Promise<{ success: boolean; reason?: string; raw?: any; tplCode?: string }> {
  if (!isAligoConfigured()) {
    return { success: false, reason: 'aligo 환경변수 미설정' };
  }

  const form = new URLSearchParams();
  form.append('apikey', ALIGO_API_KEY!);
  form.append('userid', ALIGO_USER_ID!);
  form.append('senderkey', ALIGO_SENDER_KEY!);
  form.append('tpl_code', params.tplCode);
  form.append('tpl_name', params.tplName);
  form.append('tpl_content', params.tplContent);
  if (params.tplSecure) form.append('tpl_secure', params.tplSecure);
  if (params.tplType) form.append('tpl_type', params.tplType);
  if (params.tplEmType) form.append('tpl_emtype', params.tplEmType);
  if (params.tplTitle) form.append('tpl_title', params.tplTitle);
  if (params.tplStitle) form.append('tpl_stitle', params.tplStitle);
  if (params.tplExtra) form.append('tpl_extra', params.tplExtra);
  if (params.tplAdvert) form.append('tpl_advert', params.tplAdvert);

  const buttonObj = buttonsToAligoRegisterFormat(params.buttons);
  if (buttonObj) form.append('tpl_button', JSON.stringify(buttonObj));

  try {
    const res = await axios.post(ALIGO_TEMPLATE_ADD_ENDPOINT, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      timeout: 15000,
    });
    const data = res.data;
    if (data && (data.code === 0 || data.code === '0')) {
      return { success: true, raw: data, tplCode: params.tplCode };
    }
    return { success: false, reason: data?.message || '알리고 템플릿 등록 실패', raw: data };
  } catch (err: any) {
    console.error('[aligoService] 템플릿 등록 예외:', err?.response?.data || err?.message);
    return {
      success: false,
      reason: err?.response?.data?.message || err?.message || '알리고 템플릿 등록 호출 중 오류',
    };
  }
}

/** 알림톡 템플릿 검수 요청 — POST /akv10/template/request/ */
export async function requestTemplateApproval(
  tplCode: string,
): Promise<{ success: boolean; reason?: string; raw?: any }> {
  if (!isAligoConfigured()) return { success: false, reason: 'aligo 환경변수 미설정' };
  const form = new URLSearchParams();
  form.append('apikey', ALIGO_API_KEY!);
  form.append('userid', ALIGO_USER_ID!);
  form.append('senderkey', ALIGO_SENDER_KEY!);
  form.append('tpl_code', tplCode);
  try {
    const res = await axios.post(ALIGO_TEMPLATE_REQUEST_ENDPOINT, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      timeout: 15000,
    });
    const data = res.data;
    if (data && (data.code === 0 || data.code === '0')) {
      return { success: true, raw: data };
    }
    return { success: false, reason: data?.message || '검수 요청 실패', raw: data };
  } catch (err: any) {
    console.error('[aligoService] 검수 요청 예외:', err?.response?.data || err?.message);
    return {
      success: false,
      reason: err?.response?.data?.message || err?.message || '검수 요청 호출 중 오류',
    };
  }
}

/** 알림톡 템플릿 목록 조회 (상태 확인용) — POST /akv10/template/list/ */
export async function listAlimtalkTemplates(opts?: { tplCode?: string }): Promise<{
  success: boolean;
  list?: any[];
  info?: { REG: number; REQ: number; APR: number; REJ: number };
  reason?: string;
  raw?: any;
}> {
  if (!isAligoConfigured()) return { success: false, reason: 'aligo 환경변수 미설정' };
  const form = new URLSearchParams();
  form.append('apikey', ALIGO_API_KEY!);
  form.append('userid', ALIGO_USER_ID!);
  form.append('senderkey', ALIGO_SENDER_KEY!);
  if (opts?.tplCode) form.append('tpl_code', opts.tplCode);
  try {
    const res = await axios.post(ALIGO_TEMPLATE_LIST_ENDPOINT, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      timeout: 15000,
    });
    const data = res.data;
    if (data && (data.code === 0 || data.code === '0')) {
      return { success: true, list: data.list || [], info: data.info, raw: data };
    }
    return { success: false, reason: data?.message || '템플릿 조회 실패', raw: data };
  } catch (err: any) {
    console.error('[aligoService] 템플릿 조회 예외:', err?.response?.data || err?.message);
    return {
      success: false,
      reason: err?.response?.data?.message || err?.message || '템플릿 조회 호출 중 오류',
    };
  }
}

/** 알림톡 템플릿 삭제 — POST /akv10/template/del/ (승인된 템플릿은 불가) */
export async function deleteAlimtalkTemplate(
  tplCode: string,
): Promise<{ success: boolean; reason?: string; raw?: any }> {
  if (!isAligoConfigured()) return { success: false, reason: 'aligo 환경변수 미설정' };
  const form = new URLSearchParams();
  form.append('apikey', ALIGO_API_KEY!);
  form.append('userid', ALIGO_USER_ID!);
  form.append('senderkey', ALIGO_SENDER_KEY!);
  form.append('tpl_code', tplCode);
  try {
    const res = await axios.post(ALIGO_TEMPLATE_DEL_ENDPOINT, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      timeout: 15000,
    });
    const data = res.data;
    if (data && (data.code === 0 || data.code === '0')) {
      return { success: true, raw: data };
    }
    return { success: false, reason: data?.message || '삭제 실패', raw: data };
  } catch (err: any) {
    console.error('[aligoService] 템플릿 삭제 예외:', err?.response?.data || err?.message);
    return {
      success: false,
      reason: err?.response?.data?.message || err?.message || '삭제 호출 중 오류',
    };
  }
}
