"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable, { Column } from "@/components/DataTable";
import { getPatients, Patient } from "@/lib/api";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [careTypeFilter, setCareTypeFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [mobilityFilter, setMobilityFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const limit = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getPatients({
        search: search || undefined,
        status: statusFilter || undefined,
        gender: genderFilter || undefined,
        mobilityStatus: mobilityFilter || undefined,
        page: currentPage,
        limit,
      });
      const list = (res as any)?.patients || (res as any)?.data || (Array.isArray(res) ? res : []);
      const pag = (res as any)?.pagination;
      let filtered = Array.isArray(list) ? list : [];
      if (careTypeFilter) {
        filtered = filtered.filter((p: any) => p.careType === careTypeFilter);
      }
      setPatients(filtered);
      setTotalItems(pag?.total ?? filtered.length);
      setTotalPages(pag?.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "환자 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, careTypeFilter, genderFilter, mobilityFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 상세 로딩
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    (async () => {
      setDetailLoading(true);
      try {
        const { apiRequest } = await import("@/lib/api");
        const res = await apiRequest<any>(`/admin/patients/${detailId}`);
        setDetail(res);
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [detailId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, careTypeFilter, genderFilter, mobilityFilter]);

  // Compute summary from current data
  const activeCount = patients.filter((p) => p.status === "활성" || p.status === "active").length;
  const totalSpent = patients.reduce((sum, p) => sum + (p.totalSpent ?? 0), 0);
  const totalFees = patients.reduce((sum, p) => sum + (p.totalFees ?? 0), 0);

  const columns: Column<Patient>[] = [
    {
      key: "name",
      label: "환자 정보",
      render: (_value, row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">{row.age ? `${row.age}세` : ""}{row.gender ? ` / ${row.gender}` : ""}{row.id ? ` | ${row.id}` : ""}</p>
        </div>
      ),
    },
    {
      key: "condition",
      label: "질환/상태",
      render: (value) => <span className="text-sm text-gray-700">{(value as string) || "-"}</span>,
    },
    {
      key: "careType",
      label: "간병 유형",
      align: "center",
      render: (value) => {
        const v = (value as string) || "-";
        return <span className={v === "1:1 간병" ? "badge-blue" : v === "가족 간병" ? "badge-purple" : "badge-gray"}>{v}</span>;
      },
    },
    {
      key: "totalMatchings",
      label: "간병 이력",
      align: "center",
      render: (value) => <span className="font-medium">{(value as number) ?? 0}회</span>,
    },
    {
      key: "totalSpent",
      label: "간병비 (총액)",
      align: "right",
      render: (value) => (
        <span className="font-medium text-gray-900">{((value as number) ?? 0).toLocaleString()}원</span>
      ),
    },
    {
      key: "totalFees",
      label: "수수료 (총액)",
      align: "right",
      render: (value) => (
        <span className="text-primary-600 font-medium">{((value as number) ?? 0).toLocaleString()}원</span>
      ),
    },
    {
      key: "registeredAt",
      label: "등록일",
      render: (value) => {
        const v = value as string | null | undefined;
        if (!v) return <span className="text-sm text-gray-500">-</span>;
        const d = new Date(v);
        const text = isNaN(d.getTime())
          ? v
          : d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
        return <span className="text-sm text-gray-500">{text}</span>;
      },
    },
    {
      key: "status",
      label: "상태",
      align: "center",
      render: (value) => {
        const v = (value as string) || "-";
        const cls =
          v === "활성" || v === "active" ? "badge-green" :
          v === "완료" ? "badge-blue" :
          v === "취소" ? "badge-red" :
          v === "대기중" ? "badge-yellow" :
          "badge-gray";
        return <span className={cls}>{v}</span>;
      },
    },
    {
      key: "id",
      label: "관리",
      align: "center",
      render: (value, row) => (
        <div className="flex gap-1 justify-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setDetailId(value as string); }}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            상세
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!confirm(`${row.name} 환자를 삭제하시겠습니까? 진행 중인 간병이 있으면 실패합니다.`)) return;
              (async () => {
                try {
                  const { apiRequest } = await import("@/lib/api");
                  await apiRequest(`/admin/patients/${value}`, { method: "DELETE" });
                  alert("삭제되었습니다.");
                  fetchData();
                } catch (err: any) {
                  alert(err?.message || "삭제 실패");
                }
              })();
            }}
            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            삭제
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">환자 관리</h1>
        <p className="mt-1 text-sm text-gray-500">환자 등록 이력, 간병 이력, 간병비 및 수수료를 관리합니다.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">전체 환자</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalItems}명</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">활성 환자</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}명</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">총 간병비</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalSpent.toLocaleString()}원</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">총 수수료</p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{totalFees.toLocaleString()}원</p>
        </div>
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
              placeholder="이름, ID, 질환명으로 검색..."
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
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
          <select
            value={careTypeFilter}
            onChange={(e) => setCareTypeFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 유형</option>
            <option value="1:1 간병">1:1 간병</option>
            <option value="가족 간병">가족 간병</option>
          </select>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 성별</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
          <select
            value={mobilityFilter}
            onChange={(e) => setMobilityFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 이동상태</option>
            <option value="INDEPENDENT">독립</option>
            <option value="PARTIAL">부분도움</option>
            <option value="DEPENDENT">완전의존</option>
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
        data={patients}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={totalItems}
        emptyMessage="조건에 맞는 환자가 없습니다."
      />

      {/* 상세 모달 */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">환자 상세 정보</h3>
                <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
              {detailLoading && <div className="py-12 text-center text-gray-400">불러오는 중...</div>}
              {!detailLoading && detail && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="이름" value={detail.name} />
                    <DetailRow label="생년월일" value={detail.birthDate ? new Date(detail.birthDate).toISOString().slice(0, 10) : "-"} />
                    <DetailRow label="성별" value={detail.gender === "M" ? "남" : detail.gender === "F" ? "여" : "-"} />
                    <DetailRow label="체중/키" value={`${detail.weight || "-"}kg / ${detail.height || "-"}cm`} />
                    <DetailRow label="의식 상태" value={detail.consciousness || "-"} />
                    <DetailRow label="거동 상태" value={detail.mobilityStatus === "DEPENDENT" ? "완전의존" : detail.mobilityStatus === "PARTIAL" ? "부분도움" : "독립보행"} />
                    <DetailRow label="치매" value={detail.hasDementia ? (detail.dementiaLevel || "있음") : "없음"} />
                    <DetailRow label="감염" value={detail.hasInfection ? (detail.infectionDetail || "있음") : "없음"} />
                    <DetailRow label="진단명" value={detail.diagnosis || "-"} full />
                    <DetailRow label="특이사항" value={detail.medicalNotes || "-"} full />
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-2">보호자 정보</h4>
                    <div className="bg-gray-50 rounded-xl p-3 text-sm">
                      <div>{detail.guardian?.user?.name || "-"}</div>
                      <div className="text-gray-500">{detail.guardian?.user?.phone} / {detail.guardian?.user?.email}</div>
                    </div>
                  </div>
                  {Array.isArray(detail.careRequests) && detail.careRequests.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-gray-900 mb-2">간병 이력 ({detail.careRequests.length}건)</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {detail.careRequests.map((cr: any) => (
                          <div key={cr.id} className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between items-start">
                            <div>
                              <div className="font-medium">{cr.careType === "INDIVIDUAL" ? "1:1" : "가족"} 간병</div>
                              <div className="text-xs text-gray-500">
                                {new Date(cr.startDate).toISOString().slice(0, 10)} ~{" "}
                                {cr.endDate ? new Date(cr.endDate).toISOString().slice(0, 10) : "미정"}
                              </div>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{cr.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}
