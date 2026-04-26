"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { noticeAPI } from "@/lib/api";

interface NoticeAttachment {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
  attachments?: NoticeAttachment[] | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: "일반", UPDATE: "업데이트", EVENT: "이벤트", MAINTENANCE: "점검",
};

const CATEGORY_COLOR: Record<string, string> = {
  GENERAL: "bg-gray-100 text-gray-700",
  UPDATE: "bg-blue-100 text-blue-700",
  EVENT: "bg-orange-100 text-orange-700",
  MAINTENANCE: "bg-red-100 text-red-700",
};

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await noticeAPI.detail(id);
        setNotice(res.data?.data || null);
      } catch (e: any) {
        setError(e?.response?.data?.message || "공지를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-14 sm:pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-4">
          <Link href="/notices" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            ← 공지사항 목록
          </Link>

          {loading ? (
            <div className="bg-white rounded-xl p-12 text-center text-gray-400">불러오는 중...</div>
          ) : error || !notice ? (
            <div className="bg-white rounded-xl p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">⚠</div>
              <p>{error || "공지사항을 찾을 수 없습니다."}</p>
              <button
                onClick={() => router.push("/notices")}
                className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm"
              >
                목록으로
              </button>
            </div>
          ) : (
            <article className="bg-white rounded-xl p-6 sm:p-8 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                {notice.isPinned && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-600">
                    고정
                  </span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOR[notice.category]}`}>
                  {CATEGORY_LABEL[notice.category]}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{notice.title}</h1>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 pb-4 border-b border-gray-100">
                <span>{new Date(notice.createdAt).toLocaleDateString("ko-KR")}</span>
                <span>조회 {notice.viewCount.toLocaleString()}</span>
              </div>
              <div
                className="mt-6 text-gray-800 leading-relaxed break-words notice-content"
                style={{ wordBreak: "break-word" }}
                dangerouslySetInnerHTML={{ __html: notice.content }}
              />

              {/* 첨부 파일 */}
              {notice.attachments && notice.attachments.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="text-sm font-semibold text-gray-700 mb-3">📎 첨부 파일 ({notice.attachments.length})</div>
                  <ul className="space-y-2">
                    {notice.attachments.map((f, i) => (
                      <li key={i}>
                        <a
                          href={f.url}
                          download={f.filename}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-xl">{f.mimeType?.startsWith('image/') ? '🖼' : '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 font-medium truncate">{f.filename}</div>
                            <div className="text-xs text-gray-400">
                              {f.size < 1024 ? `${f.size}B` : f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${(f.size / 1024 / 1024).toFixed(1)}MB`}
                            </div>
                          </div>
                          <span className="text-xs text-blue-600 shrink-0">다운로드 ↓</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
