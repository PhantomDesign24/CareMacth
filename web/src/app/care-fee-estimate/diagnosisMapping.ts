// 진단명 키워드 기반 자동 등급 분류 (권미형 차장 요청)
// - 다리 골절·고관절·대퇴골·경골 등 거동불가 → 중증 강제
// - 팔/상체 골절 → 경증 유지 (별도 처리 불필요)
// - 정신질환 (우울증·조현병·공황·양극성 등) → 고위험 base 강제

// 다리(거동불가) 관련 키워드 — 중증으로 분류
const LEG_FRACTURE_KEYWORDS = [
  '고관절골절', '고관절수술',
  '대퇴부골절', '대퇴골두무혈성괴사', '대퇴골',
  '경골', '비골',
  '골반골절',
  '다리골절', '하지골절',
  '발목골절', '발목수술',
  '무릎수술', '무릎관절수술', '무릎인공관절수술', '무릎연골수술', '인공관절', '인공관절수술',
  '십자인대파열',
  '척추골절', '척추압박골절',
  '허리골절', '허리디스크수술', '허리수술',
  '경추골절', '경추손상',
];

// 정신질환 관련 키워드 — 고위험 base
const MENTAL_DISORDER_KEYWORDS = [
  '우울증',
  '조현병', '정신분열',
  '공황장애', '공황',
  '양극성', '조울증',
  '망상',
  '불안장애',
  '정신질환', '정신과',
  '섬망', // 노인 섬망도 정신상태 관리 필요 — 고위험
];

export type DiagnosisHint = {
  forceTier: 'LIGHT' | 'MEDIUM' | 'HIGH' | null;
  reason: string | null;
};

export function getDiagnosisHint(diagnosis: string | null | undefined): DiagnosisHint {
  if (!diagnosis) return { forceTier: null, reason: null };
  const d = diagnosis.replace(/\s/g, '');
  // 정신질환이 다리 골절보다 우선 (의료적 케어 난이도 기준)
  if (MENTAL_DISORDER_KEYWORDS.some((k) => d.includes(k))) {
    return { forceTier: 'HIGH', reason: '정신질환 — 고위험 분류' };
  }
  if (LEG_FRACTURE_KEYWORDS.some((k) => d.includes(k))) {
    return { forceTier: 'MEDIUM', reason: '다리·하지 골절 — 거동 불가로 중증 분류' };
  }
  return { forceTier: null, reason: null };
}

// ──────────────────────────────────────────────────────────────────────
// 진단명 카테고리별 평균 간병 기간 (일)
// ──────────────────────────────────────────────────────────────────────
// 검사·단기 외래성 처치 — 1~2일
const SHORT_TERM_KEYWORDS = [
  '검사', '조직검사', '내시경', '조영술', '색전술',
  '백내장', '봉합', '깁스', '관장',
];
// 골절·정형외과 회복 — 14일
const FRACTURE_KEYWORDS = [
  '고관절골절', '고관절수술', '대퇴부골절', '대퇴골',
  '골반골절', '척추골절', '척추압박골절', '허리골절',
  '경추골절', '경추손상', '발목골절', '발목수술',
  '무릎수술', '무릎관절수술', '무릎인공관절수술', '인공관절', '인공관절수술',
  '십자인대파열', '회전근개파열', '디스크수술', '척추수술',
  '팔골절', '갈비뼈골절', '손목골절',
];
// 암·항암 — 21일
const CANCER_KEYWORDS = [
  '암', '항암', '백혈병', '림프종', '림프암', '말기암',
  '육종', '종양', '교모세포종', '선종',
];
// 뇌혈관·만성·와상 — 30일
const CHRONIC_KEYWORDS = [
  '뇌졸중', '뇌경색', '뇌출혈', '지주막하출혈', '뇌내출혈', '경막하출혈',
  '치매', '알츠하이머', '파킨슨', '루게릭', '루게릭병',
  '와상', '식물인간', '사지마비', '하반신마비', '편마비',
  '척수손상', '척수염', '척수증',
  '신부전', '투석', '혈액투석',
];

export type DiagnosisDurationHint = {
  days: number | null; // null = 기본값 사용
  reason: string | null;
};

export function getDiagnosisDurationHint(diagnosis: string | null | undefined, defaultDays = 6.2): DiagnosisDurationHint {
  if (!diagnosis) return { days: null, reason: null };
  const d = diagnosis.replace(/\s/g, '');
  if (SHORT_TERM_KEYWORDS.some((k) => d.includes(k))) {
    return { days: 2, reason: '검사·단기 처치' };
  }
  if (CHRONIC_KEYWORDS.some((k) => d.includes(k))) {
    return { days: 30, reason: '뇌혈관·만성 질환' };
  }
  if (CANCER_KEYWORDS.some((k) => d.includes(k))) {
    return { days: 21, reason: '암·항암 치료' };
  }
  if (FRACTURE_KEYWORDS.some((k) => d.includes(k))) {
    return { days: 14, reason: '골절·수술 회복' };
  }
  // 매핑 없으면 PlatformConfig 의 기본값 그대로
  return { days: null, reason: null };
}

