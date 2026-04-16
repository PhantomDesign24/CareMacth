"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getNotificationTemplates,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  NotificationTemplate,
} from "@/lib/api";
import { NOTIFICATION_TYPES } from "@/lib/constants";

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [editForm, setEditForm] = useState({ title: "", body: "", enabled: true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationTemplates();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const openEdit = (t: NotificationTemplate) => {
    setEditing(t);
    setEditForm({ title: t.title, body: t.body, enabled: t.enabled });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateNotificationTemplate(editing.id, editForm);
      setToast("템플릿 저장 완료");
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (t: NotificationTemplate) => {
    try {
      await updateNotificationTemplate(t.id, { enabled: !t.enabled });
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, enabled: !t.enabled } : x));
      setToast(t.enabled ? "비활성화됨" : "활성화됨");
    } catch {
      alert("상태 변경 실패");
    }
  };

  const handleDelete = async (t: NotificationTemplate) => {
    if (!confirm(`"${t.name}" 템플릿을 삭제하시겠습니까?`)) return;
    try {
      await deleteNotificationTemplate(t.id);
      setToast("삭제됨");
      await load();
    } catch (e: any) {
      alert(e?.message || "삭제 실패");
    }
  };

  const filtered = useMemo(() => {
    if (!filterType) return templates;
    return templates.filter((t) => t.type === filterType);
  }, [templates, filterType]);

  const typeLabel = (type: string) => NOTIFICATION_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">알림 템플릿 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          사용자에게 발송되는 시스템 알림 문구를 편집합니다. 변수는 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{"{name}"}</code> 형태로 사용됩니다.
        </p>
      </div>

      {/* 타입 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterType("")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            filterType === "" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
          }`}
        >
          전체 ({templates.length})
        </button>
        {NOTIFICATION_TYPES.map((t) => {
          const count = templates.filter((x) => x.type === t.value).length;
          if (count === 0) return null;
          return (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filterType === t.value ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* 템플릿 목록 */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">템플릿이 없습니다.</div>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className={`bg-white border rounded-xl p-4 ${t.enabled ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">{typeLabel(t.type)}</span>
                    {t.isSystem && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">시스템</span>
                    )}
                    <code className="text-xs text-gray-400">{t.key}</code>
                  </div>
                  {t.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleEnabled(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      t.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.enabled ? "활성" : "비활성"}
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                  >
                    편집
                  </button>
                  {!t.isSystem && (
                    <button
                      onClick={() => handleDelete(t)}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                <div className="font-medium mb-1">{t.title}</div>
                <div className="text-gray-600 whitespace-pre-wrap text-xs">{t.body}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 편집 모달 */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editing.name} 편집</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">제목</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">본문</label>
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  maxLength={2000}
                />
                {editing.description && (
                  <p className="text-xs text-gray-500 mt-1">💡 {editing.description}</p>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm text-gray-700">활성화</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
