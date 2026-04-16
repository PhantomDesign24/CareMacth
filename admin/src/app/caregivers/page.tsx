"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DataTable, { Column } from "@/components/DataTable";
import {
  getCaregivers,
  approveCaregiver,
  rejectCaregiver,
  blacklistCaregiver,
  toggleBadge,
  addPenalty,
  addMemo,
  Caregiver,
} from "@/lib/api";

import {
  CAREGIVER_STATUS_OPTIONS as statusOptions,
  REGION_OPTIONS as regionOptions,
  EXPERIENCE_OPTIONS as experienceOptions,
  WORK_STATUS_OPTIONS as workStatusOptions,
  caregiverStatusLabel as statusLabel,
  caregiverStatusBadge as statusBadge,
} from "@/lib/constants";

export default function CaregiversPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [workStatusFilter, setWorkStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);
  const [penaltyForm, setPenaltyForm] = useState({ type: "경고", reason: "" });
  const [memoContent, setMemoContent] = useState("");

  const limit = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Parse experience filter into min/max
      let minExp: number | undefined;
      let maxExp: number | undefined;
      if (experienceFilter) {
        const parts = experienceFilter.split("-");
        if (parts[0]) minExp = parseInt(parts[0]);
        if (parts[1]) maxExp = parseInt(parts[1]);
      }

      const res = await getCaregivers({
        status: statusFilter || undefined,
        search: search || undefined,
        region: regionFilter || undefined,
        minExp,
        maxExp,
        workStatus: workStatusFilter || undefined,
        page: currentPage,
        limit,
      });
      const list = (res as any)?.caregivers || (res as any)?.data || (Array.isArray(res) ? res : []);
      const pag = (res as any)?.pagination;
      // Flatten nested user fields from API response
      const flattened = (Array.isArray(list) ? list : []).map((cg: any) => ({
        ...cg,
        name: cg.name || cg.user?.name || "",
        phone: cg.phone || cg.user?.phone || "",
        email: cg.email || cg.user?.email || "",
      }));
      setCaregivers(flattened);
      setTotalItems(pag?.total ?? list.length ?? 0);
      setTotalPages(pag?.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, regionFilter, experienceFilter, workStatusFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounce search: reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, regionFilter, experienceFilter, workStatusFilter]);

  const handleApprove = async (cg: Caregiver) => {
    if (!confirm(`${cg.name}을(를) 승인하시겠습니까?`)) return;
    setActionLoading(cg.id);
    try {
      await approveCaregiver(cg.id);
      alert(`${cg.name} 승인 완료`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "승인 처리 실패");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (cg: Caregiver) => {
    if (!confirm(`${cg.name}을(를) 거절하시겠습니까?`)) return;
    setActionLoading(cg.id);
    try {
      await rejectCaregiver(cg.id);
      alert(`${cg.name} 거절 완료`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "거절 처리 실패");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlacklist = async (cg: Caregiver) => {
    if (!confirm(`${cg.name}을(를) 블랙리스트에 등록하시겠습니까?`)) return;
    setActionLoading(cg.id);
    try {
      await blacklistCaregiver(cg.id);
      alert(`${cg.name} 블랙리스트 등록 완료`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "블랙리스트 처리 실패");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBadge = async (cg: Caregiver) => {
    if (!confirm(`${cg.name}에게 우수 간병사 뱃지를 부여하시겠습니까?`)) return;
    setActionLoading(cg.id);
    try {
      await toggleBadge(cg.id);
      alert(`${cg.name} 뱃지 처리 완료`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "뱃지 처리 실패");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePenaltySubmit = async () => {
    if (!selectedCaregiver) return;
    if (!penaltyForm.reason.trim()) {
      alert("사유를 입력해주세요.");
      return;
    }
    setActionLoading(selectedCaregiver.id);
    try {
      await addPenalty(selectedCaregiver.id, {
        type: penaltyForm.type,
        reason: penaltyForm.reason,
      });
      alert(`${selectedCaregiver.name}에게 패널티 부여 완료`);
      setShowPenaltyModal(false);
      setPenaltyForm({ type: "경고", reason: "" });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "패널티 부여 실패");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMemoSubmit = async () => {
    if (!selectedCaregiver) return;
    if (!memoContent.trim()) {
      alert("메모 내용을 입력해주세요.");
      return;
    }
    setActionLoading(selectedCaregiver.id);
    try {
      await addMemo(selectedCaregiver.id, memoContent);
      alert(`${selectedCaregiver.name} 메모 저장 완료`);
      setShowMemoModal(false);
      setMemoContent("");
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "메모 저장 실패");
    } finally {
      setActionLoading(null);
    }
  };

  const columns: Column<Caregiver>[] = [
    {
      key: "name",
      label: "이름 (상태)",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Link href={`/caregivers/${row.id}`} className="font-medium text-primary-600 hover:text-primary-700 hover:underline">
            {row.name}
          </Link>
          <span className={statusBadge(row.status)}>{statusLabel(row.status)}</span>
          {row.hasBadge && (
            <span className="badge-purple" title="우수 간병사">
              <svg className="mr-0.5 h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              우수
            </span>
          )}
        </div>
      ),
    },
    {
      key: "associationFeePaid",
      label: "협회비",
      render: (v) => <span>{v ? "납부" : "미납"}</span>,
    },
    { key: "period", label: "기간 (횟수)", render: (v, row) => <span>{(v as string) || (row.totalMatchings ? `${row.totalMatchings}회` : "-")}</span> },
    {
      key: "penaltyCount",
      label: "패널티 (누계)",
      align: "center",
      render: (_value, row) => (
        <div className="text-center">
          <span className={(row.penaltyCount ?? 0) > 0 ? "font-semibold text-red-600" : "text-gray-400"}>
            {row.penaltyCount ?? 0}회
          </span>
          {(row.penaltyTotal ?? 0) > 0 && (
            <span className="ml-1 text-xs text-gray-400">
              ({(row.penaltyTotal ?? 0).toLocaleString()}원)
            </span>
          )}
        </div>
      ),
    },
    {
      key: "detail",
      label: "상세",
      align: "center",
      render: (_value, row) => (
        <Link href={`/caregivers/${row.id}`} className="btn-secondary btn-sm">
          상세보기
        </Link>
      ),
    },
    {
      key: "lastMemo",
      label: "상담 (메모)",
      render: (_value, row) => (
        <div className="max-w-[200px]">
          <p className="truncate text-xs text-gray-500">{(row.lastMemo as string) || "-"}</p>
        </div>
      ),
    },
    {
      key: "actions",
      label: "액션",
      align: "center",
      render: (_value, row) => {
        const st = row.status?.toUpperCase();
        const isPending = st === "PENDING";
        const isApproved = st === "APPROVED";
        const isBlacklisted = st === "BLACKLISTED";
        const disabled = actionLoading === row.id;

        return (
          <div className="flex items-center justify-center gap-1">
            {isPending && (
              <>
                <button className="btn-success btn-sm" disabled={disabled} onClick={(e) => { e.stopPropagation(); handleApprove(row); }}>
                  {disabled ? "..." : "승인"}
                </button>
                <button className="btn-danger btn-sm" disabled={disabled} onClick={(e) => { e.stopPropagation(); handleReject(row); }}>
                  거절
                </button>
              </>
            )}
            {isApproved && (
              <>
                <button
                  className="btn-warning btn-sm"
                  disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); setSelectedCaregiver(row); setShowPenaltyModal(true); }}
                >
                  패널티
                </button>
                <button
                  className="btn-secondary btn-sm"
                  disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); setSelectedCaregiver(row); setShowMemoModal(true); }}
                >
                  메모
                </button>
              </>
            )}
            {!isBlacklisted && !isPending && (
              <button
                className="btn-sm rounded-lg border border-gray-300 bg-gray-800 px-3 py-1.5 text-xs text-white hover:bg-gray-900"
                disabled={disabled}
                onClick={(e) => { e.stopPropagation(); handleBlacklist(row); }}
              >
                블랙
              </button>
            )}
            {!row.hasBadge && isApproved && (row.totalMatchings ?? 0) >= 100 && (
              <button
                className="btn-sm rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-100"
                disabled={disabled}
                onClick={(e) => { e.stopPropagation(); handleToggleBadge(row); }}
              >
                뱃지
              </button>
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
        <h1 className="text-2xl font-bold text-gray-900">간병인 관리</h1>
        <p className="mt-1 text-sm text-gray-500">간병인 승인, 인증, 블랙리스트 관리를 수행합니다.</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[240px]">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="이름 또는 ID로 검색..."
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
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="input-field w-auto"
          >
            {regionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={experienceFilter}
            onChange={(e) => setExperienceFilter(e.target.value)}
            className="input-field w-auto"
          >
            {experienceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={workStatusFilter}
            onChange={(e) => setWorkStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            {workStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            총 <span className="font-semibold text-gray-800">{totalItems}</span>명
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
        data={caregivers}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={totalItems}
      />

      {/* Penalty Modal */}
      {showPenaltyModal && selectedCaregiver && (
        <div className="modal-overlay" onClick={() => setShowPenaltyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">패널티 수동 부여</h3>
              <button onClick={() => setShowPenaltyModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">대상 간병인</label>
                <p className="text-sm font-semibold text-gray-900">{selectedCaregiver.name}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">패널티 유형</label>
                <select
                  value={penaltyForm.type}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, type: e.target.value })}
                  className="input-field"
                >
                  <option value="경고">경고</option>
                  <option value="벌금">벌금</option>
                  <option value="정지">정지</option>
                  <option value="블랙리스트">블랙리스트</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">사유</label>
                <textarea
                  value={penaltyForm.reason}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, reason: e.target.value })}
                  className="input-field min-h-[80px] resize-y"
                  placeholder="패널티 사유를 입력하세요..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowPenaltyModal(false)}>취소</button>
              <button
                className="btn-danger"
                disabled={actionLoading === selectedCaregiver.id}
                onClick={handlePenaltySubmit}
              >
                {actionLoading === selectedCaregiver.id ? "처리 중..." : "패널티 부여"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memo Modal */}
      {showMemoModal && selectedCaregiver && (
        <div className="modal-overlay" onClick={() => setShowMemoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">상담 메모 작성</h3>
              <button onClick={() => setShowMemoModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">대상 간병인</label>
                <p className="text-sm font-semibold text-gray-900">{selectedCaregiver.name}</p>
              </div>
              {selectedCaregiver.lastMemo && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">최근 메모</p>
                  <p className="mt-1 text-sm text-gray-700">{selectedCaregiver.lastMemo}</p>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">메모 내용</label>
                <textarea
                  value={memoContent}
                  onChange={(e) => setMemoContent(e.target.value)}
                  className="input-field min-h-[120px] resize-y"
                  placeholder="상담 내용을 기록하세요..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowMemoModal(false)}>취소</button>
              <button
                className="btn-primary"
                disabled={actionLoading === selectedCaregiver.id}
                onClick={handleMemoSubmit}
              >
                {actionLoading === selectedCaregiver.id ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
