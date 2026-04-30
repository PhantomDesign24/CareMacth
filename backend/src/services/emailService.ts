import nodemailer from 'nodemailer';

// 이메일 전송 설정 (ENV로 관리)
// 미설정 시 메일은 발송되지 않고 콘솔에만 출력 (dev 환경 대응)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || '"케어매치" <no-reply@carematch.co.kr>';

let transporter: nodemailer.Transporter | null = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  if (!to) return false;
  if (!transporter) {
    console.log(`[EMAIL SKIPPED - SMTP 미설정] To: ${to} | Subject: ${subject}`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `[케어매치] ${subject}`,
      html,
    });
    return true;
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    return false;
  }
}

// HTML 인젝션 방어 — 모든 사용자/환자/간병인 이름 등 변수는 escape 필수
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 공통 이메일 템플릿 (전문적 디자인)
function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:20px;">
    <div style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
      <div style="background:#1E3A5F;color:#FFFFFF;padding:24px 28px;">
        <div style="font-size:13px;font-weight:600;letter-spacing:2px;opacity:0.85;">CAREMATCH</div>
        <div style="font-size:20px;font-weight:700;margin-top:6px;">${title}</div>
      </div>
      <div style="padding:28px;color:#1A202C;font-size:15px;line-height:1.7;">
        ${body}
      </div>
      <div style="padding:18px 28px;background:#EDF2F7;color:#4A5568;font-size:12px;text-align:center;">
        케어매치 주식회사 &middot; 사업자등록번호 173-81-03376<br>
        본 메일은 발신 전용입니다. 문의는 앱 내 고객센터를 이용해주세요.
      </div>
    </div>
  </div>
</body>
</html>`;
}

// 매칭 확정
export function emailMatchingConfirmed(patientName: string, caregiverName: string, startDate: Date) {
  return baseTemplate(
    '매칭이 확정되었습니다',
    `
    <p><b>${escapeHtml(patientName)}</b> 환자의 간병인이 매칭되었습니다.</p>
    <ul style="padding-left:20px;color:#4A5568;">
      <li>간병인: <b>${escapeHtml(caregiverName)}</b></li>
      <li>간병 시작일: ${escapeHtml(startDate.toLocaleDateString('ko-KR'))}</li>
    </ul>
    <p>앱에서 계약 내용과 결제를 진행해주세요.</p>
    `,
  );
}

// 결제 완료
export function emailPaymentCompleted(patientName: string, amount: number) {
  return baseTemplate(
    '결제가 완료되었습니다',
    `
    <p><b>${escapeHtml(patientName)}</b> 환자의 간병비 결제가 완료되었습니다.</p>
    <div style="padding:16px;background:#F7FAFC;border-radius:8px;margin:12px 0;">
      <div style="color:#4A5568;font-size:13px;">결제 금액</div>
      <div style="font-size:22px;font-weight:700;color:#1E3A5F;margin-top:4px;">${escapeHtml(amount.toLocaleString())}원</div>
    </div>
    <p>앱 '결제 내역'에서 전자영수증을 다운로드 받으실 수 있습니다.</p>
    `,
  );
}

// 연장 리마인더
export function emailExtensionReminder(patientName: string, daysLeft: number) {
  return baseTemplate(
    `간병 종료 ${escapeHtml(String(daysLeft))}일 전 안내`,
    `
    <p><b>${escapeHtml(patientName)}</b> 환자의 간병이 <b style="color:#D97706;">${escapeHtml(String(daysLeft))}일 후 종료</b>됩니다.</p>
    <p>연장이 필요하시면 앱 대시보드에서 '연장 요청'을 이용해주세요.</p>
    `,
  );
}

// 비밀번호 재설정 — 임시 비밀번호 안내
export function emailPasswordReset(name: string, tempPassword: string) {
  return baseTemplate(
    '임시 비밀번호 발급 안내',
    `
    <p><b>${escapeHtml(name)}</b>님, 임시 비밀번호가 발급되었습니다.</p>
    <p style="font-size:18px;background:#F1F5F9;padding:12px 16px;border-radius:6px;letter-spacing:1px;font-family:monospace;text-align:center;">
      <b>${escapeHtml(tempPassword)}</b>
    </p>
    <p>이 비밀번호로 로그인하신 뒤 <b>마이페이지 → 비밀번호 변경</b>에서 새로운 비밀번호로 즉시 변경해 주세요.</p>
    <p style="color:#B91C1C;font-size:13px;">본인이 요청하지 않으셨다면 즉시 고객센터로 연락주시기 바랍니다.</p>
    `,
  );
}

// 회원가입 환영
export function emailWelcome(name: string) {
  return baseTemplate(
    '케어매치에 가입해주셔서 감사합니다',
    `
    <p><b>${escapeHtml(name)}</b>님, 환영합니다.</p>
    <p>케어매치는 간병인과 보호자를 안전하게 연결하는 전문 매칭 플랫폼입니다.</p>
    <p>앱에서 간병 요청을 등록하시면 AI 매칭으로 최적의 간병인을 추천받으실 수 있습니다.</p>
    `,
  );
}
