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
  IN_PROGRESS: { label: "처리중", color: "bg-amber-100 text-amber-700" },
  PROCESSING: { label: "처리중", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "완료", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "거절", color: "bg-red-100 text-red-700" },
};

export default function InsuranceAdminPage() {
  const [list, setList] = useState<InsuranceReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<InsuranceReq | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res: any = await apiRequest(`/admin/insurance${qs}`);
      setList(res?.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (id: string, status: string, extra: { documentUrl?: string } = {}) => {
    setUpdating(true);
    try {
      await apiRequest(`/admin/insurance/${id}`, {
        method: "PATCH",
        body: { status, ...extra },
      });
      alert("처리 완료");
      setSelected(null);
      setDocumentUrl("");
      fetchData();
    } catch (err: any) {
      alert(err?.message || "처리 실패");
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
            <option value="IN_PROGRESS">처리중</option>
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
                        {(r.status === "REQUESTED" || r.status === "IN_PROGRESS") && (
                          <>
                            {r.status === "REQUESTED" && (
                              <button
                                onClick={() => updateStatus(r.id, "IN_PROGRESS")}
                                disabled={updating}
                                className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                              >
                                처리 시작
                              </button>
                            )}
                            <button
                              onClick={() => { setSelected(r); setDocumentUrl(r.documentUrl || ""); }}
                              disabled={updating}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              완료 처리
                            </button>
                            <button
                              onClick={() => {
                                if (!confirm("거절 처리하시겠습니까?")) return;
                                updateStatus(r.id, "REJECTED");
                              }}
                              disabled={updating}
                              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              거절
                            </button>
                          </>
                        )}
                        {r.documentUrl && (
                          <a
                            href={r.documentUrl}
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

      {/* 완료 처리 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">보험서류 완료 처리</h3>
            <p className="text-sm text-gray-500 mb-4">
              {selected.patientName} 환자 · {selected.documentType}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              서류 URL <span className="text-gray-400 text-xs">(선택)</span>
            </label>
            <input
              type="text"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              placeholder="발급된 서류 파일 URL"
              className="input-field mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setSelected(null); setDocumentUrl(""); }}
                className="btn-secondary flex-1"
                disabled={updating}
              >
                취소
              </button>
              <button
                onClick={() => updateStatus(selected.id, "COMPLETED", { documentUrl })}
                disabled={updating}
                className="btn-success flex-1"
              >
                {updating ? "처리 중..." : "완료 처리"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
