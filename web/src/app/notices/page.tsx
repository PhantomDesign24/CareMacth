"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { noticeAPI } from "@/lib/api";

interface NoticeItem {
  id: string;
  title: string;
  category: "GENERAL" | "UPDATE" | "EVENT" | "MAINTENANCE";
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: "일반",
  UPDATE: "업데이트",
  EVENT: "이벤트",
  MAINTENANCE: "점검",
};

const CATEGORY_COLOR: Record<string, string> = {
  GENERAL: "bg-gray-100 text-gray-700",
  UPDATE: "bg-blue-100 text-blue-700",
  EVENT: "bg-orange-100 text-orange-700",
  MAINTENANCE: "bg-red-100 text-red-700",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export default function NoticesPage() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    (async () => {
      try {
        const res = await noticeAPI.list({ limit: 50, ...(filter !== "ALL" && { category: filter }) });
        setItems(res.data?.data?.items || []);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="pt-14 sm:pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="mb-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">공지사항</h1>
          </div>

          {/* 카테고리 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {[
              { v: "ALL", l: "전체" },
              { v: "GENERAL", l: "일반" },
              { v: "UPDATE", l: "업데이트" },
              { v: "EVENT", l: "이벤트" },
              { v: "MAINTENANCE", l: "점검" },
            ].map((c) => (
              <button
                key={c.v}
                onClick={() => setFilter(c.v)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === c.v
                    ? "bg-primary-500 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {c.l}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400 text-sm">불러오는 중...</div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">📢</div>
                <p>등록된 공지사항이 없습니다.</p>
              </div>
            ) : (
              items.map((it) => (
                <Link
                  key={it.id}
                  href={`/notices/${it.id}`}
                  className="block p-4 sm:p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {it.isPinned && (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-600">
                        고정
                      </span>
                    )}
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOR[it.category]}`}>
                      {CATEGORY_LABEL[it.category]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 break-words">{it.title}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                        <span>{formatDate(it.createdAt)}</span>
                        <span>조회 {it.viewCount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
