"use client";

import { useEffect, useState } from "react";
import { getAdminNotices, createNotice, updateNotice, deleteNotice, type AdminNotice } from "@/lib/api";

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: "일반", UPDATE: "업데이트", EVENT: "이벤트", MAINTENANCE: "점검",
};

const CATEGORY_COLOR: Record<string, string> = {
  GENERAL: "bg-gray-100 text-gray-700",
  UPDATE: "bg-blue-100 text-blue-700",
  EVENT: "bg-orange-100 text-orange-700",
  MAINTENANCE: "bg-red-100 text-red-700",
};

interface FormState {
  id?: string;
  title: string;
  content: string;
  category: "GENERAL" | "UPDATE" | "EVENT" | "MAINTENANCE";
  isPinned: boolean;
  isPublished: boolean;
}

const empty: FormState = {
  title: "", content: "", category: "GENERAL", isPinned: false, isPublished: true,
};

export default function AdminNoticesPage() {
  const [items, setItems] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAdminNotices();
      setItems(list);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.content.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await updateNotice(editing.id, editing);
      } else {
        await createNotice(editing);
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 공지를 삭제하시겠습니까?`)) return;
    await deleteNotice(id);
    await load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">공지사항 관리</h1>
        <button
          onClick={() => setEditing({ ...empty })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 새 공지 작성
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-sm">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">카테고리</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">제목</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">고정</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">게시</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">조회</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">등록일</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-12 text-center text-gray-400">불러오는 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="p-12 text-center text-gray-400">등록된 공지가 없습니다.</td></tr>
            ) : (
              items.map((n) => (
                <tr key={n.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOR[n.category]}`}>
                      {CATEGORY_LABEL[n.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <button
                      onClick={() => setEditing({
                        id: n.id, title: n.title, content: n.content,
                        category: n.category, isPinned: n.isPinned, isPublished: n.isPublished,
                      })}
                      className="text-left text-gray-900 hover:text-blue-600 break-words"
                    >
                      {n.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">{n.isPinned ? "📌" : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {n.isPublished ? <span className="text-green-600">✓</span> : <span className="text-gray-400">✗</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{n.viewCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500">
                    {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(n.id, n.title)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 편집 모달 */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {editing.id ? "공지 수정" : "새 공지 작성"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="제목 입력 (최대 200자)"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="GENERAL">일반</option>
                  <option value="UPDATE">업데이트</option>
                  <option value="EVENT">이벤트</option>
                  <option value="MAINTENANCE">점검</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  placeholder="본문 입력 (줄바꿈 그대로 표시됨)"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.isPinned}
                    onChange={(e) => setEditing({ ...editing, isPinned: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700">상단 고정</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.isPublished}
                    onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700">게시 (체크 해제 시 비공개)</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "저장 중..." : editing.id ? "수정 저장" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
