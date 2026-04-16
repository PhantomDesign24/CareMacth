"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { applicantAPI, careRequestAPI } from "@/lib/api";
import {
  formatDate,
  formatMoney,
  formatCareType,
  formatLocation,
  formatCareStatus,
} from "@/lib/format";

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
}

interface Application {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  proposedRate: number | null;
  isAccepted: boolean;
  caregiver: Caregiver;
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
  const [careRequest, setCareRequest] = useState<CareRequest | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    caregiverId: string;
    caregiverName: string;
    proposedRate: number | null;
    isAccepted: boolean;
  } | null>(null);

  // 금액 인상 모달 상태
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [newDailyRate, setNewDailyRate] = useState("");
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
        applications: (data.applications || []).map((app: any) => ({
          id: app.id,
          status: app.status || "PENDING",
          message: app.message || "",
          createdAt: app.createdAt || "",
          proposedRate: app.proposedRate ?? null,
          isAccepted: app.isAccepted ?? false,
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
          },
        })),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "데이터를 불러오는 중 오류가 발생했습니다.";
      setError(message);
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
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "금액 인상 중 오류가 발생했습니다.";
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
              <button
                type="button"
                onClick={() => {
                  setNewDailyRate("");
                  setShowRaiseModal(true);
                }}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                금액 올리기
              </button>
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
              return (
                <div key={app.id} className="card">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Profile section */}
                    <div className="flex items-start gap-4 md:w-1/3">
                      <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {cg.user.profileImage ? (
                          <img
                            src={cg.user.profileImage}
                            alt={cg.user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg
                            className="w-8 h-8 text-gray-400"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {cg.user.name}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-500">
                          <span>{formatGender(cg.gender)}</span>
                          {cg.nationality && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span>{cg.nationality}</span>
                            </>
                          )}
                        </div>
                        <div className="mt-2">{renderStars(cg.avgRating)}</div>

                        {/* Rate badge */}
                        <div className="mt-3">
                          {app.isAccepted ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              제시 금액 수락 - {formatMoney(careRequest?.dailyRate)}
                            </span>
                          ) : app.proposedRate ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              역제안 - {app.proposedRate.toLocaleString()}원/일
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Stats section */}
                    <div className="md:w-1/3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">경력</span>
                          <p className="font-medium text-gray-900">
                            {cg.experienceYears}년
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">총 매칭</span>
                          <p className="font-medium text-gray-900">
                            {cg.totalMatches}건
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">재고용률</span>
                          <p className="font-medium text-gray-900">
                            {cg.rehireRate}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">지원일</span>
                          <p className="font-medium text-gray-900">
                            {formatDate(app.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Certificates */}
                      {cg.certificates.length > 0 && (
                        <div className="mt-3">
                          <span className="text-sm text-gray-500">자격증</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {cg.certificates.map(
                              (cert, idx: number) => (
                                <span
                                  key={cert.id || idx}
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cert.verified ? "bg-green-50 text-green-700" : "bg-primary-50 text-primary-700"}`}
                                  title={`발급: ${cert.issuer}`}
                                >
                                  {cert.verified && <span>✓</span>}
                                  {cert.name}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Specialties */}
                      {cg.specialties.length > 0 && (
                        <div className="mt-3">
                          <span className="text-sm text-gray-500">전문분야</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {cg.specialties.map(
                              (spec: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-50 text-secondary-700"
                                >
                                  {spec}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Message + Action section */}
                    <div className="md:w-1/3 flex flex-col justify-between">
                      {/* 제안 금액 강조 표시 */}
                      <div className="mb-3 rounded-xl p-4 border-2 border-primary-200 bg-primary-50">
                        <div className="text-xs text-gray-500 mb-1">
                          {app.isAccepted ? "보호자 제시 금액 수락" : app.proposedRate ? "간병인 제안 금액" : "금액 미제시"}
                        </div>
                        <div className="text-2xl font-extrabold text-primary-600">
                          {app.proposedRate != null
                            ? `${app.proposedRate.toLocaleString()}원`
                            : app.isAccepted && careRequest?.dailyRate
                              ? `${careRequest.dailyRate.toLocaleString()}원`
                              : "협의"}
                          <span className="ml-1 text-xs font-medium text-gray-400">/ 일</span>
                        </div>
                        {app.proposedRate != null && careRequest?.dailyRate && (
                          <div className="mt-1 text-xs text-gray-500">
                            원래 제시: {careRequest.dailyRate.toLocaleString()}원
                            {app.proposedRate > careRequest.dailyRate && <span className="ml-1 text-orange-600">(+{(app.proposedRate - careRequest.dailyRate).toLocaleString()})</span>}
                            {app.proposedRate < careRequest.dailyRate && <span className="ml-1 text-green-600">(-{(careRequest.dailyRate - app.proposedRate).toLocaleString()})</span>}
                          </div>
                        )}
                      </div>

                      {app.message && (
                        <div className="bg-gray-50 rounded-xl p-4 mb-4">
                          <span className="text-xs text-gray-500 block mb-1">
                            지원 메시지
                          </span>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {app.message}
                          </p>
                        </div>
                      )}

                      {/* 상태별 액션 버튼 */}
                      {careRequest?.status === "CANCELLED" ? (
                        app.status === "ACCEPTED" ? (
                          <div className="w-full py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl text-center border border-gray-200">
                            취소된 요청
                          </div>
                        ) : (
                          <div className="w-full py-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl text-center">
                            취소된 요청
                          </div>
                        )
                      ) : careRequest?.status === "MATCHED" || careRequest?.status === "IN_PROGRESS" || careRequest?.status === "COMPLETED" ? (
                        app.status === "ACCEPTED" ? (
                          <div className="w-full py-2.5 text-sm font-semibold text-green-700 bg-green-50 rounded-xl text-center border border-green-200">
                            ✓ 이 간병인과 매칭 완료
                          </div>
                        ) : (
                          <div className="w-full py-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl text-center">
                            매칭 종료됨
                          </div>
                        )
                      ) : app.status === "REJECTED" || app.status === "CANCELLED" ? (
                        <div className="w-full py-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl text-center">
                          {app.status === "REJECTED" ? "거절됨" : "취소됨"}
                        </div>
                      ) : !['OPEN', 'MATCHING'].includes(careRequest?.status || '') ? (
                        <div className="w-full py-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl text-center">
                          선택 불가
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmTarget({
                              caregiverId: cg.id,
                              caregiverName: cg.user.name,
                              proposedRate: app.proposedRate,
                              isAccepted: app.isAccepted,
                            })
                          }
                          disabled={selecting !== null}
                          className="btn-primary w-full text-sm"
                        >
                          {selecting === cg.id ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            "이 간병인 선택"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 취소된 요청 안내 */}
        {careRequest?.status === "CANCELLED" && (
          <div className="mt-6 rounded-2xl p-6 border-2 bg-gray-50 border-gray-200">
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

        {/* 금액 인상 모달 */}
        {showRaiseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                금액 인상 재공고
              </h3>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
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
                  className="flex-1 text-sm px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
                >
                  {raisingRate ? "처리 중..." : "인상 후 재공고"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm dialog overlay */}
        {confirmTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
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
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
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
    <div className={`mt-6 rounded-2xl p-6 border-2 ${bgClass}`}>
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
            className="inline-flex items-center gap-1 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors whitespace-nowrap"
          >
            결제하기 →
          </Link>
        )}
      </div>
    </div>
  );
}
