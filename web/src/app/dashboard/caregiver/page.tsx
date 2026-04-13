"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { dashboardAPI, caregiverAPI, careRequestAPI, contractAPI } from "@/lib/api";
import { formatDate, formatContractStatus, formatCareType, formatLocation } from "@/lib/format";

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
  status: string;
  contractStatus: string;
  careType: string;
  location: string;
  earnings: number;
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
  patientAge: number;
  patientGender: string;
  careType: string;
  location: string;
  startDate: string;
  duration: string;
  estimatedEarnings: number;
  urgency: string;
}

interface CaregiverSummary {
  userName: string;
  referralCode: string;
  penaltyScore: number;
}

type Status = "working" | "available" | "immediately";

export default function CaregiverDashboard() {
  const [activeTab, setActiveTab] = useState<
    "earnings" | "activity" | "penalties" | "requests" | "referral"
  >("earnings");
  const [currentStatus, setCurrentStatus] = useState<Status>("available");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Cancel contract modal state
  const [cancelContractId, setCancelContractId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const [summary, setSummary] = useState<CaregiverSummary | null>(null);
  const [earnings, setEarnings] = useState<Earnings>({ thisMonth: 0, lastMonth: 0, total: 0, pending: 0 });
  const [activityHistory, setActivityHistory] = useState<ActivityHistory[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, earningsRes, penaltiesRes, requestsRes, activityRes] = await Promise.all([
        dashboardAPI.caregiverSummary(),
        caregiverAPI.getEarnings(),
        caregiverAPI.getPenalties(),
        careRequestAPI.list({ status: "open" }),
        caregiverAPI.getActivity(),
      ]);
      // API 응답 파싱: { success, data: { ... } }
      const profile = summaryRes.data?.data || summaryRes.data || {};
      const user = profile.user || {};
      setSummary({
        userName: user.name || profile.name || '',
        referralCode: user.referralCode || '',
        penaltyScore: profile.penaltyCount || 0,
      });
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
      setActivityHistory(contracts.map((c: any) => ({
        id: c.id,
        patientName: c.careRequest?.patient?.name || '-',
        startDate: formatDate(c.startDate),
        endDate: formatDate(c.endDate),
        status: formatContractStatus(c.status),
        contractStatus: c.status || '',
        careType: formatCareType(c.careRequest?.careType || ''),
        location: formatLocation(c.careRequest?.location || ''),
        earnings: c.totalAmount || 0,
      })));

      const penaltyData = penaltiesRes.data?.data || penaltiesRes.data || {};
      const penaltyList = penaltyData.penalties || [];
      setPenalties(penaltyList.map((p: any) => ({
        id: p.id, date: p.createdAt, reason: p.type, points: 0, description: p.reason,
      })));

      const reqData = requestsRes.data?.data || requestsRes.data || {};
      const reqList = reqData.careRequests || [];
      setOpenRequests(reqList.map((r: any) => ({
        id: r.id,
        patientAge: 0,
        patientGender: r.patient?.gender === 'F' ? '여' : '남',
        careType: r.careType === 'INDIVIDUAL' ? '1:1' : '가족',
        location: r.location === 'HOSPITAL' ? '병원' : '자택',
        startDate: r.startDate,
        duration: r.durationDays ? `${r.durationDays}일` : '-',
        estimatedEarnings: (r.dailyRate || 0) * (r.durationDays || 30),
        urgency: '일반',
      })));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (status: Status) => {
    setCurrentStatus(status);
    try {
      await caregiverAPI.updateStatus(status);
    } catch {
      // Revert on failure is not needed for UI; status will sync on next load
    }
  };

  const handleApply = async (requestId: string) => {
    setApplyingId(requestId);
    try {
      await caregiverAPI.apply(requestId);
      alert(`${requestId}에 지원이 완료되었습니다.`);
      // Remove from open requests list after successful application
      setOpenRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      alert("지원 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setApplyingId(null);
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
  const penaltyScore = summary?.penaltyScore ?? penalties.reduce((sum, p) => sum + p.points, 0);

  const statusOptions: { value: Status; label: string; color: string; dotColor: string }[] = [
    { value: "working", label: "근무 중", color: "bg-blue-50 text-blue-700 border-blue-200", dotColor: "bg-blue-500" },
    { value: "available", label: "근무 가능", color: "bg-green-50 text-green-700 border-green-200", dotColor: "bg-green-500" },
    { value: "immediately", label: "즉시 가능", color: "bg-amber-50 text-amber-700 border-amber-200", dotColor: "bg-amber-500 animate-pulse" },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="badge-success">진행 중</span>;
      case "completed":
        return <span className="badge-primary">완료</span>;
      case "cancelled":
        return <span className="badge-danger">취소</span>;
      default:
        return <span className="badge-primary">{status}</span>;
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    alert("추천인 코드가 복사되었습니다.");
  };

  const tabs = [
    { key: "earnings" as const, label: "수익" },
    { key: "requests" as const, label: "공고 확인" },
    { key: "activity" as const, label: "활동 이력" },
    { key: "penalties" as const, label: "패널티" },
    { key: "referral" as const, label: "추천인 코드" },
  ];

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
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
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
              </div>
              {openRequests.map((req) => (
                <div key={req.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-400">{req.id}</span>
                        {req.urgency === "급구" && (
                          <span className="badge-danger">급구</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-gray-900">{req.careType}</h4>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                        <span>환자: {req.patientAge}세 {req.patientGender}</span>
                        <span>장소: {req.location}</span>
                        <span>시작일: {req.startDate}</span>
                        <span>기간: {req.duration}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-gray-400">예상 수익</div>
                        <div className="text-lg font-bold text-primary-600">
                          {req.estimatedEarnings.toLocaleString()}원
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-primary text-sm px-5 py-2.5"
                        disabled={applyingId === req.id}
                        onClick={() => handleApply(req.id)}
                      >
                        {applyingId === req.id ? "지원 중..." : "지원하기"}
                      </button>
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

          {/* Activity history */}
          {activeTab === "activity" && (
            <div className="divide-y divide-gray-100">
              {activityHistory.map((activity) => (
                <div key={activity.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-400">{activity.id}</span>
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
                      {activity.contractStatus === 'ACTIVE' && (
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
                      )}
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
                        {pen.points}점
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
