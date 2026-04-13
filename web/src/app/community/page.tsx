"use client";

import Link from "next/link";
import { FiPhone, FiArrowRight, FiMessageCircle, FiHelpCircle, FiBell, FiBook } from "react-icons/fi";

export default function CommunityPage() {
  const sections = [
    {
      icon: <FiHelpCircle className="w-7 h-7" />,
      title: "고객센터",
      desc: "간병 서비스 이용 중 궁금한 점이나 불편한 사항을 문의해주세요. 전담 상담원이 신속하게 답변드립니다.",
      link: "tel:1555-0801",
      linkText: "전화 상담 1555-0801",
      color: "primary",
    },
    {
      icon: <FiBell className="w-7 h-7" />,
      title: "공지사항",
      desc: "케어매치의 최신 소식, 서비스 변경사항, 이벤트 안내 등을 확인하실 수 있습니다.",
      link: "#",
      linkText: "공지사항 보기",
      color: "secondary",
    },
    {
      icon: <FiMessageCircle className="w-7 h-7" />,
      title: "FAQ (자주 묻는 질문)",
      desc: "이용 방법, 요금, 간병인 자격 등 자주 묻는 질문에 대한 답변을 확인하세요.",
      link: "/#faq",
      linkText: "FAQ 바로가기",
      color: "blue",
    },
    {
      icon: <FiBook className="w-7 h-7" />,
      title: "간병교육자료",
      desc: "간병인을 위한 교육 자료와 매뉴얼을 제공합니다. 전문 간병 교육 프로그램에 대해 알아보세요.",
      link: "#",
      linkText: "교육자료 보기",
      color: "purple",
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    primary: { bg: "bg-primary-50", text: "text-primary-600", border: "border-primary-100" },
    secondary: { bg: "bg-secondary-50", text: "text-secondary-600", border: "border-secondary-100" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" },
  };

  return (
    <>
      {/* Hero - Warm, inviting with mint/teal accent */}
      <section className="relative overflow-hidden min-h-[350px] flex items-center"
        style={{ background: "linear-gradient(135deg, #37CEB3 0%, #2DB89F 40%, #20A88E 70%, #37CEB3 100%)" }}>
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 sm:w-[400px] h-72 sm:h-[400px] rounded-full bg-white/10 blur-[80px]" />
          <div className="absolute bottom-0 left-[10%] w-48 sm:w-[250px] h-48 sm:h-[250px] rounded-full bg-teal-300/15 blur-[60px]" />
          {/* Community feel - speech bubble shapes */}
          <div className="absolute top-12 left-[8%] w-16 h-16 rounded-2xl rounded-bl-sm bg-white/[0.07] rotate-12" />
          <div className="absolute bottom-16 right-[12%] w-12 h-12 rounded-2xl rounded-br-sm bg-white/[0.05] -rotate-6" />
          <div className="absolute top-20 right-[20%] w-8 h-8 rounded-full bg-white/[0.08]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 w-full text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs sm:text-sm font-medium mb-5">
            <FiMessageCircle className="w-3.5 h-3.5" />
            함께 나누는 공간
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
            케어매치
            <br />
            <span className="text-teal-100">커뮤니티</span>
          </h1>
          <p className="mt-4 text-sm sm:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed">
            케어매치의 다양한 소통 채널을 통해
            <br className="block sm:hidden" />
            궁금한 점을 해결하고 최신 소식을 확인하세요.
          </p>
        </div>
      </section>

      {/* Main Sections */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {sections.map((s, i) => {
              const colors = colorMap[s.color];
              return (
                <div
                  key={i}
                  className={`rounded-2xl p-6 sm:p-8 border ${colors.border} ${colors.bg} transition-all duration-300 hover:shadow-lg`}
                >
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white ${colors.text} flex items-center justify-center mb-4 sm:mb-5 shadow-sm`}>
                    {s.icon}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4 sm:mb-5">{s.desc}</p>
                  <a
                    href={s.link}
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold ${colors.text} hover:underline`}
                  >
                    {s.linkText}
                    <FiArrowRight className="w-4 h-4" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Forum Coming Soon */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-2xl p-8 sm:p-10 border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4 sm:mb-5">
              <FiMessageCircle className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">커뮤니티 포럼 준비 중</h3>
            <p className="text-sm sm:text-base text-gray-500 leading-relaxed mb-6">
              간병인과 보호자가 서로 경험을 나누고 정보를 교류할 수 있는
              <br className="hidden sm:block" />
              커뮤니티 포럼이 곧 오픈 예정입니다.
            </p>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-50 text-primary-600 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
              Coming Soon
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-12 sm:py-16 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4">
            도움이 필요하신가요?
          </h2>
          <p className="text-sm sm:text-base text-gray-400 mb-5 sm:mb-6">
            전화 상담 또는 카카오톡을 통해 빠르게 문의하실 수 있습니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href="tel:1555-0801"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all shadow-xl w-full sm:w-auto justify-center"
            >
              <FiPhone className="w-5 h-5" />
              1555-0801
            </a>
            <a
              href="http://pf.kakao.com/_nnJxkxj"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-yellow-400 text-gray-900 font-bold rounded-2xl hover:bg-yellow-300 transition-all shadow-xl w-full sm:w-auto justify-center"
            >
              카카오톡 상담
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
