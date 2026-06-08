import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import { config } from '../config';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { buildPaymentHashes, requestApproval, netCancel } from '../utils/inicis';

const WEB_BASE = process.env.WEB_BASE_URL || 'https://cm.phantomdesign.kr';
const API_BASE = process.env.API_BASE_URL || 'https://cm.phantomdesign.kr/api';

// POST /payments/inicis/prepare  (GUARDIAN)
// 결제 PENDING 생성 + INIStdPay 결제창에 넘길 폼 파라미터 반환
export const prepareInicisPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contractId, pointsUsed } = req.body as { contractId?: string; pointsUsed?: number };
    if (!contractId) throw new AppError('contractId가 필요합니다.', 400);

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
    const { signature, verification, mKey } = buildPaymentHashes({ oid, price: totalAmount, timestamp });

    // 기존 PENDING(미완료) 이니시스 결제 정리 후 새로 생성
    await prisma.payment.deleteMany({ where: { contractId: contract.id, status: 'PENDING', pgProvider: 'inicis' } });
    await prisma.payment.create({
      data: {
        contractId: contract.id,
        guardianId: guardian.id,
        amount,
        vatAmount,
        totalAmount,
        method: 'CARD',
        status: 'PENDING',
        pgProvider: 'inicis',
        tossOrderId: oid,      // 이니시스 oid 저장
        pointsUsed: actualPoints,
      },
    });

    res.json({
      success: true,
      data: {
        stdJsUrl: config.inicis.stdJsUrl,
        form: {
          version: '1.0',
          mid: config.inicis.mid,
          oid,
          price: String(totalAmount),
          timestamp,
          signature,
          verification,
          mKey,
          currency: 'WON',
          goodname: `간병서비스 (${contract.careRequest?.patient?.name || '환자'})`,
          buyername: user?.name || '보호자',
          buyertel: (user?.phone || '01000000000').replace(/[^0-9]/g, ''),
          buyeremail: user?.email || req.user!.email || '',
          gopaymethod: 'Card',
          acceptmethod: 'HPP(1):below1000:va_receipt',
          use_chkfake: 'Y',
          returnUrl: `${API_BASE}/payments/inicis/return`,
          closeUrl: `${WEB_BASE}/payment/fail`,
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
  const { resultCode, authToken, authUrl, netCancelUrl, orderNumber } = b;
  const oid = orderNumber || b.oid;
  const fail = (msg: string) =>
    res.redirect(`${WEB_BASE}/payment/fail?reason=${encodeURIComponent(msg)}`);

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

    return res.redirect(`${WEB_BASE}/payment/success?provider=inicis&oid=${encodeURIComponent(oid)}`);
  } catch (e: any) {
    return fail('결제 처리 중 오류가 발생했습니다.');
  }
};
