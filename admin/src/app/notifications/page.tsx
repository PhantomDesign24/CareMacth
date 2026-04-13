"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAdminNotifications,
  sendAdminNotification,
  deleteUnsentNotifications,
  type AdminNotification,
} from "@/lib/api";

// ─── Helpers ───────────────────────────────────────────

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "SYSTEM": return "시스템";
    case "MATCHING": return "매칭";
    case "APPLICATION": return "지원";
    case "CONTRACT": return "계약";
    case "PAYMENT": return "결제";
    case "CARE_RECORD": return "간병기록";
    case "EXTENSION": return "연장";
    case "PENALTY": return "패널티";
    default: return type;
  }
}

function typeBadge(type: string): string {
  switch (type) {
    case "SYSTEM": return "badge-blue";
    case "MATCHING": return "badge-green";
    case "PAYMENT": return "badge-purple";
    case "PENALTY": return "badge-red";
    case "CONTRACT": return "badge-yellow";
    default: return "badge-gray";
  }
}

const NOTIFICATION_TYPES = [
  { value: "", label: "전체" },
  { value: "SYSTEM", label: "시스템" },
  { value: "MATCHING", label: "매칭" },
  { value: "APPLICATION", label: "지원" },
  { value: "CONTRACT", label: "계약" },
  { value: "PAYMENT", label: "결제" },
  { value: "CARE_RECORD", label: "간병기록" },
  { value: "EXTENSION", label: "연장" },
  { value: "PENALTY", label: "패널티" },
];

// ─── Main Page ────────────────────────────────────────

export default function NotificationsPage() {
  // Send form state
  const [target, setTarget] = useState<"all" | "individual" | "all_devices">("all");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendType, setSendType] = useState("SYSTEM");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // List state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("");

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { page: number; limit: number; type?: string } = { page, limit: 20 };
      if (filterType) {
        params.type = filterType;
      }
      const result = await getAdminNotifications(params);
      setNotifications(result.notifications || []);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotal(result.pagination?.total || 0);
    } catch (err: any) {
      setError(err?.message || "알림 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert("제목과 내용을 모두 입력해주세요.");
      return;
    }
    if (target === "individual" && !userId.trim()) {
      alert("개별 발송 시 사용자 ID를 입력해주세요.");
      return;
    }
    const confirmMsg = target === "all_devices" ? "비회원 포함 전체 디바이스에 푸시를 발송하시겠습니까?" : target === "all" ? "전체 회원에게 알림을 발송하시겠습니까?" : "해당 사용자에게 알림을 발송하시겠습니까?";
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setSending(true);
      setSendResult(null);
      const result: any = await sendAdminNotification({
        target,
        userId: target === "individual" ? userId.trim() : undefined,
        title: title.trim(),
        body: body.trim(),
        type: sendType,
      });
      setSendResult({ type: "success", message: result?.message || "알림이 발송되었습니다." });
      setTitle("");
      setBody("");
      setUserId("");
      // Refresh the list
      fetchNotifications();
    } catch (err: any) {
      setSendResult({ type: "error", message: err?.message || "알림 발송 중 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">알림 관리</h1>
        <p className="mt-1 text-sm text-gray-500">알림을 발송하고 발송 이력을 관리합니다.</p>
      </div>

      {/* 발송 폼 */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">알림 발송</h2>
        <form onSubmit={handleSend} className="space-y-4">
          {/* 대상 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">대상</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value="all"
                  checked={target === "all"}
                  onChange={() => setTarget("all")}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">전체 회원</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value="all_devices"
                  checked={target === "all_devices"}
                  onChange={() => setTarget("all_devices")}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">전체 디바이스 (비회원 포함)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value="individual"
                  checked={target === "individual"}
                  onChange={() => setTarget("individual")}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">개별</span>
              </label>
            </div>
          </div>

          {/* userId (개별 발송 시) */}
          {target === "individual" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사용자 ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="사용자 UUID를 입력하세요"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          )}

          {/* 유형 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">유형</label>
            <select
              value={sendType}
              onChange={(e) => setSendType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-60"
            >
              {NOTIFICATION_TYPES.filter((t) => t.value !== "").map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* 제목 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="알림 제목을 입력하세요"
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">내용</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="알림 내용을 입력하세요"
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* 결과 메시지 */}
          {sendResult && (
            <div className={`rounded-lg px-4 py-3 text-sm ${
              sendResult.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}>
              {sendResult.message}
            </div>
          )}

          {/* 발송 버튼 */}
          <button
            type="submit"
            disabled={sending || !title.trim() || !body.trim()}
            className="btn-primary"
          >
            {sending ? "발송 중..." : "발송"}
          </button>
        </form>
      </div>

      {/* 발송 이력 */}
      <div className="card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            발송 이력
            <span className="ml-2 text-sm font-normal text-gray-400">총 {total}건</span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm text-gray-500">유형:</label>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={async () => {
                if (!confirm("미발송 알림을 모두 삭제하시겠습니까?")) return;
                try {
                  const res: any = await deleteUnsentNotifications();
                  alert(res?.message || "삭제 완료");
                  fetchNotifications();
                } catch (e: any) {
                  alert(e?.message || "삭제 실패");
                }
              }}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 transition-colors"
            >
              미발송 일괄 삭제
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <svg className="mx-auto h-8 w-8 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="mt-3 text-sm text-gray-500">알림 목록을 불러오는 중...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchNotifications} className="btn-primary mt-3">
              다시 시도
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            <p className="mt-3 text-sm text-gray-400">발송된 알림이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-medium uppercase text-gray-500">
                    <th className="px-4 py-3">유형</th>
                    <th className="px-4 py-3">제목</th>
                    <th className="px-4 py-3">내용</th>
                    <th className="px-4 py-3">대상</th>
                    <th className="px-4 py-3">발송일</th>
                    <th className="px-4 py-3">푸시 상태</th>
                    <th className="px-4 py-3">읽음여부</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {notifications.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={typeBadge(n.type)}>{typeLabel(n.type)}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {n.title}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={n.body}>
                        {n.body.length > 50 ? n.body.substring(0, 50) + "..." : n.body}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="text-sm">{n.userName}</div>
                        <div className="text-xs text-gray-400">{n.userEmail}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {formatDate(n.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {(n as any).pushSent ? (
                          (n as any).pushSuccess ? (
                            <span className="badge-green">발송 성공</span>
                          ) : (
                            <span className="badge-red" title={(n as any).pushError || ''}>발송 실패</span>
                          )
                        ) : (
                          <span className="badge-gray">미발송</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {n.isRead ? (
                          <span className="badge-green">읽음</span>
                        ) : (
                          <span className="badge-gray">안읽음</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500">
                  {page} / {totalPages} 페이지
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-secondary btn-sm disabled:opacity-50"
                  >
                    이전
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn-secondary btn-sm disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
