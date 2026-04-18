"use client";

import { useState, useEffect, useCallback } from "react";
import StatsCard from "@/components/StatsCard";
import { getStats, exportCaregivers, StatsData } from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface HistoricalStat {
  id: string;
  year: number;
  month: number;
  totalRequests: number;
  totalMatches: number;
  totalRevenue: number;
  totalPlatformFee: number;
  activeCaregivers: number;
  activeGuardians: number;
  avgRating: number;
}

interface StatsResponse {
  historicalStats?: HistoricalStat[];
  monthlyData?: HistoricalStat[];
  currentMonth?: {
    year: number;
    month: number;
    totalRequests: number;
    totalMatches: number;
    totalRevenue: number;
    activeCaregivers: number;
    activeGuardians: number;
    pendingCaregivers: number;
  };
  // Fallback fields from StatsData
  totalMatchings?: number;
  totalRevenue?: number;
  totalFees?: number;
  averageRating?: number;
}

function formatMoney(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

function formatMoneyShort(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만`;
  }
  return `${amount.toLocaleString()}`;
}

export default function StatsPage() {
  const [period, setPeriod] = useState("2026");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getStats({ year: period });
      setData(res as unknown as StatsResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "통계 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExcelDownload = async () => {
    setExporting(true);
    try {
      const blob = await exportCaregivers();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carematch-stats-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  };

  // Normalize historicalStats from the backend response
  const historicalStats: HistoricalStat[] = data?.historicalStats || data?.monthlyData || [];

  // Build chart data with Korean month labels
  const chartData = historicalStats.map((s) => ({
    name: `${s.month}월`,
    month: s.month,
    totalRevenue: s.totalRevenue ?? 0,
    totalPlatformFee: s.totalPlatformFee ?? 0,
    totalRequests: s.totalRequests ?? 0,
    totalMatches: s.totalMatches ?? 0,
    activeCaregivers: s.activeCaregivers ?? 0,
    activeGuardians: s.activeGuardians ?? 0,
    avgRating: s.avgRating ?? 0,
  }));

  // Summary KPI calculations
  const totalRevenue = historicalStats.reduce((sum, s) => sum + (s.totalRevenue ?? 0), 0);
  const totalPlatformFee = historicalStats.reduce((sum, s) => sum + (s.totalPlatformFee ?? 0), 0);
  const totalRequests = historicalStats.reduce((sum, s) => sum + (s.totalRequests ?? 0), 0);
  const totalMatches = historicalStats.reduce((sum, s) => sum + (s.totalMatches ?? 0), 0);
  const avgRating = historicalStats.length > 0
    ? historicalStats.reduce((sum, s) => sum + (s.avgRating ?? 0), 0) / historicalStats.length
    : 0;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">통계 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통계</h1>
          <p className="mt-1 text-sm text-gray-500">플랫폼 운영 통계를 확인합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-field w-auto"
          >
            <option value="2026">2026년</option>
            <option value="2025">2025년</option>
            <option value="2024">2024년</option>
          </select>
          <button
            onClick={handleExcelDownload}
            disabled={exporting}
            className="btn-secondary flex items-center gap-2"
          >
            {exporting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-gray-700" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            {exporting ? "다운로드 중..." : "엑셀 다운로드"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
          <button onClick={fetchData} className="ml-4 underline">다시 시도</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard title="총 매출" value={formatMoney(totalRevenue)} color="green" />
        <StatsCard title="총 수수료" value={formatMoney(totalPlatformFee)} color="purple" />
        <StatsCard title="총 요청" value={`${totalRequests.toLocaleString()}건`} color="blue" />
        <StatsCard title="총 매칭" value={`${totalMatches.toLocaleString()}건`} color="indigo" />
        <StatsCard title="평균 평점" value={avgRating > 0 ? `${avgRating.toFixed(1)}점` : "-"} color="amber" />
      </div>

      {/* Chart 1: 월별 매출 추이 (BarChart) */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">월별 매출 추이</h2>
        {chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-gray-400">
            데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => formatMoneyShort(v)}
              />
              <Tooltip
                formatter={(value, name) => [
                  `${Number(value).toLocaleString()}원`,
                  name === "totalRevenue" ? "매출" : "플랫폼 수수료",
                ]}
                labelFormatter={(label) => `${label}`}
              />
              <Legend
                formatter={(value) =>
                  value === "totalRevenue" ? "매출" : "플랫폼 수수료"
                }
              />
              <Bar dataKey="totalRevenue" fill="#10b981" name="totalRevenue" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalPlatformFee" fill="#8b5cf6" name="totalPlatformFee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 2: 월별 요청/매칭 추이 (LineChart) */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">월별 요청/매칭 추이</h2>
        {chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-gray-400">
            데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [
                  `${Number(value).toLocaleString()}건`,
                  name === "totalRequests" ? "요청" : "매칭",
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === "totalRequests" ? "요청" : "매칭"
                }
              />
              <Line
                type="monotone"
                dataKey="totalRequests"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="totalRequests"
              />
              <Line
                type="monotone"
                dataKey="totalMatches"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="totalMatches"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 3: 간병인/보호자 증가 추이 (AreaChart) */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">간병인/보호자 증가 추이</h2>
        {chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-gray-400">
            데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [
                  `${Number(value).toLocaleString()}명`,
                  name === "activeCaregivers" ? "활성 간병인" : "활성 보호자",
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === "activeCaregivers" ? "활성 간병인" : "활성 보호자"
                }
              />
              <Area
                type="monotone"
                dataKey="activeCaregivers"
                stroke="#0ea5e9"
                fill="#0ea5e9"
                fillOpacity={0.15}
                strokeWidth={2}
                name="activeCaregivers"
              />
              <Area
                type="monotone"
                dataKey="activeGuardians"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.15}
                strokeWidth={2}
                name="activeGuardians"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 4: 평균 평점 추이 (LineChart) */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">평균 평점 추이</h2>
        {chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-gray-400">
            데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}점`, "평균 평점"]}
              />
              <Legend formatter={() => "평균 평점"} />
              <Line
                type="monotone"
                dataKey="avgRating"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4, fill: "#f59e0b" }}
                activeDot={{ r: 6 }}
                name="avgRating"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly Data Table */}
      <div className="card overflow-hidden p-0">
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">월별 상세 통계</h2>
        </div>
        {historicalStats.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">월</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">요청</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">매칭</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">매출</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">수수료</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">간병인</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">보호자</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">평점</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historicalStats.map((s) => (
                  <tr key={`${s.year}-${s.month}`} className="hover:bg-gray-50/80">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.month}월</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{(s.totalRequests ?? 0).toLocaleString()}건</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{(s.totalMatches ?? 0).toLocaleString()}건</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">{(s.totalRevenue ?? 0).toLocaleString()}원</td>
                    <td className="px-6 py-4 text-right text-sm text-primary-600">{(s.totalPlatformFee ?? 0).toLocaleString()}원</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{(s.activeCaregivers ?? 0).toLocaleString()}명</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{(s.activeGuardians ?? 0).toLocaleString()}명</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{(s.avgRating ?? 0).toFixed(1)}점</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">합계</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">{totalRequests.toLocaleString()}건</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">{totalMatches.toLocaleString()}건</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">{totalRevenue.toLocaleString()}원</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-primary-600">{totalPlatformFee.toLocaleString()}원</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">-</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">-</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">{avgRating > 0 ? `${avgRating.toFixed(1)}점` : "-"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
