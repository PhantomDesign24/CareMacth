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

// 지원 상태
export function formatApplicationStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: '대기 중',
    ACCEPTED: '수락됨',
    REJECTED: '미선택',
    CANCELLED: '취소됨',
  };
  return map[status] || status;
}

// 간병인 근무 상태
export function formatWorkStatus(status: string): string {
  const map: Record<string, string> = {
    WORKING: '근무 중',
    AVAILABLE: '근무 가능',
    IMMEDIATE: '즉시 가능',
  };
  return map[status] || status;
}

// 신고 상태
export function formatReportStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: '접수됨',
    REVIEWING: '검토 중',
    RESOLVED: '처리 완료',
    REJECTED: '기각',
  };
  return map[status] || status;
}

// 신고 사유
export function formatReportReason(reason: string): string {
  const map: Record<string, string> = {
    INAPPROPRIATE: '부적절한 내용',
    SPAM: '스팸/광고',
    ABUSE: '욕설·비방',
    FAKE: '허위 사실',
    PRIVACY: '개인정보 노출',
    OTHER: '기타',
  };
  return map[reason] || reason;
}

// 신고 대상 유형
export function formatReportTargetType(type: string): string {
  const map: Record<string, string> = {
    REVIEW: '리뷰',
    USER: '사용자',
    CARE_RECORD: '간병 일지',
    MESSAGE: '메시지',
  };
  return map[type] || type;
}

// 알림 유형
export function formatNotificationType(type: string): string {
  const map: Record<string, string> = {
    MATCHING: '매칭',
    APPLICATION: '지원',
    CONTRACT: '계약',
    PAYMENT: '결제',
    CARE_RECORD: '간병 기록',
    EXTENSION: '연장',
    PENALTY: '패널티',
    SYSTEM: '시스템',
  };
  return map[type] || type;
}

// 패널티 유형
export function formatPenaltyType(type: string): string {
  const map: Record<string, string> = {
    NO_SHOW: '노쇼(무단결근)',
    CANCELLATION: '취소',
    COMPLAINT: '민원/불만',
    MANUAL: '관리자 직접 부여',
  };
  return map[type] || type;
}

// 보험 서류 상태
export function formatInsuranceDocStatus(status: string): string {
  const map: Record<string, string> = {
    REQUESTED: '신청됨',
    PROCESSING: '처리 중',
    COMPLETED: '발급 완료',
    REJECTED: '반려',
  };
  return map[status] || status;
}

// 의식 상태
export function formatConsciousness(value: string): string {
  const map: Record<string, string> = {
    ALERT: '명료',
    DROWSY: '기면',
    STUPOR: '혼미',
    COMA: '혼수',
  };
  return map[value] || value;
}

// 치매 정도
export function formatDementiaLevel(value: string): string {
  const map: Record<string, string> = {
    MILD: '경증',
    MODERATE: '중등도',
    SEVERE: '중증',
  };
  return map[value] || value;
}

// 성별
export function formatGender(gender: string): string {
  const map: Record<string, string> = {
    M: '남성',
    F: '여성',
  };
  return map[gender] || gender;
}
