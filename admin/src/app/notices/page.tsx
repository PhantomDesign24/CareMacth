"use client";

import { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { getAdminNotices, createNotice, updateNotice, deleteNotice, uploadNoticeFile, uploadNoticeFilesMulti, type AdminNotice, type NoticeAttachment } from "@/lib/api";

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
  attachments: NoticeAttachment[];
}

const empty: FormState = {
  title: "", content: "", category: "GENERAL", isPinned: false, isPublished: true, attachments: [],
};

declare global {
  interface Window {
    jQuery?: any;
    $?: any;
  }
}

export default function AdminNoticesPage() {
  const [items, setItems] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [scriptsReady, setScriptsReady] = useState(false);

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
    if (!editing.title.trim() || !editing.content.trim() || editing.content === '<p><br></p>') {
      alert("제목과 내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...editing, attachments: editing.attachments };
      if (editing.id) {
        await updateNotice(editing.id, payload);
      } else {
        await createNotice(payload);
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
    <>
      {/* Summernote CDN — jQuery + Summernote-lite (Bootstrap 의존성 없음) */}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.css" />
      <Script src="https://code.jquery.com/jquery-3.7.1.min.js" strategy="afterInteractive" onLoad={() => {
        // jQuery 로드 후 Summernote 로드
      }} />
      <Script
        src="https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsReady(true)}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/lang/summernote-ko-KR.min.js"
        strategy="afterInteractive"
      />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">공지사항 관리</h1>
          <button
            onClick={() => setEditing({ ...empty, attachments: [] })}
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
                <th className="px-4 py-3 text-center font-semibold text-gray-600">첨부</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">조회</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">등록일</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-12 text-center text-gray-400">불러오는 중...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-gray-400">등록된 공지가 없습니다.</td></tr>
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
                          attachments: n.attachments || [],
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
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {n.attachments?.length ? `📎 ${n.attachments.length}` : "—"}
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
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-gray-900">
                  {editing.id ? "공지 수정" : "새 공지 작성"}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >×</button>
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

                {/* Summernote 본문 */}
                <SummernoteEditor
                  ready={scriptsReady}
                  value={editing.content}
                  onChange={(v) => setEditing((prev) => prev ? { ...prev, content: v } : prev)}
                />

                {/* 첨부파일 (멀티 업로드) */}
                <AttachmentField
                  attachments={editing.attachments}
                  onChange={(list) => setEditing((prev) => prev ? { ...prev, attachments: list } : prev)}
                />

                <div className="flex gap-6 pt-2">
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
              <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 flex justify-end gap-2">
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
    </>
  );
}

// ============================================
// Summernote 에디터
// ============================================
function SummernoteEditor({ ready, value, onChange }: { ready: boolean; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!ready || !ref.current || initializedRef.current) return;
    if (typeof window === 'undefined' || !window.$) return;
    const $ = window.$;
    const $el = $(ref.current);

    $el.summernote({
      lang: 'ko-KR',
      height: 320,
      placeholder: '본문을 입력해주세요. 이미지·동영상 첨부 가능.',
      toolbar: [
        ['style', ['style']],
        ['font', ['bold', 'italic', 'underline', 'strikethrough', 'clear']],
        ['fontsize', ['fontsize']],
        ['color', ['color']],
        ['para', ['ul', 'ol', 'paragraph']],
        ['table', ['table']],
        ['insert', ['link', 'picture', 'video', 'hr']],
        ['view', ['fullscreen', 'codeview', 'help']],
      ],
      callbacks: {
        onChange: (contents: string) => {
          onChange(contents);
        },
        onImageUpload: async (files: FileList) => {
          for (const f of Array.from(files)) {
            try {
              const result = await uploadNoticeFile(f);
              const img = $('<img>').attr({
                src: result.url,
                alt: result.filename,
                style: 'max-width:100%;height:auto;',
              });
              $el.summernote('insertNode', img[0]);
            } catch (e: any) {
              alert(e?.message || '이미지 업로드 실패');
            }
          }
        },
      },
    });

    if (value) {
      $el.summernote('code', value);
    }
    initializedRef.current = true;

    return () => {
      try { $el.summernote('destroy'); } catch {}
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // value 가 외부에서 바뀌었는데 에디터 내용과 다르면 동기화 (수정 모달 열 때)
  useEffect(() => {
    if (!initializedRef.current || !ref.current || !window.$) return;
    const current = window.$(ref.current).summernote('code');
    if (current !== value) {
      window.$(ref.current).summernote('code', value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">본문 (Summernote 에디터)</label>
      <textarea ref={ref} defaultValue={value} />
      {!ready && (
        <p className="mt-1 text-xs text-gray-400">에디터 로딩 중...</p>
      )}
    </div>
  );
}

// ============================================
// 첨부파일 멀티 업로드
// ============================================
function AttachmentField({ attachments, onChange }: { attachments: NoticeAttachment[]; onChange: (list: NoticeAttachment[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleSelect = async (files: FileList) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const result = await uploadNoticeFilesMulti(Array.from(files));
      onChange([...attachments, ...result]);
    } catch (e: any) {
      alert(e?.message || '업로드 실패');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = (idx: number) => {
    onChange(attachments.filter((_, i) => i !== idx));
  };

  const fmtSize = (n: number) => {
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
    return `${(n / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">첨부 파일 ({attachments.length})</label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {uploading ? '업로드 중...' : '+ 파일 추가 (여러 개 가능)'}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleSelect(e.target.files);
          }}
        />
      </div>
      {attachments.length === 0 ? (
        <p className="text-sm text-gray-400 px-3 py-4 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-center">
          첨부된 파일이 없습니다. 본문 외에 별도 다운로드용 파일을 추가할 수 있습니다.
        </p>
      ) : (
        <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {attachments.map((f, i) => (
            <li key={`${f.url}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-xl">{f.mimeType.startsWith('image/') ? '🖼' : '📎'}</span>
              <div className="flex-1 min-w-0">
                <a href={f.url} target="_blank" rel="noopener" className="text-sm text-gray-900 hover:text-blue-600 truncate block">
                  {f.filename}
                </a>
                <div className="text-xs text-gray-400">{fmtSize(f.size)} · {f.mimeType}</div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-red-600 hover:text-red-800 text-xs px-2 py-1"
              >
                제거
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
