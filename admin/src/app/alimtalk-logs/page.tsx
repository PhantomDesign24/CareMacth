"use client";

import { useCallback, useEffect, useState } from "react";
import StatsCard from "@/components/StatsCard";
import {
  getAlimtalkLogs,
  resendAlimtalkLog,
  getNotificationTemplates,
  AlimtalkLogItem,
  NotificationTemplate,
} from "@/lib/api";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  SUCCESS: { label: "성공", cls: "bg-emerald-100 text-emerald-700" },
  FAILED: { label: "실패", cls: "bg-red-100 text-red-700" },
  PENDING: { label: "대기", cls: "bg-amber-100 text-amber-700" },
};

export default function AlimtalkLogsPage() {
  const [items, setItems] = useState<AlimtalkLogItem[]>([]);
  const [summary, setSummary] = useState({
    todayCount: 0,
    todaySuccessRate: 0,
    last24hFailedCount: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터
  const [status, setStatus] = useState<string>("");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [userQuery, setUserQuery] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // 본문 미리보기 모달
  const [previewItem, setPreviewItem] = useState<AlimtalkLogItem | null>(null);

  // 템플릿 KEY 셀렉트용
  const [templateOptions, setTemplateOptions] = useState<{ key: string; title: string }[]>([]);

  useEffect(() => {
    getNotificationTemplates()
      .then((rows) => {
        const opts = (rows || [])
          .map((t: NotificationTemplate) => ({ key: t.key, title: t.title || '' }))
          .sort((a, b) => a.key.localeCompare(b.key));
        setTemplateOptions(opts);
      })
      .catch(() => setTemplateOptions([]));
  }, []);

  const fetchData = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAlimtalkLogs({
        status: status || undefined,
        templateKey: templateKey || undefined,
        userQuery: userQuery || undefined,
        from: from || undefined,
        to: to || undefined,
        page: pageOverride || pagination.page,
        limit: pagination.limit,
      });
      setItems(res?.items || []);
      setSummary(res?.summary || { todayCount: 0, todaySuccessRate: 0, last24hFailedCount: 0 });
      setPagination(res?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "발송 로그를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, templateKey, userQuery, from, to, pagination.limit]);

  useEffect(() => {
    fetchData(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => {
    fetchData(1);
  };

  const onReset = () => {
    setStatus("");
    setTemplateKey("");
    setUserQuery("");
    setFrom("");
    setTo("");
    setTimeout(() => fetchData(1), 0);
  };

  const onResend = async (id: string) => {
    if (!confirm("이 알림톡을 재발송하시겠습니까?")) return;
    try {
      const res = await resendAlimtalkLog(id);
      alert(res?.reason ? `처리됨: ${res.reason}` : "재발송 요청을 완료했습니다.");
      fetchData(pagination.page);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "재발송 실패");
    }
  };

  const goPage = (next: number) => {
    if (next < 1 || next > pagination.totalPages || next === pagination.page) return;
    fetchData(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">알림톡 발송 로그</h1>
        <p className="mt-1 text-sm text-gray-500">카카오 알림톡(알리고) 발송 이력 — 성공/실패/재발송</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatsCard title="오늘 발송 수" value={`${summary.todayCount.toLocaleString()}건`} color="blue" />
        <StatsCard title="오늘 성공률" value={`${summary.todaySuccessRate}%`} color="green" />
        <StatsCard title="최근 24시간 실패" value={`${summary.last24hFailedCount.toLocaleString()}건`} color="red" />
      </div>

      {/* 필터 */}
      <div className="card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">전체</option>
              <option value="SUCCESS">성공</option>
              <option value="FAILED">실패</option>
              <option value="PENDING">대기</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">템플릿</label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">전체 템플릿</option>
              {templateOptions.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.title || t.key} ({t.key})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">사용자 (이름·이메일·전화)</label>
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="홍길동, 010-...."
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">시작</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">종료</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field text-sm" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary btn-sm" onClick={onSearch} disabled={loading}>
            {loading ? "조회 중..." : "조회"}
          </button>
          <button className="btn-secondary btn-sm" onClick={onReset}>초기화</button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 표 */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">시간</th>
              <th className="px-3 py-2 text-left">수신자</th>
              <th className="px-3 py-2 text-left">템플릿</th>
              <th className="px-3 py-2 text-center">상태</th>
              <th className="px-3 py-2 text-left">에러 사유</th>
              <th className="px-3 py-2 text-left">본문</th>
              <th className="px-3 py-2 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-400">발송 이력이 없습니다.</td>
              </tr>
            ) : (
              items.map((it) => {
                const stat = STATUS_LABEL[it.status] || { label: it.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {new Date(it.createdAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-gray-900">{it.userName || "-"}</div>
                      <div className="text-xs text-gray-400">{it.phone}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-gray-700">{it.templateKey || "-"}</div>
                      {it.templateCode && (
                        <div className="text-[10px] text-gray-400">{it.templateCode}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stat.cls}`}>
                        {stat.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-red-600 max-w-[200px] truncate" title={it.errorReason || ""}>
                      {it.errorReason || ""}
                    </td>
                    <td className="px-3 py-2 max-w-[280px]">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(it)}
                        className="text-xs text-gray-600 hover:underline truncate text-left w-full"
                      >
                        {it.message?.slice(0, 60) || "(본문 없음)"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {it.status === "FAILED" && (
                        <button
                          type="button"
                          onClick={() => onResend(it.id)}
                          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          재발송
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => goPage(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="btn-secondary btn-sm"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {pagination.page} / {pagination.totalPages} (총 {pagination.total.toLocaleString()}건)
          </span>
          <button
            onClick={() => goPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="btn-secondary btn-sm"
          >
            다음
          </button>
        </div>
      )}

      {/* 본문 미리보기 모달 */}
      {previewItem && (
        <div className="modal-overlay" onClick={() => setPreviewItem(null)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{previewItem.title || previewItem.templateKey || "알림톡 본문"}</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {new Date(previewItem.createdAt).toLocaleString("ko-KR")} · {previewItem.phone}
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
{previewItem.message}
            </pre>
            {previewItem.errorReason && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <strong>에러:</strong> {previewItem.errorReason}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {previewItem.status === "FAILED" && (
                <button
                  className="btn-primary"
                  onClick={() => { onResend(previewItem.id); setPreviewItem(null); }}
                >
                  재발송
                </button>
              )}
              <button className="btn-secondary" onClick={() => setPreviewItem(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
