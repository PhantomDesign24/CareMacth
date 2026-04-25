"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DataTable, { Column } from "@/components/DataTable";
import StatsCard from "@/components/StatsCard";
import { getAdminPayments, AdminPayment, apiRequest } from "@/lib/api";

interface MatchingRow {
  id: string;
  contractId: string;
  patientName: string;
  caregiverName: string;
  status: string;
  contractStatus: string | null;
  contractCancelledAt: string | null;
  amount: number;
  fee: number;
  netAmount: number;
  method: string;
  paidAt: string;
  createdAt: string;
  additionalFeesCount: number;
  additionalFeesPending: number;
  additionalFeesTotal: number;
  disputesCount: number;
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
    contractStatus: p.contractStatus ?? null,
    contractCancelledAt: p.contractCancelledAt ?? null,
    amount: p.amount,
    fee: p.fee,
    netAmount: p.netAmount,
    method: p.method,
    paidAt: p.paidAt || "",
    createdAt: p.createdAt || "",
    additionalFeesCount: p.additionalFeesCount || 0,
    additionalFeesPending: p.additionalFeesPending || 0,
    additionalFeesTotal: p.additionalFeesTotal || 0,
    disputesCount: p.disputesCount || 0,
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

  // 상세 모달
  const [detailRow, setDetailRow] = useState<MatchingRow | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const limit = 20;

  const openDetail = useCallback(async (row: MatchingRow) => {
    if (!row.contractId || row.contractId === "-") {
      alert("계약 정보가 연결되지 않은 결제입니다.");
      return;
    }
    setDetailRow(row);
    setDetailData(null);
    setDetailLoading(true);
    setCancelMode(false);
    setCancelReason("");
    try {
      const res: any = await apiRequest(`/admin/contracts/${row.contractId}/detail`);
      setDetailData(res?.data || res);
    } catch (err: any) {
      alert(err?.message || "상세 조회 실패");
      setDetailRow(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const reloadDetail = async () => {
    if (!detailRow) return;
    try {
      const res: any = await apiRequest(`/admin/contracts/${detailRow.contractId}/detail`);
      setDetailData(res?.data || res);
    } catch {
      // ignore
    }
  };

  const handleForceCancel = async () => {
    if (!detailRow) return;
    if (!cancelReason.trim()) { alert("취소 사유를 입력해주세요."); return; }
    setActionLoading(true);
    try {
      await apiRequest(`/admin/contracts/${detailRow.contractId}/force-cancel`, {
        method: "POST",
        body: { reason: cancelReason.trim() },
      });
      alert("계약이 강제 취소되었습니다.");
      setCancelMode(false);
      setCancelReason("");
      await fetchData();
      await reloadDetail();
    } catch (err: any) {
      alert(err?.message || "취소 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceComplete = async () => {
    if (!detailRow) return;
    if (!confirm("해당 계약을 강제 완료 처리하시겠습니까?")) return;
    setActionLoading(true);
    try {
      await apiRequest(`/admin/contracts/${detailRow.contractId}/force-complete`, { method: "POST" });
      alert("완료 처리되었습니다.");
      await fetchData();
      await reloadDetail();
    } catch (err: any) {
      alert(err?.message || "완료 처리 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmergencyRematch = async () => {
    if (!detailRow) return;
    const reason = prompt("긴급 재매칭 사유를 입력하세요:");
    if (!reason || !reason.trim()) return;
    setActionLoading(true);
    try {
      await apiRequest(`/admin/emergency-rematch/${detailRow.contractId}`, {
        method: "POST",
        body: { reason: reason.trim() },
      });
      alert("긴급 재매칭 처리되었습니다.");
      await fetchData();
      await reloadDetail();
    } catch (err: any) {
      alert(err?.message || "재매칭 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMidSettlement = async () => {
    if (!detailRow || !detailData) return;
    const available = detailData.stats?.availableDays || 0;
    if (available <= 0) {
      alert("정산 가능한 경과 일수가 없습니다.");
      return;
    }
    const input = prompt(`정산할 일수를 입력하세요 (최대 ${available}일, 비우면 전체)`);
    if (input === null) return;
    const days = input.trim() ? parseInt(input.trim(), 10) : undefined;
    setActionLoading(true);
    try {
      await apiRequest(`/admin/contracts/${detailRow.contractId}/mid-settlement`, {
        method: "POST",
        body: days !== undefined ? { days } : {},
      });
      alert("중간정산이 생성되었습니다.");
      await reloadDetail();
    } catch (err: any) {
      alert(err?.message || "중간정산 실패");
    } finally {
      setActionLoading(false);
    }
  };

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
      render: (v, row) => {
        const s = v as string;
        const r = row as MatchingRow;
        const label = formatStatus(s);
        const cls =
          s === "COMPLETED" ? "badge-green" :
          s === "ESCROW" ? "badge-blue" :
          s === "PENDING" ? "badge-yellow" :
          s === "REFUNDED" || s === "PARTIAL_REFUND" ? "badge-red" :
          "badge-gray";
        const cancelled = r.contractStatus === "CANCELLED";
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={cls}>{label}</span>
            {cancelled && (
              <span className="badge-red text-[10px]" title="계약이 취소되었습니다">계약 취소됨</span>
            )}
          </div>
        );
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
    {
      key: "additionalFeesCount",
      label: "추가비/분쟁",
      align: "center",
      render: (_v, row) => {
        const r = row as MatchingRow;
        if (r.additionalFeesCount === 0 && r.disputesCount === 0) {
          return <span className="text-xs text-gray-300">—</span>;
        }
        return (
          <div className="flex flex-col items-center gap-1">
            {r.additionalFeesCount > 0 && (
              <div className="flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    r.additionalFeesPending > 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                  title={`추가비 ${r.additionalFeesCount}건 (대기 ${r.additionalFeesPending}건)`}
                >
                  💰 {r.additionalFeesCount}
                  {r.additionalFeesPending > 0 && (
                    <span className="ml-0.5 text-red-600">({r.additionalFeesPending})</span>
                  )}
                </span>
              </div>
            )}
            {r.additionalFeesTotal > 0 && (
              <span className="text-[10px] text-gray-500">
                +{r.additionalFeesTotal.toLocaleString()}원
              </span>
            )}
            {r.disputesCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700"
                title={`분쟁 ${r.disputesCount}건`}
              >
                ⚠ {r.disputesCount}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "id",
      label: "관리",
      align: "center",
      render: (_v, row) => (
        <button
          type="button"
          onClick={() => openDetail(row as MatchingRow)}
          className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium"
        >
          상세/관리
        </button>
      ),
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

      {/* 상세/관리 모달 */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !actionLoading && setDetailRow(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">매칭 상세 관리</h3>
                <p className="text-xs text-gray-500 mt-0.5">계약 ID: {detailRow.contractId}</p>
              </div>
              <button
                onClick={() => setDetailRow(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {detailLoading ? (
              <div className="py-20 text-center text-gray-400">불러오는 중...</div>
            ) : !detailData ? (
              <div className="py-20 text-center text-gray-400">데이터가 없습니다.</div>
            ) : (
              <div className="p-6 space-y-5">
                {/* 당사자 정보 */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">당사자</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-blue-600">보호자</div>
                      <div className="font-semibold text-gray-900 mt-1">{detailData.guardian?.user?.name || "-"}</div>
                      <div className="text-xs text-gray-500">{detailData.guardian?.user?.phone || "-"}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-green-600">간병인</div>
                      <div className="font-semibold text-gray-900 mt-1">{detailData.caregiver?.user?.name || "-"}</div>
                      <div className="text-xs text-gray-500">{detailData.caregiver?.user?.phone || "-"}</div>
                      {detailData.caregiver?.id && (
                        <Link
                          href={`/caregivers/${detailData.caregiver.id}`}
                          className="inline-block mt-1 text-xs text-orange-600 hover:underline"
                        >
                          → 간병인 페이지
                        </Link>
                      )}
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-xs text-purple-600">환자</div>
                      <div className="font-semibold text-gray-900 mt-1">{detailData.patient?.name || "-"}</div>
                      <div className="text-xs text-gray-500">
                        {detailData.patient?.birthDate
                          ? new Date(detailData.patient.birthDate).toLocaleDateString("ko-KR")
                          : "-"}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 계약 정보 */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">계약</h4>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                    <InfoRow label="상태" value={
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        detailData.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                        detailData.status === "EXTENDED" ? "bg-blue-100 text-blue-700" :
                        detailData.status === "COMPLETED" ? "bg-gray-100 text-gray-600" :
                        detailData.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{detailData.status}</span>
                    } />
                    <InfoRow label="간병기간" value={
                      `${new Date(detailData.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(detailData.endDate).toLocaleDateString("ko-KR")} (총 ${detailData.stats?.totalDays}일)`
                    } />
                    <InfoRow label="일당" value={`${detailData.dailyRate?.toLocaleString()}원`} />
                    <InfoRow label="총 금액" value={`${detailData.totalAmount?.toLocaleString()}원`} />
                    <InfoRow label="플랫폼 수수료" value={`${detailData.platformFee}%`} />
                    <InfoRow label="경과/정산됨" value={`${detailData.stats?.elapsed}일 / ${detailData.stats?.settledDays}일`} />
                    {detailData.stats?.availableDays > 0 && (
                      <InfoRow label="미정산 경과" value={
                        <span className="text-orange-600 font-semibold">
                          {detailData.stats.availableDays}일 ({detailData.stats.pendingAmount.toLocaleString()}원)
                        </span>
                      } />
                    )}
                    {detailData.cancelledAt && (
                      <InfoRow label="취소 사유" value={`${detailData.cancellationReason || "-"} (${new Date(detailData.cancelledAt).toLocaleDateString("ko-KR")})`} />
                    )}
                  </div>
                </section>

                {/* 결제/환불 요약 */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">
                    결제 <span className="text-xs font-normal text-gray-400">{detailData.payments?.length || 0}건</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                    <StatMini label="총 결제액" value={`${(detailData.stats?.totalPaid || 0).toLocaleString()}원`} color="blue" />
                    <StatMini label="환불액" value={`${(detailData.stats?.totalRefunded || 0).toLocaleString()}원`} color="red" />
                    <StatMini label="정산 생성액" value={`${(detailData.stats?.totalEarnings || 0).toLocaleString()}원`} color="green" />
                    <StatMini label="미지급 정산" value={`${detailData.stats?.unpaidEarnings || 0}건`} color="amber" />
                  </div>
                  {detailData.payments?.length > 0 && (
                    <div className="border border-gray-100 rounded-lg overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1.5 text-left text-gray-600">생성일</th>
                            <th className="px-2 py-1.5 text-left text-gray-600">방법</th>
                            <th className="px-2 py-1.5 text-right text-gray-600">금액</th>
                            <th className="px-2 py-1.5 text-center text-gray-600">상태</th>
                            <th className="px-2 py-1.5 text-right text-gray-600">환불</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.payments.map((p: any) => (
                            <tr key={p.id} className="border-t border-gray-100">
                              <td className="px-2 py-1.5">{new Date(p.createdAt).toLocaleDateString("ko-KR")}</td>
                              <td className="px-2 py-1.5">
                                {({ CARD: "카드", BANK_TRANSFER: "무통장", DIRECT: "직접" } as any)[p.method] || p.method}
                              </td>
                              <td className="px-2 py-1.5 text-right">{p.totalAmount?.toLocaleString()}원</td>
                              <td className="px-2 py-1.5 text-center">{p.status}</td>
                              <td className="px-2 py-1.5 text-right">
                                {p.refundAmount ? `${p.refundAmount.toLocaleString()}원` : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* 간병 기록 / 분쟁 / 리뷰 */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-teal-50 rounded-lg p-3 text-sm">
                    <div className="text-xs text-teal-700">간병일지</div>
                    <div className="text-lg font-bold text-gray-900 mt-1">{detailData.careRecordCount || 0}건</div>
                    {detailData.latestCareRecord?.date && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        최근: {new Date(detailData.latestCareRecord.date).toLocaleDateString("ko-KR")}
                      </div>
                    )}
                  </div>
                  <div className={`rounded-lg p-3 text-sm ${detailData.disputes?.length > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                    <div className={`text-xs ${detailData.disputes?.length > 0 ? "text-red-700" : "text-gray-600"}`}>분쟁</div>
                    <div className="text-lg font-bold text-gray-900 mt-1">{detailData.disputes?.length || 0}건</div>
                    {detailData.disputes?.length > 0 && (
                      <Link href="/disputes" className="text-xs text-red-600 hover:underline">→ 분쟁 관리</Link>
                    )}
                  </div>
                  <div className={`rounded-lg p-3 text-sm ${detailData.review ? "bg-yellow-50" : "bg-gray-50"}`}>
                    <div className={`text-xs ${detailData.review ? "text-yellow-700" : "text-gray-600"}`}>리뷰</div>
                    <div className="text-lg font-bold text-gray-900 mt-1">
                      {detailData.review ? `⭐ ${detailData.review.rating}` : "없음"}
                    </div>
                    {detailData.review?.isHidden && (
                      <div className="text-xs text-red-600 mt-0.5">숨김 처리됨</div>
                    )}
                  </div>
                </section>

                {/* 디지털 서명 상태 */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">계약서 서명</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`px-3 py-2 rounded-lg border ${
                      detailData.guardianSignedAt
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}>
                      <div className="font-bold mb-0.5">{detailData.guardianSignedAt ? "✓ 보호자 서명" : "✗ 보호자 미서명"}</div>
                      {detailData.guardianSignedAt && (
                        <div className="text-[10px] text-gray-500">
                          {new Date(detailData.guardianSignedAt).toLocaleString("ko-KR")}
                        </div>
                      )}
                    </div>
                    <div className={`px-3 py-2 rounded-lg border ${
                      detailData.caregiverSignedAt
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}>
                      <div className="font-bold mb-0.5">{detailData.caregiverSignedAt ? "✓ 간병인 서명" : "✗ 간병인 미서명"}</div>
                      {detailData.caregiverSignedAt && (
                        <div className="text-[10px] text-gray-500">
                          {new Date(detailData.caregiverSignedAt).toLocaleString("ko-KR")}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* 연장 / 추가비 */}
                {(detailData.extensions?.length > 0 || detailData.additionalFees?.length > 0) && (
                  <section>
                    <h4 className="text-sm font-bold text-gray-900 mb-2">
                      연장 {detailData.extensions?.length || 0}건 · 추가비 {detailData.additionalFees?.length || 0}건
                    </h4>
                    <div className="space-y-1 text-xs text-gray-600">
                      {detailData.extensions?.map((ex: any) => {
                        const statusInfo = (() => {
                          switch (ex.status) {
                            case 'CONFIRMED': return { cls: 'bg-emerald-100 text-emerald-700', label: '결제완료·확정' };
                            case 'PENDING_PAYMENT': return { cls: 'bg-amber-100 text-amber-700', label: '결제 대기' };
                            case 'EXPIRED': return { cls: 'bg-gray-200 text-gray-600', label: '만료' };
                            case 'REJECTED': return { cls: 'bg-red-100 text-red-700', label: '거절/취소' };
                            default: return { cls: 'bg-gray-100 text-gray-600', label: ex.status || '-' };
                          }
                        })();
                        return (
                          <div key={ex.id} className="px-3 py-2 bg-blue-50 rounded flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              연장: {ex.additionalDays}일 · {ex.additionalAmount?.toLocaleString()}원
                              {ex.isNewCaregiver && <span className="ml-1 text-amber-700">(새 간병인)</span>}
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusInfo.cls}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                        );
                      })}
                      {detailData.additionalFees?.map((f: any) => (
                        <div key={f.id} className="px-3 py-1.5 bg-amber-50 rounded">
                          추가비: {f.amount?.toLocaleString()}원 · {f.reason}
                          {f.approvedByGuardian ? " · 승인" : " · 대기"}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 액션 버튼 */}
                <section className="pt-3 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">관리 액션</h4>
                  {cancelMode ? (
                    <div className="space-y-2 bg-red-50 rounded-lg p-3 border border-red-200">
                      <div className="text-sm font-semibold text-red-800">⚠ 계약 강제 취소</div>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="취소 사유 (보호자·간병인에게 알림 전송)"
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setCancelMode(false); setCancelReason(""); }}
                          disabled={actionLoading}
                          className="flex-1 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleForceCancel}
                          disabled={actionLoading || !cancelReason.trim()}
                          className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                          {actionLoading ? "처리 중..." : "강제 취소"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        onClick={() => window.open(
                          `/api/contracts/${detailRow.contractId}/pdf?token=${encodeURIComponent(
                            typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""
                          )}`,
                          "_blank"
                        )}
                        className="text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        📄 계약서 PDF
                      </button>
                      <button
                        onClick={() => window.open(
                          `/api/care-records/${detailRow.contractId}/pdf?token=${encodeURIComponent(
                            typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""
                          )}`,
                          "_blank"
                        )}
                        className="text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        📋 간병일지 PDF
                      </button>
                      {detailData.status !== "CANCELLED" && detailData.status !== "COMPLETED" && (
                        <>
                          <button
                            onClick={handleMidSettlement}
                            disabled={actionLoading || (detailData.stats?.availableDays || 0) <= 0}
                            className="text-xs px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            💰 중간정산
                          </button>
                          <button
                            onClick={handleEmergencyRematch}
                            disabled={actionLoading}
                            className="text-xs px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
                          >
                            🔄 긴급 재매칭
                          </button>
                          <button
                            onClick={handleForceComplete}
                            disabled={actionLoading}
                            className="text-xs px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                          >
                            ✓ 강제 완료
                          </button>
                          <button
                            onClick={() => setCancelMode(true)}
                            disabled={actionLoading}
                            className="text-xs px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                          >
                            ⚠ 강제 취소
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color: "blue" | "red" | "green" | "amber" }) {
  const cls = {
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
  }[color];
  return (
    <div className={`rounded-lg p-2 ${cls}`}>
      <div className="text-[10px] opacity-80">{label}</div>
      <div className="font-bold mt-0.5">{value}</div>
    </div>
  );
}
