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
  apiRequest,
} from "@/lib/api";

type PaymentTab = "payments" | "settlements" | "mid-settlement" | "refunds" | "additional-fees";

interface AdditionalFeeItem {
  id: string;
  contractId: string;
  amount: number;
  platformFeeAmount: number;
  taxAmount: number;
  netAmount: number;
  platformFeePercent: number;
  taxRate: number;
  reason: string;
  approvedByGuardian: boolean;
  rejected: boolean;
  rejectReason: string | null;
  paid: boolean;
  statusLabel: "pending" | "approved" | "paid" | "rejected";
  createdAt: string;
  caregiverName: string | null;
  caregiverPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  patientName: string | null;
}

interface RefundRequest {
  id: string;
  guardianName: string | null;
  guardianPhone: string | null;
  caregiverName: string | null;
  patientName: string | null;
  totalAmount: number;
  refundRequestAmount: number | null;
  refundRequestReason: string | null;
  refundRequestedAt: string | null;
  refundRequestStatus: string;
  refundRejectReason: string | null;
  method: string;
  paidAt: string | null;
}

interface MidSettlementContract {
  id: string;
  patientName: string;
  caregiverName: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  status: string;
  totalDays: number;
  elapsed: number;
  settledDays: number;
  availableDays: number;
  pendingAmount: number;
}

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
  const [selectedSettlementIds, setSelectedSettlementIds] = useState<string[]>([]);
  const [settlementActionLoading, setSettlementActionLoading] = useState(false);

  // Additional fees state
  const [additionalFees, setAdditionalFees] = useState<AdditionalFeeItem[]>([]);
  const [feesStatusFilter, setFeesStatusFilter] = useState<string>("pending");
  const [feesLoading, setFeesLoading] = useState(false);

  const fetchAdditionalFees = useCallback(async () => {
    setFeesLoading(true);
    try {
      const res: any = await apiRequest(`/admin/additional-fees?status=${feesStatusFilter}`);
      setAdditionalFees(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setAdditionalFees([]);
    } finally {
      setFeesLoading(false);
    }
  }, [feesStatusFilter]);

  // Refund requests state
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [refundStatusFilter, setRefundStatusFilter] = useState<string>("PENDING");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundActionLoading, setRefundActionLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RefundRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchRefundRequests = useCallback(async () => {
    setRefundLoading(true);
    try {
      const res: any = await apiRequest(`/admin/refund-requests?status=${refundStatusFilter}`);
      setRefundRequests(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setRefundRequests([]);
    } finally {
      setRefundLoading(false);
    }
  }, [refundStatusFilter]);

  const handleApproveRefund = async (id: string) => {
    if (!confirm("환불을 승인하고 즉시 처리하시겠습니까?\n(Toss 환불 + 계약/정산 연동이 함께 실행됩니다)")) return;
    setRefundActionLoading(true);
    try {
      await apiRequest(`/admin/payments/${id}/refund-approve`, { method: "POST" });
      await fetchRefundRequests();
    } catch (err: any) {
      alert(err?.message || "환불 승인 실패");
    } finally {
      setRefundActionLoading(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!rejectTarget) return;
    setRefundActionLoading(true);
    try {
      await apiRequest(`/admin/payments/${rejectTarget.id}/refund-reject`, {
        method: "POST",
        body: { reason: rejectReason.trim() },
      });
      setRejectTarget(null);
      setRejectReason("");
      await fetchRefundRequests();
    } catch (err: any) {
      alert(err?.message || "거절 실패");
    } finally {
      setRefundActionLoading(false);
    }
  };

  // Mid-settlement state
  const [midContracts, setMidContracts] = useState<MidSettlementContract[]>([]);
  const [midLoading, setMidLoading] = useState(false);
  const [midError, setMidError] = useState("");
  const [midModal, setMidModal] = useState<MidSettlementContract | null>(null);
  const [midDays, setMidDays] = useState<string>("");
  const [midSubmitting, setMidSubmitting] = useState(false);

  const fetchMidContracts = useCallback(async () => {
    setMidLoading(true);
    setMidError("");
    try {
      const res: any = await apiRequest(`/admin/contracts/active-for-settlement`);
      setMidContracts(Array.isArray(res) ? res : res?.data || []);
    } catch (err: any) {
      setMidError(err?.message || "중간정산 대상 조회 실패");
    } finally {
      setMidLoading(false);
    }
  }, []);

  const handleCreateMidSettlement = async () => {
    if (!midModal) return;
    setMidSubmitting(true);
    try {
      const days = midDays ? parseInt(midDays, 10) : undefined;
      if (days !== undefined && (isNaN(days) || days <= 0 || days > midModal.availableDays)) {
        alert(`정산 일수는 1~${midModal.availableDays}일 범위여야 합니다.`);
        setMidSubmitting(false);
        return;
      }
      await apiRequest(`/admin/contracts/${midModal.id}/mid-settlement`, {
        method: "POST",
        body: days !== undefined ? { days } : {},
      });
      alert("중간정산이 생성되었습니다.");
      setMidModal(null);
      setMidDays("");
      await fetchMidContracts();
      await fetchSettlements();
    } catch (err: any) {
      alert(err?.message || "중간정산 실패");
    } finally {
      setMidSubmitting(false);
    }
  };

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
    } else if (activeTab === "mid-settlement") {
      fetchMidContracts();
    } else if (activeTab === "refunds") {
      fetchRefundRequests();
    } else if (activeTab === "additional-fees") {
      fetchAdditionalFees();
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
    {
      key: "id",
      label: "관리",
      align: "center",
      render: (v, row) => {
        const r = row as AdminSettlement;
        if (r.isPaid) {
          return <span className="text-xs text-gray-400">완료</span>;
        }
        return (
          <div className="flex items-center gap-2 justify-center">
            <input
              type="checkbox"
              checked={selectedSettlementIds.includes(v as string)}
              onChange={(e) => {
                e.stopPropagation();
                setSelectedSettlementIds((prev) =>
                  e.target.checked
                    ? [...prev, v as string]
                    : prev.filter((id) => id !== v as string)
                );
              }}
              className="accent-orange-500"
            />
            <button
              type="button"
              disabled={settlementActionLoading}
              onClick={() => handlePaySettlement(v as string)}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
            >
              정산 실행
            </button>
          </div>
        );
      },
    },
  ];

  const handlePaySettlement = async (id: string) => {
    if (!confirm("이 건을 정산 처리하시겠습니까?")) return;
    setSettlementActionLoading(true);
    try {
      await apiRequest(`/admin/settlements/${id}/pay`, { method: "POST" });
      setSelectedSettlementIds((prev) => prev.filter((x) => x !== id));
      await fetchSettlements();
    } catch (err: any) {
      alert(err?.message || "정산 처리 실패");
    } finally {
      setSettlementActionLoading(false);
    }
  };

  const handleBulkPay = async () => {
    if (selectedSettlementIds.length === 0) return;
    if (!confirm(`선택한 ${selectedSettlementIds.length}건을 일괄 정산 처리하시겠습니까?`)) return;
    setSettlementActionLoading(true);
    try {
      await apiRequest(`/admin/settlements/bulk-pay`, {
        method: "POST",
        body: { ids: selectedSettlementIds },
      });
      setSelectedSettlementIds([]);
      await fetchSettlements();
    } catch (err: any) {
      alert(err?.message || "일괄 처리 실패");
    } finally {
      setSettlementActionLoading(false);
    }
  };

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
            { key: "mid-settlement" as const, label: "중간정산" },
            { key: "refunds" as const, label: "환불 요청" },
            { key: "additional-fees" as const, label: "추가 간병비" },
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
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
            <div className="font-semibold text-blue-900 mb-1.5">📘 정산이란?</div>
            <ul className="space-y-1 text-xs text-gray-700 ml-4 list-disc">
              <li>
                <b>정산 (자동·매일)</b> — 계약이 종료되면 다음날 자동으로 간병인 귀속 금액(공급가)에서 플랫폼 수수료·원천징수 세금을 차감해 <code className="bg-white px-1 rounded text-[11px]">Earning</code> 레코드를 생성합니다.
              </li>
              <li>
                <b>일괄정산 (수동)</b> — 누적된 미지급 정산건을 어드민이 한 번에 송금 완료 처리하는 단계입니다. 아래 "선택건 일괄정산" 버튼으로 다수 건을 동시에 <code className="bg-white px-1 rounded text-[11px]">isPaid=true</code> 로 전환합니다.
              </li>
              <li>
                즉, <b>정산 = 금액 산정/Earning 생성</b>, <b>일괄정산 = 실제 송금 후 지급 완료 표시</b>입니다.
              </li>
            </ul>
          </div>
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
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  선택: <span className="font-semibold text-gray-800">{selectedSettlementIds.length}</span>건
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const pendingIds = settlements.filter((s) => !s.isPaid).map((s) => s.id);
                    setSelectedSettlementIds((prev) =>
                      prev.length === pendingIds.length ? [] : pendingIds
                    );
                  }}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {selectedSettlementIds.length > 0 ? "선택 해제" : "대기건 전체 선택"}
                </button>
                <button
                  type="button"
                  disabled={selectedSettlementIds.length === 0 || settlementActionLoading}
                  onClick={handleBulkPay}
                  className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {settlementActionLoading ? "처리 중..." : "일괄 정산 처리"}
                </button>
              </div>
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

      {/* Mid-settlement Tab */}
      {activeTab === "mid-settlement" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-700">
            <div className="font-semibold text-amber-900 mb-1.5">💡 중간정산이란?</div>
            <ul className="space-y-1 text-xs text-gray-700 ml-4 list-disc">
              <li>
                계약이 끝나기 전에도 <b>경과 일수만큼 미리 정산</b>하는 기능입니다. 장기 계약(예: 1개월 이상)에서 간병인이 매주/격주로 일부 금액을 받고 싶을 때 사용.
              </li>
              <li>
                계약 시작일~오늘까지 일수 × 일당 으로 일할 정산 → 잔여분은 종료 후 자동 정산(또는 추가 중간정산)으로 처리.
              </li>
              <li>
                일반 정산 흐름과 분리: <b>중간정산</b>(진행중) → 종료 후 <b>잔여 자동 정산</b> → 다수 건을 모아 <b>일괄정산</b>(송금 완료 표시).
              </li>
            </ul>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">중간정산 대상 계약 (진행중/연장)</h3>
                <p className="text-xs text-gray-500 mt-0.5">시작일~오늘까지 경과한 일수 기준으로 일할 정산 생성. 일부만 정산하고 나중에 잔여분 추가정산 가능.</p>
              </div>
              <button onClick={fetchMidContracts} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                새로고침
              </button>
            </div>
          </div>
          {midError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{midError}</div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">계약 ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">환자</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">간병인</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">기간</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">일당</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">총/경과/정산됨</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">정산 가능</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">작업</th>
                </tr>
              </thead>
              <tbody>
                {midLoading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">로딩중...</td></tr>
                ) : midContracts.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">중간정산 가능한 계약이 없습니다.</td></tr>
                ) : midContracts.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{c.id.slice(0, 8)}...</td>
                    <td className="px-3 py-2">{c.patientName}</td>
                    <td className="px-3 py-2">{c.caregiverName}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {new Date(c.startDate).toLocaleDateString("ko-KR")} ~<br />
                      {new Date(c.endDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{c.dailyRate.toLocaleString()}원</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">
                      {c.totalDays}일 / <span className="font-semibold text-gray-800">{c.elapsed}일</span> / {c.settledDays}일
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-bold text-orange-600">{c.pendingAmount.toLocaleString()}원</div>
                      <div className="text-[10px] text-gray-400">{c.availableDays}일분</div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        disabled={c.availableDays <= 0}
                        onClick={() => { setMidModal(c); setMidDays(""); }}
                        className="text-xs px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        중간정산
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 중간정산 모달 */}
      {midModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !midSubmitting && setMidModal(null)}
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">중간정산 생성</h3>
              <button onClick={() => setMidModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">환자</span><span>{midModal.patientName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">간병인</span><span>{midModal.caregiverName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">일당</span><span>{midModal.dailyRate.toLocaleString()}원</span></div>
              <div className="flex justify-between"><span className="text-gray-500">경과 일수</span><span>{midModal.elapsed}일 (전체 {midModal.totalDays}일)</span></div>
              <div className="flex justify-between"><span className="text-gray-500">이미 정산됨</span><span>{midModal.settledDays}일</span></div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="font-semibold text-gray-700">정산 가능</span>
                <span className="font-bold text-orange-600">{midModal.availableDays}일 / {midModal.pendingAmount.toLocaleString()}원</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1 text-gray-700">정산할 일수 <span className="text-gray-400">(비워두면 전체 {midModal.availableDays}일 처리)</span></label>
              <input
                type="number"
                min={1}
                max={midModal.availableDays}
                value={midDays}
                onChange={(e) => setMidDays(e.target.value)}
                placeholder={`최대 ${midModal.availableDays}일`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                예상 금액: <span className="font-semibold text-orange-600">
                  {((midDays ? Math.min(parseInt(midDays) || 0, midModal.availableDays) : midModal.availableDays) * midModal.dailyRate).toLocaleString()}원
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMidModal(null)}
                disabled={midSubmitting}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateMidSettlement}
                disabled={midSubmitting}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
              >
                {midSubmitting ? "처리 중..." : "정산 생성"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 환불 요청 Tab */}
      {activeTab === "refunds" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">상태:</label>
              <select
                value={refundStatusFilter}
                onChange={(e) => setRefundStatusFilter(e.target.value)}
                className="input-field w-auto"
              >
                <option value="PENDING">대기중</option>
                <option value="APPROVED">승인됨</option>
                <option value="REJECTED">거절됨</option>
              </select>
              <button onClick={fetchRefundRequests} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 ml-auto">
                새로고침
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">요청일시</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">보호자</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">환자 / 간병인</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">결제액 / 요청액</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">사유</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">방법</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">작업</th>
                </tr>
              </thead>
              <tbody>
                {refundLoading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">로딩중...</td></tr>
                ) : refundRequests.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">환불 요청이 없습니다.</td></tr>
                ) : refundRequests.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {r.refundRequestedAt ? new Date(r.refundRequestedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.guardianName || "-"}</div>
                      <div className="text-xs text-gray-400">{r.guardianPhone || ""}</div>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div>{r.patientName || "-"}</div>
                      <div className="text-xs text-gray-500">{r.caregiverName || "-"}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-xs text-gray-500">{r.totalAmount.toLocaleString()}원</div>
                      <div className="font-bold text-red-600">{(r.refundRequestAmount ?? r.totalAmount).toLocaleString()}원</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[240px]">
                      {r.refundRequestReason || "-"}
                      {r.refundRejectReason && (
                        <div className="text-xs text-red-600 mt-1">거절 사유: {r.refundRejectReason}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">
                      {({ CARD: "카드", BANK_TRANSFER: "무통장", DIRECT: "직접결제" } as any)[r.method] || r.method}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.refundRequestStatus === "PENDING" ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            disabled={refundActionLoading}
                            onClick={() => handleApproveRefund(r.id)}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                          >
                            승인
                          </button>
                          <button
                            disabled={refundActionLoading}
                            onClick={() => { setRejectTarget(r); setRejectReason(""); }}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.refundRequestStatus === "APPROVED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {r.refundRequestStatus === "APPROVED" ? "승인됨" : "거절됨"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 환불 거절 모달 */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !refundActionLoading && setRejectTarget(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">환불 요청 거절</h3>
            <p className="text-sm text-gray-600 mb-4">
              {rejectTarget.guardianName}님의 {(rejectTarget.refundRequestAmount ?? rejectTarget.totalAmount).toLocaleString()}원 환불 요청을 거절합니다.
            </p>
            <label className="block text-xs font-medium mb-1 text-gray-700">거절 사유 <span className="text-red-500">*</span></label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거절 사유를 입력해주세요 (보호자에게 알림으로 전달됩니다)"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={refundActionLoading}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleRejectRefund}
                disabled={refundActionLoading || !rejectReason.trim()}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {refundActionLoading ? "처리 중..." : "거절 처리"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가 간병비 Tab */}
      {activeTab === "additional-fees" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium text-gray-700">상태:</label>
              <select
                value={feesStatusFilter}
                onChange={(e) => setFeesStatusFilter(e.target.value)}
                className="input-field w-auto"
              >
                <option value="pending">보호자 승인 대기</option>
                <option value="approved">보호자 승인됨 (미지급)</option>
                <option value="paid">지급 완료</option>
                <option value="rejected">거절됨</option>
                <option value="all">전체</option>
              </select>
              <button onClick={fetchAdditionalFees} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 ml-auto">
                새로고침
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              간병인이 보호자에게 추가 간병비를 요청한 내역입니다. 승인된 건에는 수수료·세금이 적용되며, 거절·지급 이력까지 모두 보관됩니다.
            </p>
          </div>

          {/* 요약 카드 */}
          {!feesLoading && additionalFees.length > 0 && (() => {
            const approvedList = additionalFees.filter((f) => f.approvedByGuardian && !f.rejected);
            const total = approvedList.reduce((s, f) => s + f.amount, 0);
            const totalFee = approvedList.reduce((s, f) => s + f.platformFeeAmount, 0);
            const totalTax = approvedList.reduce((s, f) => s + f.taxAmount, 0);
            const totalNet = approvedList.reduce((s, f) => s + f.netAmount, 0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card bg-orange-50 border-orange-100">
                  <div className="text-xs text-orange-700">승인 총액</div>
                  <div className="text-lg font-bold text-orange-800 mt-1">{total.toLocaleString()}원</div>
                </div>
                <div className="card bg-blue-50 border-blue-100">
                  <div className="text-xs text-blue-700">수수료 합계</div>
                  <div className="text-lg font-bold text-blue-800 mt-1">{totalFee.toLocaleString()}원</div>
                </div>
                <div className="card bg-gray-50 border-gray-100">
                  <div className="text-xs text-gray-600">세금 합계</div>
                  <div className="text-lg font-bold text-gray-800 mt-1">{totalTax.toLocaleString()}원</div>
                </div>
                <div className="card bg-green-50 border-green-100">
                  <div className="text-xs text-green-700">간병인 실수령</div>
                  <div className="text-lg font-bold text-green-800 mt-1">{totalNet.toLocaleString()}원</div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">요청일</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">간병인 → 보호자</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">환자</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">금액</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">수수료</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">세금</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">실수령</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">사유</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">상태</th>
                </tr>
              </thead>
              <tbody>
                {feesLoading ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">로딩중...</td></tr>
                ) : additionalFees.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">추가 간병비 요청이 없습니다.</td></tr>
                ) : additionalFees.map((f) => (
                  <tr key={f.id} className={`border-b border-gray-100 hover:bg-gray-50 ${f.rejected ? "opacity-70" : ""}`}>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(f.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="font-medium">{f.caregiverName || "-"}</div>
                      <div className="text-gray-400">→ {f.guardianName || "-"}</div>
                    </td>
                    <td className="px-3 py-2 text-sm">{f.patientName || "-"}</td>
                    <td className="px-3 py-2 text-right font-bold text-orange-600">{f.amount.toLocaleString()}원</td>
                    <td className="px-3 py-2 text-right text-xs text-blue-600">
                      {f.approvedByGuardian && !f.rejected ? (
                        <>
                          <div>-{f.platformFeeAmount.toLocaleString()}원</div>
                          <div className="text-gray-400">({f.platformFeePercent}%)</div>
                        </>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {f.approvedByGuardian && !f.rejected ? (
                        <>
                          <div>-{f.taxAmount.toLocaleString()}원</div>
                          <div className="text-gray-400">({f.taxRate}%)</div>
                        </>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-green-700">
                      {f.approvedByGuardian && !f.rejected ? `${f.netAmount.toLocaleString()}원` : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[240px]">
                      <div>{f.reason}</div>
                      {f.rejected && f.rejectReason && (
                        <div className="text-[10px] text-red-600 mt-1">거절 사유: {f.rejectReason}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        f.rejected
                          ? "bg-red-100 text-red-700"
                          : f.paid
                          ? "bg-green-100 text-green-700"
                          : f.approvedByGuardian
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {f.rejected ? "거절됨" : f.paid ? "지급완료" : f.approvedByGuardian ? "승인·지급대기" : "승인대기"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
