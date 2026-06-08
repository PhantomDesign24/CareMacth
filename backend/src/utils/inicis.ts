// KG이니시스 INIStdPay 웹표준결제 유틸
// 공식 매뉴얼(manual.inicis.com/pay/stdpay_pc.html) 스펙 기준 해시 생성.
import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config';

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
