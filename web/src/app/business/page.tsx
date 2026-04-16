"use client";

import { useState } from "react";
import Link from "next/link";
import { FiPhone, FiCheck, FiMail, FiArrowRight } from "react-icons/fi";
import { FaHospital, FaBuilding, FaHandshake } from "react-icons/fa";
import { SITE } from "@/config/site";

export default function BusinessPage() {
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    type: "hospital",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const partnerTypes = [
    {
      icon: <FaHospital className="w-8 h-8" />,
      title: "병원",
      desc: "입원 환자를 위한 간병인 매칭 파트너십을 제공합니다. 병원 내 간병 서비스의 품질 관리와 효율적인 운영을 지원합니다.",
    },
    {
      icon: <FaBuilding className="w-8 h-8" />,
      title: "기업",
      desc: "직원 복지 프로그램의 일환으로 간병 서비스를 제공합니다. 기업 맞춤형 간병 서비스 패키지를 구성해 드립니다.",
    },
    {
      icon: <FaHandshake className="w-8 h-8" />,
      title: "기관/단체",
      desc: "지자체, 복지관, 요양시설 등과의 협력을 통해 지역사회 간병 서비스의 질을 높입니다.",
    },
  ];

  const benefits = [
    "전문 교육을 이수한 검증된 간병인 매칭",
    "24시간 전담 케어코디 배정",
    "실시간 간병일지 및 현황 리포트 제공",
    "맞춤형 요금 체계 및 정산 시스템",
    "긴급 대체 간병인 즉시 배정",
    "정기 서비스 품질 보고서 제공",
  ];

  return (
    <>
      {/* Hero - Professional dark blue/navy */}
      <section className="relative overflow-hidden min-h-[420px] flex items-center"
        style={{ background: "linear-gradient(135deg, #0F1B3D 0%, #1A2E5A 40%, #0D1A35 100%)" }}>
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 sm:w-[400px] h-72 sm:h-[400px] rounded-full bg-[#FF922E]/10 blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-48 sm:w-[300px] h-48 sm:h-[300px] rounded-full bg-[#37CEB3]/10 blur-[80px]" />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-24 w-full">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 text-xs sm:text-sm font-medium mb-5 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-[#FF922E] animate-pulse" />
              병원 / 기업회원
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
              병원&middot;기업
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF922E] to-[#FFB347]">담당자님!</span>
            </h1>
            <p className="mt-4 text-sm sm:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
              케어매치와 함께 체계적이고 전문적인
              <br className="block sm:hidden" />
              간병 서비스를 제공하세요.
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {["검증된 간병인 10,000+", "24시간 운영", "보험 100% 가입"].map((badge, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/10 backdrop-blur-sm">
                  <FiCheck className="w-3.5 h-3.5 text-[#37CEB3]" />
                  <span className="text-white/90 text-xs sm:text-sm font-medium">{badge}</span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <a
                href={`tel:${SITE.phone}`}
                className="inline-flex items-center gap-2 sm:gap-3 text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#FF922E] hover:text-[#FFB347] transition-colors"
              >
                <FiPhone className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" />
                {SITE.phone}
              </a>
              <p className="mt-2 text-gray-400 text-xs sm:text-sm">평일 09:30~17:30 (점심 12:00~13:00)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Types */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              파트너 유형
            </h2>
            <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg">
              다양한 기관과의 맞춤형 파트너십을 제공합니다
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {partnerTypes.map((p, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 text-center"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4 sm:mb-5">
                  {p.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              파트너십 혜택
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-4 sm:p-5 border border-gray-100">
                <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FiCheck className="w-3.5 h-3.5" />
                </div>
                <p className="text-sm sm:text-base text-gray-700 font-medium">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              제휴 문의
            </h2>
            <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-lg">
              아래 양식을 작성해주시면 담당자가 빠르게 연락드리겠습니다
            </p>
          </div>

          {submitted ? (
            <div className="bg-primary-50 border border-primary-200 rounded-2xl p-6 sm:p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-4">
                <FiCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">제휴 문의가 접수되었습니다</h3>
              <p className="text-sm sm:text-base text-gray-600">
                담당자가 확인 후 연락드리겠습니다.
                <br />
                빠른 상담은 <strong>{SITE.phone}</strong>로 전화해주세요.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">기관명</label>
                  <input
                    type="text"
                    required
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition text-sm sm:text-base"
                    placeholder="병원/기업명"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">담당자명</label>
                  <input
                    type="text"
                    required
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition text-sm sm:text-base"
                    placeholder="담당자 성함"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">연락처</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition text-sm sm:text-base"
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition text-sm sm:text-base"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">기관 유형</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition text-sm sm:text-base"
                >
                  <option value="hospital">병원</option>
                  <option value="enterprise">기업</option>
                  <option value="institution">기관/단체</option>
                  <option value="other">기타</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">문의 내용</label>
                <textarea
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition resize-y text-sm sm:text-base"
                  placeholder="파트너십에 대해 궁금하신 점을 자유롭게 작성해주세요."
                />
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 sm:py-4 bg-primary-500 text-white font-bold rounded-2xl text-sm sm:text-base hover:bg-primary-600 transition-all shadow-lg"
              >
                제휴 문의하기
                <FiArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
