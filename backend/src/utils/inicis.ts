// KG이니시스 INIStdPay 웹표준결제 유틸
// 공식 매뉴얼(manual.inicis.com/pay/stdpay_pc.html) 스펙 기준 해시 생성.
import crypto from 'crypto';
import axios from 'axios';
import iconv from 'iconv-lite';
import { config } from '../config';

// application/x-www-form-urlencoded 본문(EUC-KR) → 객체.
// 이니시스 모바일은 EUC-KR 로 P_NEXT_URL 에 결과를 POST → 기본 UTF-8 파서로는 한글(P_RMESG1) 깨짐.
export function parseEucKrFormBody(buf: Buffer): Record<string, string> {
  const s = buf.toString('latin1'); // 퍼센트 인코딩 보존 (바이트 그대로)
  const out: Record<string, string> = {};
  for (const pair of s.split('&')) {
    if (!pair) continue;
    const idx = pair.indexOf('=');
    const rawKey = idx >= 0 ? pair.slice(0, idx) : pair;
    const rawVal = idx >= 0 ? pair.slice(idx + 1) : '';
    out[iconv.decode(percentDecodeToBuffer(rawKey), 'euc-kr')] =
      iconv.decode(percentDecodeToBuffer(rawVal), 'euc-kr');
  }
  return out;
}

function percentDecodeToBuffer(str: string): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '+') {
      bytes.push(0x20);
    } else if (c === '%' && i + 2 < str.length) {
      bytes.push(parseInt(str.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(str.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

export function sha256hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// 결제요청용 해시 3종
//  signature    = SHA256(oid=..&price=..&timestamp=..)
//  verification = SHA256(oid=..&price=..&signKey=..&timestamp=..)
//  mKey         = SHA256(signKey)
export function buildPaymentHashes(params: { oid: string; price: number | string; timestamp: string | number }) {
  const { oid, price, timestamp } = params;
  const signKey = config.inicis.signKey;
  return {
    signature: sha256hex(`oid=${oid}&price=${price}&timestamp=${timestamp}`),
    verification: sha256hex(`oid=${oid}&price=${price}&signKey=${signKey}&timestamp=${timestamp}`),
    mKey: sha256hex(signKey),
  };
}

// 승인/망취소용 해시 2종
//  signature    = SHA256(authToken=..&timestamp=..)
//  verification = SHA256(authToken=..&signKey=..&timestamp=..)
export function buildAuthHashes(params: { authToken: string; timestamp: string | number }) {
  const { authToken, timestamp } = params;
  const signKey = config.inicis.signKey;
  return {
    signature: sha256hex(`authToken=${authToken}&timestamp=${timestamp}`),
    verification: sha256hex(`authToken=${authToken}&signKey=${signKey}&timestamp=${timestamp}`),
  };
}

// 모바일(mobile.inicis.com/smart) 위변조 방지 해시
//  P_CHKFAKE = BASE64( SHA512( P_AMT + P_OID + P_TIMESTAMP + signKey ) )
export function buildMobileChkfake(params: { amt: number | string; oid: string; timestamp: string | number }) {
  const { amt, oid, timestamp } = params;
  // 모바일 위변조 해시는 PC signKey가 아니라 모바일 전용 HashKey 사용 (없으면 signKey로 fallback)
  const hashKey = config.inicis.mobileHashKey || config.inicis.signKey;
  const sha512 = crypto.createHash('sha512').update(`${amt}${oid}${timestamp}${hashKey}`, 'utf8').digest();
  return Buffer.from(sha512).toString('base64');
}

// 모바일 최종 승인 — 인증(P_NEXT_URL, P_STATUS=00) 후 P_REQ_URL 로 POST 해야 실제 승인 완료.
// 응답(EUC-KR urlencoded)에 최종 P_STATUS/P_OID/P_AMT 가 담겨온다.
export async function requestMobileApproval(reqUrl: string, tid: string): Promise<Record<string, string>> {
  const body = new URLSearchParams({ P_MID: config.inicis.mid, P_TID: tid });
  const res = await axios.post(reqUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20000,
    responseType: 'arraybuffer', // EUC-KR 바이트 보존
  });
  // 승인 응답도 EUC-KR urlencoded → 인증결과 파서 재사용(한글 P_RMESG1 정상 디코드).
  // 이전엔 latin1+decodeURIComponent 라 한글 에러메시지가 깨져 그대로 노출됐음.
  return parseEucKrFormBody(Buffer.from(res.data));
}

export type InicisApproveResult = {
  resultCode: string;   // '0000' = 승인성공
  resultMsg: string;
  tid?: string;
  MOID?: string;        // = 우리 oid
  TotPrice?: string;
  payMethod?: string;
  applDate?: string;
  applTime?: string;
  raw: any;
};

// 승인요청 — returnUrl 로 받은 authUrl 에 server-to-server POST
export async function requestApproval(authUrl: string, authToken: string): Promise<InicisApproveResult> {
  const timestamp = Date.now().toString();
  const { signature, verification } = buildAuthHashes({ authToken, timestamp });
  const body = new URLSearchParams({
    mid: config.inicis.mid,
    authToken,
    timestamp,
    signature,
    verification,
    charset: 'UTF-8',
    format: 'JSON',
  });
  const res = await axios.post(authUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20000,
  });
  const d = res.data || {};
  return {
    resultCode: String(d.resultCode ?? ''),
    resultMsg: String(d.resultMsg ?? ''),
    tid: d.tid, MOID: d.MOID, TotPrice: d.TotPrice, payMethod: d.payMethod,
    applDate: d.applDate, applTime: d.applTime,
    raw: d,
  };
}

// INIAPI 취소/환불 — 이니시스 승인건 취소 (iniapi.inicis.com/api/v1/refund)
//  hashData = SHA512hex( iniApiKey + type + paymethod + timestamp + clientIp + mid + tid )
//  timestamp = KST(UTC+9) yyyyMMddHHmmss 14자리
//  resultCode '00' = 정상처리 (그 외 실패)
//  price 지정 시 부분취소, 미지정 시 전액취소
export async function refundInicis(params: {
  tid: string;
  msg?: string;
  price?: number;
  clientIp?: string;
}): Promise<{ ok: boolean; resultCode: string; resultMsg: string; raw: any }> {
  const { tid } = params;
  const mid = config.inicis.mid;
  const iniApiKey = config.inicis.iniApiKey;
  const type = 'Refund';
  const paymethod = 'Card';
  const clientIp = params.clientIp || process.env.INICIS_CLIENT_IP || '115.68.220.241';
  const msg = params.msg || '관리자 환불';

  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${kst.getUTCFullYear()}${p2(kst.getUTCMonth() + 1)}${p2(kst.getUTCDate())}${p2(kst.getUTCHours())}${p2(kst.getUTCMinutes())}${p2(kst.getUTCSeconds())}`;

  const hashData = crypto
    .createHash('sha512')
    .update(`${iniApiKey}${type}${paymethod}${timestamp}${clientIp}${mid}${tid}`, 'utf8')
    .digest('hex');

  const body: Record<string, string> = { mid, type, paymethod, timestamp, clientIp, hashData, tid, msg };
  if (params.price && params.price > 0) body.price = String(params.price); // 부분취소

  const res = await axios.post('https://iniapi.inicis.com/api/v1/refund', new URLSearchParams(body).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20000,
  });
  const d = res.data || {};
  const resultCode = String(d.resultCode ?? '');
  return { ok: resultCode === '00', resultCode, resultMsg: String(d.resultMsg ?? ''), raw: d };
}

// 망취소 — 승인 단계에서 오류 시 인증 무효화 (10분 이내)
export async function netCancel(netCancelUrl: string, authToken: string): Promise<any> {
  const timestamp = Date.now().toString();
  const { signature, verification } = buildAuthHashes({ authToken, timestamp });
  const body = new URLSearchParams({
    mid: config.inicis.mid,
    authToken,
    timestamp,
    signature,
    verification,
    charset: 'UTF-8',
    format: 'JSON',
  });
  try {
    const res = await axios.post(netCancelUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
    });
    return res.data;
  } catch (e: any) {
    return { error: e?.message || 'netCancel failed' };
  }
}
