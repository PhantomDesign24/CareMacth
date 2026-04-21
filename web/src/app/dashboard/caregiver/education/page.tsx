"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { educationAPI } from "@/lib/api";
import { showToast } from "@/components/Toast";

interface Course {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  duration: number;
  order: number;
  progress: number;
  completed: boolean;
  completedAt: string | null;
}

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?[^#]*v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function EducationListPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await educationAPI.list();
      const data = res.data || {};
      const list: any[] = data.educations || [];
      setCourses(
        list.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          videoUrl: c.videoUrl,
          duration: c.duration,
          order: c.order,
          progress: c.progress ?? 0,
          completed: c.completed ?? false,
          completedAt: c.completedAt ?? null,
        }))
      );
    } catch (err: any) {
      showToast(err?.message || "교육 과정을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const totalCount = courses.length;
  const completedCount = courses.filter((c) => c.completed).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-primary-50/30 via-gray-50 to-gray-50 py-4 sm:py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">교육 센터</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalCount > 0
                ? `총 ${totalCount}개 과정 · ${completedCount}개 수료`
                : "등록된 교육 과정이 없습니다."}
            </p>
          </div>
          <Link
            href="/dashboard/caregiver"
            className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            ← 대시보드
          </Link>
        </div>

        {/* 과정 카드 목록 */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-gray-100">
            <p className="text-sm text-gray-400">현재 제공 중인 교육 과정이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {courses.map((c) => {
              const hasVideo = !!extractYoutubeId(c.videoUrl);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => hasVideo && router.push(`/dashboard/caregiver/education/${c.id}`)}
                  disabled={!hasVideo}
                  className={`group text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all ${
                    hasVideo ? "hover:border-primary-300 hover:shadow-md cursor-pointer" : "opacity-60 cursor-not-allowed"
                  }`}
                >
                  {/* 썸네일 */}
                  <div className="relative aspect-video bg-gray-900 overflow-hidden">
                    {hasVideo ? (
                      <img
                        src={`https://img.youtube.com/vi/${extractYoutubeId(c.videoUrl)}/mqdefault.jpg`}
                        alt={c.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">영상 없음</div>
                    )}
                    {c.completed && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow">
                        수료
                      </span>
                    )}
                    {hasVideo && !c.completed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <svg className="w-5 h-5 text-primary-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 정보 */}
                  <div className="p-3.5">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2 mb-1">{c.title}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-2">
                      <span>{c.duration}분</span>
                      {c.completedAt && (
                        <>
                          <span>·</span>
                          <span>{new Date(c.completedAt).toLocaleDateString("ko-KR")} 수료</span>
                        </>
                      )}
                    </div>
                    {/* 진도 바 */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                        <span>진도</span>
                        <span className="tabular-nums font-semibold">{Math.floor(c.progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${c.completed ? "bg-emerald-500" : "bg-primary-500"} transition-all duration-500`}
                          style={{ width: `${Math.min(100, c.progress)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
