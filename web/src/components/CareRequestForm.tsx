"use client";

import React, { useState } from "react";

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
};

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
  {
    value: "visit",
    label: "방문요양",
    desc: "요양이 필요한 분을 위한 방문요양",
    emoji: "💝",
  },
  {
    value: "daily",
    label: "생활돌봄",
    desc: "일상생활 지원 돌봄 서비스",
    emoji: "🤝",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
interface Props {
  onSubmit?: (data: CareRequestFormData) => void;
}

export default function CareRequestForm({ onSubmit }: Props) {
  const [form, setForm] = useState<CareRequestFormData>(initialFormData);
  const [step, setStep] = useState(1);
  const [diagSearch, setDiagSearch] = useState("");

  const totalSteps = 4;

  const update = (
    field: keyof CareRequestFormData,
    value: string | boolean | string[]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  const validateAll = (): string | null => {
    // Step 1 - 환자 정보
    if (!form.patientName?.trim()) return "환자 이름을 입력해주세요.";
    if (!form.patientAge?.trim()) return "환자 나이를 입력해주세요.";
    if (!form.patientGender) return "환자 성별을 선택해주세요.";
    if (!form.consciousness) return "환자 의식상태를 선택해주세요.";
    if (!form.mobility) return "환자 거동상태를 선택해주세요.";
    if (form.hasDementia && !form.dementiaLevel) return "치매 정도를 선택해주세요.";
    if (form.hasInfection && !form.infectionDetails?.trim()) return "감염 세부사항을 입력해주세요.";
    // Step 2 - 간병 유형
    if (!form.careType) return "간병 유형을 선택해주세요.";
    if (!form.careSchedule) return "간병 스케줄을 선택해주세요.";
    if (form.careSchedule === "hourly" && (!form.hourlyStart || !form.hourlyEnd)) {
      return "시간제 간병의 시작/종료 시간을 입력해주세요.";
    }
    // Step 3 - 장소·일정
    if (!form.locationType) return "간병 장소 유형을 선택해주세요.";
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
          form.mobility
        );
      case 2:
        return form.careType && form.careSchedule;
      case 3:
        return (
          form.locationType &&
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
        </div>
      )}

      {/* ==================== Step 3: Location & Schedule ==================== */}
      {step === 3 && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900">위치 및 일정</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              간병 장소 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <label
                className={`flex flex-col items-center p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  form.locationType === "hospital"
                    ? "border-primary-500 bg-primary-50 shadow-md shadow-primary-500/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="locationType"
                  value="hospital"
                  checked={form.locationType === "hospital"}
                  onChange={(e) => update("locationType", e.target.value)}
                  className="sr-only"
                />
                <span className="text-3xl mb-2">&#127973;</span>
                <span className="font-semibold text-gray-900">병원</span>
              </label>
              <label
                className={`flex flex-col items-center p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  form.locationType === "home"
                    ? "border-primary-500 bg-primary-50 shadow-md shadow-primary-500/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="locationType"
                  value="home"
                  checked={form.locationType === "home"}
                  onChange={(e) => update("locationType", e.target.value)}
                  className="sr-only"
                />
                <span className="text-3xl mb-2">&#127968;</span>
                <span className="font-semibold text-gray-900">자택</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {form.locationType === "hospital" ? "병원명" : "주소"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder={
                form.locationType === "hospital"
                  ? "병원 이름을 입력하세요"
                  : "주소를 입력하세요"
              }
              value={form.locationName}
              onChange={(e) => update("locationName", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              상세 주소
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="병동, 호실 등 상세 주소 입력"
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
            disabled={!form.disclaimerChecked}
            className="btn-primary"
          >
            간병 요청 제출
          </button>
        )}
      </div>
    </form>
  );
}
