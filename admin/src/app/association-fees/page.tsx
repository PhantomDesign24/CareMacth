"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getAssociationFees,
  updateAssociationFee,
  exportAssociationFees,
  getPlatformConfig,
  AssociationFeeRow,
} from "@/lib/api";
import { caregiverStatusLabel, WORK_STATUSES } from "@/lib/constants";

type Filter = "all" | "paid" | "unpaid";

export default function AssociationFeesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<AssociationFeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultAmount, setDefaultAmount] = useState<number | null>(null); // PlatformConfig 로드 후 설정
  const [memoModal, setMemoModal] = useState<AssociationFeeRow | null>(null);
  const [detailModal, setDetailModal] = useState<AssociationFeeRow | null>(null);
  const [memoText, setMemoText] = useState("");
  const [memoAmount, setMemoAmount] = useState(0);
  const [toast, setToast] = useState("");
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadYear, setDownloadYear] = useState(now.getFullYear());
  const [downloadMonths, setDownloadMonths] = useState<number[]>([now.getMonth() + 1]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAssociationFees(year, month);
      setRows(res.rows || []);
      setSelected(new Set());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // PlatformConfig에서 기본 협회비 금액 로드 (최초 1회)
  useEffect(() => {
    getPlatformConfig()
      .then((cfg) => {
        if (cfg?.associationFeeDefault) {
          setDefaultAmount(cfg.associationFeeDefault);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredRows = useMemo(() => {
    let r = rows;
    if (filter === "paid") r = r.filter((x) => x.feePaid);
    else if (filter === "unpaid") r = r.filter((x) => !x.feePaid);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(q) || x.phone.includes(q));
    }
    return r;
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.feePaid).length;
    const total = rows.length;
    const sum = rows.filter((r) => r.feePaid).reduce((a, b) => a + b.feeAmount, 0);
    const rate = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { paid, total, unpaid: total - paid, sum, rate };
  }, [rows]);

  const togglePaid = async (row: AssociationFeeRow) => {
    // 이미 납부 확정된 건은 변경 불가
    if (row.feePaid) {
      alert(`${row.name} 간병사는 이미 납부 확정되었습니다. 변경하려면 관리자에게 문의해주세요.`);
      return;
    }
    if (defaultAmount == null) {
      alert("기본 협회비 금액을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }
    // 납부 확정 — 한 번 확정하면 되돌릴 수 없음을 명시
    if (!confirm(
      `${row.name} 간병사 ${year}년 ${month}월 협회비를 납부 처리합니다.\n` +
      `금액: ${(row.feeAmount || defaultAmount).toLocaleString()}원\n\n` +
      `한 번 확정하면 되돌릴 수 없습니다. 진행하시겠습니까?`
    )) {
      return;
    }
    try {
      await updateAssociationFee(row.caregiverId, {
        year, month,
        paid: true,
        amount: row.feeAmount || defaultAmount,
      });
      setRows(prev => prev.map(r =>
        r.caregiverId === row.caregiverId
          ? { ...r, feePaid: true, feeAmount: r.feeAmount || defaultAmount }
          : r
      ));
      setToast(`${row.name} 납부 확정`);
    } catch {
      alert("업데이트 실패");
    }
  };

  const bulkMarkPaid = async () => {
    if (selected.size === 0) return;
    if (defaultAmount == null) {
      alert("기본 협회비 금액을 불러오지 못했습니다.");
      return;
    }
    if (!confirm(`선택된 ${selected.size}명을 일괄 납부 처리하시겠습니까?\n금액: ${defaultAmount.toLocaleString()}원`)) return;
    setSaving(true);
    try {
      const targets = rows.filter((r) => selected.has(r.caregiverId) && !r.feePaid);
      await Promise.all(
        targets.map((r) =>
          updateAssociationFee(r.caregiverId, {
            year, month, paid: true, amount: defaultAmount,
          })
        )
      );
      setToast(`${targets.length}명 일괄 납부 처리 완료`);
      await load();
    } catch {
      alert("일괄 처리 실패");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map(r => r.caregiverId)));
    }
  };

  const saveMemo = async () => {
    if (!memoModal) return;
    try {
      await updateAssociationFee(memoModal.caregiverId, {
        year, month,
        paid: memoModal.feePaid,
        amount: memoAmount,
        note: memoText,
      });
      setMemoModal(null);
      load();
      setToast("메모 저장 완료");
    } catch {
      alert("저장 실패");
    }
  };

  const performDownload = async (y: number, m: number | number[] | undefined, filename: string) => {
    try {
      const blob = await exportAssociationFees(y, m);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setToast("엑셀 다운로드 완료");
    } catch (e) {
      console.error(e);
      alert("다운로드 실패");
    }
  };

  const handleQuickExport = async () => {
    await performDownload(year, month, `협회비_${year}년${String(month).padStart(2, "0")}월.csv`);
  };

  const handleCustomExport = async () => {
    if (downloadMonths.length === 0) {
      alert("월을 1개 이상 선택해주세요.");
      return;
    }
    let filename: string;
    let monthParam: number | number[] | undefined;
    if (downloadMonths.length === 12) {
      filename = `협회비_${downloadYear}년전체.csv`;
      monthParam = undefined; // 전체
    } else if (downloadMonths.length === 1) {
      filename = `협회비_${downloadYear}년${String(downloadMonths[0]).padStart(2, "0")}월.csv`;
      monthParam = downloadMonths[0];
    } else {
      filename = `협회비_${downloadYear}년_${downloadMonths.map(m => `${m}월`).join("_")}.csv`;
      monthParam = downloadMonths;
    }
    await performDownload(downloadYear, monthParam, filename);
    setShowDownloadModal(false);
  };

  const toggleDownloadMonth = (m: number) => {
    setDownloadMonths(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">협회비 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">간병인 월별 협회비 납부 현황</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleQuickExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-1.5"
            title={`${year}년 ${month}월 다운로드`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            이번달 다운로드
          </button>
          <button
            type="button"
            onClick={() => {
              setDownloadYear(year);
              setDownloadMonths([month]);
              setShowDownloadModal(true);
            }}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5"
          >
            선택 다운로드
          </button>
        </div>
      </div>

      {/* 월 네비게이션 + 통계 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center">‹</button>
            <div className="text-lg font-bold text-gray-900 min-w-[110px] text-center">
              {year}년 {month}월
            </div>
            <button onClick={nextMonth} className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center">›</button>
            {!isCurrentMonth && (
              <button onClick={goToday} className="ml-2 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100">
                이번 달
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">기본 금액:</label>
            <input
              type="number"
              value={defaultAmount ?? ""}
              placeholder={defaultAmount == null ? "로딩..." : ""}
              onChange={(e) => setDefaultAmount(parseInt(e.target.value) || 0)}
              className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm"
            />
            <span className="text-gray-500">원</span>
            <span className="text-[10px] text-gray-400">(플랫폼 설정 기본값)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-blue-600 font-medium">전체</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.total}명</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-xs text-green-600 font-medium">납부 완료</div>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.paid}명</div>
            <div className="text-xs text-green-500 mt-0.5">{stats.rate}%</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-xs text-red-500 font-medium">미납</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.unpaid}명</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="text-xs text-orange-600 font-medium">수납 총액</div>
            <div className="text-xl font-bold text-orange-700 mt-1">{stats.sum.toLocaleString()}원</div>
          </div>
        </div>
      </div>

      {/* 필터 + 검색 + 일괄 처리 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["all", "unpaid", "paid"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filter === f ? "bg-orange-500 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "all" ? `전체 (${stats.total})` : f === "unpaid" ? `미납 (${stats.unpaid})` : `완납 (${stats.paid})`}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 또는 연락처 검색"
          className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        {selected.size > 0 && (
          <button
            onClick={bulkMarkPaid}
            disabled={saving}
            className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "처리 중..." : `${selected.size}명 일괄 납부 처리`}
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 p-2 text-center">
                <input
                  type="checkbox"
                  checked={filteredRows.length > 0 && selected.size === filteredRows.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-orange-500"
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">이름</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">상태</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600 hidden sm:table-cell">연락처</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">협회비</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600 hidden md:table-cell">납부액</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600 hidden md:table-cell">간병</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600 hidden md:table-cell">패널티</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">로딩중...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">데이터가 없습니다.</td></tr>
            ) : filteredRows.map((r) => (
              <tr key={r.caregiverId} className={`border-b border-gray-100 hover:bg-orange-50/30 transition-colors ${selected.has(r.caregiverId) ? "bg-orange-50" : ""}`}>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(r.caregiverId)}
                    onChange={() => toggleSelect(r.caregiverId)}
                    className="w-4 h-4 accent-orange-500"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-gray-900">{r.name}</div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {r.status === "APPROVED" ? "활동" : r.status === "SUSPENDED" ? "정지" : r.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center text-gray-500 hidden sm:table-cell">{r.phone}</td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => togglePaid(r)}
                    title={r.feePaid ? '납부 확정됨 (변경 불가)' : '납부 처리'}
                    className={`w-14 py-1 rounded-full text-xs font-bold transition-all ${
                      r.feePaid
                        ? "bg-green-500 text-white shadow-sm cursor-not-allowed opacity-90"
                        : "bg-red-50 text-red-500 border border-red-200 hover:bg-red-100"
                    }`}
                  >
                    {r.feePaid ? "납부✓" : "미납"}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-center text-gray-700 hidden md:table-cell">
                  {r.feeAmount > 0 ? `${r.feeAmount.toLocaleString()}원` : "-"}
                </td>
                <td className="px-3 py-2.5 text-center text-gray-600 hidden md:table-cell">{r.careCount}회</td>
                <td className="px-3 py-2.5 text-center hidden md:table-cell">
                  <span className={r.penaltyCount > 0 ? "text-red-500 font-semibold" : "text-gray-400"}>
                    {r.penaltyCount}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => setDetailModal(r)}
                      className="w-7 h-7 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      title="상세"
                    >
                      상세
                    </button>
                    <button
                      onClick={() => {
                        setMemoModal(r);
                        setMemoText(r.feeNote || "");
                        setMemoAmount(r.feeAmount || defaultAmount || 0);
                      }}
                      className={`w-7 h-7 text-xs rounded ${r.feeNote ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600"} hover:opacity-80`}
                      title="메모"
                    >
                      메모
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-[fadeIn_0.2s]">
          {toast}
        </div>
      )}

      {/* 선택 다운로드 모달 */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDownloadModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">엑셀 다운로드</h3>
              <button onClick={() => setShowDownloadModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              {/* 연도 선택 */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700">연도</label>
                <select
                  value={downloadYear}
                  onChange={(e) => setDownloadYear(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>

              {/* 월 다중 선택 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">월 선택 (복수 선택 가능)</label>
                  <div className="flex gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDownloadMonths([1,2,3,4,5,6,7,8,9,10,11,12])}
                      className="text-orange-600 hover:underline"
                    >
                      전체
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setDownloadMonths([1,2,3])}
                      className="text-gray-500 hover:underline"
                    >
                      1분기
                    </button>
                    <button
                      type="button"
                      onClick={() => setDownloadMonths([4,5,6])}
                      className="text-gray-500 hover:underline"
                    >
                      2분기
                    </button>
                    <button
                      type="button"
                      onClick={() => setDownloadMonths([7,8,9])}
                      className="text-gray-500 hover:underline"
                    >
                      3분기
                    </button>
                    <button
                      type="button"
                      onClick={() => setDownloadMonths([10,11,12])}
                      className="text-gray-500 hover:underline"
                    >
                      4분기
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setDownloadMonths([])}
                      className="text-gray-500 hover:underline"
                    >
                      해제
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const active = downloadMonths.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleDownloadMonth(m)}
                        className={`py-2 rounded-lg text-sm font-semibold border transition-all ${
                          active
                            ? "bg-orange-500 text-white border-orange-500"
                            : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                        }`}
                      >
                        {m}월
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  선택됨: {downloadMonths.length === 0 ? "없음" : downloadMonths.length === 12 ? "전체 연간" : `${downloadMonths.length}개월 (${downloadMonths.join(", ")})`}
                </p>
              </div>

              <button
                onClick={handleCustomExport}
                disabled={downloadMonths.length === 0}
                className="w-full py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
              >
                다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{detailModal.name} 상세</h3>
              <button onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">상태</dt><dd>{caregiverStatusLabel(detailModal.status)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">근무상태</dt><dd>{WORK_STATUSES.find(w => w.value === detailModal.workStatus)?.label || detailModal.workStatus}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">연락처</dt><dd>{detailModal.phone}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">이메일</dt><dd className="truncate max-w-[60%]">{detailModal.email}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">협회비</dt><dd className={detailModal.feePaid ? "text-green-600 font-semibold" : "text-red-500"}>
                {detailModal.feePaid ? `납부 완료 (${detailModal.feeAmount.toLocaleString()}원)` : "미납"}
              </dd></div>
              {detailModal.feePaidAt && (
                <div className="flex justify-between"><dt className="text-gray-500">납부일</dt><dd>{new Date(detailModal.feePaidAt).toLocaleString("ko-KR")}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-gray-500">간병 기간</dt><dd>{detailModal.careCount}회</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">패널티 누계</dt><dd>{detailModal.penaltyCount}회</dd></div>
              {detailModal.feeNote && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <dt className="text-xs text-gray-500 mb-1">메모</dt>
                  <dd className="text-sm whitespace-pre-wrap">{detailModal.feeNote}</dd>
                </div>
              )}
            </dl>
            <button
              onClick={() => window.location.href = `/admin/caregivers/${detailModal.caregiverId}`}
              className="mt-5 w-full py-2.5 bg-orange-500 text-white rounded-lg font-semibold text-sm hover:bg-orange-600"
            >
              간병인 상세 페이지 →
            </button>
          </div>
        </div>
      )}

      {/* 메모 모달 */}
      {memoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMemoModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{memoModal.name} · 협회비 메모</h3>
              <button onClick={() => setMemoModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">납부액</label>
                <div className="relative">
                  <input
                    type="number"
                    value={memoAmount}
                    onChange={(e) => setMemoAmount(parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">메모</label>
                <textarea
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  rows={4}
                  placeholder="특이사항 (미납 사유, 연락 상태 등)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none"
                />
              </div>
              <button
                onClick={saveMemo}
                className="w-full py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
