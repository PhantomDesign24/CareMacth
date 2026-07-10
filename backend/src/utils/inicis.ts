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
  const signKey = config.inicis.signKey;
  const sha512 = crypto.createHash('sha512').update(`${amt}${oid}${timestamp}${signKey}`, 'utf8').digest();
  return Buffer.from(sha512).toString('base64');
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
