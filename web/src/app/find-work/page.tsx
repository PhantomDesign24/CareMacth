"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { careRequestAPI, caregiverAPI } from "@/lib/api";
import { formatDate, formatCareType, formatLocation } from "@/lib/format";
import { FiArrowRight, FiCheck, FiPhone, FiX, FiDollarSign, FiMapPin } from "react-icons/fi";
import { SITE } from "@/config/site";

const REGION_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const BASE = "https://massage.phantomdesign.kr/assets/images/region";
const REGION_CARDS = [
  { name: "서울", img: `${BASE}/map01.png` },
  { name: "경기", img: `${BASE}/map02.png` },
  { name: "인천", img: `${BASE}/map03.png` },
  { name: "대전", img: `${BASE}/map04.png` },
  { name: "대구", img: `${BASE}/map05.png` },
  { name: "부산", img: `${BASE}/map06.png` },
  { name: "광주", img: `${BASE}/map07.png` },
  { name: "울산", img: `${BASE}/map08.png` },
  { name: "세종", img: `${BASE}/map09.png` },
  { name: "강원", img: `${BASE}/map10.png` },
  { name: "충북", img: `${BASE}/map11.png` },
  { name: "충남", img: `${BASE}/map12.png` },
  { name: "전북", img: `${BASE}/map13.png` },
  { name: "전남", img: `${BASE}/map14.png` },
  { name: "경북", img: `${BASE}/map15.png` },
  { name: "경남", img: `${BASE}/map16.png` },
  { name: "제주", img: `${BASE}/map17.png` },
];

interface CareRequest {
  id: string;
  careType: string;
  scheduleType: string;
  location: string;
  address: string;
  region: string | null;
  hospitalName: string | null;
  startDate: string;
  endDate: string | null;
  durationDays: number | null;
  dailyRate: number | null;
  hourlyRate: number | null;
  status: string;
  specialRequirements: string | null;
  // 간병인 목록 응답: 결제 전 비식별 정보만 (성별/연령대/거동/감염), 보호자 X
  patient: {
    gender: string;
    ageBucket: number | null; // 10세 단위 (예: 70 = 70대)
    mobilityStatus: string;
    hasDementia: boolean;
    hasInfection: boolean;
  } | null;
  applicantCount?: number;
}

function parseRole(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch { return null; }
}

export default function FindWorkPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [careRequests, setCareRequests] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [myPreferredRegions, setMyPreferredRegions] = useState<string[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTarget, setModalTarget] = useState<CareRequest | null>(null);
  const [proposedRate, setProposedRate] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [appliedStatuses, setAppliedStatuses] = useState<Record<string, string>>({});

  // Quick accept state
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [myWorkStatus, setMyWorkStatus] = useState<string>("AVAILABLE");

  const isCaregiver = userRole === "CAREGIVER";
  const isWorking = isCaregiver && myWorkStatus === "WORKING";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("cm_access_token");
      setIsLoggedIn(!!token);
      setUserRole(parseRole(token));
    }
  }, []);

  // 역할 가드: 간병인/관리자 이외 접근 제한
  useEffect(() => {
    if (userRole && userRole !== "CAREGIVER" && userRole !== "ADMIN") {
      // 보호자/병원 등은 접근 불가 → 홈 or 대시보드로
      if (typeof window !== "undefined") {
        alert("이 페이지는 간병인 회원만 이용할 수 있습니다.");
        window.location.href = userRole === "GUARDIAN" ? "/dashboard/guardian" : "/";
      }
    }
  }, [userRole]);

  const regionKey = regionFilter.join(",");
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, unknown> = { status: "OPEN", page, limit: 20 };
      if (regionKey) {
        params.regions = regionKey;
      }
      const res = await careRequestAPI.list(params);
      const data = res.data?.data || res.data;
      setCareRequests(data.careRequests || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setError("간병 요청 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, regionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 선호지역 + 지원내역: 간병인 로그인 직후 1회만 로드
  useEffect(() => {
    if (!isLoggedIn || !isCaregiver) return;
    caregiverAPI.list()
      .then((res) => {
        const data = res.data?.data || {};
        const preferred: string[] = data.preferredRegions || [];
        setMyPreferredRegions(preferred);
        if (preferred.length > 0) setRegionFilter(preferred);
        if (data.workStatus) setMyWorkStatus(data.workStatus);
      })
      .catch(() => {});
    caregiverAPI.getMyApplications()
      .then((res) => {
        const raw: { careRequestId: string; status: string }[] = res.data?.data || [];
        // 취소된 지원은 재지원 가능하므로 제외
        const list = raw.filter((a) => a.status !== 'CANCELLED');
        setAppliedIds(list.map((a) => a.careRequestId));
        setAppliedStatuses(
          list.reduce<Record<string, string>>((acc, a) => {
            acc[a.careRequestId] = a.status;
            return acc;
          }, {})
        );
      })
      .catch(() => {});
  }, [isLoggedIn, isCaregiver]); // eslint-disable-line react-hooks/exhaustive-deps

  // 목록 조회: 페이지·지역 필터 변경 시
  useEffect(() => {
    if (isLoggedIn) fetchRequests();
  }, [isLoggedIn, fetchRequests]);

  const handleAcceptPrice = async (request: CareRequest) => {
    setAcceptingId(request.id);
    setApplyError("");
    setApplySuccess("");
    try {
      await caregiverAPI.applyWithProposal(request.id, {
        isAccepted: true,
        message: "",
      });
      setApplySuccess(`간병 요청에 지원했습니다. 보호자가 확인 후 연락드립니다.`);
      setAppliedIds(prev => [...prev, request.id]);
      setAppliedStatuses(prev => ({ ...prev, [request.id]: 'PENDING' }));
      fetchRequests();
    } catch (err: unknown) {
      const raw = (err as any)?.response?.data?.message || "";
      let message = "지원 중 오류가 발생했습니다.";
      if (raw.includes("이미 지원")) message = "이미 지원한 요청입니다.";
      else if (raw.includes("승인된")) message = "관리자 승인 대기 중입니다.";
      else if (raw.includes("진행 중")) message = "진행 중인 간병이 있습니다.";
      setApplyError(message);
    } finally {
      setAcceptingId(null);
    }
  };

  const openProposalModal = (request: CareRequest) => {
    setModalTarget(request);
    setProposedRate(request.dailyRate ? String(request.dailyRate) : "");
    setApplyMessage("");
    setApplyError("");
    setApplySuccess("");
    setShowModal(true);
  };

  const handleSubmitProposal = async () => {
    if (!modalTarget) return;
    const rate = parseInt(proposedRate);
    if (!rate || rate <= 0) {
      setApplyError("제안 금액을 입력해주세요.");
      return;
    }
    setApplying(true);
    setApplyError("");
    try {
      await caregiverAPI.applyWithProposal(modalTarget.id, {
        isAccepted: false,
        proposedRate: rate,
        message: applyMessage,
      });
      setShowModal(false);
      setApplySuccess(`간병 요청에 일당 ${rate.toLocaleString()}원으로 역제안을 보냈습니다. 보호자가 확인 후 연락드립니다.`);
      setAppliedIds(prev => [...prev, modalTarget.id]);
      setAppliedStatuses(prev => ({ ...prev, [modalTarget.id]: 'PENDING' }));
      fetchRequests();
    } catch (err: unknown) {
      const raw = (err as any)?.response?.data?.message || "";
      let message = "제안 중 오류가 발생했습니다.";
      if (raw.includes("이미 지원")) message = "이미 지원한 요청입니다.";
      setApplyError(message);
    } finally {
      setApplying(false);
    }
  };

  // Non-logged-in landing page
  if (!isLoggedIn) {
    const benefits = [
      {
        title: "안정적인 일감 배정",
        desc: "AI 매칭 시스템을 통해 본인의 경력과 전문 분야에 맞는 일감을 지속적으로 배정받을 수 있습니다.",
      },
      {
        title: "체계적인 교육 지원",
        desc: "간병 전문성을 높이기 위한 직무 소양 교육, 실무 교육, 재교육 프로그램을 무료로 제공합니다.",
      },
      {
        title: "우수 간병사 포상 제도",
        desc: "높은 평가를 받은 간병사에게 우수 뱃지 부여 및 포상금을 지급합니다.",
      },
      {
        title: "간병비 유예 지급제",
        desc: "선불 간병료 유예 지급제를 통해 안정적인 수입을 보장합니다.",
      },
      {
        title: "전담 케어코디 지원",
        desc: "전담 케어코디네이터가 간병 전 과정을 밀착 지원합니다.",
      },
      {
        title: "보험 가입 지원",
        desc: "간병 활동 중 발생할 수 있는 사고에 대비한 보험 가입을 지원합니다.",
      },
    ];

    return (
      <>
        {/* Hero */}
        <section className="relative overflow-hidden min-h-[420px] flex items-center"
          style={{ background: "linear-gradient(135deg, #FF922E 0%, #FFB347 40%, #FF8C00 100%)" }}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-72 sm:w-[400px] h-72 sm:h-[400px] rounded-full bg-white/10 blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-48 sm:w-[300px] h-48 sm:h-[300px] rounded-full bg-yellow-300/15 blur-[60px]" />
            <div className="absolute top-16 left-[10%] w-3 h-3 rounded-full bg-white/20 animate-pulse" />
            <div className="absolute top-32 right-[15%] w-2 h-2 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "0.5s" }} />
            <div className="absolute bottom-20 left-[25%] w-2.5 h-2.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: "1s" }} />
            <div className="absolute top-24 right-[30%] w-2 h-2 rounded-full bg-white/25 animate-pulse" style={{ animationDelay: "1.5s" }} />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-24 w-full">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs sm:text-sm font-medium mb-5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                간병 일감 찾기
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
                내가 직접 찾는
                <br />
                <span className="text-yellow-100">일자리</span>
              </h1>
              <p className="mt-4 text-sm sm:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed">
                검증된 플랫폼에서 나에게 맞는 간병 일감을
                <br className="hidden sm:block" />
                AI가 매칭해드립니다.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/20 backdrop-blur-sm">
                <span className="text-white/80 text-xs sm:text-sm">매일</span>
                <span className="text-white font-extrabold text-lg sm:text-2xl">10,000</span>
                <span className="text-white/80 text-xs sm:text-sm">개의 좋은 일자리</span>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-orange-600 font-bold rounded-2xl text-sm sm:text-base hover:bg-gray-50 transition-all shadow-xl w-full sm:w-auto"
                >
                  간병인 등록하기
                  <FiArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href={`tel:${SITE.phone}`}
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-orange-700/50 backdrop-blur-sm text-white font-bold rounded-2xl text-sm sm:text-base hover:bg-orange-700/70 transition-all w-full sm:w-auto"
                >
                  <FiPhone className="w-5 h-5" />
                  전화 상담 {SITE.phone}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-orange-500 font-semibold text-sm tracking-wider uppercase mb-3">Benefits</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">케어매치 간병인 혜택</h2>
              <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg max-w-2xl mx-auto">
                케어매치와 함께하는 간병인이 누리는 6가지 혜택을 확인하세요
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {benefits.map((b, i) => (
                <div
                  key={i}
                  className="group bg-white rounded-2xl p-5 sm:p-7 border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
                    <FiCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">{b.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Registration Steps */}
        <section className="py-14 sm:py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">간병인 등록 절차</h2>
              <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg">
                간단한 4단계로 케어매치 간병인이 될 수 있습니다
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              {[
                { step: "01", title: "회원가입", desc: "앱 또는 웹에서 간단한 정보를 입력하고 회원가입합니다." },
                { step: "02", title: "서류 제출", desc: "신분증, 자격증 등 필요 서류를 업로드합니다." },
                { step: "03", title: "교육 이수", desc: "케어매치 전문 교육 프로그램을 이수합니다." },
                { step: "04", title: "매칭 시작", desc: "교육 이수 후 바로 간병 일감 매칭을 시작합니다." },
              ].map((s, i) => (
                <div key={i} className="relative">
                  <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] text-center relative z-10">
                    <div className="text-xs font-bold text-orange-500 tracking-widest mb-2 sm:mb-3">STEP {s.step}</div>
                    <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">{s.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:flex absolute top-1/2 -right-3 z-20 -translate-y-1/2 text-gray-300">
                      <FiArrowRight className="w-6 h-6" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 sm:py-16" style={{ background: "linear-gradient(135deg, #FF922E 0%, #FF8C00 100%)" }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4">
              지금 바로 케어매치 간병인으로 시작하세요
            </h2>
            <p className="text-orange-100 text-sm sm:text-base mb-6 sm:mb-8">
              안정적인 수입과 체계적인 교육, 케어매치가 함께합니다.
            </p>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-orange-600 font-bold rounded-2xl text-sm sm:text-base hover:bg-gray-50 transition-all shadow-xl"
            >
              간병인 등록하기
              <FiArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </>
    );
  }

  // Logged-in view with care request listings
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">

      {/* Region selector section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">간병 일감 찾기</h1>
              <p className="mt-0.5 text-sm text-gray-500">지역을 선택하거나 전체 일감을 확인하세요</p>
            </div>
            {regionFilter.length > 0 && (
              <button
                type="button"
                onClick={() => { setRegionFilter([]); setPage(1); }}
                className="text-xs text-orange-500 font-medium hover:underline flex items-center gap-1"
              >
                <FiX className="w-3 h-3" /> 필터 해제
              </button>
            )}
          </div>

          {/* 전체 / 필터해제 버튼 */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setRegionFilter([]); setPage(1); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                regionFilter.length === 0
                  ? "bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-200"
                  : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              <FiMapPin className="w-3.5 h-3.5" />
              전체 지역
            </button>
            {isCaregiver && myPreferredRegions.length > 0 && (() => {
              const isPreferredActive =
                regionFilter.length === myPreferredRegions.length &&
                myPreferredRegions.every((r) => regionFilter.includes(r));
              return (
                <button
                  type="button"
                  onClick={() => { setRegionFilter(myPreferredRegions); setPage(1); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                    isPreferredActive
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-200"
                      : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
                  }`}
                >
                  ⭐ 내 선호지역
                  <span className={`text-xs ${isPreferredActive ? "text-orange-100" : "text-gray-400"}`}>
                    ({myPreferredRegions.join("·")})
                  </span>
                </button>
              );
            })()}
            {regionFilter.length > 0 && (
              <span className="text-xs text-gray-400">
                {regionFilter.join(" · ")} 선택됨
              </span>
            )}
          </div>

          {/* 선호지역 외 노출 안내 */}
          {isCaregiver && regionFilter.length === 0 && myPreferredRegions.length > 0 && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
              <span className="shrink-0">ℹ</span>
              <span>
                현재 <strong>선호지역 외 공고</strong>도 함께 표시 중입니다. 선호지역({myPreferredRegions.join(", ")})으로 돌아가려면 <strong>&quot;내 선호지역&quot;</strong> 버튼을 누르세요.
              </span>
            </div>
          )}

          {/* Region grid - 다중 선택 */}
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
            {REGION_CARDS.map((r) => {
              const active = regionFilter.includes(r.name);
              return (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => {
                    setRegionFilter(prev =>
                      prev.includes(r.name)
                        ? prev.filter(x => x !== r.name)
                        : [...prev, r.name]
                    );
                    setPage(1);
                  }}
                  className={`group flex flex-col items-center gap-1 py-3 px-1 rounded-xl border transition-all ${
                    active
                      ? "border-orange-400 bg-orange-50 shadow-sm"
                      : "border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm"
                  }`}
                >
                  <div
                    className="w-9 h-[34px] bg-no-repeat bg-center"
                    style={{
                      backgroundImage: `url('${r.img}')`,
                      backgroundSize: "100% 200%",
                      backgroundPosition: active ? "center bottom" : "center top",
                    }}
                  />
                  <span className={`text-[11px] font-bold leading-none ${active ? "text-orange-500" : "text-gray-700"}`}>
                    {r.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Toast notifications */}
        {/* 하단 고정 토스트 */}
        {applySuccess && (
          <div className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-sm animate-[slideUp_0.3s_ease-out] flex items-center gap-3 rounded-xl bg-green-600 px-4 py-3 shadow-lg" onClick={() => setApplySuccess("")}>
            <FiCheck className="w-5 h-5 text-white shrink-0" />
            <p className="flex-1 text-sm font-medium text-white">{applySuccess}</p>
          </div>
        )}
        {applyError && !showModal && (
          <div className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-sm animate-[slideUp_0.3s_ease-out] flex items-center gap-3 rounded-xl bg-red-600 px-4 py-3 shadow-lg" onClick={() => setApplyError("")}>
            <FiX className="w-5 h-5 text-white shrink-0" />
            <p className="flex-1 text-sm font-medium text-white">{applyError}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-orange-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <button type="button" onClick={fetchRequests} className="btn-primary text-sm">
              다시 시도
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && careRequests.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4 text-gray-300">
              <FiDollarSign className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500">현재 모집 중인 간병 요청이 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">나중에 다시 확인해주세요.</p>
          </div>
        )}

        {/* Care request cards */}
        {!loading && careRequests.length > 0 && (
          <div className="space-y-4">
            {careRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-base truncate">
                          {req.location === "HOSPITAL"
                            ? `${req.hospitalName || (req.region || "병원")} 간병 요청`
                            : `${req.region || req.address?.split(" ").slice(0, 2).join(" ") || "자택"} 간병 요청`}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                          {formatCareType(req.careType)}
                        </span>
                        {appliedIds.includes(req.id) && (() => {
                          const st = appliedStatuses[req.id];
                          if (st === 'ACCEPTED') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">수락됨</span>;
                          if (st === 'REJECTED') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">미선택</span>;
                          return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600">지원완료</span>;
                        })()}
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm mt-3">
                        <div>
                          <span className="text-gray-400 text-xs">간병 유형</span>
                          <p className="text-gray-700 font-medium">{req.scheduleType === 'FULL_TIME' ? '24시간' : '시간제'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">장소</span>
                          <p className="text-gray-700 font-medium">{formatLocation(req.location)}{req.hospitalName ? ` (${req.hospitalName})` : ''}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">지역</span>
                          <p className="text-gray-700 font-medium">{req.region || '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">주소</span>
                          <p className="text-gray-700 font-medium truncate">{req.address || '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">기간</span>
                          <p className="text-gray-700 font-medium">
                            {formatDate(req.startDate)} ~ {req.endDate ? formatDate(req.endDate) : "미정"}
                            {req.durationDays && ` (${req.durationDays}일)`}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">환자 성별/연령</span>
                          <p className="text-gray-700 font-medium">
                            {req.patient?.gender === 'F' ? '여' : '남'}
                            {req.patient?.ageBucket ? ` / ${req.patient.ageBucket}대` : ''}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">환자 상태</span>
                          <p className="text-gray-700 font-medium">
                            {req.patient?.mobilityStatus === "DEPENDENT" ? "완전의존" : req.patient?.mobilityStatus === "PARTIAL" ? "부분도움" : "독립보행"}
                            {req.patient?.hasDementia && " · 치매"}
                            {req.patient?.hasInfection && " · 감염"}
                          </p>
                        </div>
                        {typeof req.applicantCount === 'number' && (
                          <div>
                            <span className="text-gray-400 text-xs">지원자</span>
                            <p className="text-gray-700 font-medium">{req.applicantCount}명</p>
                          </div>
                        )}
                      </div>

                      {req.specialRequirements && (
                        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 line-clamp-2">
                          요청사항: {req.specialRequirements}
                        </p>
                      )}
                    </div>

                    {/* Rate + Actions */}
                    <div className="sm:w-56 shrink-0 flex flex-col items-stretch gap-3">
                      {/* Daily rate - prominent */}
                      <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
                        <span className="text-xs text-orange-600 font-medium block">보호자 제시 일당</span>
                        <span className="text-xl sm:text-2xl font-extrabold text-orange-600">
                          {req.dailyRate ? `${req.dailyRate.toLocaleString()}원` : "협의"}
                        </span>
                        {req.dailyRate && req.durationDays && (() => {
                          const gross = req.dailyRate * req.durationDays;
                          // 기본 수수료 10%, 세율 3.3% (실제 계약 시 재계산)
                          const fee = Math.round(gross * 0.1);
                          const tax = Math.round((gross - fee) * 0.033);
                          const net = gross - fee - tax;
                          return (
                            <div className="mt-2 pt-2 border-t border-orange-200 text-[11px] text-left space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-gray-500">총액 ({req.durationDays}일)</span>
                                <span className="text-gray-700 font-medium">{gross.toLocaleString()}원</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">수수료 10%</span>
                                <span className="text-gray-400">-{fee.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">세금 3.3%</span>
                                <span className="text-gray-400">-{tax.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-orange-100">
                                <span className="text-orange-700 font-semibold">실수령</span>
                                <span className="text-orange-700 font-bold">{net.toLocaleString()}원</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Action buttons — 간병인만 */}
                      {!isCaregiver ? (
                        <div className="w-full text-center text-xs text-gray-400 py-2">
                          간병인 계정으로 지원 가능
                        </div>
                      ) : appliedIds.includes(req.id) ? (
                        (() => {
                          const st = appliedStatuses[req.id];
                          if (st === 'ACCEPTED') return (
                            <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-700 font-semibold rounded-xl text-sm border border-green-200">
                              <FiCheck className="w-4 h-4" />
                              수락됨 - 계약 진행 중
                            </div>
                          );
                          if (st === 'REJECTED') return (
                            <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-500 font-medium rounded-xl text-sm border border-red-200">
                              <FiX className="w-4 h-4" />
                              미선택
                            </div>
                          );
                          return (
                            <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 text-orange-600 font-medium rounded-xl text-sm border border-orange-200">
                              <FiCheck className="w-4 h-4" />
                              지원 완료 · 응답 대기 중
                            </div>
                          );
                        })()
                      ) : isWorking ? (
                        <div className="w-full p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
                          <div className="font-semibold">⚠ 진행 중인 간병이 있습니다</div>
                          <div className="text-xs text-red-600 mt-1">
                            현재 간병 종료 후 지원 가능합니다
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAcceptPrice(req)}
                            disabled={acceptingId !== null}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white font-bold rounded-xl text-base hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {acceptingId === req.id ? (
                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <>
                                <FiCheck className="w-5 h-5" />
                                이 금액으로 수락
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openProposalModal(req)}
                            disabled={acceptingId !== null}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-orange-300 text-orange-600 font-bold rounded-xl text-base hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <FiDollarSign className="w-5 h-5" />
                            다른 금액 제안하기
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              이전
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {/* Proposal modal */}
      {showModal && modalTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">금액 제안하기</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Guardian's rate */}
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs text-gray-500 block mb-1">보호자 제시 금액</span>
                <span className="text-lg font-bold text-gray-900">
                  {modalTarget.dailyRate ? `${modalTarget.dailyRate.toLocaleString()}원` : "협의"}
                </span>
              </div>

              {/* Proposed rate input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내 제안 금액 (일당)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={proposedRate}
                    onChange={(e) => setProposedRate(e.target.value)}
                    placeholder="금액을 입력하세요"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-8"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메시지 (선택)
                </label>
                <textarea
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="보호자에게 전달할 메시지를 작성해주세요."
                  rows={3}
                  maxLength={500}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Error in modal */}
              {applyError && showModal && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{applyError}</div>
              )}

              <button
                type="button"
                onClick={handleSubmitProposal}
                disabled={applying}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white font-semibold rounded-xl text-sm hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  "제안 보내기"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
