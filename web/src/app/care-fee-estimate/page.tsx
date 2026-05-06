"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiArrowLeft, FiSearch, FiCheck, FiHeart, FiAlertCircle, FiActivity, FiShield, FiRefreshCw, FiArrowRight, FiInfo, FiCalendar, FiMapPin } from "react-icons/fi";

// 케어네이션 precalc 와 동일한 시세표 (2024.06 기준 · 내국인 식대 포함)
const PRICE_TABLE: Record<string, { min: number; average: number; max: number }> = {
  "0000": { min: 125000, average: 135000, max: 164000 },
  "0001": { min: 138000, average: 148000, max: 177000 },
  "0010": { min: 127000, average: 140000, max: 178000 },
  "0011": { min: 140000, average: 153000, max: 191000 },
  "0100": { min: 128000, average: 139000, max: 174000 },
  "0101": { min: 141000, average: 153000, max: 187000 },
  "0110": { min: 130000, average: 145000, max: 188000 },
  "0111": { min: 143000, average: 157000, max: 201000 },
  "1000": { min: 135000, average: 145000, max: 174000 },
  "1001": { min: 148000, average: 158000, max: 187000 },
  "1010": { min: 137000, average: 150000, max: 188000 },
  "1011": { min: 150000, average: 163000, max: 201000 },
  "1100": { min: 138000, average: 149000, max: 184000 },
  "1101": { min: 151000, average: 163000, max: 197000 },
  "1110": { min: 140000, average: 155000, max: 198000 },
  "1111": { min: 153000, average: 167000, max: 211000 },
};

const DIAGNOSES = [
  "CRE","VRE","간경변","간경화","간농양","간성혼수","간암","간염","간이식","간질","갈비뼈골절","감기","감염","갑상선암","개두술","거동불가","거동불편","검사","결석","결핵","경련","경막하출혈","경추골절","경추손상","고관절골절","고관절수술","고열","고혈압","골반골절","골수염","골수종","골절","공여","관상동맥","관장","관절염","괴사","교모세포종","교정","교통사고","구강암","구토","궤양","기능저하","기력저하","기형","기흉","길랑바레","깁스","낙상","난소암","난청","낭종","내과","내시경","노환","농양","뇌경색","뇌내출혈","뇌동맥류","뇌병변","뇌손상","뇌수막염","뇌수막종","뇌염","뇌전증","뇌졸중","뇌종양","뇌진탕","뇌출혈","뇌하수체종양","다리골절","다발골수종","다발성근육염","담관암","담낭암","담낭염","담도암","담석","당뇨","당뇨합병증","대동맥류","대동맥박리","대동맥판막","대장암","대퇴골두무혈성괴사","대퇴부골절","동맥류","두경부암","디스크","디스크수술","디스크파열","루게릭","루게릭병","류마티스","림프암","림프종","마비","만성폐쇄성폐질환","말기암","망상","모야모야","목디스크","무릎관절수술","무릎수술","무릎연골수술","무릎인공관절수술","무지외반증","물리치료","물혹","발목골절","발목수술","방광암","방광염","백내장","백혈병","변비","복강경","복막염","복수","봉합","부상","부인과","부작용","부정맥","부종","분만","비뇨기과","빈혈","사지마비","상세불명","상해","색전술","석션","선종","설사","설암","섬망","소뇌위축","소변줄","손목골절","손상","쇠약","쇼크","수두증","수면장애","수술","스텐트","시각장애","식도암","식물인간","신경손상","신경외과","신부전","신우신염","신장결석","신장암","신장이식","신장질환","실금","심근경색","심부전","심장질환","심장판막","심정지","심혈관질환","십자인대파열","안과","알츠하이머","양악","어지러움증","어지럼증","언어장애","염좌","염증","옴","와상","외상","외상성뇌출혈","요관암","요로감염","요로결석","요실금","요양","욕창","용종","우울증","위루관","위암","유방암","육종","의식불명","이식","이식수술","이형성증","인공관절","인공관절수술","인대파열","인두암","입원","자궁경부암","자궁근종","자궁내막암","자궁내막증","자궁선근증","자궁암","자궁적출","자상","장루","장애","장염","장폐색","재건술","재활","저산소증","저혈당","저혈압","적출","전립선비대","전립선암","절개","절단","절제","제거","제왕절개","조영술","조직검사","조현병","종양","중풍","중환자","지병","지주막하출혈","지체장애","직장암","척수손상","척수염","척수증","척추골절","척추관협착증","척추손상","척추수술","척추압박골절","척추전방전위증","척추협착","천공","천포창","출산","출혈","췌장암","췌장염","측만","치매","치질","코로나","타박상","탈구","탈수","탈장","탈출","통증","통풍","퇴행성관절염","투석","파열","파킨슨","판막수술","팔골절","패혈증","편마비","폐결핵","폐렴","폐부종","폐색","폐섬유","폐암","폐이식","폐질환","피부암","피부이식","하반신마비","합병증","항암","허리골절","허리디스크","허리디스크수술","허리수술","허리염좌","허리협착증","혈관질환","혈변","혈액암","혈액투석","혈전","협심증","협착","협착증","호흡곤란","호흡기질환","호흡부전","화상","황달","회복","회전근개파열","후두암","후유증","흉수","흡인성폐렴",
];

const fmt = (n: number) => n.toLocaleString("ko-KR");

function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    startRef.current = null;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const ratio = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setValue(Math.round(target * eased));
      if (ratio < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const QUESTIONS = [
  { key: "suction", title: "석션 또는 피딩이 필요한가요?", short: "석션·피딩", desc: "기관 흡인·경관 영양 관리 필요 여부", icon: FiActivity, color: "from-rose-50 to-rose-100", iconColor: "text-rose-500" },
  { key: "dementia", title: "치매·섬망·수면장애가 있나요?", short: "치매·섬망·수면장애", desc: "인지 저하·야간 배회·불면 등", icon: FiAlertCircle, color: "from-amber-50 to-amber-100", iconColor: "text-amber-500" },
  { key: "paralysis", title: "마비 또는 욕창이 있나요?", short: "마비·욕창", desc: "편마비·하반신마비·압박성 궤양 등", icon: FiHeart, color: "from-violet-50 to-violet-100", iconColor: "text-violet-500" },
  { key: "infection", title: "감염성 질환이 있나요?", short: "감염성 질환", desc: "결핵·MRSA·VRE·CRE 등 격리 필요", icon: FiShield, color: "from-emerald-50 to-emerald-100", iconColor: "text-emerald-500" },
] as const;

type AnswerKey = "suction" | "dementia" | "paralysis" | "infection";

function PriceGraph({ result }: { result: { min: number; average: number; max: number } }) {
  const range = result.max - result.min || 1;
  const avgPos = ((result.average - result.min) / range) * 100;
  return (
    <div className="relative">
      <div className="relative h-3 rounded-full bg-gradient-to-r from-amber-100 via-orange-200 to-amber-100">
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${avgPos}%`, transform: `translate(-50%, -50%)` }}>
          <div className="w-5 h-5 rounded-full bg-white border-[3px] border-orange-500 shadow-md" />
        </div>
      </div>
      <div className="flex justify-between mt-3">
        <div className="text-left">
          <div className="text-[11px] text-gray-400 mb-0.5">최소 금액</div>
          <div className="text-sm font-bold text-gray-700 tabular-nums">{fmt(result.min)}원</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-orange-500 font-semibold mb-0.5">평균 금액</div>
          <div className="text-base font-bold text-orange-600 tabular-nums">{fmt(result.average)}원</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-gray-400 mb-0.5">최대 금액</div>
          <div className="text-sm font-bold text-gray-700 tabular-nums">{fmt(result.max)}원</div>
        </div>
      </div>
    </div>
  );
}

export default function CareFeeEstimatePage() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [diagnosis, setDiagnosis] = useState("");
  const [search, setSearch] = useState("");
  const [answers, setAnswers] = useState<Record<AnswerKey, boolean | null>>({ suction: null, dementia: null, paralysis: null, infection: null });
  const [expandedDetail, setExpandedDetail] = useState(true);

  const filteredDiagnoses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DIAGNOSES;
    return DIAGNOSES.filter((d) => d.toLowerCase().includes(q));
  }, [search]);

  const allAnswered = answers.suction !== null && answers.dementia !== null && answers.paralysis !== null && answers.infection !== null;
  const answeredCount = (Object.values(answers) as (boolean | null)[]).filter((v) => v !== null).length;

  const result = useMemo(() => {
    if (!allAnswered) return null;
    const key = [answers.suction ? "1" : "0", answers.dementia ? "1" : "0", answers.paralysis ? "1" : "0", answers.infection ? "1" : "0"].join("");
    return PRICE_TABLE[key] || PRICE_TABLE["0000"];
  }, [answers, allAnswered]);

  const animatedAvg = useCountUp(result?.average || 0, 1500);

  const reset = () => {
    setStep(0);
    setDiagnosis("");
    setSearch("");
    setAnswers({ suction: null, dementia: null, paralysis: null, infection: null });
    setExpandedDetail(true);
  };

  const setAnswer = (key: AnswerKey, value: boolean) => setAnswers((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-orange-50/60 via-white to-emerald-50/40">
      {/* ===== 좌우 분할 레이아웃 (lg+ 만 적용) ===== */}
      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">

          {/* 왼쪽: 비주얼 + 카피 (lg+ sticky) */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 mb-5">
              <Link href="/" className="p-2 rounded-lg hover:bg-gray-100" aria-label="뒤로">
                <FiArrowLeft className="w-5 h-5 text-gray-700" />
              </Link>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                AI 간병비 시세
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-3">
              한눈에 알아보는<br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #FF922E 0%, #FF6B35 100%)" }}>
                예상 간병비
              </span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-5 lg:mb-7">
              진단명과 환자 상태 4가지만 입력하면<br className="hidden sm:block" />
              하루 예상 간병비를 즉시 확인할 수 있습니다.
            </p>

            {/* 비주얼 이미지 */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-orange-50 to-emerald-50 mb-5">
              <Image
                src="/img/care-fee-hero.png"
                alt="간병비 계산 안내"
                width={800}
                height={533}
                priority
                className="w-full h-auto"
              />
            </div>

            {/* 특징 3개 */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: "⚡", title: "30초", desc: "간단한 4문항" },
                { icon: "💰", title: "정확한 시세", desc: "실시간 데이터" },
                { icon: "🛡️", title: "무료", desc: "회원가입 불필요" },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-2xl border border-gray-100 px-3 py-2.5 text-center shadow-sm">
                  <div className="text-xl mb-0.5">{item.icon}</div>
                  <div className="text-xs font-bold text-gray-900">{item.title}</div>
                  <div className="text-[10px] text-gray-500">{item.desc}</div>
                </div>
              ))}
            </div>
          </aside>

          {/* 오른쪽: 인터랙티브 영역 */}
          <main className="lg:col-span-7">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-5">
              {[0, 1, 2].map((s) => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? "bg-primary-500" : "bg-gray-200"}`} />
              ))}
            </div>

            {/* Step 0: 진단명 검색 (케어네이션 스타일) */}
            {step === 0 && (
              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-snug mb-1">
                  진단명이 무엇인가요?
                </h3>
                <p className="text-sm text-gray-500 mb-5">정확한 시세를 위해 환자의 주 진단명을 입력해주세요.</p>

                {/* 검색 카드 */}
                <div className="bg-white rounded-2xl p-5 sm:p-7" style={{ boxShadow: "0 8px 24px 0 rgba(0,0,0,0.06)" }}>
                  {/* 인풋 — 회색 배경 + 우측 검색 아이콘 */}
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="환자 진단명을 입력해 주세요."
                      autoFocus
                      className="w-full pl-4 pr-12 py-3.5 sm:py-4 rounded-lg bg-gray-50 border border-gray-200 text-base focus:border-primary-500 focus:bg-white focus:outline-none transition-colors placeholder:text-gray-400"
                    />
                    <FiSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                  </div>

                  {/* 결과 영역 — 항상 전체 리스트 노출 (검색 시 필터링) */}
                  {filteredDiagnoses.length === 0 ? (
                    // 진단명 없음
                    <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center justify-center py-12 sm:py-16">
                      <div className="text-5xl mb-3" aria-hidden>🔍</div>
                      <p className="text-sm text-gray-500 mb-4">"{search}" 검색 결과가 없습니다.</p>
                      <button
                        type="button"
                        onClick={() => { setDiagnosis(search.trim() || "진단명 없음"); setStep(1); }}
                        className="px-6 py-3 rounded-lg bg-white border-2 border-primary-500 text-primary-600 text-sm font-bold hover:bg-primary-50 transition-colors flex items-center gap-2"
                      >
                        진단명이 없습니다 <FiArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-[11px] text-gray-500">
                          {search.trim() ? <>검색 결과 <span className="font-bold text-gray-900">{filteredDiagnoses.length}</span>건</> : <>전체 <span className="font-bold text-gray-900">{filteredDiagnoses.length}</span>개 진단명</>}
                        </p>
                        <p className="text-[11px] text-gray-400">스크롤하여 선택</p>
                      </div>
                      <ul
                        className="mt-2 h-[420px] overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100"
                        style={{ scrollbarWidth: "thin" }}
                      >
                        {filteredDiagnoses.map((d) => {
                          const q = search.trim();
                          return (
                            <li key={d}>
                              <button
                                type="button"
                                onClick={() => { setDiagnosis(d); setStep(1); }}
                                className="w-full px-5 py-3.5 text-left text-base font-medium text-gray-800 hover:bg-orange-50/60 hover:text-orange-600 transition-colors flex items-center justify-between group"
                              >
                                <span>
                                  {q
                                    ? d.split(new RegExp(`(${q})`, "i")).map((part, i) =>
                                        part.toLowerCase() === q.toLowerCase() ? (
                                          <mark key={i} className="bg-orange-100 text-orange-600 font-bold px-0.5 rounded">{part}</mark>
                                        ) : (
                                          <span key={i}>{part}</span>
                                        )
                                      )
                                    : d}
                                </span>
                                <FiArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Step 1: 4문항 */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center text-base shrink-0">📋</div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-500">선택한 진단명</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{diagnosis}</p>
                    </div>
                  </div>
                  <button type="button" onClick={reset} className="shrink-0 text-xs text-gray-500 hover:text-red-600 underline">변경</button>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 text-center">
                  <p className="text-xs sm:text-sm font-semibold text-orange-900">
                    환자 상태 <span className="text-primary-600">{answeredCount}/4</span> 답변 완료
                  </p>
                </div>

                <div className="space-y-3">
                  {QUESTIONS.map((q, idx) => {
                    const Icon = q.icon;
                    const value = answers[q.key as AnswerKey];
                    return (
                      <div key={q.key} className={`bg-white rounded-2xl border-2 p-5 shadow-sm transition-all ${value !== null ? "border-primary-200 ring-2 ring-primary-100" : "border-gray-100"}`}>
                        <div className="flex items-start gap-3 mb-4">
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${q.color} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-5 h-5 ${q.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-xs font-medium text-gray-400 mb-0.5">Q{idx + 1}</p>
                            <h4 className="text-sm sm:text-base font-bold text-gray-900 leading-snug">{q.title}</h4>
                            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">{q.desc}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setAnswer(q.key as AnswerKey, false)} className={`relative py-3 rounded-xl text-sm font-bold border-2 transition-all ${value === false ? "bg-gray-900 text-white border-gray-900 shadow-md scale-[1.02]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                            {value === false && <FiCheck className="absolute top-1.5 right-2 w-3.5 h-3.5" />}
                            아니요
                          </button>
                          <button type="button" onClick={() => setAnswer(q.key as AnswerKey, true)} className={`relative py-3 rounded-xl text-sm font-bold border-2 transition-all ${value === true ? "bg-primary-500 text-white border-primary-500 shadow-md scale-[1.02]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                            {value === true && <FiCheck className="absolute top-1.5 right-2 w-3.5 h-3.5" />}
                            예
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button type="button" disabled={!allAnswered} onClick={() => setStep(2)} className="w-full py-4 rounded-2xl text-base font-bold text-white shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none" style={{ background: allAnswered ? "linear-gradient(135deg, #FF922E 0%, #FF6B35 100%)" : "#9ca3af" }}>
                  {allAnswered ? "예상 간병비 계산하기 →" : `${4 - answeredCount}개 답변 남음`}
                </button>
              </div>
            )}

            {/* Step 2: 결과 */}
            {step === 2 && result && (
              <div className="space-y-4">
                {/* 진단 정보 카드 */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <button type="button" onClick={() => setExpandedDetail(!expandedDetail)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <h4 className="text-sm font-bold text-gray-500 shrink-0">진단명</h4>
                      <p className="text-base font-bold text-gray-900 truncate">{diagnosis}</p>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{expandedDetail ? "접기 ▲" : "펼치기 ▼"}</span>
                  </button>
                  {expandedDetail && (
                    <div className="border-t border-gray-100 px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-2 bg-gray-50/30">
                      {QUESTIONS.map((q) => {
                        const val = answers[q.key as AnswerKey];
                        return (
                          <div key={q.key} className="flex items-center justify-between py-1">
                            <span className="text-xs sm:text-sm font-medium text-gray-700 truncate pr-2">{q.short}</span>
                            <span className={`text-xs sm:text-sm font-bold shrink-0 ${val ? "text-orange-600" : "text-gray-400"}`}>{val ? "예" : "아니오"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 메인 결과 카드 */}
                <div className="bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden">
                  <div className="px-5 sm:px-7 py-7 sm:py-8 text-center">
                    <p className="text-xs sm:text-sm font-semibold text-gray-500 mb-2">하루 예상 간병비</p>
                    <div className="flex items-baseline justify-center gap-1 mb-1">
                      <span className="text-4xl sm:text-5xl font-extrabold text-gray-900 tabular-nums">{fmt(animatedAvg)}</span>
                      <span className="text-2xl font-bold text-gray-700">원</span>
                    </div>
                    <p className="text-[11px] text-rose-500 font-medium">( 내국인 식대 포함 기준 )</p>
                  </div>

                  <div className="px-5 sm:px-7 pb-7">
                    <PriceGraph result={result} />
                  </div>

                  <div className="bg-gray-50 border-t border-gray-100 px-5 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[11px] text-gray-500">* 2024.06 기준</span>
                    <p className="text-[11px] text-gray-500">* 위 정보는 임시 예상으로 <strong className="text-gray-700">실제와 차이</strong>가 있을 수 있습니다.</p>
                  </div>
                </div>

                {/* 평균 간병 기간 + 간병 장소 비율 — 큼직한 SVG 아이콘 + 도넛차트 */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 평균 간병 기간 카드 */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute -top-2 -right-2 w-20 h-20 rounded-full bg-blue-50/70" />
                    <div className="relative">
                      <h5 className="text-xs font-bold text-gray-500 mb-3">평균 간병 기간</h5>
                      <div className="flex items-end gap-3">
                        {/* 달력 SVG */}
                        <svg className="w-12 h-12 shrink-0" viewBox="0 0 48 48" fill="none">
                          <rect x="6" y="10" width="36" height="32" rx="4" fill="#DBEAFE" />
                          <rect x="6" y="10" width="36" height="9" rx="4" fill="#3B82F6" />
                          <rect x="13" y="6" width="3" height="9" rx="1.5" fill="#1E40AF" />
                          <rect x="32" y="6" width="3" height="9" rx="1.5" fill="#1E40AF" />
                          <circle cx="16" cy="27" r="2" fill="#3B82F6" />
                          <circle cx="24" cy="27" r="2" fill="#3B82F6" />
                          <circle cx="32" cy="27" r="2" fill="#93C5FD" />
                          <circle cx="16" cy="35" r="2" fill="#93C5FD" />
                          <circle cx="24" cy="35" r="2.5" fill="#FF922E" />
                          <circle cx="32" cy="35" r="2" fill="#93C5FD" />
                        </svg>
                        <div>
                          <div className="leading-none">
                            <span className="text-3xl font-extrabold text-gray-900 tabular-nums">6.2</span>
                            <span className="text-lg font-bold text-gray-700 ml-0.5">일</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">전체 평균</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 간병 장소 비율 카드 — 도넛 차트 */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute -top-2 -right-2 w-20 h-20 rounded-full bg-emerald-50/70" />
                    <div className="relative">
                      <h5 className="text-xs font-bold text-gray-500 mb-3">간병 장소 비율</h5>
                      <div className="flex items-center gap-3">
                        {/* 도넛 차트 SVG (90% 병원 / 10% 집) — viewBox 여백으로 stroke 잘림 방지 */}
                        <svg className="w-14 h-14 shrink-0 -rotate-90" viewBox="-4 -4 44 44" overflow="visible">
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#FED7AA" strokeWidth="5" />
                          <circle
                            cx="18" cy="18" r="15.915" fill="none"
                            stroke="#FF922E" strokeWidth="5"
                            strokeDasharray="90 100" strokeDashoffset="0"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="flex-1 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-orange-500" />
                              <span className="text-gray-600 font-medium">병원</span>
                            </span>
                            <span className="font-extrabold text-gray-900 tabular-nums">90%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-orange-200" />
                              <span className="text-gray-600 font-medium">집</span>
                            </span>
                            <span className="font-extrabold text-gray-900 tabular-nums">10%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 안내 */}
                <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-start gap-2.5">
                  <FiInfo className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] sm:text-xs text-blue-900 leading-relaxed">
                    <strong>참고 사항</strong> · 실제 매칭 단가는 간병사 경력·지역·일정에 따라 달라질 수 있으며, 2024.06 시장 시세 기반 예상치입니다.
                  </div>
                </div>

                {/* CTA — sticky 제거, 일반 배치 (가림 문제 픽스) */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button type="button" onClick={reset} className="py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                    <FiRefreshCw className="w-4 h-4" /> 다시 계산
                  </button>
                  <Link href="/care-request" className="py-4 rounded-2xl text-white font-bold text-center shadow-md transition-colors flex items-center justify-center gap-1.5" style={{ background: "linear-gradient(135deg, #FF922E 0%, #FF6B35 100%)" }}>
                    지금 간병 요청 <FiArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
