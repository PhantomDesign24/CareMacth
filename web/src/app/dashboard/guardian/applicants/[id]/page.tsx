"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { applicantAPI, careRequestAPI } from "@/lib/api";
import { showToast } from "@/components/Toast";
import { KOREA_REGIONS, dominantSido } from "@/lib/koreaRegions";
import {
  formatDate,
  formatMoney,
  formatCareType,
  formatLocation,
  formatCareStatus,
} from "@/lib/format";

interface CaregiverReview {
  id: string;
  rating: number;
  comment: string | null;
  wouldRehire: boolean;
  createdAt: string;
  guardian?: { user?: { name?: string } };
}

interface Caregiver {
  id: string;
  user: {
    name: string;
    profileImage: string | null;
  };
  certificates: Array<{ id: string; name: string; issuer: string; verified: boolean; imageUrl?: string }>;
  experienceYears: number;
  avgRating: number;
  totalMatches: number;
  rehireRate: number;
  specialties: string[];
  gender: string;
  nationality: string;
  bio?: string | null;
  reviews?: CaregiverReview[];
  totalReviewCount?: number;
}

interface MatchScore {
  total: number;
  distance: number;
  experience: number;
  review: number;
  rehire: number;
  cancelPenalty: number;
}

interface Application {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  proposedRate: number | null;
  isAccepted: boolean;
  caregiver: Caregiver;
  matchScore: MatchScore | null;
}

interface CareRequest {
  id: string;
  patientName: string;
  careType: string;
  location: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  previousDailyRate: number | null;
  status: string;
  regions?: string[];
  patient?: {
    name: string;
  };
  applications: Application[];
}

export default function ApplicantsPage() {
  const params = useParams();
  const router = useRouter();
  const careRequestId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [careRequest, setCareRequest] = useState<CareRequest | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    caregiverId: string;
    caregiverName: string;
    proposedRate: number | null;
    isAccepted: boolean;
  } | null>(null);

  // 전체 리뷰 모달 상태
  const [reviewsModalCaregiver, setReviewsModalCaregiver] = useState<Caregiver | null>(null);
  const [fullReviews, setFullReviews] = useState<CaregiverReview[]>([]);
  const [fullReviewsLoading, setFullReviewsLoading] = useState(false);

  useEffect(() => {
    if (!reviewsModalCaregiver) return;
    setFullReviewsLoading(true);
    import("@/lib/api").then(({ reviewAPI }) =>
      reviewAPI
        .byCaregiver(reviewsModalCaregiver.id)
        .then((res) => {
          const list = res.data?.data?.reviews || res.data?.data || res.data || [];
          setFullReviews(Array.isArray(list) ? list : []);
        })
        .catch(() => setFullReviews([]))
        .finally(() => setFullReviewsLoading(false))
    );
  }, [reviewsModalCaregiver]);

  // 금액 인상 모달 상태
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [newDailyRate, setNewDailyRate] = useState("");
  const [showExpandRegionModal, setShowExpandRegionModal] = useState(false);
  const [expandRegions, setExpandRegions] = useState<string[]>([]);
  const [expandSido, setExpandSido] = useState<string>("");
  const [expandingRegion, setExpandingRegion] = useState(false);
  const [raisingRate, setRaisingRate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await applicantAPI.getApplicants(careRequestId);
      const data = res.data?.data || res.data || {};
      setCareRequest({
        id: data.id,
        patientName: data.patient?.name || data.patientName || "-",
        careType: data.careType || "",
        location: data.location || "",
        startDate: data.startDate ? new Date(data.startDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : "",
        endDate: data.endDate ? new Date(data.endDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : "",
        dailyRate: data.dailyRate || 0,
        previousDailyRate: data.previousDailyRate || null,
        status: data.status || "",
        regions: Array.isArray(data.regions) ? data.regions : [],
        applications: (data.applications || []).map((app: any) => ({
          id: app.id,
          status: app.status || "PENDING",
          message: app.message || "",
          createdAt: app.createdAt || "",
          proposedRate: app.proposedRate ?? null,
          isAccepted: app.isAccepted ?? false,
          matchScore: app.matchScore || null,
          caregiver: {
            id: app.caregiver?.id || app.caregiverId || "",
            user: {
              name: app.caregiver?.user?.name || "-",
              profileImage: app.caregiver?.user?.profileImage || null,
            },
            certificates: app.caregiver?.certificates || [],
            experienceYears: app.caregiver?.experienceYears || 0,
            avgRating: app.caregiver?.avgRating || 0,
            totalMatches: app.caregiver?.totalMatches || 0,
            rehireRate: app.caregiver?.rehireRate || 0,
            specialties: app.caregiver?.specialties || [],
            gender: app.caregiver?.gender || "",
            nationality: app.caregiver?.nationality || "",
            bio: app.caregiver?.bio || null,
            reviews: app.caregiver?.reviews || [],
            totalReviewCount: app.caregiver?._count?.reviews || 0,
          },
        })),
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.message;
      // 404: 삭제되었거나 존재하지 않음 — notFound 플래그로 별도 처리
      if (status === 404) {
        setNotFoundFlag(true);
      } else {
        const message =
          apiMsg ||
          (err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다.");
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [careRequestId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelect = async (caregiverId: string) => {
    setSelecting(caregiverId);
    try {
      const res = await applicantAPI.selectCaregiver(careRequestId, caregiverId);
      const contractId = (res.data?.data?.id) || (res.data?.id);
      alert("매칭이 완료되었습니다. 결제 페이지로 이동합니다.");
      if (contractId) {
        router.push(`/dashboard/guardian/payment/${contractId}`);
      } else {
        router.push("/dashboard/guardian");
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const message =
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        "간병인 선택 중 오류가 발생했습니다.";
      alert(message);
    } finally {
      setSelecting(null);
      setConfirmTarget(null);
    }
  };

  const handleRaiseRate = async () => {
    const rate = parseInt(newDailyRate);
    if (!rate || rate <= (careRequest?.dailyRate || 0)) {
      alert(`새 일당은 현재 일당(${(careRequest?.dailyRate || 0).toLocaleString()}원)보다 높아야 합니다.`);
      return;
    }
    setRaisingRate(true);
    try {
      await careRequestAPI.raiseRate(careRequestId, rate);
      alert("금액이 인상되었습니다. 간병인들에게 알림이 발송되었습니다.");
      setShowRaiseModal(false);
      setNewDailyRate("");
      await fetchData();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err instanceof Error ? err.message : "금액 인상 중 오류가 발생했습니다.");
      alert(message);
    } finally {
      setRaisingRate(false);
    }
  };

  // 지원자가 없거나 모두 역제안인 경우 금액 인상 버튼 표시
  const showRaiseRateButton =
    careRequest &&
    ['OPEN', 'MATCHING'].includes(careRequest.status) &&
    (careRequest.applications.length === 0 ||
      careRequest.applications.every((app) => !app.isAccepted && app.proposedRate !== null));

  const formatGender = (gender: string) => {
    const map: Record<string, string> = { M: "남성", F: "여성" };
    return map[gender] || gender;
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.5;
    const empty = 5 - full - (hasHalf ? 1 : 0);
    return (
      <span className="inline-flex items-center gap-0.5 text-amber-400">
        {"★".repeat(full)}
        {hasHalf && "☆"}
        <span className="text-gray-300">{"★".repeat(empty)}</span>
        <span className="ml-1 text-sm text-gray-600">{rating.toFixed(1)}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-primary-500 mx-auto mb-4"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-gray-500">지원자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (notFoundFlag) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            만료되었거나 삭제된 공고입니다
          </h2>
          <p className="text-gray-500 mb-6">
            해당 간병 요청을 더 이상 찾을 수 없습니다. 새 공고를 작성하거나 내 이력에서 다른 공고를 확인해주세요.
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/guardian")}
              className="btn-primary"
            >
              내 이력으로
            </button>
            <button
              type="button"
              onClick={() => router.push("/care-request")}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              새 공고 작성
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            오류가 발생했습니다
          </h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button type="button" onClick={fetchData} className="btn-primary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // Sort: accepted offers first, then by proposedRate (lowest first), then by date
  const sortedApplications = [...(careRequest?.applications || [])].sort(
    (a, b) => {
      // Accepted first
      if (a.isAccepted && !b.isAccepted) return -1;
      if (!a.isAccepted && b.isAccepted) return 1;
      // Among non-accepted, sort by proposedRate (lowest first), nulls last
      if (!a.isAccepted && !b.isAccepted) {
        if (a.proposedRate !== null && b.proposedRate !== null) {
          return a.proposedRate - b.proposedRate;
        }
        if (a.proposedRate !== null && b.proposedRate === null) return -1;
        if (a.proposedRate === null && b.proposedRate !== null) return 1;
      }
      return 0;
    }
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          href="/dashboard/guardian"
          className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          대시보드로 돌아가기
        </Link>

        {/* Care request summary */}
        <div className="card mb-8">
          <h1 className="text-xl font-bold text-gray-900 mb-4">
            간병 요청 정보
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">환자명</span>
              <p className="font-medium text-gray-900">
                {careRequest?.patientName}
              </p>
            </div>
            <div>
              <span className="text-gray-500">간병 유형</span>
              <p className="font-medium text-gray-900">
                {formatCareType(careRequest?.careType || "")}
              </p>
            </div>
            <div>
              <span className="text-gray-500">장소</span>
              <p className="font-medium text-gray-900">
                {formatLocation(careRequest?.location || "")}
              </p>
            </div>
            <div>
              <span className="text-gray-500">시작일</span>
              <p className="font-medium text-gray-900">
                {formatDate(careRequest?.startDate)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">종료일</span>
              <p className="font-medium text-gray-900">
                {formatDate(careRequest?.endDate)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">제시 일당</span>
              <p className="font-medium text-gray-900">
                {careRequest?.previousDailyRate ? (
                  <>
                    <span className="line-through text-gray-400 mr-2">
                      {careRequest.previousDailyRate.toLocaleString()}원
                    </span>
                    <span className="text-primary-600">{formatMoney(careRequest?.dailyRate)}</span>
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      인상됨
                    </span>
                  </>
                ) : (
                  formatMoney(careRequest?.dailyRate)
                )}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">상태: </span>
            <span className="badge-primary">
              {formatCareStatus(careRequest?.status || "")}
            </span>
          </div>
        </div>

        {/* 금액 올리기 섹션 */}
        {showRaiseRateButton && (
          <div className="card mb-8 bg-amber-50 border-amber-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-amber-800">
                  {careRequest?.applications.length === 0
                    ? "아직 지원자가 없습니다."
                    : "모든 지원자가 역제안을 했습니다."}
                </h3>
                <p className="text-sm text-amber-600 mt-1">
                  일당을 인상하여 더 많은 간병인에게 재공고할 수 있습니다.
                </p>
                <p className="text-sm text-amber-700 mt-1 font-medium">
                  현재 일당: {(careRequest?.dailyRate || 0).toLocaleString()}원
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setNewDailyRate("");
                    setShowRaiseModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                >
                  💰 금액 올리기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sido = dominantSido(careRequest?.regions || []) || "서울";
                    setExpandSido(sido);
                    setExpandRegions([]);
                    setShowExpandRegionModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                  🌏 지역 확대
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Applicants header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            지원자 목록{" "}
            <span className="text-primary-600">{sortedApplications.length}명</span>
          </h2>
        </div>

        {/* Applicant cards */}
        {sortedApplications.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400">아직 지원자가 없습니다.</p>
            <p className="text-sm text-gray-400 mt-2">
              간병인의 지원을 기다려 주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedApplications.map((app) => {
              const cg = app.caregiver;
              const score = app.matchScore?.total ?? null;
              // 등급별 라인형 아이콘 (trophy / shield-check / star / info)
              const trophyIcon = (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
                  <path d="M16 5h3a2 2 0 0 1 0 4h-3" />
                  <path d="M8 5H5a2 2 0 0 0 0 4h3" />
                  <path d="M12 12v4" />
                  <path d="M8 20h8" />
                  <path d="M10 20v-2h4v2" />
                </svg>
              );
              const shieldCheckIcon = (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M12 3 4 6v5.5c0 4.8 3.2 9 8 10 4.8-1 8-5.2 8-10V6l-8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              );
              const starIcon = (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="m12 3 2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 17.3l-5.9 3.5 1.7-6.6L2.6 9.8l6.8-.5L12 3Z" />
                </svg>
              );
              const infoIcon = (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8h.01" />
                  <path d="M11 12h1v4h1" />
                </svg>
              );
              const tier =
                score === null ? null
                : score >= 85 ? { label: "최우수 매칭", border: "border-emerald-200", bg: "from-emerald-50 to-teal-50", ring: "ring-emerald-300", text: "text-emerald-700", bar: "from-emerald-400 to-teal-500", dot: "bg-emerald-500", icon: trophyIcon }
                : score >= 70 ? { label: "우수 매칭", border: "border-blue-200", bg: "from-blue-50 to-sky-50", ring: "ring-blue-300", text: "text-blue-700", bar: "from-blue-400 to-sky-500", dot: "bg-blue-500", icon: shieldCheckIcon }
                : score >= 50 ? { label: "양호 매칭", border: "border-orange-200", bg: "from-orange-50 to-amber-50", ring: "ring-orange-300", text: "text-orange-700", bar: "from-orange-400 to-amber-500", dot: "bg-orange-500", icon: starIcon }
                : { label: "검토 필요", border: "border-gray-200", bg: "from-gray-50 to-slate-50", ring: "ring-gray-300", text: "text-gray-600", bar: "from-gray-400 to-slate-500", dot: "bg-gray-400", icon: infoIcon };

              return (
                <div key={app.id} className="card">
                  {/* 프로필 + 매칭 점수 상단 헤더 */}
                  <div className="flex items-start gap-4 mb-4 pb-4 border-b border-gray-100">
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {cg.user.profileImage ? (
                        <img src={cg.user.profileImage} alt={cg.user.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{cg.user.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <span>{formatGender(cg.gender)}</span>
                            {cg.nationality && <><span className="text-gray-300">·</span><span>{cg.nationality}</span></>}
                            <span className="text-gray-300">·</span>
                            <span>지원일 {formatDate(app.createdAt)}</span>
                          </div>
                          <div className="mt-1.5">{renderStars(cg.avgRating)}</div>
                        </div>
                        {/* 매칭 점수 */}
                        {score !== null && tier && (
                          <div className={`shrink-0 p-3 rounded-lg bg-gradient-to-br ${tier.bg} border ${tier.border} w-full sm:w-auto sm:min-w-[220px]`}>
                            <div className="flex items-center gap-3">
                              <div className={`shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm ring-2 ${tier.ring} ${tier.text}`}>
                                {tier.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                                    <span className={`text-[11px] font-semibold ${tier.text}`}>{tier.label}</span>
                                  </div>
                                  <div className="flex items-baseline gap-0.5">
                                    <span className={`text-xl font-extrabold ${tier.text}`}>{score.toFixed(0)}</span>
                                    <span className="text-[10px] font-medium text-gray-400">점</span>
                                  </div>
                                </div>
                                <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden">
                                  <div className={`h-full bg-gradient-to-r ${tier.bar} rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 핵심 스탯 & 제안 금액 (한 줄, 항상 채움) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <StatBlock
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 7h-4V3H8v4H4v13h16V7Z" /><path d="M10 11h4" /></svg>}
                      label="경력"
                      value={`${cg.experienceYears}년`}
                    />
                    <StatBlock
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
                      label="총 매칭"
                      value={`${cg.totalMatches}건`}
                    />
                    <StatBlock
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>}
                      label="재고용률"
                      value={`${cg.rehireRate}%`}
                    />
                    <div className="rounded-lg border-2 border-primary-200 bg-primary-50 px-3 py-2">
                      <div className="text-[10px] text-primary-600 font-semibold">
                        {app.isAccepted ? "제시 금액 수락" : app.proposedRate ? "역제안 금액" : "금액 미제시"}
                      </div>
                      <div className="text-base font-extrabold text-primary-600 mt-0.5">
                        {app.proposedRate != null
                          ? `${app.proposedRate.toLocaleString()}원`
                          : app.isAccepted && careRequest?.dailyRate
                            ? `${careRequest.dailyRate.toLocaleString()}원`
                            : "협의"}
                        <span className="text-[10px] font-medium text-gray-400">/일</span>
                      </div>
                      {app.proposedRate != null && careRequest?.dailyRate && app.proposedRate !== careRequest.dailyRate && (
                        <div className={`text-[10px] mt-0.5 ${app.proposedRate > careRequest.dailyRate ? "text-orange-600" : "text-green-600"}`}>
                          제시 대비 {app.proposedRate > careRequest.dailyRate ? "+" : ""}
                          {(app.proposedRate - careRequest.dailyRate).toLocaleString()}원
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 자격증/전문분야/소개 — 존재하는 것만 flex wrap */}
                  {(cg.certificates.length > 0 || cg.specialties.length > 0 || cg.bio) && (
                    <div className="mb-4 space-y-2">
                      {(cg.certificates.length > 0 || cg.specialties.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                          {cg.certificates.map((cert, idx: number) => (
                            <span key={cert.id || idx}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cert.verified ? "bg-green-50 text-green-700" : "bg-primary-50 text-primary-700"}`}
                              title={`발급: ${cert.issuer}`}>
                              {cert.verified && <span>✓</span>}
                              {cert.name}
                            </span>
                          ))}
                          {cg.specialties.map((spec: string, idx: number) => (
                            <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}
                      {cg.bio && (
                        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 leading-relaxed">
                          {cg.bio}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 지원 메시지 + 리뷰 — 2단 그리드 (둘 다 있으면 나란히, 하나만 있으면 전체폭) */}
                  {(app.message || (cg.reviews && cg.reviews.length > 0)) && (
                    <div className={`grid gap-3 mb-4 ${app.message && cg.reviews && cg.reviews.length > 0 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                      {app.message && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold mb-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm.375 3.375a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3-3.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 3.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.375-3.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 3.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                              <path d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" />
                            </svg>
                            지원 메시지
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{app.message}</p>
                        </div>
                      )}
                      {cg.reviews && cg.reviews.length > 0 && (
                        <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.32.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .32-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                              </svg>
                              리뷰 {cg.totalReviewCount || cg.reviews.length}건
                            </div>
                            {(cg.totalReviewCount || 0) > cg.reviews.length && (
                              <button type="button" onClick={() => setReviewsModalCaregiver(cg)}
                                className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                                전체 보기 →
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {cg.reviews.map((rv) => (
                              <div key={rv.id} className="bg-white rounded-lg p-2 border border-amber-100">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-amber-500">{"★".repeat(Math.round(rv.rating))}</span>
                                  <span className="font-semibold text-gray-700">{rv.guardian?.user?.name || "익명"}</span>
                                  {rv.wouldRehire && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">재고용 의사</span>
                                  )}
                                </div>
                                {rv.comment && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{rv.comment}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 액션 버튼 — 항상 하단 full-width */}
                  {careRequest?.status === "CANCELLED" ? (
                    <div className="w-full py-2.5 text-sm text-gray-400 bg-gray-50 rounded-lg text-center">
                      취소된 요청
                    </div>
                  ) : careRequest?.status === "MATCHED" || careRequest?.status === "IN_PROGRESS" || careRequest?.status === "COMPLETED" ? (
                    app.status === "ACCEPTED" ? (
                      <div className="w-full py-2.5 text-sm font-semibold text-green-700 bg-green-50 rounded-lg text-center border border-green-200">
                        ✓ 이 간병인과 매칭 완료
                      </div>
                    ) : (
                      <div className="w-full py-2.5 text-sm text-gray-400 bg-gray-50 rounded-lg text-center">
                        매칭 종료됨
                      </div>
                    )
                  ) : app.status === "REJECTED" || app.status === "CANCELLED" ? (
                    <div className="w-full py-2.5 text-sm text-gray-400 bg-gray-50 rounded-lg text-center">
                      {app.status === "REJECTED" ? "거절됨" : "취소됨"}
                    </div>
                  ) : !['OPEN', 'MATCHING'].includes(careRequest?.status || '') ? (
                    <div className="w-full py-2.5 text-sm text-gray-400 bg-gray-50 rounded-lg text-center">
                      선택 불가
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmTarget({
                        caregiverId: cg.id,
                        caregiverName: cg.user.name,
                        proposedRate: app.proposedRate,
                        isAccepted: app.isAccepted,
                      })}
                      disabled={selecting !== null}
                      className="btn-primary w-full text-sm"
                    >
                      {selecting === cg.id ? (
                        <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        "이 간병인 선택"
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 취소된 요청 안내 */}
        {careRequest?.status === "CANCELLED" && (
          <div className="mt-6 rounded-lg p-6 border-2 bg-gray-50 border-gray-200">
            <div className="text-xs font-semibold mb-1 text-gray-500">ℹ 취소된 요청</div>
            <div className="text-lg font-bold text-gray-900">이 간병 요청은 취소되었습니다</div>
            <p className="text-sm text-gray-600 mt-1">
              새로 매칭하시려면 <Link href="/care-request" className="text-primary-600 font-semibold hover:underline">새 간병 요청</Link>을 등록해주세요.
            </p>
          </div>
        )}

        {/* 이미 매칭 완료된 경우 결제 안내 */}
        {careRequest && (careRequest.status === "MATCHED" || careRequest.status === "IN_PROGRESS") && (
          <PaymentStatusBanner careRequestId={careRequestId} />
        )}

        {/* 전체 리뷰 모달 */}
        {reviewsModalCaregiver && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
            onClick={() => setReviewsModalCaregiver(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {reviewsModalCaregiver.user.name} 간병인 리뷰
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    평균 ⭐ {reviewsModalCaregiver.avgRating.toFixed(1)} ·
                    총 {reviewsModalCaregiver.totalReviewCount || fullReviews.length}건
                  </p>
                </div>
                <button
                  onClick={() => setReviewsModalCaregiver(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {fullReviewsLoading ? (
                  <div className="py-20 text-center text-gray-400 text-sm">불러오는 중...</div>
                ) : fullReviews.length === 0 ? (
                  <div className="py-20 text-center text-gray-400 text-sm">리뷰가 없습니다.</div>
                ) : (
                  fullReviews.map((rv: any) => (
                    <div key={rv.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-500 font-bold">
                            {"★".repeat(Math.round(rv.rating))}
                            <span className="text-gray-300">{"★".repeat(5 - Math.round(rv.rating))}</span>
                          </span>
                          <span className="text-gray-700 font-medium">
                            {rv.guardian?.user?.name || "익명"}
                          </span>
                          {rv.wouldRehire && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              재고용 의사
                            </span>
                          )}
                        </div>
                        <span className="text-gray-400">
                          {new Date(rv.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      {rv.comment && (
                        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{rv.comment}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 지역 확대 모달 — 시·군·구 단위 */}
        {showExpandRegionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">지역 확대 재검색</h3>
              <p className="text-sm text-gray-500 mb-3">
                현재 지역과 같은 시·도 내에서 추가로 알림을 보낼 시·군·구를 선택하세요. 해당 지역 간병인에게 공고가 재발송됩니다.
              </p>

              {/* 시·도 셀렉터 */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">시·도</label>
                <select
                  value={expandSido}
                  onChange={(e) => { setExpandSido(e.target.value); setExpandRegions([]); }}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                >
                  {Object.keys(KOREA_REGIONS).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-400 mb-2">✓ 표시는 이미 추가된 지역(고정), 다른 지역을 선택해 추가하세요.</p>
              <div className="flex flex-wrap gap-2 mb-5 max-h-56 overflow-y-auto py-2 px-1">
                {(KOREA_REGIONS[expandSido] || []).map((sigungu) => {
                  const full = `${expandSido} ${sigungu}`;
                  const already = (careRequest?.regions || []).includes(full)
                    || (careRequest?.regions || []).includes(expandSido); // 시·도만 등록된 경우도 포함으로 간주
                  const picked = expandRegions.includes(full);
                  return (
                    <button
                      key={sigungu}
                      type="button"
                      disabled={already}
                      onClick={() => {
                        setExpandRegions((prev) =>
                          prev.includes(full) ? prev.filter((r) => r !== full) : [...prev, full]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm ${
                        already
                          ? "bg-blue-500 text-white opacity-70 cursor-not-allowed ring-2 ring-blue-300"
                          : picked
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {already ? `✓ ${sigungu}` : sigungu}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowExpandRegionModal(false); setExpandRegions([]); }}
                  disabled={expandingRegion}
                  className="btn-secondary flex-1 text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={expandingRegion || expandRegions.length === 0}
                  onClick={async () => {
                    setExpandingRegion(true);
                    try {
                      // 추가할 신규 지역만 전송 — 백엔드에서 트랜잭션으로 atomic 병합
                      await careRequestAPI.expandRegions(careRequestId, expandRegions);
                      showToast("지역이 확대되었습니다. 해당 지역 간병인에게 알림이 발송됩니다.", "success");
                      setShowExpandRegionModal(false);
                      setExpandRegions([]);
                      fetchData();
                    } catch (err: any) {
                      showToast(err?.response?.data?.message || "확대 실패", "error");
                    } finally {
                      setExpandingRegion(false);
                    }
                  }}
                  className="flex-1 text-sm px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium rounded-lg"
                >
                  {expandingRegion ? "처리 중..." : `${expandRegions.length}개 지역 추가`}
                </button>
              </div>
            </div>
          </div>
        )}

        {showRaiseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                금액 인상 재공고
              </h3>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">현재 일당</span>
                    <span className="font-semibold text-gray-900">
                      {(careRequest?.dailyRate || 0).toLocaleString()}원
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    새 일당 (원)
                  </label>
                  <input
                    type="number"
                    value={newDailyRate}
                    onChange={(e) => setNewDailyRate(e.target.value)}
                    placeholder={`${((careRequest?.dailyRate || 0) + 10000).toLocaleString()}원 이상`}
                    min={(careRequest?.dailyRate || 0) + 1}
                    className="input-field"
                  />
                  {newDailyRate && parseInt(newDailyRate) > (careRequest?.dailyRate || 0) && (
                    <p className="text-sm text-green-600 mt-1">
                      +{(parseInt(newDailyRate) - (careRequest?.dailyRate || 0)).toLocaleString()}원 인상
                    </p>
                  )}
                  {newDailyRate && parseInt(newDailyRate) <= (careRequest?.dailyRate || 0) && (
                    <p className="text-sm text-red-500 mt-1">
                      현재 일당보다 높은 금액을 입력해주세요.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  disabled={raisingRate}
                  className="btn-secondary flex-1 text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleRaiseRate}
                  disabled={
                    raisingRate ||
                    !newDailyRate ||
                    parseInt(newDailyRate) <= (careRequest?.dailyRate || 0)
                  }
                  className="flex-1 text-sm px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  {raisingRate ? "처리 중..." : "재공고"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm dialog overlay */}
        {confirmTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                간병인 선택 확인
              </h3>
              <p className="text-gray-600 mb-4">
                <span className="font-semibold text-primary-600">
                  {confirmTarget.caregiverName}
                </span>
                님을 간병인으로 선택하시겠습니까?
              </p>

              {/* Show rate info in confirm dialog */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                {confirmTarget.isAccepted ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">제시 금액 수락</span>
                    <span className="font-semibold text-gray-900">{formatMoney(careRequest?.dailyRate)}</span>
                  </div>
                ) : confirmTarget.proposedRate ? (
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">제시 금액:</span>
                      <span className="text-gray-700">{formatMoney(careRequest?.dailyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-600 font-medium">역제안 금액:</span>
                      <span className="font-bold text-amber-700">{confirmTarget.proposedRate.toLocaleString()}원</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">제시 일당: {formatMoney(careRequest?.dailyRate)}</div>
                )}
              </div>

              <span className="text-sm text-gray-400 block mb-6">
                선택 후에는 변경이 어려울 수 있습니다.
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmTarget(null)}
                  disabled={selecting !== null}
                  className="btn-secondary flex-1 text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect(confirmTarget.caregiverId)}
                  disabled={selecting !== null}
                  className="btn-primary flex-1 text-sm"
                >
                  {selecting ? "처리 중..." : "확인"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 매칭 완료 후 결제 상태 안내 배너
function PaymentStatusBanner({ careRequestId }: { careRequestId: string }) {
  const [contractId, setContractId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"NONE" | "ESCROW" | "COMPLETED">("NONE");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await applicantAPI.getApplicants(careRequestId);
        const data = res.data?.data || res.data;
        const contract = data?.contract;
        if (contract) {
          setContractId(contract.id);
          setTotalAmount(contract.totalAmount || 0);
          // 결제 내역 조회
          const payRes = await fetch(`/api/payments/history?contractId=${contract.id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("cm_access_token")}` },
          }).then((r) => r.json());
          const payments = payRes?.data?.payments || [];
          const completed = payments.find((p: any) => p.status === "COMPLETED");
          const escrow = payments.find((p: any) => p.status === "ESCROW");
          if (completed) {
            setPaymentStatus("COMPLETED");
            setPaidAmount(completed.totalAmount);
          } else if (escrow) {
            setPaymentStatus("ESCROW");
            setPaidAmount(escrow.totalAmount);
          }
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [careRequestId]);

  if (loading || !contractId) return null;

  const isPaid = paymentStatus === "COMPLETED";
  const isEscrow = paymentStatus === "ESCROW";

  const bgClass = isPaid
    ? "bg-green-50 border-green-200"
    : isEscrow
    ? "bg-blue-50 border-blue-200"
    : "bg-orange-50 border-orange-300";

  const badgeColor = isPaid ? "text-green-600" : isEscrow ? "text-blue-600" : "text-orange-600";
  const badgeText = isPaid ? "✓ 결제 완료" : isEscrow ? "🔒 에스크로 보관 중" : "⚠ 결제 대기 중";
  const mainText = isPaid
    ? `${paidAmount.toLocaleString()}원 결제됨`
    : isEscrow
    ? `${paidAmount.toLocaleString()}원 보관 중`
    : `${totalAmount.toLocaleString()}원 결제가 필요합니다`;

  return (
    <div className={`mt-6 rounded-lg p-6 border-2 ${bgClass}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className={`text-xs font-semibold mb-1 ${badgeColor}`}>{badgeText}</div>
          <div className="text-lg font-bold text-gray-900">{mainText}</div>
          {!isPaid && !isEscrow && (
            <p className="text-sm text-gray-600 mt-1">결제를 완료해야 간병 서비스가 정식 시작됩니다.</p>
          )}
          {isEscrow && (
            <p className="text-sm text-gray-600 mt-1">간병 완료 후 간병인에게 정산됩니다.</p>
          )}
        </div>
        {!isPaid && !isEscrow && (
          <Link
            href={`/dashboard/guardian/payment/${contractId}`}
            className="inline-flex items-center gap-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors whitespace-nowrap"
          >
            결제하기 →
          </Link>
        )}
      </div>
    </div>
  );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <div className="text-base font-bold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}
