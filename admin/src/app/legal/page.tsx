"use client";

import { useState, useEffect, useCallback } from "react";
import { getLegalDocs, updateLegalDoc, LegalDocItem } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  terms: "이용약관",
  privacy: "개인정보처리방침",
  location_terms: "위치기반서비스 이용약관",
};

export default function LegalCmsPage() {
  const [docs, setDocs] = useState<LegalDocItem[]>([]);
  const [active, setActive] = useState<string>("terms");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getLegalDocs();
      const items: LegalDocItem[] = res?.items || [];
      setDocs(items);
    } catch (e: any) {
      alert(e?.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 탭 전환 또는 로드 시 편집 필드 채우기
  useEffect(() => {
    const d = docs.find((x) => x.type === active);
    setTitle(d?.title || TYPE_LABELS[active] || "");
    setContent(d?.content || "");
    setEffectiveDate(d?.effectiveDate || "");
  }, [active, docs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async () => {
    if (!content.trim()) {
      alert("본문을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await updateLegalDoc(active, { title: title.trim(), content, effectiveDate: effectiveDate || null });
      setToast("저장되었습니다.");
      await load();
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const webPath = active === "terms" ? "/terms" : active === "privacy" ? "/privacy" : "/location-terms";

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">약관·개인정보 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          이용약관·개인정보처리방침을 직접 수정·게시합니다. 저장 즉시 홈페이지에 반영됩니다.
          본문은 HTML을 지원합니다. (예: <code className="bg-gray-100 px-1 rounded">&lt;h2&gt;제목&lt;/h2&gt;</code>, <code className="bg-gray-100 px-1 rounded">&lt;p&gt;문단&lt;/p&gt;</code>, <code className="bg-gray-100 px-1 rounded">&lt;ul&gt;&lt;li&gt;항목&lt;/li&gt;&lt;/ul&gt;</code>)
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {Object.keys(TYPE_LABELS).map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === t ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시행일</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">본문 (HTML)</label>
              <a href={webPath} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline">
                홈페이지에서 미리보기 ↗
              </a>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={22}
              spellCheck={false}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono leading-relaxed focus:outline-none focus:border-orange-400"
              placeholder="<section><h2>제1조 (목적)</h2><p>내용...</p></section>"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장 후 게시"}
            </button>
            <span className="text-xs text-gray-400">저장하면 홈페이지 {webPath} 에 즉시 반영됩니다.</span>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
