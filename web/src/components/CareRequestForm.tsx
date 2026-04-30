"use client";

import React, { useEffect, useState } from "react";
import { guardianAPI } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CareRequestFormData {
  // Patient info
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientWeight: string;
  patientHeight: string;
  consciousness: string;
  hasDementia: boolean;
  dementiaLevel: string;
  hasInfection: boolean;
  infectionDetails: string;
  mobility: string;
  specialNotes: string;
  diagnosis: string[];
  diagnosisEtc: string;

  // Care type
  careType: string;
  careSchedule: string;
  hourlyStart: string;
  hourlyEnd: string;

  // Location
  locationType: string;
  locationName: string;
  locationAddress: string;
  regions: string[];

  // Schedule
  startDate: string;
  duration: string;
  durationUnit: string;

  // Rate
  dailyRate: string;

  // Preferences
  preferredGender: string;
  preferredNationality: string;

  // Disclaimer
  disclaimerChecked: boolean;

  // ── 신규: 환자 상태 / 간병 난이도
  infections: string[];                  // 다중: NONE/VRE/CRE/TB/SCABIES/FLU/ETC
  infectionsEtc: string;
  roomType: string;                      // GENERAL/ICU/ISOLATION/ER/CLOSED/ETC
  roomTypeEtc: string;
  longTermCareGrade: string;             // NONE/G1~G5/COGNITIVE/UNKNOWN/APPLYING/INTERESTED
  hasSurgery: string;                    // 'YES' | 'NO' | ''
  treatments: string[];                  // 다중: NONE/REHAB/DIALYSIS/ETC
  treatmentsEtc: string;
  paralysisStatus: string;               // NONE/FULL/HEMI
  hygieneStatus: string;                 // SELF/TOILET_HELP/BED_HELP/FULL_HELP/ETC
  hygieneStatusEtc: string;
  mealStatus: string;                    // SELF/PREP_HELP/FEED_HELP/NASOGASTRIC/PEG/ETC
  mealStatusEtc: string;
  toiletStatus: string;                  // SELF/AFTER_CARE/URINAL/DIAPER/CATHETER/ETC
  toiletStatusEtc: string;
  exerciseStatus: string;                // SELF/SUPPORT/CANE_WHEELCHAIR/POSITION_CHANGE/FULL_HELP/ETC
  exerciseStatusEtc: string;
  hasDelirium: string;                   // 'YES'|'NO'|''
  hasBedsore: string;
  needsSuction: string;
  hasStoma: string;
  hospitalizationReason: string;         // DISEASE/TRAFFIC/INDUSTRIAL/GENERAL/ETC
  hospitalizationReasonEtc: string;
  covidTestRequirement: string;          // CONFIRM_NEEDED/TEST_NEEDED/QUESTIONNAIRE_ONLY/NONE
  vaccineCheckRequirement: string;       // CONFIRM_NEEDED/NONE

  // ── 신규: 신청인-환자 관계 / 희망 서비스 / 희망 급여
  relationToPatient: string;             // 본인/배우자/자녀/형제·자매/기타
  preferredServices: string[];           // 다중: EXERCISE/COMPANION/TIDY/MEDICATION
  preferredWageType: string;             // MONTHLY_24H/MONTHLY_12H/MONTHLY_1H
  preferredWageAmount: string;           // 보호자 직접 입력 (원)
}

const initialFormData: CareRequestFormData = {
  patientName: "",
  patientAge: "",
  patientGender: "",
  patientWeight: "",
  patientHeight: "",
  consciousness: "",
  hasDementia: false,
  dementiaLevel: "",
  hasInfection: false,
  infectionDetails: "",
  mobility: "",
  specialNotes: "",
  diagnosis: [],
  diagnosisEtc: "",
  careType: "",
  careSchedule: "",
  hourlyStart: "",
  hourlyEnd: "",
  locationType: "",
  locationName: "",
  locationAddress: "",
  regions: [],
  startDate: "",
  duration: "",
  durationUnit: "days",
  preferredGender: "",
  preferredNationality: "",
  dailyRate: "",
  disclaimerChecked: false,
  // 신규
  infections: [],
  infectionsEtc: "",
  roomType: "",
  roomTypeEtc: "",
  longTermCareGrade: "",
  hasSurgery: "",
  treatments: [],
  treatmentsEtc: "",
  paralysisStatus: "",
  hygieneStatus: "",
  hygieneStatusEtc: "",
  mealStatus: "",
  mealStatusEtc: "",
  toiletStatus: "",
  toiletStatusEtc: "",
  exerciseStatus: "",
  exerciseStatusEtc: "",
  hasDelirium: "",
  hasBedsore: "",
  needsSuction: "",
  hasStoma: "",
  hospitalizationReason: "",
  hospitalizationReasonEtc: "",
  covidTestRequirement: "",
  vaccineCheckRequirement: "",
  relationToPatient: "",
  preferredServices: [],
  preferredWageType: "",
  preferredWageAmount: "",
};

// 옵션 사전
const PATIENT_STATE_OPTIONS = {
  ROOM_TYPE: [
    { v: 'GENERAL', l: '일반 병실' },
    { v: 'ICU', l: '중환자실' },
    { v: 'ISOLATION', l: '격리병동' },
    { v: 'ER', l: '응급실' },
    { v: 'CLOSED', l: '폐쇄병동' },
    { v: 'ETC', l: '기타' },
  ],
  GRADE: [
    { v: 'NONE', l: '등급없음' },
    { v: 'G1', l: '1등급' }, { v: 'G2', l: '2등급' }, { v: 'G3', l: '3등급' },
    { v: 'G4', l: '4등급' }, { v: 'G5', l: '5등급' },
    { v: 'COGNITIVE', l: '인지지원등급' },
    { v: 'UNKNOWN', l: '등급 모름' },
    { v: 'APPLYING', l: '등급 신청 중' },
    { v: 'INTERESTED', l: '등급 신청 관심 있음' },
  ],
  INFECTION: [
    { v: 'NONE', l: '아니요' },
    { v: 'VRE', l: 'VRE' },
    { v: 'CRE', l: 'CRE' },
    { v: 'TB', l: '결핵' },
    { v: 'SCABIES', l: '옴' },
    { v: 'FLU', l: '독감' },
    { v: 'ETC', l: '기타' },
  ],
  TREATMENTS: [
    { v: 'NONE', l: '없음' },
    { v: 'REHAB', l: '재활치료' },
    { v: 'DIALYSIS', l: '투석치료' },
    { v: 'ETC', l: '기타' },
  ],
  PARALYSIS: [
    { v: 'NONE', l: '없음' },
    { v: 'FULL', l: '전신마비' },
    { v: 'HEMI', l: '편마비' },
  ],
  HYGIENE: [
    { v: 'SELF', l: '스스로 가능' },
    { v: 'TOILET_HELP', l: '화장실에서 도움 필요' },
    { v: 'BED_HELP', l: '침대에서 도움 필요' },
    { v: 'FULL_HELP', l: '전적인 도움 필요' },
    { v: 'ETC', l: '기타' },
  ],
  MEAL: [
    { v: 'SELF', l: '스스로 가능' },
    { v: 'PREP_HELP', l: '식사 준비 도움 필요' },
    { v: 'FEED_HELP', l: '입에 넣어드려야 함' },
    { v: 'NASOGASTRIC', l: '콧줄(L-tube)' },
    { v: 'PEG', l: '뱃줄(PEG)' },
    { v: 'ETC', l: '기타' },
  ],
  TOILET: [
    { v: 'SELF', l: '스스로 가능' },
    { v: 'AFTER_CARE', l: '뒷처리만 도움' },
    { v: 'URINAL', l: '소변통 도움' },
    { v: 'DIAPER', l: '기저귀 사용' },
    { v: 'CATHETER', l: '소변주머니 도움' },
    { v: 'ETC', l: '기타' },
  ],
  EXERCISE: [
    { v: 'SELF', l: '스스로 가능' },
    { v: 'SUPPORT', l: '옆에서 부축 필요' },
    { v: 'CANE_WHEELCHAIR', l: '지팡이/휠체어 보조' },
    { v: 'POSITION_CHANGE', l: '침대 내 자세 변경' },
    { v: 'FULL_HELP', l: '전적으로 도움 필요' },
    { v: 'ETC', l: '기타' },
  ],
  HOSP_REASON: [
    { v: 'DISEASE', l: '질병' },
    { v: 'TRAFFIC', l: '교통사고' },
    { v: 'INDUSTRIAL', l: '산업/근로자재해' },
    { v: 'GENERAL', l: '일반사고' },
    { v: 'ETC', l: '기타' },
  ],
  COVID: [
    { v: 'CONFIRM_NEEDED', l: '확인 필요' },
    { v: 'TEST_NEEDED', l: '검사 필요' },
    { v: 'QUESTIONNAIRE_ONLY', l: '열 체크/문진표만' },
    { v: 'NONE', l: '필요 없음' },
  ],
  VACCINE: [
    { v: 'CONFIRM_NEEDED', l: '확인 필요' },
    { v: 'NONE', l: '필요 없음' },
  ],
};

const PREFERRED_SERVICE_OPTIONS = [
  { v: 'EXERCISE', l: '운동 보조(산책)' },
  { v: 'COMPANION', l: '말벗' },
  { v: 'TIDY', l: '간단한 주변 정리' },
  { v: 'MEDICATION', l: '투약 보조' },
];

const RELATION_OPTIONS = ['본인', '배우자', '자녀', '부모', '형제·자매', '친척', '지인', '기타'];

const WAGE_TYPE_OPTIONS = [
  { v: 'MONTHLY_24H', l: '24시간 근무 월급' },
  { v: 'MONTHLY_12H', l: '12시간 근무 월급' },
  { v: 'MONTHLY_1H', l: '1시간 근무 월급' },
];

/* ------------------------------------------------------------------ */
/*  Diagnosis Options                                                  */
/* ------------------------------------------------------------------ */
const DIAGNOSIS_CATEGORIES = [
  {
    label: "감염성 질환",
    items: ["CRE", "VRE", "MRSA", "결핵", "COVID-19", "간염(A/B/C형)", "HIV/AIDS", "패혈증"],
  },
  {
    label: "암/종양",
    items: [
      "위암", "폐암", "간암", "대장암", "유방암", "췌장암", "갑상선암",
      "전립선암", "방광암", "자궁암", "뇌종양", "혈액암(백혈병)", "림프종",
      "기타 암",
    ],
  },
  {
    label: "뇌/신경계 질환",
    items: [
      "뇌졸중(뇌경색/뇌출혈)", "치매(알츠하이머)", "파킨슨병",
      "뇌손상/두부외상", "간질(뇌전증)", "척수손상", "다발성경화증",
      "근위축성측삭경화증(ALS)",
    ],
  },
  {
    label: "근골격계 질환",
    items: [
      "골절(대퇴골/척추/골반 등)", "관절염", "디스크(추간판탈출증)",
      "골다공증", "인공관절수술", "척추수술 후",
    ],
  },
  {
    label: "심혈관 질환",
    items: [
      "심근경색", "심부전", "부정맥", "협심증", "고혈압", "대동맥질환",
    ],
  },
  {
    label: "호흡기 질환",
    items: ["폐렴", "만성폐쇄성폐질환(COPD)", "천식", "폐섬유증", "기관지확장증"],
  },
  {
    label: "소화기 질환",
    items: ["간경화", "장폐색", "크론병", "궤양성대장염", "췌장염"],
  },
  {
    label: "내분비/대사 질환",
    items: ["당뇨병(1형/2형)", "갑상선질환", "신부전/투석"],
  },
  {
    label: "정신건강 질환",
    items: ["우울증", "조현병", "양극성장애", "불안장애"],
  },
  {
    label: "기타",
    items: [
      "욕창", "연하장애(삼킴곤란)", "인공호흡기", "기관절개 상태",
      "비위관(L-tube)", "장루/요루", "수술 후 회복", "노환/노쇠",
      "기타(직접입력)",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Region Options                                                     */
/* ------------------------------------------------------------------ */
const REGION_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const MAP_BASE = "https://massage.phantomdesign.kr/assets/images/region";
const REGION_MAP_IMGS: Record<string, string> = {
  서울: `${MAP_BASE}/map01.png`, 경기: `${MAP_BASE}/map02.png`,
  인천: `${MAP_BASE}/map03.png`, 대전: `${MAP_BASE}/map04.png`,
  대구: `${MAP_BASE}/map05.png`, 부산: `${MAP_BASE}/map06.png`,
  광주: `${MAP_BASE}/map07.png`, 울산: `${MAP_BASE}/map08.png`,
  세종: `${MAP_BASE}/map09.png`, 강원: `${MAP_BASE}/map10.png`,
  충북: `${MAP_BASE}/map11.png`, 충남: `${MAP_BASE}/map12.png`,
  전북: `${MAP_BASE}/map13.png`, 전남: `${MAP_BASE}/map14.png`,
  경북: `${MAP_BASE}/map15.png`, 경남: `${MAP_BASE}/map16.png`,
  제주: `${MAP_BASE}/map17.png`,
};

/* ------------------------------------------------------------------ */
/*  Care Type Options                                                  */
/* ------------------------------------------------------------------ */
const CARE_TYPES = [
  {
    value: "hospital",
    label: "병원간병",
    desc: "입원 환자를 위한 전문 병원 간병",
    emoji: "🏥",
  },
  {
    value: "home",
    label: "재택간병",
    desc: "자택에서 받는 전문 재택 간병",
    emoji: "🏠",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
interface Props {
  onSubmit?: (data: CareRequestFormData) => void;
  submitting?: boolean;
}

interface SavedPatient {
  id: string;
  name: string;
  birthDate?: string;
  gender?: string;
  weight?: number | null;
  height?: number | null;
  consciousness?: string | null;
  hasDementia?: boolean;
  dementiaLevel?: string | null;
  hasInfection?: boolean;
  infectionDetail?: string | null;
  mobilityStatus?: string | null;
  medicalNotes?: string | null;
  diagnosis?: string | null;
  // 신규 환자 상태 필드 (DB 추가됨)
  diagnoses?: string[] | null;
  infections?: string[] | null;
  roomType?: string | null;
  roomTypeEtc?: string | null;
  longTermCareGrade?: string | null;
  hasSurgery?: boolean | null;
  treatments?: string[] | null;
  treatmentsEtc?: string | null;
  paralysisStatus?: string | null;
  hygieneStatus?: string | null;
  hygieneStatusEtc?: string | null;
  mealStatus?: string | null;
  mealStatusEtc?: string | null;
  toiletStatus?: string | null;
  toiletStatusEtc?: string | null;
  exerciseStatus?: string | null;
  exerciseStatusEtc?: string | null;
  hasDelirium?: boolean | null;
  hasBedsore?: boolean | null;
  needsSuction?: boolean | null;
  hasStoma?: boolean | null;
  hospitalizationReason?: string | null;
  hospitalizationReasonEtc?: string | null;
  covidTestRequirement?: string | null;
  vaccineCheckRequirement?: string | null;
  // 최근 간병 요청 (가장 최근 1건의 신청인-환자 관계 / 희망 서비스 등 자동 채움용)
  careRequests?: Array<{
    id: string;
    status: string;
    careType?: string | null;
    scheduleType?: string | null;
    location?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    relationToPatient?: string | null;
    preferredServices?: string[] | null;
    preferredGender?: string | null;
    specialRequirements?: string | null;
    dailyRate?: number | null;
  }>;
}

// ── Daum 우편번호 (Postcode) 동적 로드 + 팝업 ──
const DAUM_POSTCODE_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

interface DaumPostcodeResult {
  address: string;          // 도로명 주소 (기본)
  jibunAddress: string;     // 지번 주소
  zonecode: string;         // 우편번호 (5자리)
  bname: string;            // 동·읍·면
  sido: string;             // 시·도
  sigungu: string;          // 시·군·구
  buildingName?: string;
}

let daumScriptPromise: Promise<void> | null = null;
function loadDaumPostcode(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('SSR');
  if ((window as any).daum?.Postcode) return Promise.resolve();
  if (daumScriptPromise) return daumScriptPromise;
  daumScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = DAUM_POSTCODE_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      daumScriptPromise = null;
      reject(new Error('Daum 우편번호 스크립트 로드 실패'));
    };
    document.head.appendChild(s);
  });
  return daumScriptPromise;
}

function openDaumPostcode(onComplete: (data: DaumPostcodeResult) => void) {
  loadDaumPostcode()
    .then(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Postcode = (window as any).daum.Postcode;
      new Postcode({
        oncomplete: (data: DaumPostcodeResult) => {
          onComplete(data);
        },
      }).open();
    })
    .catch((e) => {
      alert(typeof e === 'string' ? e : (e?.message || '주소 검색을 불러올 수 없습니다.'));
    });
}

// ── 환자 상태 입력용 헬퍼 컴포넌트 ──
function YesNoToggle({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      <div className="flex gap-2">
        {[
          { v: 'YES', l: '예' },
          { v: 'NO', l: '아니요' },
        ].map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium border ${value === o.v ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-300 text-gray-600'}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function RadioRow({ label, options, value, onChange }: { label: string; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${value === o.v ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-300 text-gray-600'}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function RadioWithEtc({ label, options, value, etcValue, onChange, onEtcChange, required = false }: { label: string; options: { v: string; l: string }[]; value: string; etcValue: string; onChange: (v: string) => void; onEtcChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${value === o.v ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-300 text-gray-600'}`}>
            {o.l}
          </button>
        ))}
      </div>
      {value === 'ETC' && (
        <input type="text" className="input-field mt-2" placeholder="직접 입력"
          value={etcValue} onChange={(e) => onEtcChange(e.target.value)} />
      )}
    </div>
  );
}

export default function CareRequestForm({ onSubmit, submitting = false }: Props) {
  const [form, setForm] = useState<CareRequestFormData>(initialFormData);
  const [step, setStep] = useState(1);
  const [diagSearch, setDiagSearch] = useState("");
  const [savedPatients, setSavedPatients] = useState<SavedPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  const totalSteps = 4;

  // 등록된 환자 목록 불러오기
  useEffect(() => {
    (async () => {
      try {
        const res = await guardianAPI.getPatients();
        const list = res.data?.data || res.data || [];
        if (Array.isArray(list)) setSavedPatients(list);
      } catch {
        // 로그인 안 된 상태 등은 조용히 무시
      }
    })();
  }, []);

  // 기존 환자 선택 시 폼 자동 채움
  const applyPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    if (!patientId) return;
    const p = savedPatients.find((x) => x.id === patientId);
    if (!p) return;
    // 나이 계산 (birthDate → 만 나이)
    let age = "";
    if (p.birthDate) {
      const b = new Date(p.birthDate);
      const now = new Date();
      let a = now.getFullYear() - b.getFullYear();
      const m = now.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
      age = String(a);
    }
    // gender: M/F → male/female
    const genderMap: Record<string, string> = { M: "male", F: "female", male: "male", female: "female" };
    // mobilityStatus: INDEPENDENT / PARTIAL / DEPENDENT → independent/partial/bedridden
    const mobilityMap: Record<string, string> = {
      INDEPENDENT: "independent",
      PARTIAL: "partial",
      DEPENDENT: "bedridden",
    };
    // 진단명: 신규 diagnoses[] 우선, 없으면 레거시 diagnosis (콤마구분 String)
    const rawDiagnosisList = Array.isArray(p.diagnoses) && p.diagnoses.length > 0
      ? p.diagnoses
      : (p.diagnosis ? p.diagnosis.split(",").map((s) => s.trim()).filter(Boolean) : []);
    // "기타: <텍스트>" 형태 분리 — UI는 "기타(직접입력)" 토글 + diagnosisEtc 입력값으로 표현
    let restoredEtc = "";
    const diagnosisList = rawDiagnosisList.map((item) => {
      if (typeof item === "string" && item.startsWith("기타:")) {
        restoredEtc = item.slice(3).trim();
        return "기타(직접입력)";
      }
      return item;
    });

    // boolean → YES/NO 문자열 (UI 형식)
    const yn = (v: boolean | null | undefined): string =>
      v === true ? 'YES' : v === false ? 'NO' : '';

    setForm((prev) => ({
      ...prev,
      patientName: p.name || "",
      patientAge: age,
      patientGender: genderMap[p.gender || ""] || "",
      patientWeight: p.weight ? String(p.weight) : "",
      patientHeight: p.height ? String(p.height) : "",
      consciousness: p.consciousness || "",
      hasDementia: !!p.hasDementia,
      dementiaLevel: p.dementiaLevel || "",
      hasInfection: !!p.hasInfection,
      infectionDetails: p.infectionDetail || "",
      mobility: mobilityMap[p.mobilityStatus || ""] || "",
      specialNotes: p.medicalNotes || "",
      diagnosis: diagnosisList,
      diagnosisEtc: restoredEtc,
      // ── 신규 환자 상태 필드 모두 복원
      infections: Array.isArray(p.infections) ? p.infections : [],
      infectionsEtc: "",
      roomType: p.roomType || "",
      roomTypeEtc: p.roomTypeEtc || "",
      longTermCareGrade: p.longTermCareGrade || "",
      hasSurgery: yn(p.hasSurgery),
      treatments: Array.isArray(p.treatments) ? p.treatments : [],
      treatmentsEtc: p.treatmentsEtc || "",
      paralysisStatus: p.paralysisStatus || "",
      hygieneStatus: p.hygieneStatus || "",
      hygieneStatusEtc: p.hygieneStatusEtc || "",
      mealStatus: p.mealStatus || "",
      mealStatusEtc: p.mealStatusEtc || "",
      toiletStatus: p.toiletStatus || "",
      toiletStatusEtc: p.toiletStatusEtc || "",
      exerciseStatus: p.exerciseStatus || "",
      exerciseStatusEtc: p.exerciseStatusEtc || "",
      hasDelirium: yn(p.hasDelirium),
      hasBedsore: yn(p.hasBedsore),
      needsSuction: yn(p.needsSuction),
      hasStoma: yn(p.hasStoma),
      hospitalizationReason: p.hospitalizationReason || "",
      hospitalizationReasonEtc: p.hospitalizationReasonEtc || "",
      covidTestRequirement: p.covidTestRequirement || "",
      vaccineCheckRequirement: p.vaccineCheckRequirement || "",
    }));

    // 가장 최근 간병 요청에서 신청인-환자 관계 / 희망 서비스 / 선호 성별 자동 채움
    const latestReq = Array.isArray(p.careRequests) && p.careRequests.length > 0
      ? p.careRequests[0]
      : null;
    if (latestReq) {
      const preferredGenderMap: Record<string, string> = { M: 'male', F: 'female' };
      setForm((prev) => ({
        ...prev,
        relationToPatient: latestReq.relationToPatient || prev.relationToPatient || "",
        preferredServices: Array.isArray(latestReq.preferredServices) ? latestReq.preferredServices : (prev.preferredServices || []),
        preferredGender: latestReq.preferredGender ? (preferredGenderMap[latestReq.preferredGender] || prev.preferredGender) : prev.preferredGender,
      }));
    }
  };

  const update = (
    field: keyof CareRequestFormData,
    value: string | boolean | string[]
  ) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // careType 변경 시 locationType 자동 동기화 (hospital → hospital, home → home)
      if (field === 'careType' && (value === 'hospital' || value === 'home')) {
        next.locationType = value as string;
        // 다른 유형으로 바꾸면 이전 장소명도 초기화 (사용자 혼선 방지)
        if (prev.careType !== value) {
          next.locationName = '';
          next.locationAddress = '';
        }
      }
      return next;
    });
  };

  const toggleDiagnosis = (item: string) => {
    setForm((prev) => {
      const has = prev.diagnosis.includes(item);
      return {
        ...prev,
        diagnosis: has
          ? prev.diagnosis.filter((d) => d !== item)
          : [...prev.diagnosis, item],
      };
    });
  };

  // 다중 선택 토글 (infections, treatments, preferredServices 등)
  const toggleMulti = (field: keyof CareRequestFormData, value: string) => {
    setForm((prev) => {
      const current = prev[field] as string[];
      const has = current.includes(value);
      return {
        ...prev,
        [field]: has ? current.filter((x) => x !== value) : [...current, value],
      } as CareRequestFormData;
    });
  };

  const validateAll = (): string | null => {
    // Step 1 - 환자 정보
    if (!form.patientName?.trim()) return "환자 이름을 입력해주세요.";
    if (!form.patientAge?.trim()) return "환자 나이를 입력해주세요.";
    if (!form.patientGender) return "환자 성별을 선택해주세요.";
    if (!form.consciousness) return "환자 의식상태를 선택해주세요.";
    if (!form.mobility) return "환자 거동상태를 선택해주세요.";
    if (form.hasDementia && !form.dementiaLevel) return "치매 정도를 선택해주세요.";
    if (form.hasInfection && !form.infectionDetails?.trim()) return "감염 세부사항을 입력해주세요.";
    if (!form.hospitalizationReason) return "입원 사유를 선택해주세요.";
    if (form.hospitalizationReason === 'ETC' && !form.hospitalizationReasonEtc?.trim()) {
      return "입원 사유의 기타 내용을 입력해주세요.";
    }
    if (form.diagnosis.includes("기타(직접입력)") && !form.diagnosisEtc?.trim()) {
      return "기타 진단명을 직접 입력해주세요.";
    }
    // Step 2 - 간병 유형
    if (!form.careType) return "간병 유형을 선택해주세요.";
    if (!form.careSchedule) return "간병 스케줄을 선택해주세요.";
    if (form.careSchedule === "hourly" && (!form.hourlyStart || !form.hourlyEnd)) {
      return "시간제 간병의 시작/종료 시간을 입력해주세요.";
    }
    // Step 3 - 장소·일정 (locationType은 careType에서 파생)
    if (!form.locationName?.trim()) return "장소명을 입력해주세요.";
    if (!form.regions || form.regions.length === 0) return "지역을 한 곳 이상 선택해주세요.";
    if (!form.startDate) return "시작일을 선택해주세요.";
    if (!form.duration?.trim()) return "간병 기간을 입력해주세요.";
    // Step 4 - 동의
    if (!form.disclaimerChecked) return "의료행위 금지 안내 동의에 체크해주세요.";
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 중복 제출 방지: 이미 제출 중이면 무시
    if (submitting) return;
    const err = validateAll();
    if (err) {
      alert(err);
      return;
    }
    onSubmit?.(form);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return (
          form.patientName &&
          form.patientAge &&
          form.patientGender &&
          form.consciousness &&
          form.mobility &&
          form.hospitalizationReason &&
          (form.hospitalizationReason !== 'ETC' || !!form.hospitalizationReasonEtc?.trim())
        );
      case 2:
        return form.careType && form.careSchedule
          && (form.careSchedule !== "hourly" || (!!form.hourlyStart && !!form.hourlyEnd));
      case 3:
        return (
          form.locationName &&
          form.regions.length > 0 &&
          form.startDate &&
          form.duration
        );
      case 4:
        return form.disclaimerChecked;
      default:
        return false;
    }
  };

  const stepLabels = [
    "환자 정보",
    "간병 유형",
    "위치 및 일정",
    "확인 및 제출",
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Progress bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <React.Fragment key={i}>
            <div
              className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                i + 1 <= step
                  ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
                  : "bg-gray-200 text-gray-500"
              }`}
              onClick={() => {
                if (i + 1 < step) setStep(i + 1);
              }}
            >
              {i + 1 < step ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < totalSteps - 1 && (
              <div
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i + 1 < step ? "bg-primary-500" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="text-sm font-semibold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
          {step}단계
        </div>
        <div className="text-sm font-medium text-gray-500">
          {stepLabels[step - 1]}
        </div>
      </div>

      {/* ==================== Step 1: Patient info ==================== */}
      {step === 1 && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900">환자 정보</h3>

          {/* 기존 환자 선택 */}
          {savedPatients.length > 0 && (
            <div className="rounded-xl border-2 border-primary-100 bg-primary-50/40 p-4">
              <label className="block text-sm font-semibold text-primary-800 mb-2">
                ⚡ 기존 등록 환자에서 불러오기
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="input-field flex-1"
                  value={selectedPatientId}
                  onChange={(e) => applyPatient(e.target.value)}
                >
                  <option value="">-- 신규로 직접 입력 --</option>
                  {savedPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.birthDate
                        ? ` (${new Date(p.birthDate).toLocaleDateString("ko-KR")})`
                        : ""}
                      {p.diagnosis ? ` · ${p.diagnosis.split(",")[0]}` : ""}
                    </option>
                  ))}
                </select>
                {selectedPatientId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatientId("");
                      setForm(initialFormData);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    초기화
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                환자를 선택하면 기본 정보가 자동으로 입력됩니다. 아래 필드에서 수정 가능합니다.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                환자 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="환자 이름 입력"
                value={form.patientName}
                onChange={(e) => update("patientName", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                나이 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="나이 입력"
                value={form.patientAge}
                onChange={(e) => update("patientAge", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                성별 <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={form.patientGender}
                onChange={(e) => update("patientGender", e.target.value)}
              >
                <option value="">선택하세요</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                체중 (kg)
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="체중 입력"
                value={form.patientWeight}
                onChange={(e) => update("patientWeight", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                키 (cm)
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="키 입력"
                value={form.patientHeight}
                onChange={(e) => update("patientHeight", e.target.value)}
              />
            </div>
          </div>

          {/* Consciousness */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              의식 상태 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {[
                { value: "clear", label: "명료" },
                { value: "drowsy", label: "기면" },
                { value: "stupor", label: "혼미" },
                { value: "coma", label: "혼수" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 cursor-pointer transition-all text-xs sm:text-sm font-medium ${
                    form.consciousness === opt.value
                      ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="consciousness"
                    value={opt.value}
                    checked={form.consciousness === opt.value}
                    onChange={(e) => update("consciousness", e.target.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Mobility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              거동 상태 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {[
                { value: "independent", label: "독립 보행" },
                { value: "assisted", label: "보조 보행" },
                { value: "wheelchair", label: "휠체어" },
                { value: "bedridden", label: "거동 불가" },
                { value: "partial", label: "부분 거동" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 cursor-pointer transition-all text-xs sm:text-sm font-medium ${
                    form.mobility === opt.value
                      ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="mobility"
                    value={opt.value}
                    checked={form.mobility === opt.value}
                    onChange={(e) => update("mobility", e.target.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Diagnosis Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              진단명 / 질환 선택 (복수 선택 가능)
            </label>

            {/* Search box */}
            <input
              type="text"
              className="input-field mb-3"
              placeholder="질환명 검색 (예: 골절, 치매, 암 ...)"
              value={diagSearch}
              onChange={(e) => setDiagSearch(e.target.value)}
            />

            {/* Selected tags */}
            {form.diagnosis.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.diagnosis.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-100 text-primary-700 text-sm font-medium rounded-lg"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => toggleDiagnosis(d)}
                      className="ml-1 text-primary-500 hover:text-primary-700"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 기타(직접입력) 선택 시 추가 입력란 */}
            {form.diagnosis.includes("기타(직접입력)") && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  기타 진단명 직접 입력
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="예: 파킨슨 합병증, 다발성 외상 등"
                  value={form.diagnosisEtc}
                  onChange={(e) => update("diagnosisEtc", e.target.value)}
                />
              </div>
            )}

            {/* Category grid */}
            <div className="border border-gray-200 rounded-xl max-h-72 overflow-y-auto">
              {DIAGNOSIS_CATEGORIES.map((cat) => {
                const filtered = diagSearch
                  ? cat.items.filter((item) =>
                      item.toLowerCase().includes(diagSearch.toLowerCase())
                    )
                  : cat.items;
                if (filtered.length === 0) return null;
                return (
                  <div key={cat.label} className="border-b border-gray-100 last:border-0">
                    <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
                      {cat.label}
                    </div>
                    <div className="px-4 py-2 flex flex-wrap gap-2">
                      {filtered.map((item) => {
                        const selected = form.diagnosis.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleDiagnosis(item)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              selected
                                ? "bg-primary-500 text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dementia */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasDementia}
                onChange={(e) => update("hasDementia", e.target.checked)}
                className="w-5 h-5 text-primary-500 border-gray-300 rounded focus:ring-primary-400"
              />
              <span className="text-sm font-medium text-gray-700">
                치매 증상이 있습니다
              </span>
            </label>
            {form.hasDementia && (
              <select
                className="input-field"
                value={form.dementiaLevel}
                onChange={(e) => update("dementiaLevel", e.target.value)}
              >
                <option value="">치매 정도를 선택하세요</option>
                <option value="mild">경증 (일상생활 가능)</option>
                <option value="moderate">중등도 (도움 필요)</option>
                <option value="severe">중증 (지속적 관리 필요)</option>
              </select>
            )}
          </div>

          {/* Infection */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasInfection}
                onChange={(e) => update("hasInfection", e.target.checked)}
                className="w-5 h-5 text-primary-500 border-gray-300 rounded focus:ring-primary-400"
              />
              <span className="text-sm font-medium text-gray-700">
                감염성 질환이 있습니다
              </span>
            </label>
            {form.hasInfection && (
              <input
                type="text"
                className="input-field"
                placeholder="감염 질환명을 입력하세요 (예: MRSA, 결핵 등)"
                value={form.infectionDetails}
                onChange={(e) => update("infectionDetails", e.target.value)}
              />
            )}
          </div>

          {/* ===== 신규 환자 상태 섹션 ===== */}
          <div className="border-t border-gray-200 pt-6 space-y-5">
            <h4 className="text-base font-bold text-gray-900">환자 상태 (간병 난이도)</h4>

            {/* 병실 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">병실 종류</label>
              <div className="flex flex-wrap gap-2">
                {PATIENT_STATE_OPTIONS.ROOM_TYPE.map((opt) => (
                  <button key={opt.v} type="button"
                    onClick={() => update('roomType', opt.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.roomType === opt.v ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
              {form.roomType === 'ETC' && (
                <input type="text" className="input-field mt-2" placeholder="병실 직접 입력"
                  value={form.roomTypeEtc} onChange={(e) => update('roomTypeEtc', e.target.value)} />
              )}
            </div>

            {/* 장기요양등급 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">장기요양등급</label>
              <div className="flex flex-wrap gap-2">
                {PATIENT_STATE_OPTIONS.GRADE.map((opt) => (
                  <button key={opt.v} type="button"
                    onClick={() => update('longTermCareGrade', opt.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.longTermCareGrade === opt.v ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* 수술 여부 */}
            <YesNoToggle label="수술 하셨나요?" value={form.hasSurgery} onChange={(v) => update('hasSurgery', v)} />

            {/* 받는 치료 (다중) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">받고 있는 치료 <span className="text-xs text-gray-400">(복수 선택)</span></label>
              <div className="flex flex-wrap gap-2">
                {PATIENT_STATE_OPTIONS.TREATMENTS.map((opt) => (
                  <button key={opt.v} type="button"
                    onClick={() => toggleMulti('treatments', opt.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.treatments.includes(opt.v) ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
              {form.treatments.includes('ETC') && (
                <input type="text" className="input-field mt-2" placeholder="치료 직접 입력"
                  value={form.treatmentsEtc} onChange={(e) => update('treatmentsEtc', e.target.value)} />
              )}
            </div>

            {/* 마비 상태 */}
            <RadioRow label="마비 상태" options={PATIENT_STATE_OPTIONS.PARALYSIS} value={form.paralysisStatus} onChange={(v) => update('paralysisStatus', v)} />

            {/* 위생 / 식사 / 화장실 / 운동 */}
            <RadioWithEtc label="개인 위생 (목욕/세수/양치)" options={PATIENT_STATE_OPTIONS.HYGIENE} value={form.hygieneStatus} etcValue={form.hygieneStatusEtc} onChange={(v) => update('hygieneStatus', v)} onEtcChange={(v) => update('hygieneStatusEtc', v)} />
            <RadioWithEtc label="식사" options={PATIENT_STATE_OPTIONS.MEAL} value={form.mealStatus} etcValue={form.mealStatusEtc} onChange={(v) => update('mealStatus', v)} onEtcChange={(v) => update('mealStatusEtc', v)} />
            <RadioWithEtc label="화장실 이동/이용" options={PATIENT_STATE_OPTIONS.TOILET} value={form.toiletStatus} etcValue={form.toiletStatusEtc} onChange={(v) => update('toiletStatus', v)} onEtcChange={(v) => update('toiletStatusEtc', v)} />
            <RadioWithEtc label="운동/활동" options={PATIENT_STATE_OPTIONS.EXERCISE} value={form.exerciseStatus} etcValue={form.exerciseStatusEtc} onChange={(v) => update('exerciseStatus', v)} onEtcChange={(v) => update('exerciseStatusEtc', v)} />

            {/* 섬망/욕창/석션/장루 */}
            <YesNoToggle label="섬망 증상" value={form.hasDelirium} onChange={(v) => update('hasDelirium', v)} hint="수술 후 약물로 인한 인지/행동 장애" />
            <YesNoToggle label="욕창 증상" value={form.hasBedsore} onChange={(v) => update('hasBedsore', v)} />
            <YesNoToggle label="석션 필요" value={form.needsSuction} onChange={(v) => update('needsSuction', v)} />
            <YesNoToggle label="장루 관리 필요" value={form.hasStoma} onChange={(v) => update('hasStoma', v)} />

            {/* 입원 사유 */}
            <RadioWithEtc required label="입원 사유" options={PATIENT_STATE_OPTIONS.HOSP_REASON} value={form.hospitalizationReason} etcValue={form.hospitalizationReasonEtc} onChange={(v) => update('hospitalizationReason', v)} onEtcChange={(v) => update('hospitalizationReasonEtc', v)} />

            {/* 코로나 / 백신 */}
            <RadioRow label="코로나 검사 여부" options={PATIENT_STATE_OPTIONS.COVID} value={form.covidTestRequirement} onChange={(v) => update('covidTestRequirement', v)} />
            <RadioRow label="백신 접종 확인" options={PATIENT_STATE_OPTIONS.VACCINE} value={form.vaccineCheckRequirement} onChange={(v) => update('vaccineCheckRequirement', v)} />
          </div>
        </div>
      )}

      {/* ==================== Step 2: Care type ==================== */}
      {step === 2 && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900">간병 유형</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              간병 유형 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {CARE_TYPES.map((ct) => (
                <label
                  key={ct.value}
                  className={`relative p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    form.careType === ct.value
                      ? "border-primary-500 bg-primary-50 shadow-md shadow-primary-500/10"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="careType"
                    value={ct.value}
                    checked={form.careType === ct.value}
                    onChange={(e) => update("careType", e.target.value)}
                    className="sr-only"
                  />
                  <div className="text-2xl mb-2">{ct.emoji}</div>
                  <div className="font-semibold text-gray-900">{ct.label}</div>
                  <div className="text-sm text-gray-500 mt-1">{ct.desc}</div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              간병 시간 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <label
                className={`relative p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  form.careSchedule === "24h"
                    ? "border-primary-500 bg-primary-50 shadow-md shadow-primary-500/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="careSchedule"
                  value="24h"
                  checked={form.careSchedule === "24h"}
                  onChange={(e) => update("careSchedule", e.target.value)}
                  className="sr-only"
                />
                <div className="text-2xl mb-2">&#9200;</div>
                <div className="font-semibold text-gray-900 text-sm sm:text-base">24시간 간병</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                  하루 종일 상주하며 케어합니다
                </div>
              </label>
              <label
                className={`relative p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  form.careSchedule === "hourly"
                    ? "border-primary-500 bg-primary-50 shadow-md shadow-primary-500/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="careSchedule"
                  value="hourly"
                  checked={form.careSchedule === "hourly"}
                  onChange={(e) => update("careSchedule", e.target.value)}
                  className="sr-only"
                />
                <div className="text-2xl mb-2">&#128337;</div>
                <div className="font-semibold text-gray-900 text-sm sm:text-base">시간제 간병</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                  필요한 시간만 선택하여 이용합니다
                </div>
              </label>
            </div>
          </div>

          {form.careSchedule === "hourly" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  시작 시간
                </label>
                <input
                  type="time"
                  className="input-field"
                  value={form.hourlyStart}
                  onChange={(e) => update("hourlyStart", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  종료 시간
                </label>
                <input
                  type="time"
                  className="input-field"
                  value={form.hourlyEnd}
                  onChange={(e) => update("hourlyEnd", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ===== 신규: 신청인 관계 / 희망 서비스 ===== */}
          <div className="border-t border-gray-200 pt-6 space-y-5">
            <h4 className="text-base font-bold text-gray-900">신청인 정보 · 희망 사항</h4>

            {/* 환자와의 관계 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">신청인과 환자의 관계</label>
              <div className="flex flex-wrap gap-2">
                {RELATION_OPTIONS.map((r) => (
                  <button key={r} type="button" onClick={() => update('relationToPatient', r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.relationToPatient === r ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 희망 서비스 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">희망 서비스 <span className="text-xs text-gray-400">(복수 선택)</span></label>
              <div className="flex flex-wrap gap-2">
                {PREFERRED_SERVICE_OPTIONS.map((opt) => (
                  <button key={opt.v} type="button" onClick={() => toggleMulti('preferredServices', opt.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.preferredServices.includes(opt.v) ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Step 3: Location & Schedule ==================== */}
      {step === 3 && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900">위치 및 일정</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {form.locationType === "hospital" ? "병원명" : "주소"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder={
                  form.locationType === "hospital"
                    ? "병원 이름을 입력하거나 주소 검색"
                    : "주소 검색을 눌러주세요"
                }
                value={form.locationName}
                onChange={(e) => update("locationName", e.target.value)}
                readOnly={form.locationType === 'home'}
              />
              <button
                type="button"
                onClick={() => openDaumPostcode((data) => {
                  update('locationName', data.address);
                  // 자치구가 있으면 region 자동 채움
                  if (data.sido && data.sigungu) {
                    const region = `${data.sido} ${data.sigungu}`;
                    if (!form.regions.includes(region)) {
                      update('regions', [...form.regions, region]);
                    }
                  }
                })}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium whitespace-nowrap"
              >
                🔍 주소 검색
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">우편번호 검색으로 정확한 주소를 입력해주세요.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              상세 주소
            </label>
            <input
              type="text"
              className="input-field"
              placeholder={form.locationType === "home" ? "동, 호수 상세주소 입력" : "병동, 호실 등 상세 주소 입력"}
              value={form.locationAddress}
              onChange={(e) => update("locationAddress", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              지역 <span className="text-red-500">*</span>
              {form.regions.length > 0 && (
                <span className="ml-2 text-xs text-primary-500 font-normal">
                  {form.regions.join(", ")} 선택됨
                </span>
              )}
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
              {REGION_OPTIONS.map((r) => {
                const active = form.regions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      update(
                        "regions",
                        active
                          ? form.regions.filter((x) => x !== r)
                          : [...form.regions, r]
                      )
                    }
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all ${
                      active
                        ? "border-primary-400 bg-primary-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-primary-300"
                    }`}
                  >
                    <div
                      className="w-8 h-[30px] bg-no-repeat bg-center"
                      style={{
                        backgroundImage: `url('${REGION_MAP_IMGS[r]}')`,
                        backgroundSize: "100% 200%",
                        backgroundPosition: active ? "center bottom" : "center top",
                      }}
                    />
                    <span className={`text-[10px] font-bold leading-none ${active ? "text-primary-600" : "text-gray-600"}`}>
                      {r}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="input-field"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                기간 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="숫자 입력"
                min="1"
                value={form.duration}
                onChange={(e) => update("duration", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                단위
              </label>
              <select
                className="input-field"
                value={form.durationUnit}
                onChange={(e) => update("durationUnit", e.target.value)}
              >
                <option value="days">일</option>
                <option value="weeks">주</option>
                <option value="months">개월</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Step 4: Preferences & Disclaimer ==================== */}
      {step === 4 && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900">선호 사항 및 확인</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              제시 일당 (원) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                className="input-field pr-8"
                placeholder="예: 150000"
                min="0"
                value={form.dailyRate}
                onChange={(e) => update("dailyRate", e.target.value)}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">간병인에게 제시할 하루 금액. 간병인이 다른 금액을 역제안할 수 있습니다.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                선호 성별
              </label>
              <select
                className="input-field"
                value={form.preferredGender}
                onChange={(e) => update("preferredGender", e.target.value)}
              >
                <option value="">무관</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                선호 국적
              </label>
              <select
                className="input-field"
                value={form.preferredNationality}
                onChange={(e) =>
                  update("preferredNationality", e.target.value)
                }
              >
                <option value="">무관</option>
                <option value="korean">한국인</option>
                <option value="chinese">중국 (조선족)</option>
                <option value="other">기타</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              특이사항
            </label>
            <textarea
              className="input-field min-h-[120px] resize-y"
              placeholder="추가로 알려야 할 사항이 있으면 입력해주세요 (예: 식이조절 필요, 야간 관찰 필요 등)"
              value={form.specialNotes}
              onChange={(e) => update("specialNotes", e.target.value)}
            />
          </div>

          {/* Medical act disclaimer */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-amber-500 text-xl mt-0.5">&#9888;</span>
              <h4 className="text-base font-bold text-amber-800">
                의료행위 불가 안내
              </h4>
            </div>
            <div className="text-sm text-amber-900 leading-relaxed space-y-2 mb-5">
              <p>
                본 플랫폼의 간병사는 「의료법」상 의료인이 아니므로 의료행위를
                수행할 수 없습니다.
              </p>
              <p>
                보호자가 의료행위를 요청하거나 간병사가 이를 수행할 경우, 관련
                법령에 따라 법적 책임이 발생할 수 있습니다.
              </p>
              <p>
                의료행위(석션, 도뇨관 삽입·교체, 주사, 투약 등)는 반드시
                의료기관 또는 의료인을 통해 진행해 주시기 바랍니다.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.disclaimerChecked}
                onChange={(e) => update("disclaimerChecked", e.target.checked)}
                className="w-5 h-5 mt-0.5 text-primary-500 border-gray-300 rounded focus:ring-primary-400"
              />
              <span className="text-sm font-semibold text-amber-900">
                위 내용을 확인하였으며, 의료행위는 간병사가 수행할 수 없음을
                동의합니다.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="btn-secondary"
          >
            이전 단계
          </button>
        ) : (
          <div />
        )}

        {step < totalSteps ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="btn-primary"
          >
            다음 단계
          </button>
        ) : (
          <button
            type="submit"
            disabled={!form.disclaimerChecked || submitting}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                제출 중...
              </span>
            ) : (
              "간병 요청 제출"
            )}
          </button>
        )}
      </div>
    </form>
  );
}
