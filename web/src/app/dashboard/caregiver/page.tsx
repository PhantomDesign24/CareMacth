"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { dashboardAPI, caregiverAPI, careRequestAPI, contractAPI, reviewAPI, reportAPI, paymentAPI } from "@/lib/api";
import { formatDate, formatContractStatus, formatCareType, formatLocation, formatPenaltyType } from "@/lib/format";
import { showToast } from "@/components/Toast";
import NotificationPrefsSection from "@/components/NotificationPrefsSection";

interface Earnings {
  thisMonth: number;
  lastMonth: number;
  total: number;
  pending: number;
}

interface ActivityHistory {
  id: string;
  patientName: string;
  startDate: string;
  endDate: string;
  startDateRaw?: string;  // ISO 원본 (date 비교용)
  endDateRaw?: string;
  status: string;
  contractStatus: string;
  careType: string;
  location: string;
  earnings: number;
  hasTodayRecord?: boolean; // 오늘 간병일지 작성 여부
}

// 로컬 날짜 YYYY-MM-DD
function localYMD(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// 오늘 일지 작성 필요 여부: ACTIVE/EXTENDED + 오늘이 시작~종료일 안 + hasTodayRecord=false
function needsJournalToday(a: ActivityHistory): boolean {
  if (a.contractStatus !== 'ACTIVE' && a.contractStatus !== 'EXTENDED') return false;
  const today = localYMD(new Date());
  const startStr = a.startDateRaw ? localYMD(a.startDateRaw) : '';
  const endStr = a.endDateRaw ? localYMD(a.endDateRaw) : '';
  if (startStr && today < startStr) return false;
  if (endStr && today > endStr) return false;
  return !a.hasTodayRecord;
}

interface Penalty {
  id: string;
  date: string;
  reason: string;
  points: number;
  description: string;
}

interface OpenRequest {
  id: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  careType: string;
  location: string;
  hospitalName: string;
  address: string;
  region: string;
  startDate: string;
  duration: string;
  dailyRate: number;
  estimatedEarnings: number;
  urgency: string;
  mobilityStatus: string;
  hasDementia: boolean;
  hasInfection: boolean;
  diagnosis: string;
  specialRequirements: string;
}

interface CaregiverSummary {
  userName: string;
  referralCode: string;
  penaltyScore: number;
}

type Status = "working" | "available" | "immediately";

type TabKey = "earnings" | "activity" | "applications" | "journal" | "penalties" | "requests" | "reviews" | "referral" | "settings";

export default function CaregiverDashboardPage() {
  return (
    <Suspense fallback={null}>
      <CaregiverDashboard />
    </Suspense>
  );
}

function CaregiverDashboard() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tabFromUrl = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(tabFromUrl || "earnings");

  // 리뷰 + 신고
  const [receivedReviews, setReceivedReviews] = useState<any[]>([]);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [reportReason, setReportReason] = useState("INAPPROPRIATE");
  const [reportDetail, setReportDetail] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const loadReceivedReviews = useCallback(async () => {
    try {
      const res = await reviewAPI.myReceived();
      setReceivedReviews(res.data?.data?.reviews || []);
    } catch {}
  }, []);

  const submitReport = async () => {
    if (!reportTarget) return;
    setReportLoading(true);
    try {
      await reportAPI.create({
        targetType: "REVIEW",
        targetId: reportTarget.id,
        reason: reportReason,
        detail: reportDetail || undefined,
      });
      alert("신고가 접수되었습니다. 관리자가 검토 후 처리합니다.");
      setReportTarget(null);
      setReportReason("INAPPROPRIATE");
      setReportDetail("");
    } catch (err: unknown) {
      const message =
        (err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null) || "신고 처리 중 오류가 발생했습니다.";
      alert(message);
    } finally {
      setReportLoading(false);
    }
  };

  // Delete account state
  const [corporateName, setCorporateName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [currentStatus, setCurrentStatus] = useState<Status>("available");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Proposal modal state (역제안)
  const [proposalTarget, setProposalTarget] = useState<OpenRequest | null>(null);
  const [proposedRate, setProposedRate] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Cancel contract modal state
  const [cancelContractId, setCancelContractId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // 추가 간병비 요청 모달
  const [additionalFeeContractId, setAdditionalFeeContractId] = useState<string | null>(null);
  const [additionalFeeAmount, setAdditionalFeeAmount] = useState("");
  const [additionalFeeReason, setAdditionalFeeReason] = useState("");
  const [additionalFeeLoading, setAdditionalFeeLoading] = useState(false);

  const [summary, setSummary] = useState<CaregiverSummary | null>(null);
  const [earnings, setEarnings] = useState<Earnings>({ thisMonth: 0, lastMonth: 0, total: 0, pending: 0 });
  const [activityHistory, setActivityHistory] = useState<ActivityHistory[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, earningsRes, penaltiesRes, requestsRes, activityRes, applicationsRes] = await Promise.all([
        dashboardAPI.caregiverSummary(),
        caregiverAPI.getEarnings(),
        caregiverAPI.getPenalties(),
        careRequestAPI.list({ status: "open" }),
        caregiverAPI.getActivity(),
        caregiverAPI.getMyApplications().catch(() => ({ data: { data: [] } })),
      ]);
      // 내가 이미 지원한 요청 ID 목록 (PENDING/ACCEPTED 상태만)
      const myApps: any[] = applicationsRes.data?.data || [];
      setMyApplications(myApps);
      const activeAppIds = new Set(
        myApps
          .filter((a: any) => a.status === 'PENDING' || a.status === 'ACCEPTED')
          .map((a: any) => a.careRequestId)
      );
      // API 응답 파싱: { success, data: { ... } }
      const profile = summaryRes.data?.data || summaryRes.data || {};
      const user = profile.user || {};
      setSummary({
        userName: user.name || profile.name || '',
        referralCode: user.referralCode || '',
        penaltyScore: profile.penaltyCount || 0,
      });
      setCorporateName(profile.corporateName || '');
      if (profile.workStatus) {
        const statusMap: Record<string, Status> = { WORKING: 'working', AVAILABLE: 'available', IMMEDIATE: 'immediately' };
        setCurrentStatus(statusMap[profile.workStatus] || 'available');
      }

      const earningsData = earningsRes.data?.data || earningsRes.data || {};
      const earningsList = earningsData.earnings || [];
      const earningSummary = earningsData.summary || {};
      const totalEarned = earningSummary.totalNetAmount || earningsList.reduce((s: number, e: any) => s + (e.netAmount || 0), 0);
      const unpaidAmount = earningSummary.unpaidAmount || 0;
      setEarnings({ thisMonth: totalEarned, lastMonth: 0, total: totalEarned, pending: unpaidAmount });

      // 활동 이력 (계약 기반)
      const activityData = activityRes.data?.data || activityRes.data || {};
      const contracts = activityData.contracts || [];
      const todayYMD = localYMD(new Date());
      setActivityHistory(contracts.map((c: any) => {
        // 오늘 간병일지 작성 여부: careRecords 중 date가 오늘인 것
        const records = Array.isArray(c.careRecords) ? c.careRecords : [];
        const hasTodayRecord = records.some((r: any) => {
          if (!r.date) return false;
          return localYMD(r.date) === todayYMD;
        });
        return {
          id: c.id,
          patientName: c.careRequest?.patient?.name || '-',
          startDate: formatDate(c.startDate),
          endDate: formatDate(c.endDate),
          startDateRaw: c.startDate,
          endDateRaw: c.endDate,
          status: formatContractStatus(c.status),
          contractStatus: c.status || '',
          careType: formatCareType(c.careRequest?.careType || ''),
          location: formatLocation(c.careRequest?.location || ''),
          earnings: c.totalAmount || 0,
          hasTodayRecord,
        };
      }));

      const penaltyData = penaltiesRes.data?.data || penaltiesRes.data || {};
      const penaltyList = penaltyData.penalties || [];
      // 패널티 유형별 기준 점수 (CLAUDE.md 기준)
      const typeToPoints: Record<string, number> = {
        NO_SHOW: 30,         // 무단 불참
        CANCELLATION: 10,    // 24시간 이내 취소
        COMPLAINT: 10,       // 보호자 불만 (5~20 중앙값)
        MANUAL: 5,           // 관리자 수동
      };
      const typeToLabel: Record<string, string> = {
        NO_SHOW: "무단 불참",
        CANCELLATION: "24시간 이내 취소",
        COMPLAINT: "보호자 불만 접수",
        MANUAL: "관리자 부여 패널티",
      };
      setPenalties(penaltyList.map((p: any) => ({
        id: p.id,
        date: formatDate(p.createdAt),
        reason: typeToLabel[p.type] || p.type,
        points: typeToPoints[p.type] ?? 0,
        description: p.reason,
      })));

      const reqData = requestsRes.data?.data || requestsRes.data || {};
      const reqList = reqData.careRequests || [];
      // 이미 지원한 요청은 목록에서 제외
      const filteredList = reqList.filter((r: any) => !activeAppIds.has(r.id));
      setOpenRequests(filteredList.map((r: any) => {
        // 생년월일로 나이 계산
        let age = 0;
        if (r.patient?.birthDate) {
          const b = new Date(r.patient.birthDate);
          const now = new Date();
          age = now.getFullYear() - b.getFullYear();
          const m = now.getMonth() - b.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
        }
        // 긴급 판단: 시작일이 3일 이내
        const daysUntilStart = r.startDate
          ? Math.ceil((new Date(r.startDate).getTime() - Date.now()) / 86400000)
          : 999;
        return {
          id: r.id,
          patientName: r.patient?.name || '-',
          patientAge: age,
          patientGender: r.patient?.gender === 'F' ? '여' : '남',
          careType: r.careType === 'INDIVIDUAL' ? '1:1' : '가족',
          location: r.location === 'HOSPITAL' ? '병원' : '자택',
          hospitalName: r.hospitalName || '',
          address: r.address || '',
          region: r.region || '',
          startDate: formatDate(r.startDate),
          duration: r.durationDays ? `${r.durationDays}일` : '-',
          dailyRate: r.dailyRate || 0,
          estimatedEarnings: (r.dailyRate || 0) * (r.durationDays || 30),
          urgency: daysUntilStart <= 3 ? '급구' : '일반',
          mobilityStatus: r.patient?.mobilityStatus || '',
          hasDementia: !!r.patient?.hasDementia,
          hasInfection: !!r.patient?.hasInfection,
          diagnosis: r.patient?.diagnosis || '',
          specialRequirements: r.specialRequirements || '',
        };
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const router = useRouter();

  // URL ↔ 탭 동기화
  useEffect(() => {
    const t = searchParams.get("tab") as TabKey | null;
    if (t && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cm_access_token') : null;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    fetchData();
  }, [fetchData, router]);

  const handleStatusChange = async (status: Status) => {
    setCurrentStatus(status);
    try {
      await caregiverAPI.updateStatus(status);
    } catch {
      // Revert on failure is not needed for UI; status will sync on next load
    }
  };

  // 제시 금액 수락하고 지원
  const handleApply = async (requestId: string) => {
    setApplyingId(requestId);
    try {
      await caregiverAPI.applyWithProposal(requestId, { isAccepted: true });
      const target = openRequests.find((r) => r.id === requestId);
      showToast(`${target?.patientName || '환자'}님 간병 요청에 지원 완료. 보호자 확인을 기다려주세요.`, "success");
      setOpenRequests((prev) => prev.filter((r) => r.id !== requestId));
      // 백그라운드 동기화 (지원 이력 갱신)
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "지원 중 오류가 발생했습니다.";
      showToast(msg, "error");
      console.error('지원 실패:', err?.response?.data || err);
    } finally {
      setApplyingId(null);
    }
  };

  // 역제안 모달 열기
  const openProposalModal = (req: OpenRequest) => {
    setProposalTarget(req);
    setProposedRate(req.dailyRate ? String(req.dailyRate) : "");
    setProposalMessage("");
  };

  // 역제안 제출
  const handleSubmitProposal = async () => {
    if (!proposalTarget) return;
    const rate = parseInt(proposedRate);
    if (!rate || rate <= 0) {
      showToast("제안 금액을 입력해주세요.", "error");
      return;
    }
    setSubmittingProposal(true);
    try {
      await caregiverAPI.applyWithProposal(proposalTarget.id, {
        isAccepted: false,
        proposedRate: rate,
        message: proposalMessage,
      });
      showToast(`${proposalTarget.patientName}님께 ${rate.toLocaleString()}원 역제안 전송 완료`, "success");
      setOpenRequests((prev) => prev.filter((r) => r.id !== proposalTarget.id));
      setProposalTarget(null);
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "역제안 전송 실패";
      showToast(msg, "error");
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleCancelContract = async () => {
    if (!cancelContractId || !cancelReason.trim()) {
      alert("취소 사유를 입력해주세요.");
      return;
    }
    setCancelLoading(true);
    try {
      await contractAPI.cancel(cancelContractId, cancelReason.trim());
      alert("계약이 취소되었습니다. 패널티가 부과되었습니다.");
      setCancelContractId(null);
      setCancelReason("");
      await fetchData();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || "계약 취소 중 오류가 발생했습니다.");
      } else {
        alert("계약 취소 중 오류가 발생했습니다.");
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const referralCode = summary?.referralCode ?? "";
  // 실제 누적 점수는 개별 패널티의 points 합산 (summary.penaltyScore는 count였던 레거시 값이라 무시)
  const penaltyScore = penalties.reduce((sum, p) => sum + p.points, 0);

  const statusOptions: { value: Status; label: string; color: string; dotColor: string }[] = [
    { value: "working", label: "근무 중", color: "bg-blue-50 text-blue-700 border-blue-200", dotColor: "bg-blue-500" },
    { value: "available", label: "근무 가능", color: "bg-green-50 text-green-700 border-green-200", dotColor: "bg-green-500" },
    { value: "immediately", label: "즉시 가능", color: "bg-amber-50 text-amber-700 border-amber-200", dotColor: "bg-amber-500 animate-pulse" },
  ];

  const statusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "active":
      case "진행 중":
        return <span className="badge-success">진행 중</span>;
      case "completed":
      case "완료":
        return <span className="badge-primary">완료</span>;
      case "cancelled":
      case "취소":
        return <span className="badge-danger">취소</span>;
      case "extended":
      case "연장됨":
        return <span className="badge-primary">연장됨</span>;
      default:
        return <span className="badge-primary">{formatContractStatus(status)}</span>;
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    alert("추천인 코드가 복사되었습니다.");
  };

  const tabs = [
    { key: "earnings" as const, label: "수익" },
    { key: "requests" as const, label: "공고 확인" },
    { key: "applications" as const, label: "내 지원" },
    { key: "activity" as const, label: "활동 이력" },
    { key: "journal" as const, label: "간병일지" },
    { key: "reviews" as const, label: "받은 리뷰" },
    { key: "penalties" as const, label: "패널티" },
    { key: "referral" as const, label: "추천인 코드" },
    { key: "settings" as const, label: "계정 설정" },
  ];

  useEffect(() => {
    if (activeTab === "reviews") loadReceivedReviews();
  }, [activeTab, loadReceivedReviews]);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "탈퇴합니다") {
      setDeleteError('"탈퇴합니다"를 정확히 입력해주세요.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const { authAPI } = await import("@/lib/api");
      await authAPI.deleteAccount(deletePassword, deleteReason);
      alert("회원 탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다.");
      localStorage.removeItem("cm_access_token");
      localStorage.removeItem("cm_refresh_token");
      window.location.href = "/";
    } catch (err: unknown) {
      const message =
        (err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null) || "탈퇴 처리 중 오류가 발생했습니다.";
      setDeleteError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-primary-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500">대시보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button type="button" onClick={fetchData} className="btn-primary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const userName = summary?.userName ?? "간병인";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">간병인 대시보드</h1>
            <p className="text-gray-500 mt-1">안녕하세요, {userName}님</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/dashboard/caregiver/documents" className="btn-secondary text-sm px-4 py-2">
              서류 관리
            </Link>
            <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 mr-1">현재 상태:</span>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleStatusChange(opt.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  currentStatus === opt.value
                    ? opt.color
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  currentStatus === opt.value ? opt.dotColor : "bg-gray-300"
                }`} />
                {opt.label}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">이번 달 수익</div>
            <div className="text-2xl font-bold text-primary-600">
              {(earnings.thisMonth / 10000).toFixed(0)}만원
            </div>
            {earnings.lastMonth > 0 && (
              <div className="text-xs text-green-600 mt-1">
                {earnings.thisMonth >= earnings.lastMonth ? "+" : ""}
                {(((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth) * 100).toFixed(0)}% vs 지난달
              </div>
            )}
          </div>
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">정산 대기</div>
            <div className="text-2xl font-bold text-accent-500">
              {(earnings.pending / 10000).toFixed(0)}만원
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">누적 수익</div>
            <div className="text-2xl font-bold text-gray-900">
              {(earnings.total / 10000).toFixed(0)}만원
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">패널티 점수</div>
            <div className="text-2xl font-bold text-gray-900">
              {penaltyScore}점
            </div>
            <div className="text-xs text-gray-400 mt-1">최근 6개월</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            // 간병일지 탭: 오늘 미작성 계약이 1건이라도 있으면 빨간 점
            const showJournalAlert = tab.key === 'journal' && activityHistory.some(needsJournalToday);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`relative flex-1 min-w-[80px] px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-primary-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab.label}
                {showJournalAlert && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {/* Earnings */}
          {activeTab === "earnings" && (
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">수익 현황</h3>

              {/* Monthly breakdown */}
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <div className="font-medium text-gray-900">이번 달</div>
                    <div className="text-xs text-gray-400">진행 중</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-primary-600">
                      {earnings.thisMonth.toLocaleString()}원
                    </div>
                    <div className="text-xs text-gray-400">
                      정산 대기: {earnings.pending.toLocaleString()}원
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <div className="font-medium text-gray-900">지난 달</div>
                    <div className="text-xs text-gray-400">정산 완료</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-gray-900">
                      {earnings.lastMonth.toLocaleString()}원
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-5 bg-gray-50 rounded-2xl">
                <div className="text-sm text-gray-500 mb-1">누적 총 수익</div>
                <div className="text-3xl font-bold text-gray-900">
                  {earnings.total.toLocaleString()}원
                </div>
              </div>
            </div>
          )}

          {/* Open requests */}
          {activeTab === "requests" && (
            <div className="divide-y divide-gray-100">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">매칭 가능 공고</h3>
                <p className="text-sm text-gray-500">조건에 맞는 간병 요청 목록입니다.</p>
                {currentStatus === 'working' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
                    <span className="text-base">⚠</span>
                    <div>
                      <div className="font-semibold">현재 간병 진행 중입니다.</div>
                      <div className="text-xs text-amber-700 mt-0.5">
                        진행 중 상태에서는 새로운 지원을 할 수 없습니다. 현재 간병 종료 후 상단 상태를 &apos;근무 가능&apos;으로 변경하시면 지원할 수 있습니다.
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {openRequests.map((req) => (
                <div key={req.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-gray-900">
                          {req.patientName} 환자
                        </h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                          {req.careType}
                        </span>
                        {req.urgency === "급구" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">급구</span>
                        )}
                        {req.hasInfection && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">감염</span>
                        )}
                        {req.hasDementia && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">치매</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-gray-400 text-xs">환자</span>
                          <p className="text-gray-700 font-medium">{req.patientAge}세 {req.patientGender}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">거동 상태</span>
                          <p className="text-gray-700 font-medium">
                            {req.mobilityStatus === "DEPENDENT" ? "완전의존" : req.mobilityStatus === "PARTIAL" ? "부분도움" : "독립보행"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">장소</span>
                          <p className="text-gray-700 font-medium truncate">
                            {req.location}{req.hospitalName ? ` · ${req.hospitalName}` : ''}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">지역</span>
                          <p className="text-gray-700 font-medium">{req.region || '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">시작일</span>
                          <p className="text-gray-700 font-medium">{req.startDate}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">기간</span>
                          <p className="text-gray-700 font-medium">{req.duration}</p>
                        </div>
                        {req.diagnosis && (
                          <div className="col-span-2">
                            <span className="text-gray-400 text-xs">진단명</span>
                            <p className="text-gray-700 font-medium truncate">{req.diagnosis}</p>
                          </div>
                        )}
                      </div>
                      {req.specialRequirements && (
                        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 line-clamp-2">
                          요청사항: {req.specialRequirements}
                        </p>
                      )}
                    </div>
                    <div className="flex md:flex-col items-center md:items-stretch gap-3 shrink-0 md:w-44">
                      <div className="flex-1 md:flex-none bg-orange-50 rounded-xl px-4 py-3 text-center">
                        <div className="text-xs text-orange-600">일당</div>
                        <div className="text-base font-bold text-orange-600">
                          {req.dailyRate ? `${req.dailyRate.toLocaleString()}원` : "협의"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          총 {req.estimatedEarnings.toLocaleString()}원
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {currentStatus === 'working' ? (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                            ⚠ 진행 중 간병이 있어<br />지원할 수 없습니다
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-primary text-sm px-4 py-2.5 shrink-0 disabled:opacity-50"
                              disabled={applyingId === req.id}
                              onClick={() => handleApply(req.id)}
                            >
                              {applyingId === req.id ? "지원 중..." : "수락하고 지원"}
                            </button>
                            <button
                              type="button"
                              className="text-sm px-4 py-2.5 border border-orange-300 text-orange-600 rounded-xl hover:bg-orange-50"
                              onClick={() => openProposalModal(req)}
                            >
                              역제안
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {openRequests.length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  현재 매칭 가능한 공고가 없습니다.
                </div>
              )}
            </div>
          )}

          {/* My applications (내 지원) */}
          {activeTab === "applications" && (
            <div className="divide-y divide-gray-100">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">내 지원 내역</h3>
                <p className="text-sm text-gray-500">지원한 간병 요청과 처리 상태입니다.</p>
              </div>
              {myApplications.length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  지원한 공고가 없습니다.
                </div>
              )}
              {myApplications.map((app) => {
                const status = app.status;
                const cr = app.careRequest || {};
                const patient = cr.patient || {};
                let statusColor = "bg-gray-100 text-gray-600";
                let statusLabel = "대기";
                if (status === 'PENDING') { statusColor = "bg-orange-100 text-orange-700"; statusLabel = "대기 중"; }
                else if (status === 'ACCEPTED') { statusColor = "bg-green-100 text-green-700"; statusLabel = "수락됨"; }
                else if (status === 'REJECTED') { statusColor = "bg-gray-100 text-gray-500"; statusLabel = "미선택"; }
                else if (status === 'CANCELLED') { statusColor = "bg-gray-100 text-gray-500"; statusLabel = "취소됨"; }
                return (
                  <div key={app.id} className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                            {statusLabel}
                          </span>
                          {app.isAccepted === false && app.proposedRate ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                              역제안 {app.proposedRate.toLocaleString()}원
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                              금액 수락 지원
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900">
                          {patient.name || '-'} 환자
                        </h4>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                          <span>간병 유형: {cr.careType === 'INDIVIDUAL' ? '1:1' : cr.careType === 'FAMILY' ? '가족' : '-'}</span>
                          <span>장소: {cr.location === 'HOSPITAL' ? '병원' : '자택'}{cr.hospitalName ? ` · ${cr.hospitalName}` : ''}</span>
                          <span>시작일: {cr.startDate ? formatDate(cr.startDate) : '-'}</span>
                          {cr.durationDays && <span>기간: {cr.durationDays}일</span>}
                        </div>
                        {app.message && (
                          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
                            내 메시지: {app.message}
                          </p>
                        )}
                        <div className="text-xs text-gray-400">
                          지원일: {formatDate(app.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center md:items-end gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-gray-400">보호자 제시 일당</div>
                          <div className="text-base font-bold text-gray-900">
                            {cr.dailyRate ? `${cr.dailyRate.toLocaleString()}원` : '-'}
                          </div>
                          {app.proposedRate && (
                            <div className="text-xs text-blue-600 mt-1">
                              내 제안: {app.proposedRate.toLocaleString()}원
                            </div>
                          )}
                        </div>
                        {status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('지원을 취소하시겠습니까?')) return;
                              try {
                                await caregiverAPI.cancelApplication(cr.id);
                                showToast('지원이 취소되었습니다.', 'success');
                                fetchData();
                              } catch (err: any) {
                                showToast(err?.response?.data?.message || '취소 실패', 'error');
                              }
                            }}
                            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                          >
                            지원 취소
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Journal (간병일지 바로가기) */}
          {activeTab === "journal" && (
            <div className="divide-y divide-gray-100">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">간병일지 작성</h3>
                <p className="text-sm text-gray-500">진행 중인 간병 건을 선택해 일지를 작성하세요.</p>
              </div>
              {activityHistory.filter((a) => a.contractStatus === 'ACTIVE' || a.contractStatus === 'EXTENDED').length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  진행 중인 간병이 없습니다.
                </div>
              )}
              {activityHistory
                .filter((a) => a.contractStatus === 'ACTIVE' || a.contractStatus === 'EXTENDED')
                .map((a) => {
                  const missingToday = needsJournalToday(a);
                  return (
                    <Link
                      key={a.id}
                      href={`/dashboard/caregiver/journal/${a.id}`}
                      className="block p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {a.patientName} 환자
                            </h4>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              진행 중
                            </span>
                            {missingToday && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                오늘 일지 미작성
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {a.careType} · {a.location} · {a.startDate} ~ {a.endDate}
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 shrink-0">
                          📝 일지 작성 →
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          )}

          {/* Activity history */}
          {activeTab === "activity" && (
            <div className="divide-y divide-gray-100">
              {activityHistory.map((activity) => (
                <div key={activity.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        {statusBadge(activity.status)}
                      </div>
                      <h4 className="font-semibold text-gray-900">
                        {activity.patientName} - {activity.careType}
                      </h4>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                        <span>장소: {activity.location}</span>
                        <span>
                          기간: {activity.startDate} ~ {activity.endDate}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {activity.earnings.toLocaleString()}원
                        </div>
                      </div>
                      {(activity.contractStatus === 'ACTIVE' || activity.contractStatus === 'EXTENDED') && (
                        <>
                          <Link
                            href={`/dashboard/caregiver/journal/${activity.id}`}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                          >
                            📝 간병일지
                          </Link>
                          <button
                            type="button"
                            onClick={() => { setAdditionalFeeContractId(activity.id); setAdditionalFeeAmount(""); setAdditionalFeeReason(""); }}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            💰 추가비 요청
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            onClick={() => {
                              setCancelContractId(activity.id);
                              setCancelReason("");
                            }}
                          >
                            취소
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const t = typeof window !== "undefined" ? localStorage.getItem("cm_access_token") : "";
                          window.open(`/api/contracts/${activity.id}/pdf?token=${encodeURIComponent(t || "")}`, "_blank");
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        title="계약서 PDF"
                      >
                        📄 계약서
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {activityHistory.length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  활동 이력이 없습니다.
                </div>
              )}
            </div>
          )}

          {/* Penalties */}
          {activeTab === "penalties" && (
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">패널티 이력</h3>
              <p className="text-sm text-gray-500 mb-6">
                최근 6개월간의 패널티 이력입니다. 누적 점수에 따라 활동 제한이 발생할 수 있습니다.
              </p>

              {penalties.length > 0 ? (
                <div className="space-y-3">
                  {penalties.map((pen) => (
                    <div
                      key={pen.id}
                      className="flex items-start justify-between p-4 bg-red-50 border border-red-100 rounded-xl"
                    >
                      <div>
                        <div className="font-medium text-red-800">{pen.reason}</div>
                        <div className="text-sm text-red-600 mt-1">{pen.description}</div>
                        <div className="text-xs text-red-400 mt-1">{pen.date}</div>
                      </div>
                      <span className="text-lg font-bold text-red-600 shrink-0">
                        -{pen.points}점
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  패널티 이력이 없습니다.
                </div>
              )}

              <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-600">
                <strong>패널티 기준 안내:</strong>
                <ul className="mt-2 space-y-1 text-gray-500">
                  <li>- 24시간 이내 취소: -10점</li>
                  <li>- 무단 불참: -30점</li>
                  <li>- 보호자 불만 접수: -5~20점</li>
                  <li>- 50점 이상 누적 시 활동 정지</li>
                </ul>
              </div>
            </div>
          )}

          {/* Received Reviews */}
          {activeTab === "reviews" && (
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">받은 리뷰 ({receivedReviews.length})</h3>
              {receivedReviews.length === 0 ? (
                <div className="text-center py-12 text-gray-400">아직 받은 리뷰가 없습니다.</div>
              ) : (
                <div className="space-y-3">
                  {receivedReviews.map((r) => (
                    <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-500 text-lg">{"★".repeat(Math.round(r.rating))}{"☆".repeat(5 - Math.round(r.rating))}</span>
                            <span className="text-sm text-gray-600 font-medium">{r.rating.toFixed(1)}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {r.guardian?.user?.name || "익명"} · {formatDate(r.createdAt)}
                            {r.wouldRehire && <span className="ml-2 text-green-600">재고용 의향 ✓</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReportTarget(r)}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 border border-gray-200 rounded-lg hover:border-red-300"
                          title="이 리뷰 신고"
                        >
                          🚨 신고
                        </button>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Account Settings */}
          {activeTab === "settings" && (
            <div className="p-6 max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">계정 설정</h3>
                <p className="text-sm text-gray-500">계정 관련 설정을 변경합니다.</p>
              </div>

              {/* 간병일지 정보 설정 */}
              <div className="border border-gray-200 bg-white rounded-2xl p-6">
                <h4 className="font-bold text-gray-900 mb-1">간병일지 PDF 정보</h4>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  보험사 제출용 간병일지 PDF에 자동으로 포함됩니다. 한 번 저장하면 다음부터는 자동으로 채워집니다.
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  간병인 사용 법인명
                </label>
                <input
                  type="text"
                  value={corporateName}
                  onChange={(e) => setCorporateName(e.target.value)}
                  placeholder="예: ○○케어 주식회사"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await caregiverAPI.updateProfile({ corporateName });
                      showToast("저장되었습니다.", "success");
                    } catch {
                      showToast("저장에 실패했습니다.", "error");
                    }
                  }}
                  className="mt-3 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800"
                >
                  저장
                </button>
              </div>

              {/* 알림 카테고리 설정 */}
              <NotificationPrefsSection />

              <div className="border border-red-200 bg-red-50 rounded-2xl p-6">
                <h4 className="font-bold text-red-700 mb-2">회원 탈퇴</h4>
                <p className="text-sm text-red-600 mb-4 leading-relaxed">
                  회원 탈퇴 시 계정이 즉시 비활성화되며, 개인정보는 익명 처리됩니다.<br />
                  <strong>진행 중인 계약이 있거나 미정산 수익이 있으면 탈퇴할 수 없습니다.</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
                >
                  회원 탈퇴하기
                </button>
              </div>
            </div>
          )}

          {/* Referral */}
          {activeTab === "referral" && (
            <div className="p-6">
              <div className="max-w-md mx-auto text-center py-8">
                <div className="text-5xl mb-4">&#127873;</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  동료 간병인을 추천하세요!
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  추천인 코드로 가입한 간병인이 첫 간병을 완료하면, 본인에게 50,000원이 지급됩니다.
                </p>
                <div className="bg-gray-50 rounded-2xl p-6 mb-4">
                  <div className="text-sm text-gray-500 mb-1">내 추천인 코드</div>
                  <div className="text-2xl font-mono font-bold text-primary-600 tracking-wider">
                    {referralCode || "-"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyReferralCode}
                  disabled={!referralCode}
                  className="btn-primary w-full"
                >
                  코드 복사하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Review Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReportTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">리뷰 신고</h3>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="text-xs text-gray-500 mb-1">신고할 리뷰</div>
              <div className="text-gray-700">
                ⭐ {reportTarget.rating} / {reportTarget.comment?.slice(0, 80) || "(내용 없음)"}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">신고 사유 *</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="input-field"
                >
                  <option value="INAPPROPRIATE">부적절한 내용</option>
                  <option value="SPAM">스팸/광고</option>
                  <option value="ABUSE">욕설·비방</option>
                  <option value="FAKE">허위 사실</option>
                  <option value="PRIVACY">개인정보 노출</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상세 설명 <span className="text-gray-400 text-xs">(선택)</span></label>
                <textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="관리자 검토에 참고할 내용을 적어주세요"
                  className="input-field resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                disabled={reportLoading}
                className="btn-secondary flex-1"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={reportLoading}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium rounded-xl"
              >
                {reportLoading ? "처리 중..." : "신고 접수"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-red-700 mb-4">회원 탈퇴</h3>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
              <p className="font-semibold mb-2">⚠️ 탈퇴 전 꼭 확인해주세요</p>
              <ul className="space-y-1 text-xs list-disc list-inside">
                <li>계정이 즉시 비활성화됩니다</li>
                <li>개인정보는 익명 처리됩니다</li>
                <li>동일 이메일/전화번호로 다시 가입할 수 없습니다</li>
                <li>간병 이력·정산 내역은 법령에 따라 일정 기간 보관됩니다</li>
                <li>보유 포인트는 모두 소멸됩니다</li>
              </ul>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 <span className="text-red-500">*</span></label>
                <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="현재 비밀번호" className="input-field" autoComplete="current-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">탈퇴 사유 <span className="text-gray-400 text-xs">(선택)</span></label>
                <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={2} maxLength={500} className="input-field resize-none" placeholder="서비스 개선에 참고됩니다" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">확인 문구 <span className="text-red-500">*</span></label>
                <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder='"탈퇴합니다" 를 입력하세요' className="input-field" />
              </div>
              {deleteError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{deleteError}</div>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setDeleteModalOpen(false); setDeletePassword(""); setDeleteReason(""); setDeleteConfirmText(""); setDeleteError(""); }} disabled={deleteLoading} className="btn-secondary flex-1">취소</button>
              <button type="button" onClick={handleDeleteAccount} disabled={deleteLoading || !deletePassword || deleteConfirmText !== "탈퇴합니다"} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors">
                {deleteLoading ? "처리 중..." : "탈퇴 확정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가 간병비 요청 모달 */}
      {additionalFeeContractId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">추가 간병비 요청</h3>
            <p className="text-sm text-gray-500 mb-4">
              보호자가 승인하면 결제됩니다.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              금액 (원) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={additionalFeeAmount}
              onChange={(e) => setAdditionalFeeAmount(e.target.value)}
              placeholder="예: 50000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 mb-3"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={additionalFeeReason}
              onChange={(e) => setAdditionalFeeReason(e.target.value)}
              placeholder="추가 발생 사유를 기재해주세요"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none"
            />
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setAdditionalFeeContractId(null)}
                disabled={additionalFeeLoading}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={
                  additionalFeeLoading ||
                  !additionalFeeAmount ||
                  parseInt(additionalFeeAmount) <= 0 ||
                  !additionalFeeReason.trim()
                }
                onClick={async () => {
                  setAdditionalFeeLoading(true);
                  try {
                    await paymentAPI.createAdditionalFee({
                      contractId: additionalFeeContractId,
                      amount: parseInt(additionalFeeAmount),
                      reason: additionalFeeReason.trim(),
                    });
                    showToast("추가 간병비 요청이 전송되었습니다.", "success");
                    setAdditionalFeeContractId(null);
                  } catch (err: any) {
                    showToast(err?.response?.data?.message || "요청 실패", "error");
                  } finally {
                    setAdditionalFeeLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                {additionalFeeLoading ? "전송 중..." : "요청 전송"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 역제안 모달 */}
      {proposalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">역제안 하기</h3>
            <p className="text-sm text-gray-500 mb-4">
              {proposalTarget.patientName}님 간병 요청에 다른 일당을 제안합니다.
            </p>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">보호자 제시 일당</span>
                  <span className="font-semibold text-gray-900">
                    {proposalTarget.dailyRate?.toLocaleString() || 0}원
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제안 일당 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  placeholder="예: 180000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
                {proposedRate && parseInt(proposedRate) > (proposalTarget.dailyRate || 0) && (
                  <p className="text-xs text-green-600 mt-1">
                    +{(parseInt(proposedRate) - (proposalTarget.dailyRate || 0)).toLocaleString()}원 인상 제안
                  </p>
                )}
                {proposedRate && parseInt(proposedRate) < (proposalTarget.dailyRate || 0) && (
                  <p className="text-xs text-blue-600 mt-1">
                    -{((proposalTarget.dailyRate || 0) - parseInt(proposedRate)).toLocaleString()}원 할인 제안
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메시지 (선택)
                </label>
                <textarea
                  value={proposalMessage}
                  onChange={(e) => setProposalMessage(e.target.value)}
                  placeholder="보호자에게 전달할 메시지"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setProposalTarget(null)}
                disabled={submittingProposal}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitProposal}
                disabled={submittingProposal || !proposedRate || parseInt(proposedRate) <= 0}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                {submittingProposal ? "전송 중..." : "역제안 전송"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Cancel Modal (Caregiver) */}
      {cancelContractId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-amber-500 text-xl">&#9888;</span>
              계약을 취소하시겠습니까?
            </h3>
            <div className="space-y-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
                <p className="font-semibold mb-2">취소 시 다음 페널티가 부과됩니다:</p>
                <ul className="space-y-1.5">
                  <li>- 취소율 증가 (매칭 점수 감소)</li>
                  <li>- 3회 이상 노쇼/취소 시 활동 정지</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">현재 취소 횟수</span>
                  <span className="font-semibold text-gray-900">
                    {penaltyScore}회 / 정지 기준: 3회
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  취소 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="취소 사유를 입력해주세요"
                  rows={3}
                  className="input-field resize-none"
                  maxLength={500}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setCancelContractId(null);
                  setCancelReason("");
                }}
                disabled={cancelLoading}
                className="btn-secondary flex-1"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={handleCancelContract}
                disabled={cancelLoading || !cancelReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
              >
                {cancelLoading ? "처리 중..." : "취소하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
