"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable, { Column } from "@/components/DataTable";
import StatsCard from "@/components/StatsCard";
import { getAdminPayments, AdminPayment } from "@/lib/api";

interface MatchingRow {
  id: string;
  contractId: string;
  patientName: string;
  caregiverName: string;
  status: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: string;
  paidAt: string;
  createdAt: string;
}

const statusMap: Record<string, string> = {
  PENDING: "대기",
  ESCROW: "에스크로",
  COMPLETED: "완료",
  REFUNDED: "환불",
  PARTIAL_REFUND: "부분환불",
  FAILED: "실패",
};

function formatStatus(status: string): string {
  return statusMap[status] || status;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function toMatchingRow(p: AdminPayment): MatchingRow {
  return {
    id: p.id,
    contractId: p.contractId || "-",
    patientName: p.patientName || "-",
    caregiverName: p.caregiverName || "-",
    status: p.status,
    amount: p.amount,
    fee: p.fee,
    netAmount: p.netAmount,
    method: p.method,
    paidAt: p.paidAt || "",
    createdAt: p.createdAt || "",
  };
}

export default function MatchingsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [matchings, setMatchings] = useState<MatchingRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminPayments({
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
        page: currentPage,
        limit,
      });
      const data = res as any;
      const list: AdminPayment[] = data?.payments || [];
      const pag = data?.pagination;

      setMatchings(list.map(toMatchingRow));
      setTotalItems(pag?.total ?? list.length ?? 0);
      setTotalPages(pag?.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "매칭 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, startDate, endDate, search, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, startDate, endDate, search]);

  const activeCount = matchings.filter((m) => m.status === "ESCROW" || m.status === "PENDING").length;
  const completedCount = matchings.filter((m) => m.status === "COMPLETED").length;
  const refundedCount = matchings.filter((m) => m.status === "REFUNDED" || m.status === "PARTIAL_REFUND").length;

  const columns: Column<MatchingRow>[] = [
    {
      key: "contractId",
      label: "계약 ID",
      render: (v) => (
        <span className="font-mono text-xs font-bold text-primary-600">
          {((v as string) || "-").substring(0, 8)}{(v as string).length > 8 ? "..." : ""}
        </span>
      ),
    },
    { key: "patientName", label: "환자" },
    { key: "caregiverName", label: "간병인" },
    {
      key: "status",
      label: "상태",
      align: "center",
      render: (v) => {
        const s = v as string;
        const label = formatStatus(s);
        const cls =
          s === "COMPLETED" ? "badge-green" :
          s === "ESCROW" ? "badge-blue" :
          s === "PENDING" ? "badge-yellow" :
          s === "REFUNDED" || s === "PARTIAL_REFUND" ? "badge-red" :
          "badge-gray";
        return <span className={cls}>{label}</span>;
      },
    },
    {
      key: "amount",
      label: "총 비용",
      align: "right",
      render: (v) => <span className="font-medium">{(v as number).toLocaleString()}원</span>,
    },
    {
      key: "fee",
      label: "수수료",
      align: "right",
      render: (v) => <span className="text-primary-600 font-medium">{(v as number).toLocaleString()}원</span>,
    },
    {
      key: "netAmount",
      label: "정산 금액",
      align: "right",
      render: (v) => <span className="font-medium">{(v as number).toLocaleString()}원</span>,
    },
    {
      key: "paidAt",
      label: "결제일",
      render: (v) => <span className="text-sm text-gray-600">{formatDate(v as string)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">매칭 관리</h1>
        <p className="mt-1 text-sm text-gray-500">간병 매칭(계약) 현황을 관리합니다.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="전체 매칭" value={`${totalItems}건`} color="blue" />
        <StatsCard title="진행중" value={`${activeCount}건`} color="green" />
        <StatsCard title="완료" value={`${completedCount}건`} color="purple" />
        <StatsCard title="환불" value={`${refundedCount}건`} color="red" />
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="환자/간병인 이름 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 상태</option>
            <option value="PENDING">대기</option>
            <option value="ESCROW">에스크로</option>
            <option value="COMPLETED">완료</option>
            <option value="REFUNDED">환불</option>
            <option value="PARTIAL_REFUND">부분환불</option>
            <option value="FAILED">실패</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field w-auto"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
          <button onClick={fetchData} className="ml-4 underline">다시 시도</button>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={matchings}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={totalItems}
        emptyMessage="매칭 내역이 없습니다."
      />
    </div>
  );
}
