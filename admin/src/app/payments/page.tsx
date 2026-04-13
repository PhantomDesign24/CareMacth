"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable, { Column } from "@/components/DataTable";
import StatsCard from "@/components/StatsCard";
import {
  getAdminPayments,
  getAdminSettlements,
  getPlatformConfig,
  updatePlatformConfig,
  AdminPayment,
  AdminSettlement,
  PaymentsSummary,
} from "@/lib/api";

type PaymentTab = "payments" | "settlements";

const paymentStatusMap: Record<string, string> = {
  PENDING: "대기",
  ESCROW: "에스크로",
  COMPLETED: "완료",
  REFUNDED: "환불",
  PARTIAL_REFUND: "부분환불",
  FAILED: "실패",
};

const paymentMethodMap: Record<string, string> = {
  CARD: "카드",
  BANK_TRANSFER: "계좌이체",
  DIRECT: "직접결제",
};

function formatStatus(status: string): string {
  return paymentStatusMap[status] || status;
}

function formatMethod(method: string): string {
  return paymentMethodMap[method] || method;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<PaymentTab>("payments");

  // Payments state
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotalPages, setPaymentTotalPages] = useState(1);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [paymentStartDate, setPaymentStartDate] = useState("");
  const [paymentEndDate, setPaymentEndDate] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentError, setPaymentError] = useState("");
  const [summary, setSummary] = useState<PaymentsSummary>({ monthlyTotal: 0, monthlyFees: 0, pendingSettlements: 0, monthlyRefunds: 0 });

  // Settlements state
  const [settlements, setSettlements] = useState<AdminSettlement[]>([]);
  const [settlementPage, setSettlementPage] = useState(1);
  const [settlementTotalPages, setSettlementTotalPages] = useState(1);
  const [settlementTotal, setSettlementTotal] = useState(0);
  const [settlementStatusFilter, setSettlementStatusFilter] = useState("");
  const [settlementPeriodFilter, setSettlementPeriodFilter] = useState("");
  const [settlementLoading, setSettlementLoading] = useState(true);
  const [settlementError, setSettlementError] = useState("");

  // Fee settings state
  const [oneOnOnePercent, setOneOnOnePercent] = useState(5);
  const [oneOnOneFixed, setOneOnOneFixed] = useState(0);
  const [familyPercent, setFamilyPercent] = useState(4);
  const [familyFixed, setFamilyFixed] = useState(10000);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeSaving, setFeeSaving] = useState(false);

  const limit = 20;

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    setPaymentLoading(true);
    setPaymentError("");
    try {
      const res = await getAdminPayments({
        status: paymentStatusFilter || undefined,
        startDate: paymentStartDate || undefined,
        endDate: paymentEndDate || undefined,
        page: paymentPage,
        limit,
      });
      const data = res as any;
      const list = data?.payments || [];
      const pag = data?.pagination;
      setPayments(Array.isArray(list) ? list : []);
      setSummary(data?.summary || { monthlyTotal: 0, monthlyFees: 0, pendingSettlements: 0, monthlyRefunds: 0 });
      setPaymentTotal(pag?.total ?? list.length ?? 0);
      setPaymentTotalPages(pag?.totalPages ?? 1);
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : "결제 데이터를 불러오지 못했습니다.");
    } finally {
      setPaymentLoading(false);
    }
  }, [paymentStatusFilter, paymentStartDate, paymentEndDate, paymentPage]);

  // Fetch settlements
  const fetchSettlements = useCallback(async () => {
    setSettlementLoading(true);
    setSettlementError("");
    try {
      const res = await getAdminSettlements({
        status: settlementStatusFilter || undefined,
        period: settlementPeriodFilter || undefined,
        page: settlementPage,
        limit,
      });
      const data = res as any;
      const list = data?.settlements || [];
      const pag = data?.pagination;
      setSettlements(Array.isArray(list) ? list : []);
      setSettlementTotal(pag?.total ?? list.length ?? 0);
      setSettlementTotalPages(pag?.totalPages ?? 1);
    } catch (err: unknown) {
      setSettlementError(err instanceof Error ? err.message : "정산 데이터를 불러오지 못했습니다.");
    } finally {
      setSettlementLoading(false);
    }
  }, [settlementStatusFilter, settlementPeriodFilter, settlementPage]);

  // Fetch fee config
  const fetchFeeConfig = useCallback(async () => {
    setFeeLoading(true);
    try {
      const config = await getPlatformConfig();
      const data = config as any;
      setOneOnOnePercent(data?.oneOnOneFeePercentage ?? data?.individualFeePercent ?? 5);
      setOneOnOneFixed(data?.oneOnOneFeeFixed ?? data?.individualFeeFixed ?? 0);
      setFamilyPercent(data?.familyCareFeePercentage ?? data?.familyFeePercent ?? 4);
      setFamilyFixed(data?.familyCareFeeFixed ?? data?.familyFeeFixed ?? 10000);
    } catch {
      // Silently use defaults
    } finally {
      setFeeLoading(false);
    }
  }, []);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === "payments") {
      fetchPayments();
    } else if (activeTab === "settlements") {
      fetchSettlements();
    } else if (activeTab === "fees") {
      fetchFeeConfig();
    }
  }, [activeTab, fetchPayments, fetchSettlements, fetchFeeConfig]);

  // Reset page on filter change
  useEffect(() => {
    setPaymentPage(1);
  }, [paymentStatusFilter, paymentStartDate, paymentEndDate]);

  useEffect(() => {
    setSettlementPage(1);
  }, [settlementStatusFilter, settlementPeriodFilter]);

  // Save fee settings
  const handleSaveFees = async () => {
    setFeeSaving(true);
    try {
      await updatePlatformConfig({
        oneOnOneFeePercentage: oneOnOnePercent,
        oneOnOneFeeFixed: oneOnOneFixed,
        familyCareFeePercentage: familyPercent,
        familyCareFeeFixed: familyFixed,
      });
      alert("수수료 설정이 저장되었습니다.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "수수료 설정 저장에 실패했습니다.");
    } finally {
      setFeeSaving(false);
    }
  };

  const handleExcelDownload = () => {
    if (payments.length === 0) {
      alert("다운로드할 결제 데이터가 없습니다.");
      return;
    }

    const headers = ["결제 ID", "계약 ID", "환자", "간병인", "결제 금액", "수수료", "정산 금액", "상태", "결제 방법", "결제 일시"];
    const rows = payments.map((p) => [
      p.id,
      p.contractId || "-",
      p.patientName,
      p.caregiverName,
      p.amount,
      p.fee,
      p.netAmount,
      formatStatus(p.status),
      formatMethod(p.method),
      formatDateTime(p.paidAt),
    ]);

    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => {
          const str = String(cell ?? "");
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.download = `결제내역_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const paymentColumns: Column<AdminPayment>[] = [
    { key: "id", label: "결제 ID", render: (v) => <span className="font-mono text-xs text-gray-500">{(v as string).slice(0, 8)}...</span> },
    { key: "contractId", label: "계약 ID", render: (v) => <span className="font-mono text-xs text-primary-600">{v ? (v as string).slice(0, 8) + "..." : "-"}</span> },
    { key: "patientName", label: "환자" },
    { key: "caregiverName", label: "간병인" },
    {
      key: "amount",
      label: "결제 금액",
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
      key: "status",
      label: "상태",
      align: "center",
      render: (v) => {
        const s = v as string;
        const label = formatStatus(s);
        const cls =
          s === "COMPLETED" || s === "ESCROW" ? "badge-green" :
          s === "PENDING" ? "badge-yellow" :
          s === "REFUNDED" || s === "PARTIAL_REFUND" ? "badge-red" :
          s === "FAILED" ? "badge-gray" : "badge-gray";
        return <span className={cls}>{label}</span>;
      },
    },
    { key: "method", label: "결제 방법", align: "center", render: (v) => formatMethod(v as string) },
    { key: "paidAt", label: "결제 일시", render: (v) => formatDateTime(v as string | null) },
  ];

  const settlementColumns: Column<AdminSettlement>[] = [
    { key: "id", label: "정산 ID", render: (v) => <span className="font-mono text-xs text-gray-500">{(v as string).slice(0, 8)}...</span> },
    { key: "caregiverName", label: "간병인" },
    { key: "createdAt", label: "정산 생성일", render: (v) => formatDate(v as string) },
    {
      key: "amount",
      label: "총 금액",
      align: "right",
      render: (v) => <span className="font-medium">{(v as number).toLocaleString()}원</span>,
    },
    {
      key: "platformFee",
      label: "수수료",
      align: "right",
      render: (v) => <span className="text-primary-600">{(v as number).toLocaleString()}원</span>,
    },
    {
      key: "taxAmount",
      label: "세금 (3.3%)",
      align: "right",
      render: (v) => <span className="text-gray-500">{(v as number).toLocaleString()}원</span>,
    },
    {
      key: "netAmount",
      label: "실 지급액",
      align: "right",
      render: (v) => <span className="font-bold text-gray-900">{(v as number).toLocaleString()}원</span>,
    },
    {
      key: "isPaid",
      label: "상태",
      align: "center",
      render: (v) => {
        const paid = v as boolean;
        return <span className={paid ? "badge-green" : "badge-yellow"}>{paid ? "완료" : "대기"}</span>;
      },
    },
    { key: "paidAt", label: "정산일", render: (v) => formatDate(v as string | null) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">결제/정산 관리</h1>
          <p className="mt-1 text-sm text-gray-500">결제 내역, 정산 현황, 수수료 설정을 관리합니다.</p>
        </div>
        <button onClick={handleExcelDownload} className="btn-secondary flex items-center gap-2 self-start">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          엑셀 다운로드
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="이번 달 결제 총액" value={`${summary.monthlyTotal.toLocaleString()}원`} color="blue" />
        <StatsCard title="이번 달 수수료" value={`${summary.monthlyFees.toLocaleString()}원`} color="green" />
        <StatsCard title="미정산 건수" value={`${summary.pendingSettlements}건`} subtitle="처리 필요" color="amber" />
        <StatsCard title="환불 건수" value={`${summary.monthlyRefunds}건`} subtitle="이번 달" color="red" />
      </div>

      {/* Tabs */}
      <div className="-mx-4 border-b border-gray-200 sm:mx-0">
        <nav className="flex gap-0 overflow-x-auto">
          {[
            { key: "payments" as const, label: "결제 목록" },
            { key: "settlements" as const, label: "정산 현황" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="input-field w-auto"
              >
                <option value="">전체 상태</option>
                <option value="COMPLETED">완료</option>
                <option value="ESCROW">에스크로</option>
                <option value="PENDING">대기</option>
                <option value="REFUNDED">환불</option>
                <option value="PARTIAL_REFUND">부분환불</option>
                <option value="FAILED">실패</option>
              </select>
              <input
                type="date"
                className="input-field w-auto"
                value={paymentStartDate}
                onChange={(e) => setPaymentStartDate(e.target.value)}
              />
              <span className="text-sm text-gray-400">~</span>
              <input
                type="date"
                className="input-field w-auto"
                value={paymentEndDate}
                onChange={(e) => setPaymentEndDate(e.target.value)}
              />
            </div>
          </div>
          {paymentError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {paymentError}
              <button onClick={fetchPayments} className="ml-4 underline">다시 시도</button>
            </div>
          )}
          <DataTable
            columns={paymentColumns}
            data={payments}
            loading={paymentLoading}
            currentPage={paymentPage}
            totalPages={paymentTotalPages}
            onPageChange={setPaymentPage}
            totalItems={paymentTotal}
          />
        </div>
      )}

      {/* Settlements Tab */}
      {activeTab === "settlements" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={settlementStatusFilter}
                onChange={(e) => setSettlementStatusFilter(e.target.value)}
                className="input-field w-auto"
              >
                <option value="">전체 상태</option>
                <option value="completed">완료</option>
                <option value="pending">대기</option>
              </select>
              <select
                className="input-field w-auto"
                value={settlementPeriodFilter}
                onChange={(e) => setSettlementPeriodFilter(e.target.value)}
              >
                <option value="">전체 기간</option>
                <option value="2026-04">2026년 4월</option>
                <option value="2026-03">2026년 3월</option>
                <option value="2026-02">2026년 2월</option>
              </select>
            </div>
          </div>
          {settlementError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {settlementError}
              <button onClick={fetchSettlements} className="ml-4 underline">다시 시도</button>
            </div>
          )}
          <DataTable
            columns={settlementColumns}
            data={settlements}
            loading={settlementLoading}
            currentPage={settlementPage}
            totalPages={settlementTotalPages}
            onPageChange={setSettlementPage}
            totalItems={settlementTotal}
          />
        </div>
      )}

      {/* 수수료 안내 배너 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          💡 수수료 설정은 <a href="/admin/settings" className="font-medium underline">플랫폼 설정</a> 페이지에서 관리합니다. (1:1 간병 {summary.monthlyFees > 0 ? '10%' : '-'}, 가족 간병 15%)
        </p>
      </div>
    </div>
  );
}
