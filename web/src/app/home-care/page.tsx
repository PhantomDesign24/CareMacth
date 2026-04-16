"use client";

import Link from "next/link";
import { FiPhone, FiArrowRight, FiCheck } from "react-icons/fi";
import { FaHandHoldingHeart } from "react-icons/fa";
import { SITE } from "@/config/site";

export default function HomeCarePage() {
  const services = [
    {
      title: "신체활동 지원",
      items: ["세면, 구강관리 등 개인위생 관리", "식사 도움 및 영양 관리", "체위 변경, 이동 보조", "배설 도움"],
    },
    {
      title: "가사활동 지원",
      items: ["취사, 청소, 세탁 등 가사 지원", "생활필수품 구매 대행", "주거 환경 정리"],
    },
    {
      title: "인지활동 지원",
      items: ["말벗, 격려 등 정서적 지원", "인지 자극 활동", "일상생활 함께하기"],
    },
    {
      title: "외출 지원",
      items: ["병원 동행 및 진료 보조", "산책 및 외출 동행", "관공서, 은행 등 방문 보조"],
    },
  ];

  const steps = [
    { step: "01", title: "전화 상담", desc: `${SITE.phone}로 전화하시면 전문 상담원이 방문요양 서비스에 대해 안내해드립니다.` },
    { step: "02", title: "방문 상담", desc: "전담 케어코디네이터가 직접 방문하여 어르신의 상태와 필요한 서비스를 파악합니다." },
    { step: "03", title: "요양보호사 매칭", desc: "어르신의 상태와 요구에 맞는 최적의 요양보호사를 AI 시스템으로 매칭합니다." },
    { step: "04", title: "서비스 시작", desc: "매칭된 요양보호사가 가정을 방문하여 체계적인 방문요양 서비스를 제공합니다." },
  ];

  return (
    <>
      {/* Hero - Caring, warm with soft colors */}
      <section className="relative overflow-hidden min-h-[420px] flex items-center"
        style={{ background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 20%, #81C784 50%, #66BB6A 100%)" }}>
        {/* Decorative warm elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 sm:w-[400px] h-72 sm:h-[400px] rounded-full bg-white/20 blur-[80px]" />
          <div className="absolute bottom-0 left-0 w-48 sm:w-[300px] h-48 sm:h-[300px] rounded-full bg-green-200/30 blur-[60px]" />
          {/* Heart/care shapes */}
          <div className="absolute top-16 right-[15%] w-4 h-4 rounded-full bg-white/20 animate-pulse" />
          <div className="absolute bottom-24 left-[12%] w-3 h-3 rounded-full bg-white/15 animate-pulse" style={{ animationDelay: "0.8s" }} />
          <div className="absolute top-28 left-[20%] w-5 h-5 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: "1.5s" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-24 w-full">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/30 backdrop-blur-sm text-green-900 text-xs sm:text-sm font-medium mb-5">
              <FaHandHoldingHeart className="w-4 h-4" />
              방문요양 서비스
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-green-900 leading-tight">
              행복한 케어매치
              <br />
              <span className="text-white drop-shadow-md">방문요양 서비스</span>
            </h1>
            <p className="mt-4 text-sm sm:text-lg text-green-900/80 max-w-2xl mx-auto leading-relaxed">
              가정에서 편안하게 받는 전문 요양 서비스.
              <br className="hidden sm:block" />
              어르신의 일상을 따뜻하게 돌보는 케어매치 방문요양입니다.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`tel:${SITE.phone}`}
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-green-700 font-bold rounded-2xl text-sm sm:text-base hover:bg-gray-50 transition-all shadow-xl w-full sm:w-auto"
              >
                <FiPhone className="w-5 h-5" />
                전화 상담 {SITE.phone}
              </a>
              <Link
                href="/care-request"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-green-800 text-white font-bold rounded-2xl text-sm sm:text-base hover:bg-green-900 transition-all w-full sm:w-auto"
              >
                방문요양 신청하기
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What is Home Care */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              방문요양 서비스란?
            </h2>
            <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg max-w-3xl mx-auto leading-relaxed">
              장기요양등급을 받은 어르신의 가정을 요양보호사가 직접 방문하여
              신체활동, 가사활동, 인지활동 등을 지원하는 서비스입니다.
              익숙한 환경에서 편안하게 돌봄을 받을 수 있어 어르신과 가족 모두에게 좋습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {services.map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-5 sm:p-7 border border-gray-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">{s.title}</h3>
                <ul className="space-y-2 sm:space-y-2.5">
                  {s.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiCheck className="w-3 h-3" />
                      </div>
                      <span className="text-sm text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              이용 절차
            </h2>
            <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg">
              간단한 4단계로 방문요양 서비스를 시작하실 수 있습니다
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] text-center relative z-10">
                  <div className="text-xs font-bold text-green-600 tracking-widest mb-2 sm:mb-3">
                    STEP {s.step}
                  </div>
                  <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">{s.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 z-20 -translate-y-1/2 text-gray-300">
                    <FiArrowRight className="w-6 h-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16" style={{ background: "linear-gradient(135deg, #66BB6A 0%, #4CAF50 100%)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4">
            방문요양 서비스가 필요하신가요?
          </h2>
          <p className="text-green-100 text-sm sm:text-base mb-6 sm:mb-8">
            지금 바로 전화 상담을 통해 맞춤형 방문요양 서비스를 안내받으세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href={`tel:${SITE.phone}`}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-green-700 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-xl w-full sm:w-auto justify-center"
            >
              <FiPhone className="w-5 h-5" />
              {SITE.phone}
            </a>
            <Link
              href="/care-request"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-green-800 text-white font-bold rounded-2xl hover:bg-green-900 transition-all w-full sm:w-auto justify-center"
            >
              온라인 신청하기
              <FiArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
