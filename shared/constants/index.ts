// ==========================================
// CareMatch 공유 상수
// ==========================================

export const APP_NAME = '케어매치';
export const DOMAIN = 'cm.phantomdesign.kr';
export const API_BASE_URL = `https://${DOMAIN}/api`;

// 의료행위 금지 안내 문구 (필수 표시)
export const MEDICAL_ACT_DISCLAIMER = `본 플랫폼의 간병사는 「의료법」상 의료인이 아니므로 의료행위를 수행할 수 없습니다.
보호자가 의료행위를 요청하거나 간병사가 이를 수행할 경우, 관련 법령에 따라 법적 책임이 발생할 수 있습니다.
의료행위(석션, 도뇨관 삽입·교체 등)는 반드시 의료기관 또는 의료인을 통해 진행해 주시기 바랍니다.`;

export const MEDICAL_ACT_CHECKBOX_LABEL = '의료행위는 간병사가 수행할 수 없음을 확인했습니다.';

// 간병 유형 라벨
export const CARE_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: '개인 간병 (1:1)',
  FAMILY: '가족 간병',
};

export const CARE_SCHEDULE_LABELS: Record<string, string> = {
  FULL_TIME: '24시간',
  PART_TIME: '시간제',
};

export const CARE_LOCATION_LABELS: Record<string, string> = {
  HOSPITAL: '병원',
  HOME: '자택',
};

// 간병인 상태 라벨
export const CAREGIVER_STATUS_LABELS: Record<string, string> = {
  PENDING: '승인 대기',
  APPROVED: '활동 중',
  REJECTED: '승인 거절',
  SUSPENDED: '활동 정지',
  BLACKLISTED: '블랙리스트',
};

export const CAREGIVER_WORK_STATUS_LABELS: Record<string, string> = {
  WORKING: '근무중',
  AVAILABLE: '근무 가능',
  IMMEDIATE: '즉시 가능',
};

// 거동 상태 라벨
export const MOBILITY_STATUS_LABELS: Record<string, string> = {
  INDEPENDENT: '독립 가능',
  PARTIAL: '부분 도움 필요',
  DEPENDENT: '완전 의존',
};

// 결제 방식 라벨
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: '무통장입금 (VAT 별도)',
  CARD: '카드결제 (VAT 별도)',
  DIRECT: '직접결제',
};

// 결제 상태 라벨
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  ESCROW: '에스크로 보관중',
  COMPLETED: '완료',
  REFUNDED: '환불',
  PARTIAL_REFUND: '부분 환불',
  FAILED: '실패',
};

// 거절 시 패널티 경고
export const REJECTION_PENALTY_WARNING = '거절 시 패널티가 부여될 수 있습니다. 거절하시겠습니까?';

// 노쇼 패널티 경고
export const NO_SHOW_PENALTY_WARNING = '노쇼 3회 이상 시 자동으로 활동 정지 처리됩니다.';

// 간병보험 서류 신청 안내
export const INSURANCE_DOC_GUIDE = `간병보험 서류 발급을 원하시면 아래 내용을 순서대로 보내주세요.

1️⃣ 환자 성함
2️⃣ 생년월일
3️⃣ 간병 이용 기간
4️⃣ 보험사명
5️⃣ 필요한 서류 종류 (예: 간병확인서, 영수증 등)

확인 후 빠르게 안내드리겠습니다.`;

// 성별 옵션
export const GENDER_OPTIONS = [
  { value: 'M', label: '남성' },
  { value: 'F', label: '여성' },
];

// 국적 옵션 (주요)
export const NATIONALITY_OPTIONS = [
  { value: 'KR', label: '한국' },
  { value: 'CN', label: '중국' },
  { value: 'VN', label: '베트남' },
  { value: 'PH', label: '필리핀' },
  { value: 'UZ', label: '우즈베키스탄' },
  { value: 'OTHER', label: '기타' },
];

// 지역 옵션
export const REGION_OPTIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];
