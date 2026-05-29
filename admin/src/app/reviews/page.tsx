"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  wouldRehire: boolean;
  isHidden: boolean;
  isFeatured: boolean;
  createdAt: string;
  guardian: { user: { name: string } } | null;
  caregiver: { user: { name: string } } | null;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "featured" | "hidden">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<ReviewRow[]>("/admin/reviews");
      setReviews(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const toggleFeatured = async (id: string, current: boolean) => {
    setBusy(id);
    try {
      await apiRequest(`/admin/reviews/${id}/feature`, { method: "PUT", body: { isFeatured: !current } });
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, isFeatured: !current } : r)));
    } catch (e: any) {
      alert(e?.message || "설정 변경 실패");
    } finally {
      setBusy(null);
    }
  };

  const toggleHidden = async (id: string, current: boolean) => {
    setBusy(id);
    try {
      if (current) {
        await apiRequest(`/admin/reviews/${id}/unhide`, { method: "POST" });
      } else {
        await apiRequest(`/admin/reviews/${id}/hide`, { method: "POST" });
      }
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, isHidden: !current, ...(!current ? { isFeatured: false } : {}) } : r)));
    } catch (e: any) {
      alert(e?.message || "설정 변경 실패");
    } finally {
      setBusy(null);
    }
  };

  const filtered = reviews.filter((r) => {
    if (filter === "featured") return r.isFeatured;
    if (filter === "hidden") return r.isHidden;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">간병 후기 관리</h1>
        <p className="mt-1 text-sm text-gray-500">후기 노출 여부 + 메인 페이지 노출 선정.</p>
      </div>

      <div className="flex gap-2">
        {(["all", "featured", "hidden"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f
                ? "bg-primary-500 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f === "all" ? `전체 (${reviews.length})` : f === "featured" ? `메인 노출 (${reviews.filter((r) => r.isFeatured).length})` : `숨김 (${reviews.filter((r) => r.isHidden).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">해당 조건의 후기가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className={`card ${r.isHidden ? "opacity-60" : ""} ${r.isFeatured ? "ring-2 ring-primary-300" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-amber-500 font-bold">{"★".repeat(Math.round(r.rating))}</span>
                    <span className="text-xs text-gray-500">{r.rating.toFixed(1)} / 5.0</span>
                    {r.wouldRehire && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">재고용 의사</span>}
                    {r.isFeatured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-bold">⭐ 메인 노출</span>}
                    {r.isHidden && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">숨김</span>}
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed mb-2 whitespace-pre-wrap">{r.comment || "(코멘트 없음)"}</p>
                  <p className="text-[11px] text-gray-400">
                    {r.guardian?.user?.name || "(탈퇴)"} → {r.caregiver?.user?.name || "(탈퇴)"} · {new Date(r.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleFeatured(r.id, r.isFeatured)}
                    disabled={busy === r.id || r.isHidden}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      r.isFeatured
                        ? "bg-primary-500 text-white border-primary-500"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {r.isFeatured ? "메인 해제" : "메인 노출"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleHidden(r.id, r.isHidden)}
                    disabled={busy === r.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      r.isHidden
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    } disabled:opacity-50`}
                  >
                    {r.isHidden ? "숨김 해제" : "숨김 처리"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
