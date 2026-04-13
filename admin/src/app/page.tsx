"use client";

import { useState, useEffect, useCallback } from "react";
import StatsCard from "@/components/StatsCard";
import DataTable, { Column } from "@/components/DataTable";
import { getDashboard, getStats, approveCaregiver, rejectCaregiver, DashboardData, Caregiver, Dispute, MonthlyStats } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const [revenuePeriod, setRevenuePeriod] = useState("monthly");
  const [data, setData] = useState<DashboardData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, statsRes] = await Promise.all([
        getDashboard(),
        getStats({ year: new Date().getFullYear() }).catch(() => null),
      ]);
      setData(res);
      if (statsRes?.monthlyData) {
        setMonthlyData(statsRes.monthlyData);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "대시보드 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: string, name: string) => {
    if (!confirm(`${name}을(를) 승인하시겠습니까?`)) return;
    setActionLoading(id);
    try {
      await approveCaregiver(id);
      alert(`${name} 승인 완료`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "승인 처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, name: string) => {
    if (!confirm(`${name}을(를) 거절하시겠습니까?`)) return;
    setActionLoading(id);
    try {
      await rejectCaregiver(id);
      alert(`${name} 거절 완료`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "거절 처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const rawPending: Caregiver[] = (data as any)?.pendingList || (data as any)?.pendingCaregivers || [];
  // Flatten nested user fields from API response
  const pendingCaregivers: Caregiver[] = rawPending.map((cg: any) => ({
    ...cg,
    name: cg.name || cg.user?.name || "",
    phone: cg.phone || cg.user?.phone || "",
    email: cg.email || cg.user?.email || "",
  }));
  const rawDisputes: Dispute[] = (data as any)?.recentDisputes || [];
  const recentDisputes: Dispute[] = rawDisputes.map((d: any) => ({
    ...d,
    patientName: d.patientName || d.guardian?.user?.name || d.guardian?.name || "",
    caregiverName: d.caregiverName || d.caregiver?.user?.name || d.caregiver?.name || "",
  }));

  const pendingColumns: Column<Caregiver>[] = [
    { key: "name", label: "이름" },
    { key: "phone", label: "연락처" },
    { key: "appliedAt", label: "신청일시", render: (v) => <span>{(v as string) || (data as Record<string, unknown>)?.createdAt as string || "-"}</span> },
    {
      key: "certificates",
      label: "자격증",
      align: "center",
      render: (value) => (
        <span className="badge-blue">{value !== undefined && value !== null ? `${value}건` : "-"}</span>
      ),
    },
    {
      key: "status",
      label: "상태",
      align: "center",
      render: () => <span className="badge-yellow">대기</span>,
    },
    {
      key: "actions",
      label: "액션",
      align: "center",
      render: (_v, row) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            className="btn-success btn-sm"
            disabled={actionLoading === row.id}
            onClick={(e) => { e.stopPropagation(); handleApprove(row.id, row.name); }}
          >
            {actionLoading === row.id ? "..." : "승인"}
          </button>
          <button
            className="btn-danger btn-sm"
            disabled={actionLoading === row.id}
            onClick={(e) => { e.stopPropagation(); handleReject(row.id, row.name); }}
          >
            거절
          </button>
        </div>
      ),
    },
  ];

  const disputeColumns: Column<Dispute>[] = [
    { key: "id", label: "ID" },
    {
      key: "type",
      label: "유형",
      render: (value) => <span className="font-medium">{(value as string) || "-"}</span>,
    },
    { key: "patientName", label: "환자" },
    { key: "caregiverName", label: "간병인" },
    {
      key: "priority",
      label: "긴급도",
      align: "center",
      render: (value) => {
        const v = value as string;
        if (!v) return <span className="badge-gray">-</span>;
        const cls = v === "긴급" || v === "urgent" ? "badge-red" : v === "높음" || v === "high" ? "badge-yellow" : "badge-gray";
        return <span className={cls}>{v}</span>;
      },
    },
    {
      key: "status",
      label: "상태",
      align: "center",
      render: (value) => {
        const v = value as string;
        if (!v) return <span className="badge-gray">-</span>;
        const cls = v === "처리중" || v === "in_progress" ? "badge-blue" : "badge-yellow";
        return <span className={cls}>{v}</span>;
      },
    },
    { key: "createdAt", label: "접수일시" },
  ];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">케어매치 플랫폼 현황을 한눈에 확인하세요.</p>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button onClick={fetchData} className="btn-primary mt-4">다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">케어매치 플랫폼 현황을 한눈에 확인하세요.</p>
      </div>

      {/* Today's Summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="오늘 신규 요청"
          value={`${(data?.newRequests ?? 0).toLocaleString()}건`}
          delta={data?.newRequestsDelta}
          deltaLabel="전일 대비"
          color="blue"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          }
        />
        <StatsCard
          title="매칭 완료"
          value={`${(data?.matchesCompleted ?? 0).toLocaleString()}건`}
          delta={data?.matchesDelta}
          deltaLabel="전일 대비"
          color="green"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <StatsCard
          title="오늘 수익"
          value={`${(data?.revenue ?? 0).toLocaleString()}원`}
          delta={data?.revenueDelta}
          deltaLabel="전일 대비"
          color="purple"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <StatsCard
          title="미처리 분쟁"
          value={`${(data?.activeDisputes ?? 0).toLocaleString()}건`}
          subtitle="즉시 확인 필요"
          color="red"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
        />
      </div>

      {/* Additional Summary Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatsCard title="활성 간병인" value={`${(data?.activeCaregivers ?? 0).toLocaleString()}명`} color="indigo" />
        <StatsCard title="승인 대기" value={`${(data?.pendingApprovals ?? pendingCaregivers.length).toLocaleString()}명`} subtitle="확인 필요" color="amber" />
        <StatsCard
          title="이번 달 매출"
          value={`${(data?.monthlyRevenue ?? 0).toLocaleString()}원`}
          delta={data?.monthlyRevenueDelta}
          deltaLabel="전월 대비"
          color="green"
        />
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">매출 추이</h2>
          <div className="flex items-center gap-2">
            {["weekly", "monthly", "yearly"].map((period) => (
              <button
                key={period}
                onClick={() => setRevenuePeriod(period)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  revenuePeriod === period
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {period === "weekly" ? "주간" : period === "monthly" ? "월간" : "연간"}
              </button>
            ))}
          </div>
        </div>
        {monthlyData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickFormatter={(v: string) => {
                    const parts = v.split("-");
                    return parts.length >= 2 ? `${parseInt(parts[1])}월` : v;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v.toLocaleString()}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const num = Number(value) || 0;
                    const label = name === "revenue" ? "매출" : name === "fees" ? "수수료" : String(name);
                    return [`${num.toLocaleString()}원`, label];
                  }}
                  labelFormatter={(label) => {
                    const str = String(label);
                    const parts = str.split("-");
                    return parts.length >= 2 ? `${parts[0]}년 ${parseInt(parts[1])}월` : str;
                  }}
                />
                <Bar dataKey="revenue" name="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fees" name="fees" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <p className="mt-2 text-sm text-gray-400">매출 데이터가 없습니다</p>
            </div>
          </div>
        )}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* Pending Caregivers */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">간병인 승인 대기</h2>
            <a href="/admin/caregivers" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              전체 보기 &rarr;
            </a>
          </div>
          <DataTable
            columns={pendingColumns}
            data={pendingCaregivers}
            emptyMessage="승인 대기 중인 간병인이 없습니다."
          />
        </div>

        {/* Recent Disputes */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">최근 분쟁</h2>
            <a href="/admin/disputes" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              전체 보기 &rarr;
            </a>
          </div>
          <DataTable
            columns={disputeColumns}
            data={recentDisputes}
            emptyMessage="진행 중인 분쟁이 없습니다."
          />
        </div>
      </div>
    </div>
  );
}
