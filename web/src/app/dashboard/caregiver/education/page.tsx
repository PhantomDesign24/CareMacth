"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { educationAPI } from "@/lib/api";
import { showToast } from "@/components/Toast";

interface Course {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  duration: number;
  order: number;
  isActive: boolean;
  record?: {
    progress: number;
    completed: boolean;
    completedAt: string | null;
  } | null;
}

// YouTube URL → video ID 추출
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

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

function loadYoutubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    const prevCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCb) prevCb();
      resolve();
    };
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
  });
}

export default function EducationPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressTimerRef = useRef<any>(null);
  const lastSavedRef = useRef<number>(0);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await educationAPI.list();
      const data = res.data || {};
      const list: any[] = data.educations || [];
      // 백엔드는 progress/completed/completedAt을 각 education에 flat하게 붙여줌
      setCourses(
        list.map((c) => ({
          ...c,
          record: {
            progress: c.progress ?? 0,
            completed: c.completed ?? false,
            completedAt: c.completedAt ?? null,
          },
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

  // 진도 저장
  const saveProgress = useCallback(async (courseId: string, progress: number) => {
    const rounded = Math.min(100, Math.max(0, Math.round(progress)));
    if (Math.abs(rounded - lastSavedRef.current) < 2) return; // 2% 이상 차이 있을 때만 저장
    lastSavedRef.current = rounded;
    try {
      await educationAPI.updateProgress(courseId, rounded);
    } catch {
      // silent — 다음 주기에 재시도
    }
  }, []);

  // 플레이어 정리
  const destroyPlayer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }
  }, []);

  // 강의 선택 시 플레이어 로드
  useEffect(() => {
    if (!activeCourse) {
      destroyPlayer();
      return;
    }
    const videoId = extractYoutubeId(activeCourse.videoUrl);
    if (!videoId) return;

    let mounted = true;
    lastSavedRef.current = activeCourse.record?.progress ?? 0;
    setCurrentProgress(activeCourse.record?.progress ?? 0);

    (async () => {
      await loadYoutubeApi();
      if (!mounted || !containerRef.current) return;
      destroyPlayer();

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            // 이전 진도만큼 탐색 (선택적)
            try {
              const dur = playerRef.current.getDuration();
              const prev = (activeCourse.record?.progress ?? 0) / 100 * dur;
              if (prev > 0 && prev < dur - 5) {
                playerRef.current.seekTo(prev, true);
              }
            } catch {}
          },
          onStateChange: (e: any) => {
            // 1=playing, 2=paused, 0=ended
            if (e.data === window.YT.PlayerState.ENDED) {
              saveProgress(activeCourse.id, 100);
              setCurrentProgress(100);
              showToast("강의 시청을 완료했습니다.", "success");
              setTimeout(() => loadCourses(), 500);
            }
          },
        },
      });

      // 5초마다 현재 재생 시간 체크
      progressTimerRef.current = setInterval(() => {
        if (!playerRef.current) return;
        try {
          const cur = playerRef.current.getCurrentTime?.() || 0;
          const dur = playerRef.current.getDuration?.() || 0;
          if (dur > 0) {
            const pct = (cur / dur) * 100;
            setCurrentProgress(pct);
            saveProgress(activeCourse.id, pct);
          }
        } catch {}
      }, 5000);
    })();

    return () => {
      mounted = false;
      destroyPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourse?.id]);

  const totalCount = courses.length;
  const completedCount = courses.filter((c) => c.record?.completed).length;

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

        {/* 재생 모달 */}
        {activeCourse && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setActiveCourse(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-gray-900 truncate">{activeCourse.title}</h3>
                  <p className="text-[11px] text-gray-500">소요 시간 {activeCourse.duration}분</p>
                </div>
                <button type="button" onClick={() => setActiveCourse(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none flex-shrink-0 ml-3">×</button>
              </div>
              <div className="p-4">
                {extractYoutubeId(activeCourse.videoUrl) ? (
                  <>
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-3">
                      <div ref={containerRef} className="absolute inset-0" />
                    </div>
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>시청 진도</span>
                        <span className="font-semibold text-primary-600 tabular-nums">
                          {Math.floor(currentProgress)}%
                          {currentProgress >= 80 && <span className="ml-2 text-emerald-600 font-bold">✓ 수료 가능</span>}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${currentProgress >= 80 ? "bg-emerald-500" : "bg-primary-500"}`}
                          style={{ width: `${Math.min(100, currentProgress)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        영상을 재생하면 자동으로 진도가 기록됩니다. 80% 이상 시청 시 수료 처리됩니다.
                      </p>
                    </div>
                    {activeCourse.description && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">
                        {activeCourse.description}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-10 text-center text-gray-400 text-sm">
                    유튜브 영상 URL이 등록되지 않은 과정입니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
              const progress = c.record?.progress ?? 0;
              const completed = c.record?.completed ?? false;
              const hasVideo = !!extractYoutubeId(c.videoUrl);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCourse(c)}
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
                    {completed && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow">
                        수료
                      </span>
                    )}
                    {hasVideo && !completed && (
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
                      {c.record?.completedAt && (
                        <>
                          <span>·</span>
                          <span>{new Date(c.record.completedAt).toLocaleDateString("ko-KR")} 수료</span>
                        </>
                      )}
                    </div>
                    {/* 진도 바 */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                        <span>진도</span>
                        <span className="tabular-nums font-semibold">{Math.floor(progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${completed ? "bg-emerald-500" : "bg-primary-500"} transition-all duration-500`}
                          style={{ width: `${Math.min(100, progress)}%` }}
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
