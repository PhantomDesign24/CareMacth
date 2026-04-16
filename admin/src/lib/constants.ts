/**
 * 관리자 공통 상수 — 여러 페이지에서 반복되는 enum/옵션을 한 곳에서 관리
 */

// ────────────────────────────────────────
// 지역
// ────────────────────────────────────────
export const REGIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

export const REGION_OPTIONS = [
  { value: "", label: "전체 지역" },
  ...REGIONS.map((r) => ({ value: r, label: r })),
];

// ────────────────────────────────────────
// 전문 분야
// ────────────────────────────────────────
export const SPECIALTIES = [
  "치매", "중환자", "호스피스", "재활", "감염관리", "수술후간호",
  "소아간병", "정신건강", "암환자", "거동불편",
];

// ────────────────────────────────────────
// 간병인 상태
// ────────────────────────────────────────
export const CAREGIVER_STATUSES = [
  { value: "PENDING", label: "승인 대기", badge: "badge-yellow" },
  { value: "APPROVED", label: "승인됨", badge: "badge-green" },
  { value: "REJECTED", label: "거절됨", badge: "badge-red" },
  { value: "SUSPENDED", label: "활동 정지", badge: "badge-red" },
  { value: "BLACKLISTED", label: "블랙리스트", badge: "badge-gray" },
] as const;

export const CAREGIVER_STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  ...CAREGIVER_STATUSES.map((s) => ({ value: s.value, label: s.label })),
];

export function caregiverStatusLabel(status: string): string {
  return CAREGIVER_STATUSES.find((s) => s.value === status?.toUpperCase())?.label || status;
}

export function caregiverStatusBadge(status: string): string {
  return CAREGIVER_STATUSES.find((s) => s.value === status?.toUpperCase())?.badge || "badge-gray";
}

// ────────────────────────────────────────
// 근무 상태
// ────────────────────────────────────────
export const WORK_STATUSES = [
  { value: "WORKING", label: "근무중" },
  { value: "AVAILABLE", label: "근무 가능" },
  { value: "IMMEDIATE", label: "즉시 가능" },
] as const;

export const WORK_STATUS_OPTIONS = [
  { value: "", label: "전체" },
  ...WORK_STATUSES.map((s) => ({ value: s.value, label: s.label })),
];

// ────────────────────────────────────────
// 경력 구간
// ────────────────────────────────────────
export const EXPERIENCE_OPTIONS = [
  { value: "", label: "전체 경력" },
  { value: "0-1", label: "1년 미만" },
  { value: "1-3", label: "1~3년" },
  { value: "3-5", label: "3~5년" },
  { value: "5-10", label: "5~10년" },
  { value: "10+", label: "10년 이상" },
];

// ────────────────────────────────────────
// 패널티 타입
// ────────────────────────────────────────
export const PENALTY_TYPES = [
  { value: "NO_SHOW", label: "노쇼(무단결근)" },
  { value: "CANCELLATION", label: "취소" },
  { value: "COMPLAINT", label: "민원/불만" },
  { value: "MANUAL", label: "관리자 직접 부여" },
] as const;

// ────────────────────────────────────────
// 알림 타입
// ────────────────────────────────────────
export const NOTIFICATION_TYPES = [
  { value: "MATCHING", label: "매칭" },
  { value: "APPLICATION", label: "지원" },
  { value: "CONTRACT", label: "계약" },
  { value: "PAYMENT", label: "결제" },
  { value: "CARE_RECORD", label: "간병 기록" },
  { value: "EXTENSION", label: "연장" },
  { value: "PENALTY", label: "패널티" },
  { value: "SYSTEM", label: "시스템" },
] as const;

// ────────────────────────────────────────
// 알림 타겟
// ────────────────────────────────────────
export const NOTIFICATION_TARGETS = [
  { value: "all", label: "전체 사용자" },
  { value: "guardians", label: "보호자 전체" },
  { value: "caregivers", label: "간병인 전체" },
  { value: "all_devices", label: "등록된 모든 기기" },
  { value: "individual", label: "개별 사용자 지정" },
] as const;

// ────────────────────────────────────────
// 결제 상태
// ────────────────────────────────────────
export const PAYMENT_STATUSES = [
  { value: "PENDING", label: "결제 대기", badge: "badge-yellow" },
  { value: "COMPLETED", label: "결제 완료", badge: "badge-green" },
  { value: "REFUNDED", label: "환불됨", badge: "badge-gray" },
  { value: "FAILED", label: "실패", badge: "badge-red" },
] as const;

// ────────────────────────────────────────
// 신고 상태 (iOS 심사용 UGC 모더레이션)
// ────────────────────────────────────────
export const REPORT_STATUSES = [
  { value: "PENDING", label: "접수됨", badge: "badge-yellow" },
  { value: "REVIEWING", label: "검토 중", badge: "badge-blue" },
  { value: "RESOLVED", label: "처리 완료", badge: "badge-green" },
  { value: "REJECTED", label: "기각", badge: "badge-gray" },
] as const;

export function reportStatusLabel(status: string): string {
  return REPORT_STATUSES.find((s) => s.value === status)?.label || status;
}
export function reportStatusBadge(status: string): string {
  return REPORT_STATUSES.find((s) => s.value === status)?.badge || "badge-gray";
}

// ────────────────────────────────────────
// 신고 사유
// ────────────────────────────────────────
export const REPORT_REASONS = [
  { value: "INAPPROPRIATE", label: "부적절한 내용" },
  { value: "SPAM", label: "스팸/광고" },
  { value: "ABUSE", label: "욕설·비방" },
  { value: "FAKE", label: "허위 사실" },
  { value: "PRIVACY", label: "개인정보 노출" },
  { value: "OTHER", label: "기타" },
] as const;

// ────────────────────────────────────────
// 신고 대상 유형
// ────────────────────────────────────────
export const REPORT_TARGET_TYPES = [
  { value: "REVIEW", label: "리뷰" },
  { value: "USER", label: "사용자" },
  { value: "CARE_RECORD", label: "간병 일지" },
  { value: "MESSAGE", label: "메시지" },
] as const;

// ────────────────────────────────────────
// 계약 상태
// ────────────────────────────────────────
export const CONTRACT_STATUSES = [
  { value: "ACTIVE", label: "진행 중", badge: "badge-green" },
  { value: "EXTENDED", label: "연장됨", badge: "badge-blue" },
  { value: "COMPLETED", label: "완료", badge: "badge-gray" },
  { value: "CANCELLED", label: "취소", badge: "badge-red" },
] as const;

// ────────────────────────────────────────
// 간병 요청 상태
// ────────────────────────────────────────
export const CARE_REQUEST_STATUSES = [
  { value: "OPEN", label: "공고 중", badge: "badge-blue" },
  { value: "MATCHING", label: "매칭 중", badge: "badge-yellow" },
  { value: "MATCHED", label: "매칭 완료", badge: "badge-green" },
  { value: "IN_PROGRESS", label: "간병 중", badge: "badge-green" },
  { value: "COMPLETED", label: "완료", badge: "badge-gray" },
  { value: "CANCELLED", label: "취소됨", badge: "badge-red" },
] as const;
