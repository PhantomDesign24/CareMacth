import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import { config } from '../config';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { buildPaymentHashes, buildMobileChkfake, requestApproval, netCancel } from '../utils/inicis';

const WEB_BASE = process.env.WEB_BASE_URL || 'https://cm.phantomdesign.kr';
const API_BASE = process.env.API_BASE_URL || 'https://cm.phantomdesign.kr/api';

// 결제 시작/복귀 도메인을 요청 호스트 기준으로 산출 → care-match.kr 에서 결제하면 그 도메인에서 끝남.
// 허용 도메인만 신뢰(스푸핑 방지), 그 외엔 기존 cm fallback.
const ALLOWED_HOSTS = ['cm.phantomdesign.kr', 'care-match.kr', 'www.care-match.kr'];
function inicisBases(req: Request): { web: string; api: string } {
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim().toLowerCase();
  if (ALLOWED_HOSTS.includes(host)) return { web: `https://${host}`, api: `https://${host}/api` };
  return { web: WEB_BASE, api: API_BASE };
}

// POST /payments/inicis/prepare  (GUARDIAN)
// 결제 PENDING 생성 + INIStdPay 결제창에 넘길 폼 파라미터 반환
export const prepareInicisPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId, pointsUsed, platform } = req.body as { contractId?: string; pointsUsed?: number; platform?: string };
    const isMobile = platform === 'mobile';
    if (!contractId) throw new AppError('contractId가 필요합니다.', 400);

    const { web: webBase, api: apiBase } = inicisBases(req);

    const guardian = await prisma.guardian.findUnique({ where: { userId: req.user!.id } });
    if (!guardian) throw new AppError('보호자 정보를 찾을 수 없습니다.', 404);

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, guardianId: guardian.id },
      include: { careRequest: { include: { patient: { select: { name: true } } } } },
    });
    if (!contract) throw new AppError('계약을 찾을 수 없습니다.', 404);
    if (!['PENDING_SIGNATURE', 'ACTIVE', 'EXTENDED'].includes(contract.status)) {
      throw new AppError('결제 가능한 계약 상태가 아닙니다.', 400);
    }

    // 이미 결제(ESCROW/COMPLETED) 있으면 차단
    const paid = await prisma.payment.findFirst({
      where: { contractId: contract.id, status: { in: ['ESCROW', 'COMPLETED'] } },
    });
    if (paid) throw new AppError('이미 결제가 완료된 계약입니다.', 400);

    // 포인트 차감 + 구매자 정보
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { points: true, name: true, phone: true, email: true } });
    const available = user?.points ?? 0;
    const reqPoints = Math.max(0, Math.floor(Number(pointsUsed) || 0));
    const base = contract.totalAmount;
    const actualPoints = Math.min(reqPoints, available, base);
    const amount = base - actualPoints;
    if (amount <= 0) throw new AppError('이니시스 결제는 1원 이상이어야 합니다. (전액 포인트는 별도 처리)', 400);

    // 카드결제 VAT 10% (무통장/직접결제는 이니시스 대상 아님)
    const vatAmount = Math.round(amount * 0.1);
    const totalAmount = amount + vatAmount;

    // 주문번호(oid) — mid + 계약 + 타임스탬프로 유니크 보장 (40byte 이내)
    const oid = `${config.inicis.mid}_${Date.now()}_${contract.id.slice(0, 8)}`;
    const timestamp = Date.now().toString();
    const goodname = '케어매치 간병서비스';
    const buyername = user?.name || '보호자';
    const buyertel = (user?.phone || '01000000000').replace(/[^0-9]/g, '');
    const buyeremail = user?.email || req.user!.email || '';

    // 기존 PENDING(미완료) 이니시스 결제 정리 후 새로 생성
    await prisma.payment.deleteMany({ where: { contractId: contract.id, status: 'PENDING', pgProvider: 'inicis' } });
    await prisma.payment.create({
      data: {
        contractId: contract.id,
        guardianId: guardian.id,
        amount, vatAmount, totalAmount,
        method: 'CARD', status: 'PENDING', pgProvider: 'inicis',
        tossOrderId: oid, pointsUsed: actualPoints,
      },
    });

    if (isMobile) {
      // 모바일: mobile.inicis.com/smart/payment/ 로 폼 전송 (전체페이지 이동)
      const mobileForm: Record<string, string> = {
        P_INI_PAYMENT: 'CARD',
        P_MID: config.inicis.mid,
        P_OID: oid,
        P_AMT: String(totalAmount),
        P_GOODS: goodname,
        P_UNAME: buyername,
        P_MOBILE: buyertel,
        P_EMAIL: buyeremail,
        P_NEXT_URL: `${apiBase}/payments/inicis/mobile-return`,
        P_NOTI_URL: `${apiBase}/payments/inicis/mobile-return`,
        // P_CHARSET 생략 → 모바일 기본 EUC-KR (프론트 폼도 accept-charset=euc-kr 로 전송)
        P_RESERVED: 'twotrs_isp=Y&block_isp=Y&twotrs_isp_noti=N',
      };
      // 위변조 해시(amt_hash)는 운영(실 HashKey)에서만 적용. 테스트는 HashKey 불명확해 생략.
      if (config.inicis.isProd) {
        mobileForm.P_RESERVED += '&amt_hash=Y';
        mobileForm.P_TIMESTAMP = timestamp;
        mobileForm.P_CHKFAKE = buildMobileChkfake({ amt: totalAmount, oid, timestamp });
      }
      return res.json({
        success: true,
        data: { mode: 'mobile', action: 'https://mobile.inicis.com/smart/payment/', form: mobileForm },
      });
    }

    // PC: INIStdPay.js 팝업
    const { signature, verification, mKey } = buildPaymentHashes({ oid, price: totalAmount, timestamp });
    res.json({
      success: true,
      data: {
        mode: 'pc',
        stdJsUrl: config.inicis.stdJsUrl,
        form: {
          version: '1.0',
          mid: config.inicis.mid,
          oid,
          price: String(totalAmount),
          timestamp,
          signature, verification, mKey,
          currency: 'WON',
          goodname, buyername, buyertel, buyeremail,
          gopaymethod: 'Card',
          acceptmethod: 'HPP(1):below1000:va_receipt',
          use_chkfake: 'Y',
          returnUrl: `${apiBase}/payments/inicis/return`,
          closeUrl: `${webBase}/payment/fail`,
        },
      },
    });
  } catch (e) {
    next(e);
  }
};

// POST /payments/inicis/return  (이니시스 서버 → 가맹점, 인증 없음)
// 인증결과 수신 → authUrl 승인요청 → Payment finalize → success/fail 페이지로 리다이렉트
export const inicisReturn = async (req: Request, res: Response) => {
  const b: any = req.body || {};
  console.log('[INICIS PC return] body keys:', Object.keys(b), '| body:', JSON.stringify(b).slice(0, 500));
  const { resultCode, authToken, authUrl, netCancelUrl, orderNumber } = b;
  const oid = orderNumber || b.oid || b.MOID || b.P_OID;
  const { web: webBase } = inicisBases(req);
  const fail = (msg: string) =>
    res.redirect(`${webBase}/payment/fail?message=${encodeURIComponent(msg)}`);

  try {
    if (!oid) return fail('주문번호 없음');
    const payment = await prisma.payment.findFirst({ where: { tossOrderId: oid, pgProvider: 'inicis' } });
    if (!payment) return fail('결제 정보를 찾을 수 없습니다.');

    // 인증 실패
    if (String(resultCode) !== '0000' || !authToken || !authUrl) {
      await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      return fail(b.resultMsg || '결제 인증 실패');
    }

    // 승인 요청 (server-to-server)
    const appr = await requestApproval(authUrl, authToken);
    if (appr.resultCode !== '0000') {
      // 승인 실패 → 망취소 (인증 무효화)
      if (netCancelUrl) await netCancel(netCancelUrl, authToken);
      await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      return fail(appr.resultMsg || '결제 승인 실패');
    }

    // 금액 검증 — 승인된 금액(TotPrice)이 우리 totalAmount 와 일치해야 함
    if (Number(appr.TotPrice) !== payment.totalAmount) {
      if (netCancelUrl) await netCancel(netCancelUrl, authToken);
      await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      return fail('결제 금액 불일치');
    }

    // finalize: PENDING → ESCROW + careRequest IN_PROGRESS + 보호자 알림 (토스 confirm 과 동일)
    const contract = payment.contractId
      ? await prisma.contract.findUnique({ where: { id: payment.contractId } })
      : null;
    try {
      await prisma.$transaction(async (tx) => {
        const fin = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: { status: 'ESCROW', paidAt: new Date(), tossPaymentKey: appr.tid || null },
        });
        if (fin.count === 0) throw new Error('이미 처리된 결제');
        const g = contract ? await tx.guardian.findUnique({ where: { id: payment.guardianId } }) : null;
        // 포인트 차감 확정 (결제에 사용한 포인트만큼 보호자 user.points 감소)
        if (payment.pointsUsed > 0 && g) {
          await tx.user.update({
            where: { id: g.userId },
            data: { points: { decrement: payment.pointsUsed } },
          }).catch(() => {});
        }
        if (contract) {
          await tx.careRequest.update({
            where: { id: contract.careRequestId },
            data: { status: 'IN_PROGRESS' },
          }).catch(() => {});
          if (g) {
            await tx.notification.create({
              data: {
                userId: g.userId, type: 'PAYMENT', title: '결제가 완료되었습니다',
                body: `결제가 완료되어 간병이 시작됩니다. 결제금액: ${payment.totalAmount.toLocaleString()}원`,
                data: { paymentId: payment.id },
              },
            });
          }
        }
      });
    } catch (dbErr: any) {
      // 승인은 성공했으나 DB 후처리 실패 → ESCROW 로 격리 (실돈/DB 불일치 방지)
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'ESCROW', paidAt: new Date(), tossPaymentKey: appr.tid || null },
      }).catch(() => {});
    }

    return res.redirect(`${webBase}/payment/success?provider=inicis&oid=${encodeURIComponent(oid)}`);
  } catch (e: any) {
    return fail('결제 처리 중 오류가 발생했습니다.');
  }
};

// 결제 ESCROW 전이 + careRequest IN_PROGRESS + 보호자 알림 (PC/모바일 공통 finalize)
async function finalizeInicisPayment(paymentId: string, tid?: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  const contract = payment.contractId ? await prisma.contract.findUnique({ where: { id: payment.contractId } }) : null;
  try {
    await prisma.$transaction(async (tx) => {
      const fin = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'ESCROW', paidAt: new Date(), tossPaymentKey: tid || null },
      });
      if (fin.count === 0) throw new Error('이미 처리됨');
      const g = contract ? await tx.guardian.findUnique({ where: { id: payment.guardianId } }) : null;
      if (payment.pointsUsed > 0 && g) {
        await tx.user.update({ where: { id: g.userId }, data: { points: { decrement: payment.pointsUsed } } }).catch(() => {});
      }
      if (contract) {
        await tx.careRequest.update({ where: { id: contract.careRequestId }, data: { status: 'IN_PROGRESS' } }).catch(() => {});
        if (g) {
          await tx.notification.create({
            data: {
              userId: g.userId, type: 'PAYMENT', title: '결제가 완료되었습니다',
              body: `결제가 완료되어 간병이 시작됩니다. 결제금액: ${payment.totalAmount.toLocaleString()}원`,
              data: { paymentId: payment.id },
            },
          });
        }
      }
    });
  } catch {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'ESCROW', paidAt: new Date(), tossPaymentKey: tid || null },
    }).catch(() => {});
  }
}

// POST /payments/inicis/mobile-return — 모바일 결제결과 수신 (P_NEXT_URL)
export const inicisMobileReturn = async (req: Request, res: Response) => {
  const b: any = req.body || {};
  console.log('[INICIS MOBILE return] body keys:', Object.keys(b), '| body:', JSON.stringify(b).slice(0, 500));
  const status = b.P_STATUS;
  const oid = b.P_OID || b.oid || b.MOID;
  const tid = b.P_TID;
  const amt = b.P_AMT;
  const { web: webBase } = inicisBases(req);
  const fail = (msg: string) => res.redirect(`${webBase}/payment/fail?message=${encodeURIComponent(msg)}`);
  try {
    // 실패(취소/위변조 등)는 oid 가 안 올 수 있음 → 실제 사유(P_RMESG1) 먼저 표시
    if (String(status) !== '00') {
      if (oid) {
        await prisma.payment.updateMany({ where: { tossOrderId: oid, pgProvider: 'inicis', status: 'PENDING' }, data: { status: 'FAILED' } });
      }
      // 깨진 문자(U+FFFD)·빈 메시지는 깔끔한 기본 문구로 대체
      const raw = String(b.P_RMESG1 || '').trim();
      const clean = raw && !raw.includes('�') ? raw : '결제가 취소되었거나 실패했습니다.';
      return fail(clean);
    }
    if (!oid) return fail('주문번호 없음');
    const payment = await prisma.payment.findFirst({ where: { tossOrderId: oid, pgProvider: 'inicis' } });
    if (!payment) return fail('결제 정보를 찾을 수 없습니다.');
    // 금액 검증
    if (Number(amt) !== payment.totalAmount) {
      await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      return fail('결제 금액 불일치');
    }
    // 모바일 스마트결제는 P_STATUS=00 이면 승인 완료 → finalize
    await finalizeInicisPayment(payment.id, tid);
    return res.redirect(`${webBase}/payment/success?provider=inicis&oid=${encodeURIComponent(oid)}`);
  } catch {
    return fail('결제 처리 중 오류가 발생했습니다.');
  }
};
