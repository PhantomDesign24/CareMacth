"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

export default function EducationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [completing, setCompleting] = useState(false);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressTimerRef = useRef<any>(null);
  // 부정행위 방지 indicator
  const heartbeatCountRef = useRef<number>(0);
  const lastProgressRef = useRef<number>(0);
  const [verifiedAt, setVerifiedAt] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const loadCourse = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await educationAPI.list();
      const data = res.data || {};
      const list: any[] = data.educations || [];
      const found = list.find((c) => c.id === id);
      if (!found) {
        setNotFound(true);
        return;
      }
      setCourse({
        id: found.id,
        title: found.title,
        description: found.description,
        videoUrl: found.videoUrl,
        duration: found.duration,
        order: found.order,
        progress: found.progress ?? 0,
        completed: found.completed ?? false,
        completedAt: found.completedAt ?? null,
      });
      setCurrentProgress(found.progress ?? 0);
    } catch (err: any) {
      showToast(err?.message || "교육 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const handleComplete = useCallback(async () => {
    if (!id || completing) return;
    setCompleting(true);
    try {
      await educationAPI.complete(id);
      setCourse((c) => c ? { ...c, completed: true, completedAt: new Date().toISOString() } : c);
      showToast("수료 처리가 완료되었습니다.", "success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "수료 처리에 실패했습니다.";
      showToast(msg, "error");
    } finally {
      setCompleting(false);
    }
  }, [id, completing]);

  const sendHeartbeat = useCallback(async (videoTime: number, duration: number, playing: boolean) => {
    if (!duration || duration <= 0 || !id) return;
    try {
      const res: any = await educationAPI.heartbeat(id, {
        videoTime: Math.floor(videoTime),
        duration: Math.floor(duration),
        playing,
      });
      const data = res.data?.data || res.data || {};
      if (typeof data.progress === "number") {
        const newProgress = data.progress;
        setCurrentProgress(newProgress);

        // 진도가 실제로 증가했을 때만 "검증됨" 카운트
        if (playing && newProgress > lastProgressRef.current + 0.1) {
          lastProgressRef.current = newProgress;
          heartbeatCountRef.current += 1;
          setVerifiedAt(Date.now());
          // 6회(약 30초)마다 토스트
          if (heartbeatCountRef.current % 6 === 0) {
            showToast("✓ 시청 기록이 서버에 검증·저장되었습니다", "success");
          }
        }

        if (data.completed) {
          setCourse((c) => c ? { ...c, completed: true } : c);
          if (!course?.completed) {
            showToast("강의 시청을 완료했습니다.", "success");
          }
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 2초마다 현재 시각 갱신 → verifiedAt 만료 체크용 리렌더 트리거
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  // 개발자도구 차단 (키 단축키 + 우클릭) — 일반 사용자 부정행위 문턱 상승용
  // 참고: 완전 차단은 불가능 (브라우저 메뉴·외부 프록시 우회 가능). 서버 heartbeat가 실제 방어
  useEffect(() => {
    const blockKey = (e: KeyboardEvent) => {
      const k = e.key;
      // F12
      if (k === "F12") {
        e.preventDefault();
        showToast("교육 페이지에서는 개발자 도구 단축키를 사용할 수 없습니다.", "error");
        return;
      }
      // Ctrl/Cmd + Shift + I/J/C (devtools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "J", "C"].includes(k.toUpperCase())) {
        e.preventDefault();
        showToast("교육 페이지에서는 개발자 도구 단축키를 사용할 수 없습니다.", "error");
        return;
      }
      // Ctrl/Cmd + U (view source)
      if ((e.ctrlKey || e.metaKey) && k.toUpperCase() === "U") {
        e.preventDefault();
        return;
      }
    };
    const blockContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("keydown", blockKey);
    window.addEventListener("contextmenu", blockContext);
    return () => {
      window.removeEventListener("keydown", blockKey);
      window.removeEventListener("contextmenu", blockContext);
    };
  }, []);

  // 플레이어 로드
  useEffect(() => {
    if (!course || !course.videoUrl) return;
    const videoId = extractYoutubeId(course.videoUrl);
    if (!videoId) return;

    let mounted = true;

    (async () => {
      await loadYoutubeApi();
      if (!mounted || !containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            try {
              const dur = playerRef.current.getDuration();
              const prev = (course.progress ?? 0) / 100 * dur;
              if (prev > 0 && prev < dur - 5) {
                playerRef.current.seekTo(prev, true);
              }
            } catch {}
          },
          onStateChange: (e: any) => {
            // 영상 종료 시 최종 heartbeat — 샘플링 간격으로 놓친 마지막 구간 보정
            if (e.data === window.YT.PlayerState.ENDED) {
              try {
                const dur = playerRef.current?.getDuration?.() || 0;
                const cur = playerRef.current?.getCurrentTime?.() || dur;
                if (dur > 0) {
                  // playing=true 로 전송해야 서버가 누적 처리
                  sendHeartbeat(cur, dur, true);
                }
              } catch {}
            }
          },
        },
      });

      progressTimerRef.current = setInterval(() => {
        if (!playerRef.current) return;
        try {
          const state = playerRef.current.getPlayerState?.();
          const playing = state === window.YT.PlayerState.PLAYING;
          const cur = playerRef.current.getCurrentTime?.() || 0;
          const dur = playerRef.current.getDuration?.() || 0;
          if (dur > 0) {
            sendHeartbeat(cur, dur, playing);
          }
        } catch {}
      }, 5000);
    })();

    return () => {
      mounted = false;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">교육 과정을 찾을 수 없습니다.</p>
          <button onClick={() => router.push("/dashboard/caregiver/education")} className="btn-primary">
            교육 목록으로
          </button>
        </div>
      </div>
    );
  }

  const hasVideo = !!extractYoutubeId(course.videoUrl);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* 비디오 영역 — 상단 full-bleed */}
      <div className="bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="relative aspect-video w-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:w-full [&>iframe]:h-full">
            {hasVideo ? (
              <div ref={containerRef} className="absolute inset-0 w-full h-full" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                유튜브 영상 URL이 등록되지 않은 과정입니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto px-4 py-5 sm:py-6">
        {/* 뒤로가기 + 제목 */}
        <div className="mb-4">
          <button
            onClick={() => router.push("/dashboard/caregiver/education")}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            교육 목록
          </button>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">{course.title}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <span>소요 시간 {course.duration}분</span>
                {course.completedAt && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-600 font-semibold">
                      {new Date(course.completedAt).toLocaleDateString("ko-KR")} 수료
                    </span>
                  </>
                )}
              </div>
            </div>
            {course.completed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                수료 완료
              </span>
            )}
          </div>
        </div>

        {/* 진도 카드 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-4">
          <div className="flex items-center justify-between text-sm text-gray-700 mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">시청 진도</span>
              {/* 부정행위 방지 indicator */}
              {(() => {
                const recentlyVerified = nowTick - verifiedAt < 10000; // 10초 내 heartbeat
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                      recentlyVerified
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-gray-50 text-gray-500 border border-gray-200"
                    }`}
                    title="서버에서 실제 시청 시간을 검증합니다"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${recentlyVerified ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                    {recentlyVerified ? "검증 중" : "대기"}
                  </span>
                );
              })()}
            </div>
            <span className={`font-bold tabular-nums ${currentProgress >= 80 ? "text-emerald-600" : "text-primary-600"}`}>
              {Math.floor(currentProgress)}%
              {currentProgress >= 80 && <span className="ml-2 text-[11px]">✓ 수료 가능</span>}
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${currentProgress >= 80 ? "bg-emerald-500" : "bg-primary-500"}`}
              style={{ width: `${Math.min(100, currentProgress)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            영상 재생 시 자동으로 진도가 기록됩니다. 80% 이상 시청 후 아래 버튼을 눌러 수료 처리하세요. 건너뛴 구간은 집계되지 않으며 시청 시간은 서버에서 검증됩니다.
          </p>

          {/* 수료 완료 버튼 */}
          <div className="mt-4">
            {course.completed ? (
              <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                수료 완료됨
              </div>
            ) : currentProgress >= 80 ? (
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-60"
              >
                {completing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    처리 중...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    수료 완료 처리
                  </>
                )}
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl bg-gray-50 text-gray-400 text-sm text-center">
                80% 이상 시청 시 수료 처리 가능 (현재 {Math.floor(currentProgress)}%)
              </div>
            )}
          </div>
        </div>

        {/* 설명 */}
        {course.description && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-2">강의 설명</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{course.description}</div>
          </div>
        )}
      </div>
    </div>
  );
}
