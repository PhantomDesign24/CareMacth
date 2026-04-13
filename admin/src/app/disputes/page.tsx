"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable, { Column } from "@/components/DataTable";
import { getDisputes, emergencyRematch, Dispute } from "@/lib/api";

function formatDate(dateStr?: string | null): string {
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

function formatStatus(status?: string): string {
  switch (status) {
    case "CANCELLED": return "취소됨";
    case "ACTIVE": return "활성";
    case "COMPLETED": return "완료";
    case "resolved": return "해결";
    case "해결": return "해결";
    case "in_progress":
    case "처리중": return "처리중";
    case "escalated":
    case "에스컬레이션": return "에스컬레이션";
    case "open":
    case "접수": return "접수";
    default: return status || "-";
  }
}

function statusBadgeClass(status?: string): string {
  const s = formatStatus(status);
  switch (s) {
    case "해결":
    case "완료": return "badge-green";
    case "처리중": return "badge-blue";
    case "에스컬레이션": return "badge-red";
    case "취소됨": return "badge-yellow";
    case "접수": return "badge-yellow";
    default: return "badge-gray";
  }
}

export default function DisputesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState("");

  const limit = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getDisputes({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        page: currentPage,
        limit,
      });

      const raw = res as any;
      const list = raw?.disputes || raw?.data || (Array.isArray(raw) ? raw : []);
      const pag = raw?.pagination;

      // Flatten nested fields from backend response
      // Backend returns cancelled contracts with: guardian.user.name, caregiver.user.name,
      // careRequest.patient.name, cancellationReason, cancelledAt, status
      const flattened = (Array.isArray(list) ? list : []).map((d: any) => ({
        ...d,
        contractId: d.contractId || d.id,
        patientName:
          d.patientName ||
          d.careRequest?.patient?.name ||
          d.guardian?.user?.name ||
          d.guardian?.name ||
          "",
        caregiverName:
          d.caregiverName ||
          d.caregiver?.user?.name ||
          d.caregiver?.name ||
          "",
        type:
          d.type ||
          d.disputeType ||
          d.cancellationReason ||
          d.careRequest?.careType ||
          "",
        description:
          d.description ||
          d.reason ||
          d.cancellationReason ||
          "",
        status: d.status || "CANCELLED",
        priority: d.priority || "-",
        createdAt: d.createdAt || d.cancelledAt || d.updatedAt || "",
      }));

      setDisputes(flattened);
      setTotalItems(pag?.total ?? list.length ?? 0);
      setTotalPages(pag?.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "분쟁 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, priorityFilter]);

  const handleEmergencyRematch = async (dispute: Dispute) => {
    const contractId = dispute.contractId || dispute.matchingId || dispute.id;
    if (!confirm(`계약 ${contractId}에 대한 긴급 재매칭을 진행하시겠습니까?`)) return;
    setActionLoading(dispute.id);
    try {
      await emergencyRematch(contractId);
      alert("긴급 재매칭이 요청되었습니다.");
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "긴급 재매칭 실패");
    } finally {
      setActionLoading(null);
    }
  };

  const openCount = disputes.filter(
    (d) => d.status !== "해결" && d.status !== "resolved" && d.status !== "COMPLETED"
  ).length;
  const cancelledCount = disputes.filter(
    (d) => d.status === "CANCELLED" || d.status === "취소됨"
  ).length;
  const resolvedCount = disputes.filter(
    (d) => d.status === "해결" || d.status === "resolved" || d.status === "COMPLETED"
  ).length;

  const columns: Column<Dispute>[] = [
    {
      key: "contractId",
      label: "계약 ID",
      render: (v) => (
        <span className="font-mono text-xs text-gray-500">
          {((v as string) || "").substring(0, 8)}...
        </span>
      ),
    },
    {
      key: "patientName",
      label: "환자명",
      render: (v) => <span className="text-sm font-medium text-gray-900">{(v as string) || "-"}</span>,
    },
    {
      key: "caregiverName",
      label: "간병인명",
      render: (v) => <span className="text-sm text-gray-700">{(v as string) || "-"}</span>,
    },
    {
      key: "description",
      label: "취소 사유",
      render: (v) => (
        <p className="max-w-[250px] truncate text-sm text-gray-600">{(v as string) || "-"}</p>
      ),
    },
    {
      key: "createdAt",
      label: "날짜",
      render: (v) => (
        <span className="text-sm text-gray-500">{formatDate(v as string)}</span>
      ),
    },
    {
      key: "status",
      label: "상태",
      align: "center",
      render: (v) => {
        const label = formatStatus(v as string);
        return <span className={statusBadgeClass(v as string)}>{label}</span>;
      },
    },
    {
      key: "actions",
      label: "액션",
      align: "center",
      render: (_v, row) => {
        const isResolved = row.status === "해결" || row.status === "resolved" || row.status === "COMPLETED";
        const disabled = actionLoading === row.id;
        return (
          <div className="flex items-center justify-center gap-1.5">
            {!isResolved && (
              <>
                <button
                  className="btn-danger btn-sm"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEmergencyRematch(row);
                  }}
                >
                  {disabled ? "..." : "긴급 재매칭"}
                </button>
                <button
                  className="btn-success btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDispute(row);
                    setShowResolveModal(true);
                  }}
                >
                  해결
                </button>
              </>
            )}
            {isResolved && (
              <span className="text-xs text-gray-400">해결 완료</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">분쟁 처리</h1>
        <p className="mt-1 text-sm text-gray-500">환자-간병인 간 분쟁을 관리하고 처리합니다.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">전체 분쟁</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalItems}건</p>
        </div>
        <div className="card border-red-200 bg-red-50/50">
          <p className="text-sm text-red-600">미해결 분쟁</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{openCount}건</p>
        </div>
        <div className="card border-amber-200 bg-amber-50/50">
          <p className="text-sm text-amber-600">취소 건</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{cancelledCount}건</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">해결 완료</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{resolvedCount}건</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 상태</option>
            <option value="CANCELLED">취소됨</option>
            <option value="open">접수</option>
            <option value="in_progress">처리중</option>
            <option value="escalated">에스컬레이션</option>
            <option value="resolved">해결</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 긴급도</option>
            <option value="urgent">긴급</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
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
        data={disputes}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={totalItems}
        emptyMessage="분쟁 내역이 없습니다."
      />

      {/* Resolve Modal */}
      {showResolveModal && selectedDispute && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">분쟁 해결 처리</h3>
              <button onClick={() => setShowResolveModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-gray-500">계약 ID:</span>
                    <span className="ml-2 font-mono font-medium">{(selectedDispute.contractId || selectedDispute.id || "").substring(0, 12)}...</span>
                  </div>
                  <div>
                    <span className="text-gray-500">취소 사유:</span>
                    <span className="ml-2 font-medium">{selectedDispute.description || selectedDispute.type || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">환자:</span>
                    <span className="ml-2 font-medium">{selectedDispute.patientName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">간병인:</span>
                    <span className="ml-2 font-medium">{selectedDispute.caregiverName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">날짜:</span>
                    <span className="ml-2 font-medium">{formatDate(selectedDispute.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">상태:</span>
                    <span className="ml-2 font-medium">{formatStatus(selectedDispute.status)}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">해결 내용</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="input-field min-h-[120px] resize-y"
                  placeholder="분쟁 해결 내용을 상세히 기록하세요..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowResolveModal(false)}>취소</button>
              <button
                className="btn-success"
                disabled={!resolution.trim() || actionLoading === selectedDispute.id}
                onClick={async () => {
                  const disputeId = selectedDispute.contractId || selectedDispute.id;
                  setActionLoading(selectedDispute.id);
                  try {
                    // 분쟁 해결 처리: 로컬 상태 업데이트
                    setDisputes((prev) =>
                      prev.map((d) =>
                        d.id === selectedDispute.id
                          ? { ...d, status: "resolved", resolution }
                          : d
                      )
                    );
                    setShowResolveModal(false);
                    setResolution("");
                  } catch (err: unknown) {
                    alert(err instanceof Error ? err.message : `분쟁 ${disputeId} 해결 처리 중 오류가 발생했습니다.`);
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                {actionLoading === selectedDispute.id ? "처리 중..." : "해결 완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
