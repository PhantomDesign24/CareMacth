"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getCaregiver,
  approveCaregiver,
  rejectCaregiver,
  blacklistCaregiver,
  toggleBadge,
  addPenalty,
  addMemo,
  verifyCertificate,
} from "@/lib/api";
import {
  caregiverStatusLabel as statusLabel,
  caregiverStatusBadge as statusBadge,
  PENALTY_TYPES,
} from "@/lib/constants";

// ─── Helpers ───────────────────────────────────────────

function genderLabel(gender: string | null | undefined): string {
  if (!gender) return "";
  switch (gender) {
    case "M": return "남성";
    case "F": return "여성";
    default: return gender;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return value;
  }
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "0원";
  return value.toLocaleString() + "원";
}

function penaltyTypeLabel(type: string): string {
  return PENALTY_TYPES.find((p) => p.value === type)?.label || type;
}

// ─── Sub-components ────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
      <span className="ml-1 text-sm font-medium text-gray-600">{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────

interface CaregiverDetailData {
  id: string;
  status: string;
  workStatus: string;
  gender: string | null;
  nationality: string | null;
  birthDate: string | null;
  address: string | null;
  specialties: string[];
  experienceYears: number;
  avgRating: number;
  totalMatches: number;
  rehireRate: number;
  cancellationRate: number;
  penaltyCount: number;
  noShowCount: number;
  hasBadge: boolean;
  badgeGrantedAt: string | null;
  associationFee: number;
  associationPaidAt: string | null;
  criminalCheckDone: boolean;
  criminalCheckDate: string | null;
  criminalCheckDoc: string | null;
  idCardImage: string | null;
  identityVerified: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    profileImage: string | null;
    createdAt: string;
  };
  certificates: {
    id: string;
    name: string;
    issuer: string;
    issueDate: string;
    imageUrl: string;
    verified: boolean;
  }[];
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    guardianName: string;
    createdAt: string;
  }[];
  penalties: {
    id: string;
    type: string;
    reason: string;
    isAutomatic: boolean;
    grantedBy: string | null;
    createdAt: string;
  }[];
  consultMemos: {
    id: string;
    content: string;
    adminId: string;
    createdAt: string;
  }[];
}

// ─── Main Page ─────────────────────────────────────────

export default function CaregiverDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<CaregiverDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"certificates" | "criminal" | "reviews" | "penalties" | "memos" | "documents">("certificates");

  // Image modal
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

  // Penalty form
  const [showPenaltyForm, setShowPenaltyForm] = useState(false);
  const [penaltyType, setPenaltyType] = useState("MANUAL");
  const [penaltyReason, setPenaltyReason] = useState("");

  // Memo form
  const [memoContent, setMemoContent] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getCaregiver(id);
      setData(result as unknown as CaregiverDetailData);
    } catch (err: any) {
      setError(err?.message || "간병인 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, fetchData]);

  // ─── Action handlers ──────────────────────────────────

  async function handleApprove() {
    if (!confirm("이 간병인을 승인하시겠습니까?")) return;
    try {
      setActionLoading(true);
      await approveCaregiver(id);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "승인 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!confirm("이 간병인을 거절하시겠습니까?")) return;
    try {
      setActionLoading(true);
      await rejectCaregiver(id);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "거절 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBlacklist() {
    if (!confirm("이 간병인을 블랙리스트에 등록하시겠습니까? 이 작업은 되돌리기 어렵습니다.")) return;
    try {
      setActionLoading(true);
      await blacklistCaregiver(id);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "블랙리스트 등록 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleBadge() {
    const action = data?.hasBadge ? "회수" : "부여";
    if (!confirm(`우수 간병사 뱃지를 ${action}하시겠습니까?`)) return;
    try {
      setActionLoading(true);
      await toggleBadge(id);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "뱃지 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddPenalty(e: React.FormEvent) {
    e.preventDefault();
    if (!penaltyReason.trim()) {
      alert("패널티 사유를 입력해주세요.");
      return;
    }
    try {
      setActionLoading(true);
      await addPenalty(id, { type: penaltyType, reason: penaltyReason.trim() });
      setPenaltyType("MANUAL");
      setPenaltyReason("");
      setShowPenaltyForm(false);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "패널티 부여 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddMemo(e: React.FormEvent) {
    e.preventDefault();
    if (!memoContent.trim()) {
      alert("메모 내용을 입력해주세요.");
      return;
    }
    try {
      setActionLoading(true);
      await addMemo(id, memoContent.trim());
      setMemoContent("");
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "메모 작성 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVerifyCertificate(certId: string) {
    if (!confirm("이 자격증을 검증 확인하시겠습니까?")) return;
    try {
      setActionLoading(true);
      await verifyCertificate(id, certId);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "자격증 검증 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  // ─── Loading / Error states ────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <svg className="mx-auto h-8 w-8 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">간병인 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <p className="mt-3 text-sm text-gray-600">{error || "간병인 정보를 불러올 수 없습니다."}</p>
        <button onClick={fetchData} className="btn-primary mt-4">
          다시 시도
        </button>
      </div>
    );
  }

  // ─── Derived values ────────────────────────────────────

  const certificates = data.certificates || [];
  const reviews = data.reviews || [];
  const penalties = data.penalties || [];
  const memos = data.consultMemos || [];

  const tabs = [
    { key: "certificates" as const, label: "자격증 목록", count: certificates.length },
    { key: "criminal" as const, label: "범죄이력 조회" },
    { key: "documents" as const, label: "서류" },
    { key: "reviews" as const, label: "리뷰/평점", count: reviews.length },
    { key: "penalties" as const, label: "패널티 이력", count: penalties.length },
    { key: "memos" as const, label: "상담 메모", count: memos.length },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/caregivers" className="hover:text-primary-600">간병인 관리</Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="font-medium text-gray-900">{data.user.name}</span>
      </nav>

      {/* Profile Header */}
      <div className="card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Avatar */}
          {data.user.profileImage ? (
            <img
              src={data.user.profileImage}
              alt={data.user.name}
              className="h-24 w-24 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary-100 text-3xl font-bold text-primary-600">
              {data.user.name.charAt(0)}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{data.user.name}</h1>
              <span className={statusBadge(data.status)}>
                {statusLabel(data.status)}
              </span>
              {data.hasBadge && (
                <span className="badge-purple">
                  <svg className="mr-0.5 h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  우수 간병사
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-gray-400">연락처</p>
                <p className="mt-0.5 text-sm text-gray-900">{data.user.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">이메일</p>
                <p className="mt-0.5 text-sm text-gray-900">{data.user.email || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">생년월일</p>
                <p className="mt-0.5 text-sm text-gray-900">
                  {formatDate(data.birthDate)}
                  {data.gender ? ` (${genderLabel(data.gender)})` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">주소</p>
                <p className="mt-0.5 text-sm text-gray-900">{data.address || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-gray-400">경력</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">{data.experienceYears}년</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">총 매칭 횟수</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">{data.totalMatches}회</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">평점</p>
                <div className="mt-0.5">
                  <StarRating rating={data.avgRating} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">협회비</p>
                <p className={`mt-0.5 text-sm font-semibold ${data.associationPaidAt ? "text-emerald-600" : "text-red-500"}`}>
                  {data.associationPaidAt ? `납부 (${formatDate(data.associationPaidAt)})` : "미납"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-gray-400">재고용률</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">{(data.rehireRate * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">취소율</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">{(data.cancellationRate * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">패널티 횟수</p>
                <p className={`mt-0.5 text-sm font-semibold ${data.penaltyCount > 0 ? "text-red-600" : "text-gray-900"}`}>
                  {data.penaltyCount}회 (노쇼 {data.noShowCount}회)
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">가입일</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">{formatDate(data.createdAt)}</p>
              </div>
            </div>

            {data.specialties && data.specialties.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400">전문 분야</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.specialties.map((s) => (
                    <span key={s} className="badge-blue">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 lg:items-end">
            {data.status === "PENDING" && (
              <>
                <button onClick={handleApprove} disabled={actionLoading} className="btn-primary">
                  승인
                </button>
                <button onClick={handleReject} disabled={actionLoading} className="btn-danger">
                  거절
                </button>
              </>
            )}
            {data.status === "APPROVED" && (
              <button onClick={handleToggleBadge} disabled={actionLoading} className="btn-primary">
                {data.hasBadge ? "뱃지 회수" : "뱃지 부여"}
              </button>
            )}
            {data.status !== "BLACKLISTED" && (
              <>
                <button
                  onClick={() => { setShowPenaltyForm(true); setActiveTab("penalties"); }}
                  disabled={actionLoading}
                  className="btn-warning"
                >
                  패널티 부여
                </button>
                <button onClick={handleBlacklist} disabled={actionLoading} className="btn-danger">
                  블랙리스트 등록
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-4 border-b border-gray-200 sm:mx-0">
        <nav className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors sm:px-5 ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1.5 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.key ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {/* Certificates */}
        {activeTab === "certificates" && (
          <div className="space-y-3">
            {certificates.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16">
                <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <p className="mt-3 text-sm text-gray-400">등록된 자격증이 없습니다.</p>
              </div>
            ) : (
              certificates.map((cert) => (
                <div key={cert.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
                      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{cert.name}</p>
                      <p className="text-sm text-gray-500">{cert.issuer} | 발급일: {formatDate(cert.issueDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {cert.verified ? (
                      <span className="badge-green">
                        <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        인증됨
                      </span>
                    ) : (
                      <span className="badge-yellow">미인증</span>
                    )}
                    {cert.imageUrl && (
                      <a href={cert.imageUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                        보기
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Criminal Record */}
        {activeTab === "criminal" && (
          <div className="card">
            <div className="flex items-start gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                data.criminalCheckDone ? "bg-emerald-50" : "bg-yellow-50"
              }`}>
                {data.criminalCheckDone ? (
                  <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                ) : (
                  <svg className="h-7 w-7 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">범죄이력 조회 결과</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-gray-400">조회 여부</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">{data.criminalCheckDone ? "조회 완료" : "미조회"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400">조회일</p>
                    <p className="mt-0.5 text-sm text-gray-900">{formatDate(data.criminalCheckDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400">결과</p>
                    <p className={`mt-0.5 text-sm font-semibold ${
                      data.criminalCheckDone ? "text-emerald-600" : "text-gray-500"
                    }`}>
                      {data.criminalCheckDone ? "범죄이력 없음" : "미조회"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents (서류) */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            {/* 자격증 목록 with image viewer */}
            <div className="card">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">자격증 목록</h3>
              {certificates.length === 0 ? (
                <p className="text-sm text-gray-400">등록된 자격증이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        {cert.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setImageModalUrl(cert.imageUrl)}
                            className="h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                          >
                            <img src={cert.imageUrl} alt={cert.name} className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                            <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{cert.name}</p>
                            {cert.verified && (
                              <span className="badge-green">
                                <svg className="mr-0.5 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                인증됨
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{cert.issuer}</p>
                          <p className="text-xs text-gray-400">발급일: {formatDate(cert.issueDate)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cert.imageUrl && (
                          <a href={cert.imageUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                            원본 보기
                          </a>
                        )}
                        {!cert.verified && (
                          <button
                            onClick={() => handleVerifyCertificate(cert.id)}
                            disabled={actionLoading}
                            className="btn-primary btn-sm"
                          >
                            {actionLoading ? "처리 중..." : "검증 확인"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 신분증 */}
            <div className="card">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">신분증</h3>
              {data.idCardImage ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <button
                    type="button"
                    onClick={() => setImageModalUrl(data.idCardImage!)}
                    className="h-32 w-full max-w-[12rem] flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-gray-200 hover:opacity-80 transition-opacity sm:w-48"
                  >
                    <img src={data.idCardImage} alt="신분증" className="h-full w-full object-cover" />
                  </button>
                  <div>
                    <p className="text-sm text-gray-700">신분증이 등록되어 있습니다.</p>
                    <p className={`mt-1 text-sm font-medium ${data.identityVerified ? "text-emerald-600" : "text-amber-600"}`}>
                      {data.identityVerified ? "본인 확인 완료" : "본인 확인 미완료"}
                    </p>
                    <a href={data.idCardImage} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm mt-2 inline-block">
                      원본 보기
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-gray-400">
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                  </svg>
                  <p className="text-sm">미등록</p>
                </div>
              )}
            </div>

            {/* 범죄이력 조회서 */}
            <div className="card">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">범죄이력 조회서</h3>
              {data.criminalCheckDoc ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <button
                    type="button"
                    onClick={() => setImageModalUrl(data.criminalCheckDoc!)}
                    className="h-32 w-full max-w-[12rem] flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-gray-200 hover:opacity-80 transition-opacity sm:w-48"
                  >
                    <img src={data.criminalCheckDoc} alt="범죄이력 조회서" className="h-full w-full object-cover" />
                  </button>
                  <div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium text-gray-400">조회 여부</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-900">{data.criminalCheckDone ? "조회 완료" : "미조회"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400">조회일</p>
                        <p className="mt-0.5 text-sm text-gray-900">{formatDate(data.criminalCheckDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400">결과</p>
                        <p className={`mt-0.5 text-sm font-semibold ${data.criminalCheckDone ? "text-emerald-600" : "text-gray-500"}`}>
                          {data.criminalCheckDone ? "범죄이력 없음" : "미조회"}
                        </p>
                      </div>
                    </div>
                    <a href={data.criminalCheckDoc} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm mt-3 inline-block">
                      원본 보기
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${data.criminalCheckDone ? "bg-emerald-50" : "bg-yellow-50"}`}>
                    {data.criminalCheckDone ? (
                      <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                      </svg>
                    ) : (
                      <svg className="h-7 w-7 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium text-gray-400">조회 여부</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900">{data.criminalCheckDone ? "조회 완료" : "미조회"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400">조회일</p>
                      <p className="mt-0.5 text-sm text-gray-900">{formatDate(data.criminalCheckDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400">결과</p>
                      <p className={`mt-0.5 text-sm font-semibold ${data.criminalCheckDone ? "text-emerald-600" : "text-gray-500"}`}>
                        {data.criminalCheckDone ? "범죄이력 없음" : "미조회"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reviews */}
        {activeTab === "reviews" && (
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16">
                <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                <p className="mt-3 text-sm text-gray-400">리뷰가 없습니다.</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="card">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StarRating rating={review.rating} />
                        <span className="text-sm text-gray-500">| {review.guardianName}</span>
                      </div>
                      {review.comment && (
                        <p className="mt-2 text-sm text-gray-700">{review.comment}</p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400">{formatDate(review.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Penalties */}
        {activeTab === "penalties" && (
          <div className="space-y-4">
            {/* Penalty Form */}
            {showPenaltyForm && (
              <div className="card border-2 border-amber-200 bg-amber-50/50">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">패널티 부여</h3>
                <form onSubmit={handleAddPenalty} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">유형</label>
                    <select
                      value={penaltyType}
                      onChange={(e) => setPenaltyType(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {PENALTY_TYPES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">사유</label>
                    <textarea
                      value={penaltyReason}
                      onChange={(e) => setPenaltyReason(e.target.value)}
                      placeholder="패널티 사유를 입력하세요..."
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={actionLoading} className="btn-warning">
                      {actionLoading ? "처리 중..." : "부여"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPenaltyForm(false)}
                      className="btn-secondary"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
            )}

            {penalties.length === 0 && !showPenaltyForm ? (
              <div className="card flex flex-col items-center justify-center py-16">
                <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="mt-3 text-sm text-gray-400">패널티 이력이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {penalties.map((p) => (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="badge-red">{penaltyTypeLabel(p.type)}</span>
                        <p className="mt-2 text-sm text-gray-700">{p.reason}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDate(p.createdAt)} | {p.isAutomatic ? "자동" : "수동"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Memos */}
        {activeTab === "memos" && (
          <div className="space-y-4">
            {/* Memo Form */}
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">메모 작성</h3>
              <form onSubmit={handleAddMemo} className="space-y-3">
                <textarea
                  value={memoContent}
                  onChange={(e) => setMemoContent(e.target.value)}
                  placeholder="상담 메모를 입력하세요..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button type="submit" disabled={actionLoading || !memoContent.trim()} className="btn-primary">
                  {actionLoading ? "저장 중..." : "메모 저장"}
                </button>
              </form>
            </div>

            {memos.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-12">
                <p className="text-sm text-gray-400">작성된 상담 메모가 없습니다.</p>
              </div>
            ) : (
              memos.map((memo) => (
                <div key={memo.id} className="card">
                  <p className="text-sm text-gray-700">{memo.content}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <span>관리자</span>
                    <span>|</span>
                    <span>{formatDate(memo.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {imageModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setImageModalUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImageModalUrl(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg hover:text-gray-900"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={imageModalUrl}
              alt="서류 이미지"
              className="max-h-[85vh] rounded-lg object-contain"
            />
            <div className="mt-2 text-center">
              <a
                href={imageModalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white underline hover:no-underline"
              >
                새 탭에서 열기
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
