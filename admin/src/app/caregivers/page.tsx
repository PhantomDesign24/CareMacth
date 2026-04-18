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
  const [docFilter, setDocFilter] = useState<string>(""); // "verified" | "pending" | "missing"
  const [feeFilter, setFeeFilter] = useState<string>("");  // "paid" | "unpaid"
  const [badgeFilter, setBadgeFilter] = useState<boolean>(false);
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
  }, [search, statusFilter, regionFilter, experienceFilter, workStatusFilter, docFilter, feeFilter, badgeFilter]);

  // 프론트 기반 필터링 (백엔드 추가 안해도 응답 후 클라이언트에서 적용)
  const displayCaregivers = caregivers.filter((c: any) => {
    if (docFilter === "verified" && !(c.identityVerified && c.criminalCheckDone)) return false;
    if (docFilter === "pending" && !(c.hasIdCard || c.hasCriminalCheckDoc) && !(c.identityVerified && c.criminalCheckDone)) return false;
    if (docFilter === "missing" && (c.identityVerified || c.criminalCheckDone || c.hasIdCard || c.hasCriminalCheckDoc)) return false;
    if (feeFilter === "paid" && !c.associationFeePaid) return false;
    if (feeFilter === "unpaid" && c.associationFeePaid) return false;
    if (badgeFilter && !c.hasBadge) return false;
    return true;
  });

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
    const isBlacklisted = (cg.status as string)?.toUpperCase() === "BLACKLISTED";
    const msg = isBlacklisted
      ? `${cg.name}의 블랙리스트를 해제하시겠습니까?`
      : `${cg.name}을(를) 블랙리스트에 등록하시겠습니까?`;
    if (!confirm(msg)) return;
    setActionLoading(cg.id);
    try {
      await blacklistCaregiver(cg.id);
      alert(isBlacklisted ? `${cg.name} 블랙리스트 해제 완료` : `${cg.name} 블랙리스트 등록 완료`);
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
      label: "간병인",
      render: (_value, row) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
            {(row.profileImage as string) ? (
              <img src={row.profileImage as string} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-gray-500">{row.name.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/caregivers/${row.id}`} className="font-medium text-primary-600 hover:underline truncate">
                {row.name}
              </Link>
              <span className={statusBadge(row.status)}>{statusLabel(row.status)}</span>
              {row.hasBadge && (
                <span className="badge-purple text-[10px]" title="우수 간병사">⭐ 우수</span>
              )}
            </div>
            <div className="text-[11px] text-gray-400 truncate">{(row.phone as string) || (row.email as string) || ""}</div>
          </div>
        </div>
      ),
    },
    {
      key: "documents",
      label: "서류",
      align: "center",
      render: (_v, row) => {
        const DocIcon = ({ ok, pending, label }: { ok?: boolean; pending?: boolean; label: string }) => (
          <span
            title={label + ": " + (ok ? "완료" : pending ? "검토중" : "미등록")}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold ${
              ok
                ? "bg-green-100 text-green-700"
                : pending
                ? "bg-amber-100 text-amber-700"
                : "bg-red-50 text-red-400"
            }`}
          >
            {ok ? "✓" : pending ? "⏳" : "✕"}
          </span>
        );
        const identityOk = !!row.identityVerified;
        const identityPending = !identityOk && !!row.hasIdCard;
        const criminalOk = !!row.criminalCheckDone;
        const criminalPending = !criminalOk && !!row.hasCriminalCheckDoc;
        const certOk = (row.verifiedCertificateCount || 0) > 0;
        const certPending = !certOk && (row.certificateCount || 0) > 0;
        return (
          <div className="flex items-center justify-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <DocIcon ok={identityOk} pending={identityPending} label="신원인증" />
              <span className="text-[9px] text-gray-400">신원</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <DocIcon ok={criminalOk} pending={criminalPending} label="범죄이력" />
              <span className="text-[9px] text-gray-400">범죄</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <DocIcon ok={certOk} pending={certPending} label="자격증" />
              <span className="text-[9px] text-gray-400">
                자격({row.verifiedCertificateCount || 0}/{row.certificateCount || 0})
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "associationFeePaid",
      label: "협회비",
      align: "center",
      render: (v, row) => (
        <div className="flex flex-col items-center gap-0.5">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${v ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"}`}>
            {v ? "✓ 납부" : "✕ 미납"}
          </span>
          {row.associationPaidAt && (
            <span className="text-[9px] text-gray-400">
              {new Date(row.associationPaidAt as string).toLocaleDateString("ko-KR")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "totalMatchings",
      label: "실적",
      align: "center",
      render: (_v, row) => (
        <div className="text-center text-xs">
          <div className="font-semibold text-gray-900">{row.totalMatchings || 0}건</div>
          <div className="text-amber-500">
            {"★".repeat(Math.round(Number(row.avgRating || row.rating || 0)))}
            <span className="ml-0.5 text-gray-500">
              {Number(row.avgRating || row.rating || 0).toFixed(1)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "penaltyActions",
      label: "패널티/블랙",
      align: "center",
      render: (_v, row) => {
        const count = row.penaltyCount || 0;
        const st = (row.status as string)?.toUpperCase();
        const isPending = st === "PENDING";
        const isApproved = st === "APPROVED";
        const isBlacklisted = st === "BLACKLISTED";
        const disabled = actionLoading === row.id;
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              count >= 3 ? "bg-red-100 text-red-700" : count > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
            }`}>
              패널티 {count}회
            </span>
            <div className="flex gap-1">
              {isPending && (
                <>
                  <button className="btn-success btn-sm text-[10px]" disabled={disabled}
                    onClick={(e) => { e.stopPropagation(); handleApprove(row); }}>
                    {disabled ? "..." : "승인"}
                  </button>
                  <button className="btn-danger btn-sm text-[10px]" disabled={disabled}
                    onClick={(e) => { e.stopPropagation(); handleReject(row); }}>
                    거절
                  </button>
                </>
              )}
              {isApproved && (
                <button className="btn-warning btn-sm text-[10px]" disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); setSelectedCaregiver(row); setShowPenaltyModal(true); }}>
                  패널티
                </button>
              )}
              {!isPending && !isBlacklisted && (
                <button
                  className="btn-sm rounded-lg border border-gray-300 bg-gray-800 px-2 py-1 text-[10px] text-white hover:bg-gray-900"
                  disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); handleBlacklist(row); }}>
                  블랙
                </button>
              )}
              {isBlacklisted && (
                <button
                  className="btn-sm rounded-lg border border-gray-400 bg-gray-100 px-2 py-1 text-[10px] text-gray-700 hover:bg-gray-200"
                  disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); handleBlacklist(row); }}>
                  블랙 해제
                </button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "detailActions",
      label: "메모/상세",
      align: "center",
      render: (_v, row) => {
        const st = (row.status as string)?.toUpperCase();
        const isApproved = st === "APPROVED";
        const disabled = actionLoading === row.id;
        return (
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              {isApproved && (
                <button className="btn-secondary btn-sm text-[10px]" disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); setSelectedCaregiver(row); setShowMemoModal(true); }}>
                  메모
                </button>
              )}
              <Link href={`/caregivers/${row.id}`}
                className="text-[10px] px-2.5 py-1 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 font-semibold">
                상세
              </Link>
            </div>
            {!row.hasBadge && isApproved && (row.totalMatchings ?? 0) >= 100 && (
              <button
                className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100"
                disabled={disabled}
                onClick={(e) => { e.stopPropagation(); handleToggleBadge(row); }}>
                우수뱃지 부여
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
      <div className="card space-y-3">
        {/* 검색 + 기본 필터 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[240px]">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="이름/전화/이메일로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
            {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="input-field w-auto">
            {regionOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={experienceFilter} onChange={(e) => setExperienceFilter(e.target.value)} className="input-field w-auto">
            {experienceOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={workStatusFilter} onChange={(e) => setWorkStatusFilter(e.target.value)} className="input-field w-auto">
            {workStatusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        {/* 빠른 필터 칩 */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 mr-1">빠른 필터</span>

          {/* 서류 인증 상태 */}
          {[
            { k: "", label: "전체 서류" },
            { k: "verified", label: "✓ 인증완료", cls: "bg-green-100 text-green-700" },
            { k: "pending", label: "⏳ 검토중", cls: "bg-amber-100 text-amber-700" },
            { k: "missing", label: "✕ 미등록", cls: "bg-red-50 text-red-600" },
          ].map((opt) => (
            <button
              key={opt.k || "all-doc"}
              type="button"
              onClick={() => setDocFilter(opt.k)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                docFilter === opt.k
                  ? (opt.cls || "bg-gray-800 text-white")
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <span className="mx-2 h-4 w-px bg-gray-200" />

          {/* 협회비 */}
          {[
            { k: "", label: "협회비 전체" },
            { k: "paid", label: "✓ 납부", cls: "bg-green-100 text-green-700" },
            { k: "unpaid", label: "✕ 미납", cls: "bg-red-50 text-red-600" },
          ].map((opt) => (
            <button
              key={opt.k || "all-fee"}
              type="button"
              onClick={() => setFeeFilter(opt.k)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                feeFilter === opt.k
                  ? (opt.cls || "bg-gray-800 text-white")
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <span className="mx-2 h-4 w-px bg-gray-200" />

          {/* 뱃지 */}
          <button
            type="button"
            onClick={() => setBadgeFilter((v) => !v)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
              badgeFilter
                ? "bg-purple-100 text-purple-700 border border-purple-200"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            ⭐ 우수 간병사만
          </button>

          {(docFilter || feeFilter || badgeFilter) && (
            <button
              type="button"
              onClick={() => { setDocFilter(""); setFeeFilter(""); setBadgeFilter(false); }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-700"
            >
              빠른 필터 초기화
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span>총 <span className="font-bold text-gray-800">{totalItems}</span>명 · 표시 <span className="font-semibold text-gray-700">{displayCaregivers.length}</span>명</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" /> 인증
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> 검토중
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400" /> 미등록
            </span>
          </span>
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
        data={displayCaregivers}
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
