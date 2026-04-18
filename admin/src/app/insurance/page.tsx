"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";

interface InsuranceReq {
  id: string;
  patientName: string;
  birthDate: string;
  carePeriod: string;
  insuranceCompany: string;
  documentType: string;
  status: string;
  documentUrl: string | null;
  createdAt: string;
  requester?: { id: string; name: string; email: string; phone: string } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "접수", color: "bg-gray-100 text-gray-700" },
  PROCESSING: { label: "처리중", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "완료", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "거절", color: "bg-red-100 text-red-700" },
};

// 백엔드 기본 호스트 (파일 뷰용)
const API_HOST =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? ""
    : "http://localhost:4000";

async function patchMultipart(path: string, form: FormData): Promise<any> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const base =
    typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? "/api"
      : "http://localhost:4000/api";
  const res = await fetch(`${base}${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || "요청 실패");
  }
  return res.json();
}

export default function InsuranceAdminPage() {
  const [list, setList] = useState<InsuranceReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [completeTarget, setCompleteTarget] = useState<InsuranceReq | null>(null);
  const [rejectTarget, setRejectTarget] = useState<InsuranceReq | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res: any = await apiRequest(`/admin/insurance${qs}`);
      setList(Array.isArray(res) ? res : res?.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startProcessing = async (id: string) => {
    setUpdating(true);
    try {
      await apiRequest(`/admin/insurance/${id}`, {
        method: "PATCH",
        body: { status: "PROCESSING" },
      });
      fetchData();
    } catch (err: any) {
      alert(err?.message || "처리 실패");
    } finally {
      setUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!completeTarget || !docFile) {
      alert("서류 파일을 선택해주세요.");
      return;
    }
    setUpdating(true);
    try {
      const fd = new FormData();
      fd.append("status", "COMPLETED");
      fd.append("document", docFile);
      await patchMultipart(`/admin/insurance/${completeTarget.id}`, fd);
      setCompleteTarget(null);
      setDocFile(null);
      fetchData();
    } catch (err: any) {
      alert(err?.message || "완료 처리 실패");
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) {
      alert("거절 사유를 입력해주세요.");
      return;
    }
    setUpdating(true);
    try {
      await apiRequest(`/admin/insurance/${rejectTarget.id}`, {
        method: "PATCH",
        body: { status: "REJECTED", rejectReason: rejectReason.trim() },
      });
      setRejectTarget(null);
      setRejectReason("");
      fetchData();
    } catch (err: any) {
      alert(err?.message || "거절 처리 실패");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">보험서류 신청 관리</h1>
        <p className="mt-1 text-sm text-gray-500">보호자의 간병보험 서류 발급 신청을 처리합니다.</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">상태 필터:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체</option>
            <option value="REQUESTED">접수</option>
            <option value="PROCESSING">처리중</option>
            <option value="COMPLETED">완료</option>
            <option value="REJECTED">거절</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">불러오는 중...</div>
      ) : list.length === 0 ? (
        <div className="py-20 text-center text-gray-400 bg-gray-50 rounded-xl">
          신청 내역이 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">신청자</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">환자명</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">보험사</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">서류 종류</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">간병기간</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">상태</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((r) => {
                const st = STATUS_LABELS[r.status] || { label: r.status, color: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={r.id}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{r.requester?.name || "-"}</div>
                      <div className="text-xs text-gray-500">{r.requester?.phone || r.requester?.email || ""}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{r.patientName}</td>
                    <td className="py-3 px-4 text-gray-700">{r.insuranceCompany}</td>
                    <td className="py-3 px-4 text-gray-700">{r.documentType}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{r.carePeriod}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {r.status === "REQUESTED" && (
                          <button
                            onClick={() => startProcessing(r.id)}
                            disabled={updating}
                            className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                          >
                            처리 시작
                          </button>
                        )}
                        {/* 완료/거절 포함 모든 상태에서 서류 재업로드(완료) 가능 */}
                        <button
                          onClick={() => { setCompleteTarget(r); setDocFile(null); }}
                          disabled={updating}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          {r.status === "COMPLETED" ? "서류 재발급" : "완료 처리"}
                        </button>
                        {/* 완료된 건은 REQUESTED로 재오픈 (재심사) */}
                        {(r.status === "COMPLETED" || r.status === "REJECTED") && (
                          <button
                            onClick={async () => {
                              if (!confirm("해당 신청을 다시 심사 대기 상태로 되돌리시겠습니까?")) return;
                              await apiRequest(`/admin/insurance/${r.id}`, {
                                method: "PATCH",
                                body: { status: "REQUESTED" },
                              });
                              fetchData();
                            }}
                            disabled={updating}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            재심사
                          </button>
                        )}
                        {r.status !== "REJECTED" && (
                          <button
                            onClick={() => { setRejectTarget(r); setRejectReason(""); }}
                            disabled={updating}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            거절
                          </button>
                        )}
                        {r.documentUrl && (
                          <a
                            href={`${API_HOST}${r.documentUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            서류
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 완료 처리 모달 — 파일 업로드 */}
      {completeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !updating && setCompleteTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">보험서류 완료 처리</h3>
            <p className="text-sm text-gray-500 mb-4">
              {completeTarget.patientName} 환자 · {completeTarget.documentType}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              발급된 서류 파일 <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 file:text-sm file:font-semibold hover:file:bg-green-100"
            />
            <p className="text-xs text-gray-400 mt-1">PDF · JPG · PNG (최대 10MB)</p>
            {docFile && (
              <p className="text-xs text-gray-600 mt-2">
                선택됨: <span className="font-medium">{docFile.name}</span> ({(docFile.size / 1024).toFixed(1)}KB)
              </p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setCompleteTarget(null); setDocFile(null); }}
                className="btn-secondary flex-1"
                disabled={updating}
              >
                취소
              </button>
              <button
                onClick={handleComplete}
                disabled={updating || !docFile}
                className="btn-success flex-1 disabled:opacity-50"
              >
                {updating ? "처리 중..." : "업로드 + 완료 처리"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 거절 처리 모달 — 사유 필수 */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !updating && setRejectTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">보험서류 신청 거절</h3>
            <p className="text-sm text-gray-500 mb-4">
              {rejectTarget.patientName} 환자 · {rejectTarget.documentType}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              거절 사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 간병 기간이 신청 범위를 벗어남, 증빙 서류 부족 등"
              rows={4}
              className="input-field resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">신청자에게 알림으로 전달됩니다.</p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                className="btn-secondary flex-1"
                disabled={updating}
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={updating || !rejectReason.trim()}
                className="flex-1 bg-red-500 text-white py-2 rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {updating ? "처리 중..." : "거절 처리"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
