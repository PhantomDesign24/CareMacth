"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable, { Column } from "@/components/DataTable";
import { getGuardians, getGuardianDetail, Guardian } from "@/lib/api";

export default function GuardiansPage() {
  const [search, setSearch] = useState("");
  const [authProviderFilter, setAuthProviderFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const limit = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getGuardians({
        search: search || undefined,
        authProvider: authProviderFilter || undefined,
        page: currentPage,
        limit,
      });
      const list = (res as any)?.guardians || (res as any)?.data || [];
      const pag = (res as any)?.pagination;
      setGuardians(Array.isArray(list) ? list : []);
      setTotalItems(pag?.total ?? (Array.isArray(list) ? list.length : 0));
      setTotalPages(pag?.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "보호자 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [search, authProviderFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    (async () => {
      setDetailLoading(true);
      try {
        const res = await getGuardianDetail(detailId);
        setDetail(res);
        setEditName((res as any)?.name || "");
        setEditPhone((res as any)?.phone || "");
        setEditEmail((res as any)?.email || "");
        setEditing(false);
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [detailId]);

  const handleSave = async () => {
    if (!detailId) return;
    setEditSaving(true);
    try {
      const { apiRequest } = await import("@/lib/api");
      await apiRequest(`/admin/guardians/${detailId}`, {
        method: "PUT",
        body: { name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim() } as any,
      });
      // 갱신
      const res = await getGuardianDetail(detailId);
      setDetail(res);
      setEditing(false);
      fetchData();
      alert("저장되었습니다.");
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, authProviderFilter]);

  const totalSpentSum = guardians.reduce((s, g) => s + (g.totalSpent ?? 0), 0);
  const totalPatients = guardians.reduce((s, g) => s + (g.patientCount ?? 0), 0);

  const columns: Column<Guardian>[] = [
    {
      key: "name",
      label: "보호자 정보",
      render: (_v, row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">{row.email} | {row.phone}</p>
        </div>
      ),
    },
    {
      key: "role",
      label: "유형",
      align: "center",
      render: (v) => (
        <span className={(v as string) === "HOSPITAL" ? "badge-purple" : "badge-blue"}>
          {(v as string) === "HOSPITAL" ? "병원/기관" : "보호자"}
        </span>
      ),
    },
    {
      key: "authProvider",
      label: "가입 방식",
      align: "center",
      render: (v) => {
        const p = (v as string) || "LOCAL";
        const label = p === "KAKAO" ? "카카오" : p === "NAVER" ? "네이버" : "이메일";
        const cls = p === "KAKAO" ? "badge-yellow" : p === "NAVER" ? "badge-green" : "badge-gray";
        return <span className={cls}>{label}</span>;
      },
    },
    {
      key: "patientCount",
      label: "환자",
      align: "center",
      render: (v) => <span className="font-medium">{(v as number) ?? 0}명</span>,
    },
    {
      key: "careRequestCount",
      label: "요청",
      align: "center",
      render: (v, row) => (
        <span className="text-sm">
          {(v as number) ?? 0}건 {row.activeRequestCount > 0 && (
            <span className="text-primary-600">({row.activeRequestCount} 진행)</span>
          )}
        </span>
      ),
    },
    {
      key: "totalSpent",
      label: "결제 누적",
      align: "right",
      render: (v) => (
        <span className="font-medium text-gray-900">{((v as number) ?? 0).toLocaleString()}원</span>
      ),
    },
    {
      key: "registeredAt",
      label: "가입일",
      render: (v) => {
        const s = v as string | undefined;
        if (!s) return <span className="text-sm text-gray-500">-</span>;
        const d = new Date(s);
        const t = isNaN(d.getTime())
          ? s
          : d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
        return <span className="text-sm text-gray-500">{t}</span>;
      },
    },
    {
      key: "id",
      label: "관리",
      align: "center",
      render: (v) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDetailId(v as string); }}
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          상세
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보호자 관리</h1>
          <p className="text-sm text-gray-500 mt-1">보호자/병원 계정 목록 및 활동 현황</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">총 보호자</p>
          <p className="text-2xl font-bold mt-1">{totalItems}명</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">현재 페이지 환자 합</p>
          <p className="text-2xl font-bold mt-1">{totalPatients}명</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">현재 페이지 결제 합</p>
          <p className="text-2xl font-bold mt-1">{totalSpentSum.toLocaleString()}원</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="이름 / 이메일 / 전화 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 input-field"
        />
        <select
          value={authProviderFilter}
          onChange={(e) => setAuthProviderFilter(e.target.value)}
          className="input-field sm:w-44"
        >
          <option value="">전체 가입방식</option>
          <option value="LOCAL">이메일</option>
          <option value="KAKAO">카카오</option>
          <option value="NAVER">네이버</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      <DataTable
        columns={columns}
        data={guardians}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Detail Modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">보호자 상세</h2>
                <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              {detailLoading ? (
                <p className="text-sm text-gray-500">로딩 중...</p>
              ) : detail ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">기본 정보</h3>
                      {!editing ? (
                        <button
                          onClick={() => setEditing(true)}
                          className="text-xs px-3 py-1 rounded bg-primary-100 text-primary-700 hover:bg-primary-200"
                        >
                          수정
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditing(false);
                              setEditName(detail.name || "");
                              setEditPhone(detail.phone || "");
                              setEditEmail(detail.email || "");
                            }}
                            disabled={editSaving}
                            className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            취소
                          </button>
                          <button
                            onClick={handleSave}
                            disabled={editSaving}
                            className="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {editSaving ? "저장 중..." : "저장"}
                          </button>
                        </div>
                      )}
                    </div>
                    {editing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">이름</label>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">이메일</label>
                          <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="input-field" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">전화</label>
                          <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="input-field" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">가입방식</label>
                          <input value={detail.authProvider === 'KAKAO' ? '카카오' : detail.authProvider === 'NAVER' ? '네이버' : '이메일'} disabled className="input-field bg-gray-50" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500">이름:</span> {detail.name}</div>
                        <div><span className="text-gray-500">이메일:</span> {detail.email}</div>
                        <div><span className="text-gray-500">전화:</span> {detail.phone}</div>
                        <div><span className="text-gray-500">가입방식:</span> {detail.authProvider === 'KAKAO' ? '카카오' : detail.authProvider === 'NAVER' ? '네이버' : '이메일'}</div>
                      </div>
                    )}
                  </div>

                  {detail.guardian?.patients?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">환자 ({detail.guardian.patients.length}명)</h3>
                      <ul className="text-sm space-y-1">
                        {detail.guardian.patients.map((p: any) => (
                          <li key={p.id} className="flex justify-between border-b border-gray-100 py-1">
                            <span>{p.name}</span>
                            <span className="text-gray-500 text-xs">{p.gender} · {p.birthDate ? new Date(p.birthDate).toLocaleDateString('ko-KR') : '-'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.guardian?.careRequests?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">최근 간병 요청</h3>
                      <ul className="text-sm space-y-1">
                        {detail.guardian.careRequests.map((r: any) => (
                          <li key={r.id} className="flex justify-between border-b border-gray-100 py-1">
                            <span>{r.patient?.name || '-'}</span>
                            <span className="text-gray-500 text-xs">{r.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.guardian?.payments?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">최근 결제</h3>
                      <ul className="text-sm space-y-1">
                        {detail.guardian.payments.map((p: any) => (
                          <li key={p.id} className="flex justify-between border-b border-gray-100 py-1">
                            <span>{(p.totalAmount - (p.refundAmount || 0)).toLocaleString()}원</span>
                            <span className="text-gray-500 text-xs">{p.method} · {p.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
