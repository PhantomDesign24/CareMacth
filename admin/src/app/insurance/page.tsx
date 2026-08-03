"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { formatPhone } from "@/lib/constants";

interface InsuranceReq {
  id: string;
  patientName: string;
  birthDate: string;
  carePeriod: string;
  insuranceCompany: string;
  documentType: string;
  status: string;
  documentUrl: string | null;
  documentUrls?: string[];
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
  // 사이드바 '미처리 보험서류' 배지 클릭 진입 시 ?status=TODO → 접수·처리중만 표시(배지 숫자와 일치)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    if (s) setStatusFilter(s);
  }, []);
  const [completeTarget, setCompleteTarget] = useState<InsuranceReq | null>(null);
  const [rejectTarget, setRejectTarget] = useState<InsuranceReq | null>(null);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [removeUrls, setRemoveUrls] = useState<string[]>([]); // 기존 서류 중 삭제할 항목
  const [rejectReason, setRejectReason] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (statusFilter === "TODO") {
        // 미처리 = 접수(REQUESTED) + 처리중(PROCESSING) → 배지와 정확히 일치
        const res: any = await apiRequest(`/admin/insurance`);
        const arr = Array.isArray(res) ? res : res?.data || [];
        setList(arr.filter((x: any) => x.status === "REQUESTED" || x.status === "PROCESSING"));
      } else {
        const qs = statusFilter ? `?status=${statusFilter}` : "";
        const res: any = await apiRequest(`/admin/insurance${qs}`);
        setList(Array.isArray(res) ? res : res?.data || []);
      }
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
    if (!completeTarget || (docFiles.length === 0 && removeUrls.length === 0)) {
      alert("업로드할 파일을 선택하거나, 삭제할 기존 서류를 선택해주세요.");
      return;
    }
    setUpdating(true);
    try {
      const fd = new FormData();
      fd.append("status", "COMPLETED");
      for (const f of docFiles) fd.append("documents", f);
      if (removeUrls.length > 0) fd.append("removeUrls", JSON.stringify(removeUrls));
      await patchMultipart(`/admin/insurance/${completeTarget.id}`, fd);
      setCompleteTarget(null);
      setDocFiles([]);
      setRemoveUrls([]);
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
            <option value="TODO">미처리(접수·처리중)</option>
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
                      <div className="text-xs text-gray-500">{formatPhone(r.requester?.phone) || r.requester?.email || ""}</div>
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
                          onClick={() => { setCompleteTarget(r); setDocFiles([]); setRemoveUrls([]); }}
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
                        {(() => {
                          // 다중 업로드 지원 — documentUrls 우선, 없으면 레거시 단일 documentUrl
                          const urls = (r.documentUrls && r.documentUrls.length > 0)
                            ? r.documentUrls
                            : (r.documentUrl ? [r.documentUrl] : []);
                          return urls.map((u, i) => (
                            <a
                              key={`${u}_${i}`}
                              href={(() => {
                                if (u.startsWith("/api/files/private/") && typeof window !== "undefined") {
                                  const t = localStorage.getItem("token");
                                  return t ? `${API_HOST}${u}?token=${encodeURIComponent(t)}` : `${API_HOST}${u}`;
                                }
                                return `${API_HOST}${u}`;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              서류{urls.length > 1 ? ` ${i + 1}` : ""}
                            </a>
                          ));
                        })()}
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
            {(() => {
              const existing = (completeTarget.documentUrls && completeTarget.documentUrls.length > 0)
                ? completeTarget.documentUrls
                : (completeTarget.documentUrl ? [completeTarget.documentUrl] : []);
              if (existing.length === 0) return null;
              return (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-600">이미 등록된 서류 ({existing.length}건)</p>
                  <ul className="space-y-1">
                    {existing.map((u, i) => {
                      const marked = removeUrls.includes(u);
                      return (
                        <li key={u} className="flex items-center justify-between gap-2 text-xs">
                          <span className={marked ? "text-red-500 line-through truncate" : "text-gray-700 truncate"}>
                            서류 {i + 1} · {u.split("/").pop()}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRemoveUrls((prev) => marked ? prev.filter((x) => x !== u) : [...prev, u])}
                            className={`shrink-0 rounded px-2 py-0.5 ${marked ? "bg-gray-200 text-gray-600" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                          >
                            {marked ? "취소" : "삭제"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {removeUrls.length > 0 && (
                    <p className="mt-2 text-[11px] text-red-500">저장 시 {removeUrls.length}건이 목록에서 제거됩니다.</p>
                  )}
                </div>
              );
            })()}
            <label className="block text-sm font-medium text-gray-700 mb-1">
              발급된 서류 파일 <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                // 여러 번 나눠서 선택해도 누적되도록 (같은 이름+크기는 중복 제외)
                setDocFiles((prev) => {
                  // 이름+크기만으로 판정하면 서로 다른 파일이 조용히 누락될 수 있어 수정시각까지 포함
                  const key = (f: File) => `${f.name}_${f.size}_${f.lastModified}`;
                  const seen = new Set(prev.map(key));
                  const added = picked.filter((f) => !seen.has(key(f)));
                  const skipped = picked.length - added.length;
                  if (skipped > 0) alert(`이미 선택된 파일 ${skipped}건은 제외했습니다.`);
                  const merged = [...prev, ...added];
                  if (merged.length > 10) {
                    alert("서류는 한 번에 최대 10건까지 업로드할 수 있습니다.");
                    return merged.slice(0, 10);
                  }
                  return merged;
                });
                e.target.value = "";
              }}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 file:text-sm file:font-semibold hover:file:bg-green-100"
            />
            <p className="text-xs text-gray-400 mt-1">
              PDF · JPG · PNG (각 최대 10MB) · <b>여러 개 선택 가능</b> (사업자등록증, 간병인사용확인서, 용역계약서, 간병일지 등)
            </p>
            {docFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {docFiles.map((f, i) => (
                  <li key={`${f.name}_${i}`} className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs">
                    <span className="truncate text-gray-700">
                      {f.name} <span className="text-gray-400">({(f.size / 1024).toFixed(1)}KB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDocFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-2 shrink-0 text-red-500 hover:underline"
                    >
                      제거
                    </button>
                  </li>
                ))}
                <li className="text-[11px] text-gray-500">총 {docFiles.length}개 선택됨</li>
              </ul>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setCompleteTarget(null); setDocFiles([]); setRemoveUrls([]); }}
                className="btn-secondary flex-1"
                disabled={updating}
              >
                취소
              </button>
              <button
                onClick={handleComplete}
                disabled={updating || (docFiles.length === 0 && removeUrls.length === 0)}
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
