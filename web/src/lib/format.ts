// 날짜 포맷 (한국 시간)
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}

// 금액 포맷
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return amount.toLocaleString('ko-KR') + '원';
}

// 간병 요청 상태
export function formatCareStatus(status: string): string {
  const map: Record<string, string> = {
    OPEN: '공고 중',
    MATCHING: '매칭 중',
    MATCHED: '매칭 완료',
    IN_PROGRESS: '간병 중',
    COMPLETED: '완료',
    CANCELLED: '취소됨',
  };
  return map[status] || status;
}

// 계약 상태
export function formatContractStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: '진행 중',
    COMPLETED: '완료',
    CANCELLED: '취소',
    EXTENDED: '연장됨',
  };
  return map[status] || status;
}

// 결제 상태
export function formatPaymentStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: '대기',
    ESCROW: '에스크로 보관',
    COMPLETED: '완료',
    REFUNDED: '환불',
    PARTIAL_REFUND: '부분환불',
    FAILED: '실패',
  };
  return map[status] || status;
}

// 결제 방법
export function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    CARD: '카드',
    BANK_TRANSFER: '무통장입금',
    DIRECT: '직접결제',
  };
  return map[method] || method;
}

// 간병 유형
export function formatCareType(type: string): string {
  const map: Record<string, string> = {
    INDIVIDUAL: '1:1 간병',
    FAMILY: '가족 간병',
  };
  return map[type] || type;
}

// 간병 장소
export function formatLocation(location: string): string {
  const map: Record<string, string> = {
    HOSPITAL: '병원',
    HOME: '자택',
  };
  return map[location] || location;
}

// 간병인 상태
export function formatCaregiverStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: '승인 대기',
    APPROVED: '승인됨',
    REJECTED: '거절됨',
    SUSPENDED: '활동 정지',
    BLACKLISTED: '블랙리스트',
  };
  return map[status] || status;
}

// 이동 상태
export function formatMobility(status: string): string {
  const map: Record<string, string> = {
    INDEPENDENT: '독립 보행',
    PARTIAL: '부분 도움',
    DEPENDENT: '완전 의존',
  };
  return map[status] || status;
}
