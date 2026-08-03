"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getBanners, createBanner, updateBanner, deleteBanner, uploadBannerImage,
  BannerItem,
} from "@/lib/api";

const EMPTY: Partial<BannerItem> = {
  title: "", subtitle: "", imageUrl: "", linkUrl: "", ctaLabel: "",
  bgColor: "#FF6B35", sortOrder: 0, isActive: true, startAt: null, endAt: null,
};

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

const toDateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export default function BannersPage() {
  const [list, setList] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<BannerItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await getBanners());
    } catch (e: any) {
      alert(e?.message || "배너를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (!editing.title?.trim()) { alert("배너 제목을 입력해주세요."); return; }
    if (!editing.imageUrl && !editing.bgColor) { alert("이미지 또는 배경색을 지정해주세요."); return; }
    setSaving(true);
    try {
      if (editing.id) await updateBanner(editing.id, editing);
      else await createBanner(editing);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: BannerItem) => {
    if (!confirm(`"${b.title}" 배너를 삭제할까요?`)) return;
    try {
      await deleteBanner(b.id);
      await load();
    } catch (e: any) {
      alert(e?.message || "삭제 실패");
    }
  };

  const toggleActive = async (b: BannerItem) => {
    try {
      await updateBanner(b.id, { ...b, isActive: !b.isActive });
      await load();
    } catch (e: any) {
      alert(e?.message || "변경 실패");
    }
  };

  const onPickImage = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await uploadBannerImage(file);
      setEditing((prev) => ({ ...(prev || {}), imageUrl: url }));
    } catch (e: any) {
      alert(e?.message || "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">메인 광고 배너</h1>
          <p className="mt-1 text-sm text-gray-500">
            홈페이지 메인 상단 슬라이드에 노출됩니다. 이미지를 올리거나 배경색만으로도 만들 수 있습니다.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setEditing({ ...EMPTY })}>
          + 배너 추가
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">불러오는 중...</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-gray-400">
          등록된 배너가 없습니다. 우측 상단 &quot;배너 추가&quot;로 등록하세요.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <div key={b.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
              {/* 미리보기 */}
              <div
                className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-medium text-white"
                style={b.imageUrl ? undefined : { background: b.bgColor || "#999" }}
              >
                {b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover" />
                ) : (
                  <span className="px-1 text-center leading-tight">{b.bgColor}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{b.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${b.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {b.isActive ? "노출중" : "숨김"}
                  </span>
                  <span className="text-[11px] text-gray-400">순서 {b.sortOrder}</span>
                </div>
                {b.subtitle && <div className="truncate text-sm text-gray-500">{b.subtitle}</div>}
                <div className="mt-0.5 text-xs text-gray-400">
                  {b.linkUrl ? `→ ${b.linkUrl}` : "링크 없음"}
                  {(b.startAt || b.endAt) && ` · ${toDateInput(b.startAt) || "무기한"} ~ ${toDateInput(b.endAt) || "무기한"}`}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button onClick={() => toggleActive(b)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  {b.isActive ? "숨기기" : "노출"}
                </button>
                <button onClick={() => setEditing({ ...b })} className="rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-200">
                  수정
                </button>
                <button onClick={() => remove(b)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 편집 모달 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-gray-900">{editing.id ? "배너 수정" : "배너 추가"}</h2>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>제목 *</label>
                <input className={inputCls} value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="예: 여름 맞이 간병 이벤트" />
              </div>
              <div>
                <label className={labelCls}>부제 (선택)</label>
                <input className={inputCls} value={editing.subtitle || ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} />
              </div>

              <div>
                <label className={labelCls}>배너 이미지</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); e.target.value = ""; }}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-orange-700 hover:file:bg-orange-100"
                />
                {uploading && <p className="mt-1 text-xs text-gray-500">업로드 중…</p>}
                {editing.imageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editing.imageUrl} alt="미리보기" className="h-16 w-28 rounded object-cover" />
                    <button type="button" onClick={() => setEditing({ ...editing, imageUrl: "" })} className="text-xs text-red-500 hover:underline">이미지 제거</button>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-gray-400">이미지를 올리지 않으면 아래 배경색으로 표시됩니다.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>배경색</label>
                  <input type="color" className="h-10 w-full rounded-lg border border-gray-300" value={editing.bgColor || "#FF6B35"} onChange={(e) => setEditing({ ...editing, bgColor: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>노출 순서</label>
                  <input type="number" className={inputCls} value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>클릭 시 이동 경로</label>
                  <input className={inputCls} value={editing.linkUrl || ""} onChange={(e) => setEditing({ ...editing, linkUrl: e.target.value })} placeholder="/care-request" />
                </div>
                <div>
                  <label className={labelCls}>버튼 문구</label>
                  <input className={inputCls} value={editing.ctaLabel || ""} onChange={(e) => setEditing({ ...editing, ctaLabel: e.target.value })} placeholder="자세히 보기" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>노출 시작 (선택)</label>
                  <input type="date" className={inputCls} value={toDateInput(editing.startAt)} onChange={(e) => setEditing({ ...editing, startAt: e.target.value || null })} />
                </div>
                <div>
                  <label className={labelCls}>노출 종료 (선택)</label>
                  <input type="date" className={inputCls} value={toDateInput(editing.endAt)} onChange={(e) => setEditing({ ...editing, endAt: e.target.value || null })} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={editing.isActive !== false} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
                지금 노출하기
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setEditing(null)} disabled={saving}>취소</button>
              <button className="btn-primary flex-1" onClick={save} disabled={saving || uploading}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
