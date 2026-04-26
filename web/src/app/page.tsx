"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiPhone,
  FiChevronDown,
  FiCheck,
  FiArrowRight,
  FiMessageCircle,
} from "react-icons/fi";
import {
  FaYoutube,
  FaBlog,
  FaInstagram,
  FaComment,
  FaApple,
  FaGooglePlay,
  FaShieldAlt,
  FaUserCheck,
  FaBrain,
  FaLayerGroup,
  FaClipboardList,
  FaSearch,
  FaHandshake,
} from "react-icons/fa";
import { SITE } from "@/config/site";

/* ------------------------------------------------------------------ */
/*  Home page                                                          */
/* ------------------------------------------------------------------ */
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <LiveDashboardSection />
      <SpecialServiceSection />
      <CareMatchTVSection />
      <HomeBannerSection />
      <PremiumFeaturesSection />
      <CareFieldsSection />
      <WhyCareMatchSection />
      <CareEducationSection />
      <AppDownloadSection />
      <FAQSection />
      <DisclaimerSection />
      <ConsultationSection />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated Counter Hook                                              */
/* ------------------------------------------------------------------ */
function useCountUp(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started, startOnView]);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return { count, ref };
}

/* ------------------------------------------------------------------ */
/*  Hero Section                                                       */
/* ------------------------------------------------------------------ */
function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();

  // 비로그인 상태면 회원가입으로, 로그인 상태면 역할 체크 후 목적 페이지
  const handleAuthRedirect = (target: string, role?: string) => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("cm_access_token");
    if (!token) {
      router.push(role ? `/auth/register?role=${role}` : "/auth/register");
      return;
    }
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const userRole = user?.role;
      // 간병 신청은 보호자/병원만
      if (target === "/care-request" && userRole && !["GUARDIAN", "HOSPITAL", "ADMIN"].includes(userRole)) {
        alert("간병 신청은 보호자 또는 병원 회원만 가능합니다.");
        return;
      }
      // 간병 일감 찾기는 간병인/관리자만
      if (target === "/find-work" && userRole && !["CAREGIVER", "ADMIN"].includes(userRole)) {
        alert("간병 일감 찾기는 간병인 회원만 가능합니다.");
        return;
      }
    } catch {}
    router.push(target);
  };

  const slides = [
    {
      type: "video" as const,
      src: "/img/main/hero_video.mp4",
      title: "인공지능 AI",
      highlight: "간병 매칭 플랫폼",
      desc: "실시간 간병 연결 서비스",
    },
    {
      type: "image" as const,
      src: "/img/main/main_bg01.png",
      title: "NO.1 케어매치",
      highlight: "매칭 전문가의 실시간 연결",
      desc: "검증된 간병인 10,000명이 대기하고 있습니다",
    },
    {
      type: "image" as const,
      src: "/img/main/main_bg02.png",
      title: "케어매치",
      highlight: "6단계 고객만족 시스템",
      desc: "체계적인 관리로 최상의 간병 서비스를 제공합니다",
    },
    {
      type: "image" as const,
      src: "/img/main/main_bg03.png",
      title: "케어매치 AI",
      highlight: "토탈 케어 플랫폼 3.0",
      desc: "AI 기술과 전문 케어코디가 함께합니다",
    },
    {
      type: "image" as const,
      src: "/img/main/main_bg04.png",
      title: "걱정없고 존중받는",
      highlight: "노후는 행복한 삶입니다",
      desc: "케어매치와 함께 편안한 간병을 시작하세요",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[currentSlide];

  return (
    <section className="relative overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center">
      {/* Background slides */}
      {slides.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === currentSlide ? "opacity-100" : "opacity-0"}`}
        >
          {s.type === "video" ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            >
              <source src={s.src} type="video/mp4" />
            </video>
          ) : (
            <img src={s.src} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>
      ))}

      {/* Slide indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentSlide ? "w-8 bg-primary-500" : "w-4 bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 w-full z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/90 text-xs sm:text-sm font-medium mb-5 sm:mb-8">
            <span className="w-2 h-2 rounded-full bg-secondary-400 animate-pulse flex-shrink-0" />
            {slide.desc}
          </div>

          {/* Main title */}
          <h1 className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.15] tracking-tight">
            {slide.title}
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 via-primary-500 to-accent-400">
              {slide.highlight}
            </span>
          </h1>

          <p className="mt-4 sm:mt-6 text-sm sm:text-lg md:text-xl text-white font-medium leading-relaxed max-w-2xl mx-auto" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
            케어매치는 환자와 간병인을 실시간으로 연결하는
            <br className="hidden sm:block" />
            대한민국 대표 AI 간병 매칭 서비스입니다.
          </p>

          {/* CTA Buttons */}
          <div className="mt-6 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => handleAuthRedirect("/care-request", "guardian")}
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-primary-500 text-white font-bold rounded-2xl text-sm sm:text-base
                         hover:bg-primary-600 transition-all duration-200 shadow-xl shadow-primary-500/30 hover:shadow-2xl hover:shadow-primary-500/40
                         w-full sm:w-auto"
            >
              간병인 찾기
              <FiArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleAuthRedirect("/find-work", "caregiver")}
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-secondary-500 text-white font-bold rounded-2xl text-sm sm:text-base
                         hover:bg-secondary-600 transition-all duration-200 shadow-xl shadow-secondary-500/30 hover:shadow-2xl hover:shadow-secondary-500/40
                         w-full sm:w-auto"
            >
              간병일감 찾기
              <FiArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* App Store Buttons */}
          <div className="mt-6 sm:mt-8 flex items-center justify-center gap-2 sm:gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2 sm:gap-2.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-white/10 backdrop-blur-sm text-white rounded-xl
                         hover:bg-white/20 transition-all duration-200 border border-white/10"
            >
              <FaApple className="w-4 sm:w-5 h-4 sm:h-5" />
              <div className="text-left">
                <div className="text-[9px] sm:text-[10px] opacity-70 leading-none">
                  Download on the
                </div>
                <div className="text-xs sm:text-sm font-semibold leading-tight">
                  App Store
                </div>
              </div>
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 sm:gap-2.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-white/10 backdrop-blur-sm text-white rounded-xl
                         hover:bg-white/20 transition-all duration-200 border border-white/10"
            >
              <FaGooglePlay className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <div className="text-left">
                <div className="text-[9px] sm:text-[10px] opacity-70 leading-none">
                  GET IT ON
                </div>
                <div className="text-xs sm:text-sm font-semibold leading-tight">
                  Google Play
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>

    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Home Banner (슬라이드 형태)                                         */
/* ------------------------------------------------------------------ */
function HomeBannerSection() {
  const router = useRouter();
  const banners = [
    {
      id: "b1",
      title: "AI 간병 매칭",
      subtitle: "10분 내 평균 매칭 완료",
      desc: "조건 입력만으로 맞춤 간병인을 즉시 추천받아보세요",
      cta: "지금 매칭 신청",
      target: "/care-request",
      role: "guardian",
      gradient: "from-primary-600 via-primary-500 to-primary-400",
      pattern: "radial-gradient(circle at 85% 20%, rgba(255,255,255,0.2), transparent 40%), radial-gradient(circle at 15% 80%, rgba(255,255,255,0.15), transparent 35%)",
      emoji: "🤝",
    },
    {
      id: "b2",
      title: "간병일감 찾으세요?",
      subtitle: "매일 새로운 공고 수백건",
      desc: "원하는 지역·조건으로 간병 일감을 바로 검색하세요",
      cta: "일감 탐색하기",
      target: "/find-work",
      role: "caregiver",
      gradient: "from-emerald-600 via-emerald-500 to-teal-400",
      pattern: "radial-gradient(circle at 75% 25%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 20% 75%, rgba(255,255,255,0.15), transparent 35%)",
      emoji: "💼",
    },
    {
      id: "b3",
      title: "3중 케어 시스템",
      subtitle: "보호자·간병인·관리자 동시 모니터링",
      desc: "실시간 간병 상태 확인 + 긴급 대응까지",
      cta: "서비스 자세히",
      target: "/home-care",
      role: undefined,
      gradient: "from-violet-600 via-purple-500 to-fuchsia-400",
      pattern: "radial-gradient(circle at 80% 30%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 15% 70%, rgba(255,255,255,0.15), transparent 35%)",
      emoji: "🛡️",
    },
    {
      id: "b4",
      title: "추천인 제도 신규 오픈",
      subtitle: "지인 초대 시 양쪽 포인트 지급",
      desc: "마이페이지 추천 코드 공유로 혜택 받아가세요",
      cta: "코드 받기",
      target: "/auth/register",
      role: undefined,
      gradient: "from-amber-500 via-orange-500 to-rose-400",
      pattern: "radial-gradient(circle at 70% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 20% 85%, rgba(255,255,255,0.15), transparent 35%)",
      emoji: "🎁",
    },
  ];

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setCurrent((c) => (c + 1) % banners.length);
    }, 5000);
    return () => clearInterval(t);
  }, [paused, banners.length]);

  const go = (target: string, role?: string) => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("cm_access_token");
    if (role && !token) {
      router.push(`/auth/register?role=${role}`);
    } else {
      router.push(target);
    }
  };

  return (
    <section className="relative py-4 sm:py-10 bg-gray-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
        <div
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg bg-gray-900 aspect-[4/3] sm:aspect-[16/7]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* 슬라이드들 */}
          {banners.map((b, i) => (
            <div
              key={b.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === current ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              <div
                className={`w-full h-full bg-gradient-to-br ${b.gradient} relative flex items-center`}
                style={{ backgroundImage: b.pattern }}
              >
                {/* 컨텐츠 */}
                <div className="relative z-10 px-5 sm:px-12 md:px-16 py-5 sm:py-10 max-w-3xl h-full flex flex-col justify-center">
                  <div className="text-4xl sm:text-6xl md:text-7xl mb-1.5 sm:mb-3 drop-shadow-lg">
                    {b.emoji}
                  </div>
                  <p className="text-white/90 text-[11px] sm:text-sm font-semibold mb-0.5 sm:mb-2 drop-shadow">
                    {b.subtitle}
                  </p>
                  <h3 className="text-white text-xl sm:text-4xl md:text-5xl font-black mb-1.5 sm:mb-3 drop-shadow-lg leading-tight">
                    {b.title}
                  </h3>
                  <p className="hidden sm:block text-white/85 text-sm sm:text-base md:text-lg font-medium mb-4 sm:mb-6 drop-shadow">
                    {b.desc}
                  </p>
                  <p className="sm:hidden text-white/85 text-xs font-medium mb-3 drop-shadow line-clamp-2">
                    {b.desc}
                  </p>
                  <button
                    type="button"
                    onClick={() => go(b.target, b.role)}
                    className="inline-flex self-start items-center gap-1.5 px-4 sm:px-7 py-2 sm:py-3.5 bg-white text-gray-900 font-bold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  >
                    {b.cta}
                    <FiArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

                {/* 우측 장식 번호 */}
                <div className="absolute top-3 right-3 sm:top-6 sm:right-8 text-white/30 font-black text-xl sm:text-4xl tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                  <span className="text-sm sm:text-xl">/{String(banners.length).padStart(2, "0")}</span>
                </div>
              </div>
            </div>
          ))}

          {/* 인디케이터 (dots) */}
          <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`슬라이드 ${i + 1}`}
                onClick={() => setCurrent(i)}
                className={`transition-all rounded-full ${
                  i === current
                    ? "w-6 h-1.5 bg-white"
                    : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>

          {/* 좌우 버튼 — 데스크톱에서만 */}
          <button
            type="button"
            aria-label="이전 슬라이드"
            onClick={() => setCurrent((c) => (c - 1 + banners.length) % banners.length)}
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="다음 슬라이드"
            onClick={() => setCurrent((c) => (c + 1) % banners.length)}
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Live Dashboard (카운터 + 실시간 현황 통합)                             */
/* ------------------------------------------------------------------ */
function LiveDashboardSection() {
  const counter1 = useCountUp(23223, 2500);
  const counter2 = useCountUp(1541, 2000);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const caregivers = [
    { name: "김영○", region: "서울 강남", exp: "5년", type: "병원간병" },
    { name: "이순○", region: "경기 성남", exp: "3년", type: "재택간병" },
    { name: "박지○", region: "서울 서초", exp: "7년", type: "병원간병" },
    { name: "정미○", region: "인천 부평", exp: "2년", type: "방문요양" },
    { name: "최윤○", region: "서울 송파", exp: "4년", type: "생활돌봄" },
    { name: "한수○", region: "경기 수원", exp: "6년", type: "병원간병" },
    { name: "강민○", region: "서울 마포", exp: "8년", type: "재택간병" },
    { name: "조은○", region: "경기 고양", exp: "1년", type: "방문요양" },
  ];
  const matches = [
    { cg: "김영○", pt: "홍○○ (68세)", type: "병원간병" },
    { cg: "이순○", pt: "박○○ (75세)", type: "재택간병" },
    { cg: "정미○", pt: "최○○ (82세)", type: "방문요양" },
    { cg: "한수○", pt: "강○○ (71세)", type: "병원간병" },
    { cg: "조은○", pt: "윤○○ (79세)", type: "생활돌봄" },
    { cg: "강민○", pt: "이○○ (66세)", type: "병원간병" },
  ];

  const off1 = tick % caregivers.length;
  const off2 = tick % matches.length;
  const visCg = [...caregivers.slice(off1), ...caregivers.slice(0, off1)].slice(0, 4);
  const visMt = [...matches.slice(off2), ...matches.slice(0, off2)].slice(0, 4);

  return (
    <section className="py-8 md:py-12 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 상단 카운터 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div ref={counter1.ref} className="rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 p-5 sm:p-8 text-white text-center">
            <p className="text-primary-100 text-xs sm:text-sm font-medium mb-1">매칭 성공사례</p>
            <p className="text-2xl sm:text-4xl md:text-5xl font-extrabold">{counter1.count.toLocaleString()}<span className="text-base sm:text-xl ml-1">건</span></p>
          </div>
          <div ref={counter2.ref} className="rounded-2xl bg-gradient-to-br from-secondary-500 to-secondary-600 p-5 sm:p-8 text-white text-center">
            <p className="text-secondary-100 text-xs sm:text-sm font-medium mb-1">진행 중 간병</p>
            <p className="text-2xl sm:text-4xl md:text-5xl font-extrabold">{counter2.count.toLocaleString()}<span className="text-base sm:text-xl ml-1">건</span></p>
          </div>
        </div>

        {/* 하단 실시간 피드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 간병인 등록 */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-secondary-500 animate-pulse" />
                <h3 className="text-sm font-bold text-gray-900">간병인 실시간 등록</h3>
              </div>
              <span className="text-xs text-secondary-600 font-bold bg-secondary-50 px-2 py-0.5 rounded-full">오늘 350명</span>
            </div>
            <div className="divide-y divide-gray-50">
              {visCg.map((c, i) => (
                <div key={`${c.name}-${tick}-${i}`} className="flex items-center justify-between px-5 py-3 text-sm" style={{animation:"fadeInUp 0.4s ease-out"}}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary-50 text-secondary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{c.name[0]}</div>
                    <div>
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-gray-300 mx-1.5">·</span>
                      <span className="text-gray-500 text-xs">{c.region}</span>
                      <span className="text-gray-300 mx-1.5">·</span>
                      <span className="text-gray-500 text-xs">{c.exp}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-secondary-50 text-secondary-600 rounded text-xs font-medium flex-shrink-0">{c.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 매칭 현황 */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                <h3 className="text-sm font-bold text-gray-900">실시간 매칭 현황</h3>
              </div>
              <span className="text-xs text-primary-600 font-bold bg-primary-50 px-2 py-0.5 rounded-full">오늘 298건</span>
            </div>
            <div className="divide-y divide-gray-50">
              {visMt.map((m, i) => (
                <div key={`${m.cg}-${tick}-${i}`} className="flex items-center justify-between px-5 py-3 text-sm" style={{animation:"fadeInUp 0.4s ease-out"}}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{m.cg[0]}</div>
                    <div>
                      <span className="text-secondary-600 font-medium">{m.cg}</span>
                      <span className="text-gray-300 mx-1.5">→</span>
                      <span className="text-primary-600 font-medium">{m.pt}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded text-xs font-medium flex-shrink-0">{m.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}




/* ------------------------------------------------------------------ */
/*  Special Service Section (특별한 지원 서비스)                          */
/* ------------------------------------------------------------------ */
function SpecialServiceSection() {
  return (
    <section className="py-10 sm:py-10 md:py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            대한민국 1등 간병 플랫폼이 제공하는 <span className="text-primary-500">특별한 지원 서비스</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {[
            { image: "/img/main/free_01.png", title: "간병 매칭료 최저가 보장", desc: "업계 최저 수수료로 부담 없이 이용하세요" },
            { image: "/img/main/free_02.png", title: "간병인 배상책임 100% 가입", desc: "만약의 사고에도 안전하게 보장됩니다" },
            { image: "/img/main/free_03.png", title: "3중 케어 시스템 운영", desc: "간병인+케어코디+지역센터장 3중 관리" },
            { image: "/img/main/free_04.png", title: "간병일지 매일 제공", desc: "매일 간병 상태를 기록하여 보호자에게 전달" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 sm:p-6 text-center shadow-sm hover:shadow-lg transition-shadow">
              <img src={s.image} alt={s.title} className="w-16 h-16 sm:w-24 sm:h-24 object-contain mx-auto mb-3 sm:mb-4" />
              <h3 className="font-bold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">{s.title}</h3>
              <p className="text-xs sm:text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  CareMatch TV Section (간병 TV / 유튜브)                              */
/* ------------------------------------------------------------------ */
function CareMatchTVSection() {
  const [activeId, setActiveId] = useState("UfDUq7wOEVM");

  const videos = [
    { id: "UfDUq7wOEVM", title: "케어매치란 무엇인가" },
    { id: "RBrbUzSNCi0", title: "간병인 매칭 과정" },
    { id: "FJpXcXWcs0Q", title: "3중 케어 시스템" },
    { id: "3Oili-noDNw", title: "환자·보호자용 영상" },
    { id: "ALsRpoy_xJ4", title: "간병인용 영상" },
  ];

  return (
    <section className="py-10 md:py-12 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white">간병 TV</h2>
          <p className="mt-2 text-gray-400">케어매치의 간병 서비스를 영상으로 만나보세요</p>
        </div>

        {/* 메인 영상 */}
        <div className="rounded-2xl overflow-hidden shadow-2xl">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              key={activeId}
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${activeId}?autoplay=0&rel=0`}
              title="케어매치 영상"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* 썸네일 목록 */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {videos.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveId(v.id)}
              className={`group relative rounded-xl overflow-hidden transition-all ${
                activeId === v.id ? "ring-2 ring-primary-500 ring-offset-2 ring-offset-gray-900" : "opacity-70 hover:opacity-100"
              }`}
            >
              <img
                src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}
                alt={v.title}
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-gray-900 border-b-[5px] border-b-transparent ml-0.5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-white text-xs font-medium truncate">{v.title}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <a href="https://www.youtube.com/@caermatch1" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors">
            <FaYoutube className="w-5 h-5" />
            케어매치 유튜브 채널 바로가기
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  6 Premium Features Section                                         */
/* ------------------------------------------------------------------ */
function PremiumFeaturesSection() {
  const features = [
    {
      image: "/img/main/serIcon01.png",
      title: "간병인 간병교육 지원",
      desc: "체계적인 교육 프로그램을 통해 전문성을 갖춘 간병인을 양성합니다.",
      bg: "bg-primary-50",
      text: "text-primary-600",
    },
    {
      image: "/img/main/serIcon02.png",
      title: "케어코디 업무 지원",
      desc: "전담 케어코디네이터가 간병 전 과정을 밀착 관리합니다.",
      bg: "bg-secondary-50",
      text: "text-secondary-600",
    },
    {
      image: "/img/main/serIcon03.png",
      title: "지역센터장 방문 지원",
      desc: "지역 센터장이 직접 방문하여 현장 케어를 점검합니다.",
      bg: "bg-blue-50",
      text: "text-blue-600",
    },
    {
      image: "/img/main/serIcon04.png",
      title: "선불 간병료 유예 지급제",
      desc: "선불 간병료를 유예하여 부담 없이 서비스를 시작할 수 있습니다.",
      bg: "bg-amber-50",
      text: "text-amber-600",
    },
    {
      image: "/img/main/serIcon05.png",
      title: "고객만족 평가 시스템 운영",
      desc: "체계적인 평가 시스템으로 서비스 품질을 지속적으로 관리합니다.",
      bg: "bg-purple-50",
      text: "text-purple-600",
    },
    {
      image: "/img/main/serIcon06.png",
      title: "간병인 포상제도 운영",
      desc: "우수 간병인에 대한 포상 제도를 통해 서비스 질을 높입니다.",
      bg: "bg-rose-50",
      text: "text-rose-600",
    },
  ];

  return (
    <section className="py-12 sm:py-8 md:py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-14">
          <p className="text-primary-500 font-semibold text-sm tracking-wider uppercase mb-3">
            Premium Care System
          </p>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            케어매치 6대 프리미엄 간병 운영 시스템
          </h2>
          <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg max-w-2xl mx-auto">
            차별화된 6가지 운영 시스템으로 최상의 간병 서비스를 제공합니다
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl p-4 sm:p-7 border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl ${f.bg} flex items-center justify-center mb-3 sm:mb-5 group-hover:scale-110 transition-transform duration-300`}
              >
                <img src={f.image} alt={f.title} className="w-7 h-7 sm:w-10 sm:h-10 object-contain" />
              </div>
              <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Care Fields Section                                                */
/* ------------------------------------------------------------------ */
function CareFieldsSection() {
  const fields = [
    { image: "/img/main/field01.jpg", title: "병원간병", desc: "입원 환자를 위한 전문 병원 간병 서비스", count: "8,200+" },
    { image: "/img/main/field02.jpg", title: "재택간병", desc: "자택에서 편안하게 받는 전문 재택 간병", count: "5,100+" },
    { image: "/img/main/field03.jpg", title: "방문요양", desc: "요양이 필요한 분들을 위한 전문 방문요양", count: "3,800+" },
    { image: "/img/main/field04.jpg", title: "생활돌봄간병", desc: "일상생활 지원이 필요한 분들을 위한 돌봄", count: "2,400+" },
  ];

  return (
    <section className="py-8 sm:py-12 md:py-14 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold">케어매치 간병 매칭 업무 분야</h2>
          <p className="mt-3 text-gray-400 text-sm sm:text-base">다양한 간병 분야에서 맞춤형 매칭 서비스를 제공합니다</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {fields.map((f, i) => (
            <div key={i} className="group relative h-52 sm:h-72 rounded-2xl overflow-hidden cursor-pointer">
              <img src={f.image} alt={f.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:from-black/90 transition-all duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                <div className="text-primary-400 text-xs font-bold mb-1">{f.count} 매칭</div>
                <h3 className="text-base sm:text-xl font-bold text-white mb-1">{f.title}</h3>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Why CareMatch Section (7 Reasons)                                  */
/* ------------------------------------------------------------------ */
function WhyCareMatchSection() {
  const reasons = [
    {
      icon: <FaSearch className="w-6 h-6" />,
      title: "편리한 간병 연결 플랫폼",
      desc: "앱과 웹에서 간편하게 간병인을 검색하고 매칭할 수 있습니다.",
    },
    {
      icon: <FaUserCheck className="w-6 h-6" />,
      title: "검증된 간병인",
      desc: "신원인증, 교육이수, 경력검증을 거친 전문 간병인만 활동합니다.",
    },
    {
      icon: <FaHandshake className="w-6 h-6" />,
      title: "1:1 맞춤형 매칭",
      desc: "환자의 상태와 요구에 맞는 최적의 간병인을 1:1로 매칭합니다.",
    },
    {
      icon: <FaShieldAlt className="w-6 h-6" />,
      title: "보험 및 교육",
      desc: "간병인 보험 가입과 전문 교육으로 안전한 간병을 보장합니다.",
    },
    {
      icon: <FaBrain className="w-6 h-6" />,
      title: "AI + 케어코디",
      desc: "인공지능 매칭과 전담 케어코디네이터의 이중 관리 시스템입니다.",
    },
    {
      icon: <FaLayerGroup className="w-6 h-6" />,
      title: "3중 케어 시스템",
      desc: "간병인-케어코디-센터장의 3중 관리로 빈틈없는 케어를 제공합니다.",
    },
    {
      icon: <FaClipboardList className="w-6 h-6" />,
      title: "간병일지",
      desc: "실시간 간병일지를 통해 환자 상태를 투명하게 확인할 수 있습니다.",
    },
  ];

  return (
    <section className="py-12 sm:py-8 md:py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-14">
          <p className="text-primary-500 font-semibold text-sm tracking-wider uppercase mb-3">
            Why CareMatch
          </p>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            케어매치를 선택해야 하는 이유
          </h2>
          <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg max-w-2xl mx-auto">
            7가지 이유로 케어매치가 최선의 선택입니다
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {reasons.map((r, i) => (
            <div
              key={i}
              className={`group bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 ${
                i === 6 ? "col-span-2 sm:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                {r.icon}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1 sm:mb-2">
                {r.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Care Education Program Section                                     */
/* ------------------------------------------------------------------ */
function CareEducationSection() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const programs = [
    { image: "/img/main/prog_01.jpg", title: "사전 심층면접", desc: "지원자의 자질과 적합성을 철저하게 검증합니다.", step: "01" },
    { image: "/img/main/prog_02.jpg", title: "직무 소양 교육", desc: "간병인의 기본 소양과 윤리를 교육합니다.", step: "02" },
    { image: "/img/main/prog_03.jpg", title: "실무 직무 교육", desc: "현장 실무 기술과 전문 지식을 교육합니다.", step: "03" },
    { image: "/img/main/prog_04.jpg", title: "재교육", desc: "정기 재교육으로 전문성을 향상시킵니다.", step: "04" },
  ];

  return (
    <section ref={sectionRef} className="py-8 sm:py-12 md:py-14 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-secondary-500 font-semibold text-sm tracking-wider uppercase mb-2">Education Program</p>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900">케어매치 간병교육 프로그램</h2>
          <p className="mt-3 text-gray-500 text-sm sm:text-base">체계적인 4단계 교육 과정으로 전문 간병인을 양성합니다</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {programs.map((p, i) => (
            <div
              key={i}
              className="group relative transition-all duration-700"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
                transitionDelay: `${i * 400}ms`,
              }}
            >
              {/* 카드 사이 화살표 (데스크탑, 마지막 제외) */}
              {i < programs.length - 1 && (
                <div
                  className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 text-primary-400 transition-all duration-500"
                  style={{
                    opacity: visible ? 1 : 0,
                    transitionDelay: `${i * 400 + 600}ms`,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )}

              <div className="rounded-2xl overflow-hidden border-2 border-gray-100 group-hover:border-primary-300 transition-colors duration-300 bg-white">
                {/* 스텝 + 이미지 */}
                <div className="relative h-36 sm:h-44 overflow-hidden">
                  <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-black/10" />
                  <div className="absolute top-3 left-3">
                    <span className="inline-block px-3 py-1 bg-primary-500 text-white text-[11px] font-bold rounded-full shadow-lg">
                      STEP {p.step}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-sm sm:text-lg font-bold text-white drop-shadow-md">{p.title}</h3>
                  </div>
                </div>
                {/* 설명 */}
                <div className="p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  24H Consultation Section                                           */
/* ------------------------------------------------------------------ */
function ConsultationSection() {
  return (
    <section className="py-8 sm:py-12 md:py-14 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-[300px] sm:w-[400px] h-[300px] sm:h-[400px] rounded-full bg-primary-500/10 blur-[100px]" />
      <div className="absolute bottom-0 left-0 w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] rounded-full bg-secondary-500/10 blur-[100px]" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-primary-500/20 text-primary-400 text-xs sm:text-sm font-semibold mb-4 sm:mb-6">
          <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
          24시간 상담 가능
        </div>

        <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white mb-3 sm:mb-4">
          전화 상담 안내
        </h2>

        <a
          href={`tel:${SITE.phone}`}
          className="inline-flex items-center gap-2 sm:gap-3 text-3xl sm:text-5xl md:text-7xl font-extrabold text-primary-400 hover:text-primary-300 transition-colors mb-6 sm:mb-8"
        >
          <FiPhone className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16" />
          {SITE.phone}
        </a>

        <p className="text-gray-400 text-sm sm:text-lg mb-6 sm:mb-10">
          평일 09:30~17:30 (점심 12:00~13:00)
          <br />
          상담 전화를 통해 빠르게 간병 서비스를 안내받으세요.
        </p>

        {/* Social links */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-10">
          <a
            href="https://www.youtube.com/@caermatch1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl hover:bg-red-600/80 transition-all duration-200 border border-white/10"
          >
            <FaYoutube className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">YouTube</span>
          </a>
          <a
            href="https://blog.naver.com/carematch11"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl hover:bg-green-600/80 transition-all duration-200 border border-white/10"
          >
            <FaBlog className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Blog</span>
          </a>
          <a
            href="https://www.instagram.com/carematch_official"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl hover:bg-pink-600/80 transition-all duration-200 border border-white/10"
          >
            <FaInstagram className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Instagram</span>
          </a>
          <a
            href="http://pf.kakao.com/_nnJxkxj"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl hover:bg-yellow-500/80 transition-all duration-200 border border-white/10"
          >
            <FaComment className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">KakaoTalk</span>
          </a>
        </div>

        {/* Online Q&A Button */}
        <Link
          href="/community"
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-primary-500 text-white font-bold rounded-2xl text-sm sm:text-base
                     hover:bg-primary-600 transition-all duration-200 shadow-xl shadow-primary-500/30"
        >
          <FiMessageCircle className="w-5 h-5" />
          온라인 상담 문의
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  App Download Section                                               */
/* ------------------------------------------------------------------ */
function AppDownloadSection() {
  return (
    <section className="py-12 sm:py-8 md:py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-14 border border-gray-100 shadow-[0_4px_30px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-10">
            <div className="flex-1 text-center md:text-left">
              <p className="text-primary-500 font-semibold text-sm tracking-wider uppercase mb-3">
                Mobile App
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
                케어매치 앱으로
                <br />더 편리하게
              </h2>
              <p className="text-sm sm:text-base text-gray-500 leading-relaxed mb-6 sm:mb-8 max-w-lg">
                케어매치 앱을 설치하면 간병 요청, 매칭 알림, 실시간 소통을 더욱
                빠르고 편리하게 이용할 수 있습니다.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                <a
                  href="#"
                  className="inline-flex items-center gap-3 px-6 py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-lg w-full sm:w-auto justify-center"
                >
                  <FaApple className="w-6 h-6" />
                  <div className="text-left">
                    <div className="text-[10px] opacity-70 leading-none">
                      Download on the
                    </div>
                    <div className="text-sm font-semibold leading-tight">
                      App Store
                    </div>
                  </div>
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-3 px-6 py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-lg w-full sm:w-auto justify-center"
                >
                  <FaGooglePlay className="w-5 h-5" />
                  <div className="text-left">
                    <div className="text-[10px] opacity-70 leading-none">
                      GET IT ON
                    </div>
                    <div className="text-sm font-semibold leading-tight">
                      Google Play
                    </div>
                  </div>
                </a>
              </div>
            </div>

            {/* Phone mockup placeholder */}
            <div className="flex-shrink-0 hidden sm:block">
              <div className="w-48 sm:w-56 h-[360px] sm:h-[420px] bg-gradient-to-b from-gray-900 to-gray-800 rounded-[2.5rem] p-3 shadow-2xl">
                <div className="w-full h-full bg-gradient-to-b from-primary-50 to-secondary-50 rounded-[2rem] flex flex-col items-center justify-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-3xl font-bold">C</span>
                  </div>
                  <p className="text-gray-900 font-bold text-lg">케어매치</p>
                  <p className="text-gray-500 text-xs">
                    AI 간병 매칭 플랫폼
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Medical Disclaimer Section                                         */
/* ------------------------------------------------------------------ */
function DisclaimerSection() {
  return (
    <section className="py-12 bg-white border-t border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-xl shrink-0">&#9888;</span>
            <div>
              <h3 className="font-bold text-amber-800 mb-2">
                의료행위 관련 안내
              </h3>
              <p className="text-sm text-amber-900 leading-relaxed">
                본 플랫폼을 통해 매칭되는 간병사는 「의료법」상 의료인이 아니며,
                의료행위를 수행할 수 없습니다. 석션, 도뇨관 삽입 및 교체, 주사,
                투약 등의 의료행위는 반드시 의료기관 또는 의료인을 통해 진행해
                주시기 바랍니다. 간병사에게 의료행위를 요청하거나 간병사가 이를
                수행할 경우, 관련 법령에 따라 보호자 및 간병사 모두에게 법적
                책임이 발생할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ Section                                                        */
/* ------------------------------------------------------------------ */
function FAQSection() {
  const faqs = [
    {
      q: "간병 요청 후 매칭까지 얼마나 걸리나요?",
      a: `AI 자동 매칭 시스템을 통해 평균 30분 이내에 조건에 맞는 간병인이 매칭됩니다. 긴급한 경우 ${SITE.phone}로 전화주시면 더 빠르게 진행됩니다.`,
    },
    {
      q: "간병비는 어떻게 결정되나요?",
      a: "간병 유형(병원간병/재택간병/방문요양/생활돌봄), 시간(24시간/시간제), 환자 상태, 지역 등에 따라 결정됩니다. 요청 시 예상 비용을 안내해 드립니다.",
    },
    {
      q: "간병인 교체가 가능한가요?",
      a: "네, 간병 시작 후에도 케어코디네이터를 통해 교체가 가능합니다. 3중 케어 시스템으로 신속하게 대체 간병인을 매칭해 드립니다.",
    },
    {
      q: "간병인의 자격은 어떻게 검증하나요?",
      a: "사전 심층면접, 신원인증, 범죄경력 조회, 자격증 확인, 직무 소양 교육 및 실무 교육을 모두 이수한 검증된 간병인만 활동합니다.",
    },
    {
      q: "케어코디네이터란 무엇인가요?",
      a: "전담 케어코디네이터가 간병 전 과정을 밀착 관리합니다. 매칭부터 간병 진행, 간병일지 확인까지 보호자님의 든든한 파트너입니다.",
    },
    {
      q: "어떤 종류의 간병 서비스를 제공하나요?",
      a: "병원간병, 재택간병, 방문요양, 생활돌봄간병 등 다양한 간병 서비스를 제공합니다. 환자의 상태와 필요에 맞는 맞춤형 서비스를 선택하실 수 있습니다.",
    },
  ];

  return (
    <section id="faq" className="py-12 sm:py-8 md:py-12 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-primary-500 font-semibold text-sm tracking-wider uppercase mb-3">
            FAQ
          </p>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            자주 묻는 질문
          </h2>
          <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg">
            궁금한 점은 아래에서 확인하세요
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.03)] hover:bg-gray-50 transition-colors">
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 sm:p-5 md:p-6 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="font-semibold text-gray-900 pr-4 text-sm sm:text-base">{question}</span>
        <span
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <FiChevronDown className="w-5 h-5" />
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-60 pb-5 md:pb-6" : "max-h-0"
        }`}
      >
        <div className="px-5 md:px-6 text-sm text-gray-600 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}
