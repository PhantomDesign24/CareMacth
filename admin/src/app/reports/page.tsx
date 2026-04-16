"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getReports, updateReport, Report } from "@/lib/api";
import {
  REPORT_STATUSES,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  reportStatusLabel,
  reportStatusBadge,
} from "@/lib/constants";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [target, setTarget] = useState<Report | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState<"REVIEWING" | "RESOLVED" | "REJECTED">("RESOLVED");
  const [hideReview, setHideReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReports(statusFilter || undefined);
      setReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const openProcess = (r: Report) => {
    setTarget(r);
    setAdminNote(r.adminNote || "");
    setNewStatus("RESOLVED");
    setHideReview(false);
  };

  const handleProcess = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await updateReport(target.id, {
        status: newStatus,
        adminNote,
        hideReview: hideReview && newStatus === "RESOLVED",
      });
      setToast("처리 완료");
      setTarget(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "처리 실패");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    reports.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    return {
      total: reports.length,
      pending: byStatus.PENDING || 0,
      reviewing: byStatus.REVIEWING || 0,
      resolved: byStatus.RESOLVED || 0,
      rejected: byStatus.REJECTED || 0,
    };
  }, [reports]);

  const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label || r;
  const targetTypeLabel = (t: string) => REPORT_TARGET_TYPES.find((x) => x.value === t)?.label || t;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">신고 관리</h1>
        <p className="text-sm text-gray-500 mt-1">사용자 신고 내역을 검토하고 처리합니다. (App Store UGC 모더레이션 필수)</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <StatCard label="전체" value={stats.total} color="text-gray-700" />
        <StatCard label="접수됨" value={stats.pending} color="text-yellow-600" />
        <StatCard label="검토 중" value={stats.reviewing} color="text-blue-600" />
        <StatCard label="처리 완료" value={stats.resolved} color="text-green-600" />
        <StatCard label="기각" value={stats.rejected} color="text-gray-500" />
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            statusFilter === "" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
          }`}
        >
          전체
        </button>
        {REPORT_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              statusFilter === s.value ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">일시</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">신고자</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">대상</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">사유</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 hidden md:table-cell">상세</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">상태</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">로딩중...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">신고 내역이 없습니다.</td></tr>
            ) : reports.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-sm font-medium">{r.reporter?.name || "-"}</div>
                  <div className="text-xs text-gray-400">{r.reporter?.email || ""}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">
                    {targetTypeLabel(r.targetType)}
                  </span>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-[120px]">{r.targetId.slice(0, 8)}</div>
                </td>
                <td className="px-3 py-2.5 text-sm">{reasonLabel(r.reason)}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[200px] truncate hidden md:table-cell">
                  {r.detail || "-"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.status === "PENDING" ? "bg-yellow-50 text-yellow-700" :
                    r.status === "REVIEWING" ? "bg-blue-50 text-blue-700" :
                    r.status === "RESOLVED" ? "bg-green-50 text-green-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {reportStatusLabel(r.status)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {["PENDING", "REVIEWING"].includes(r.status) ? (
                    <button
                      onClick={() => openProcess(r)}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600"
                    >
                      처리
                    </button>
                  ) : (
                    <button
                      onClick={() => openProcess(r)}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      상세
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 처리 모달 */}
      {target && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setTarget(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">신고 처리</h3>
              <button onClick={() => setTarget(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-3 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">대상</span><span>{targetTypeLabel(target.targetType)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">사유</span><span>{reasonLabel(target.reason)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">신고자</span><span>{target.reporter?.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">현재 상태</span><span>{reportStatusLabel(target.status)}</span></div>
                {target.detail && (
                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <div className="text-gray-500 text-xs mb-1">상세 내용</div>
                    <div className="text-gray-700 whitespace-pre-wrap">{target.detail}</div>
                  </div>
                )}
              </div>

              {target.review && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-600 mb-1">신고된 리뷰 내용</div>
                  <div className="text-gray-700 text-sm">⭐ {target.review.rating}/5</div>
                  <div className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">{target.review.comment || "-"}</div>
                </div>
              )}

              {["PENDING", "REVIEWING"].includes(target.status) && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">처리 결과</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="REVIEWING">검토 중으로 변경</option>
                      <option value="RESOLVED">처리 완료 (신고 인정)</option>
                      <option value="REJECTED">기각 (신고 사유 부적절)</option>
                    </select>
                  </div>

                  {newStatus === "RESOLVED" && target.targetType === "REVIEW" && target.reviewId && (
                    <label className="flex items-center gap-2 cursor-pointer bg-red-50 rounded-lg p-3">
                      <input
                        type="checkbox"
                        checked={hideReview}
                        onChange={(e) => setHideReview(e.target.checked)}
                        className="w-4 h-4 accent-red-500"
                      />
                      <span className="text-sm text-red-700">신고된 리뷰를 숨김 처리합니다</span>
                    </label>
                  )}

                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">관리자 메모</label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                      placeholder="처리 내역·사유 등"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                    />
                  </div>
                </>
              )}

              {target.status === "RESOLVED" || target.status === "REJECTED" ? (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">처리 메모</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{target.adminNote || "(없음)"}</div>
                  {target.reviewedAt && (
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(target.reviewedAt).toLocaleString("ko-KR")}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTarget(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                닫기
              </button>
              {["PENDING", "REVIEWING"].includes(target.status) && (
                <button
                  onClick={handleProcess}
                  disabled={saving}
                  className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
                >
                  {saving ? "처리 중..." : "처리 완료"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
