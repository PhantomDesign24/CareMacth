"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FiPhone, FiMenu, FiX, FiChevronDown, FiUser, FiLogOut, FiSearch, FiBriefcase, FiHome, FiHeart, FiBell, FiLogIn, FiUserPlus, FiClock, FiChevronRight, FiSettings } from "react-icons/fi";
import { SITE } from "@/config/site";
import NotificationBell from "@/components/NotificationBell";

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  GUARDIAN: { label: "보호자", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  CAREGIVER: { label: "간병인", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  HOSPITAL: { label: "병원", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  ADMIN: { label: "관리자", color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setShowUserMenu(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      setUser(stored ? JSON.parse(stored) : null);
    } catch { setUser(null); }
  }, [pathname]);

  const handleLogout = () => {
    // 모든 토큰·사용자 캐시 정리 (refresh 토큰 남아있으면 인터셉터가 자동 재로그인함)
    localStorage.removeItem("cm_access_token");
    localStorage.removeItem("cm_refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("cm_user");
    setUser(null);
    // router.push 대신 full reload 로 모든 메모리 state·axios 캐시 초기화
    window.location.href = "/";
  };

  const getDashboardLink = () => {
    if (!user) return "/auth/login";
    switch (user.role) {
      case "ADMIN": return "/dashboard/guardian";
      case "GUARDIAN": return "/dashboard/guardian";
      case "CAREGIVER": return "/dashboard/caregiver";
      default: return "/";
    }
  };

  const roleInfo = user ? ROLE_LABELS[user.role] : null;

  // 역할별 메뉴 필터링: 비로그인/ADMIN 은 둘 다, GUARDIAN/HOSPITAL 은 "간병인 찾기"만, CAREGIVER 는 "일감 찾기"만
  const role = user?.role;
  const allNavItems = [
    { href: "/care-request", label: "간병인 찾기", icon: FiSearch, desc: "지금 간병인 매칭하기", roles: ["GUARDIAN", "HOSPITAL", "ADMIN", null] },
    { href: "/find-work", label: "간병 일감 찾기", icon: FiBriefcase, desc: "간병인이 일감 탐색", roles: ["CAREGIVER", "ADMIN", null] },
    { href: "/business", label: "병원·기업회원", icon: FiHome, desc: "기업 단체 매칭 서비스", roles: ["GUARDIAN", "HOSPITAL", "ADMIN", null] },
    { href: "/home-care", label: "방문요양", icon: FiHeart, desc: "장기요양 방문서비스", roles: ["GUARDIAN", "HOSPITAL", "ADMIN", null] },
  ];
  const navItems = allNavItems.filter((item) => item.roles.includes((role as any) || null));

  return (
    <>
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.06)]"
          : "bg-white border-b border-[#dcdcdc]"
      }`}
    >
      {/* Top bar with phone */}
      <div className="hidden md:block bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-8 text-xs">
            <div className="flex items-center gap-4">
              <span className="text-gray-400">평일 09:30~17:30 (점심 12:00~13:00)</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={`tel:${SITE.phone}`}
                className="flex items-center gap-1.5 text-primary-400 font-semibold hover:text-primary-300 transition-colors"
              >
                <FiPhone className="w-3 h-3" />
                {SITE.phone}
              </a>
              <span className="text-gray-600">|</span>
              {user ? (
                <>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${roleInfo?.color} ${roleInfo?.bg} border`}>
                    {roleInfo?.label}
                  </span>
                  <Link href={getDashboardLink()} className="hover:text-gray-300 transition-colors font-medium">
                    {user.name}님
                  </Link>
                  <button onClick={handleLogout} className="hover:text-gray-300 transition-colors">
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="hover:text-gray-300 transition-colors">
                    로그인
                  </Link>
                  <Link href="/auth/register" className="hover:text-gray-300 transition-colors">
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-[72px]">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/img/care_logo.png"
              alt="케어매치"
              width={160}
              height={40}
              className="h-8 sm:h-9 md:h-10 w-auto max-w-[120px] sm:max-w-none"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 ${
                  pathname === item.href
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href={`tel:${SITE.phone}`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary-600"
            >
              <FiPhone className="w-4 h-4" />
              {SITE.phone}
            </a>
            {user ? (
              <>
              <NotificationBell />
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold">
                    {user.name?.[0]}
                  </div>
                  <span className="text-gray-700">{user.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${roleInfo?.color} ${roleInfo?.bg} border`}>
                    {roleInfo?.label}
                  </span>
                  <FiChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                    <Link href={getDashboardLink()} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <FiUser className="w-4 h-4" /> 마이페이지
                    </Link>
                    {user.role === "ADMIN" && (
                      <>
                        <a href="/admin/" className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium">
                          <FiMenu className="w-4 h-4" /> 관리자 패널
                        </a>
                        <Link href="/dashboard/guardian" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                          <FiUser className="w-4 h-4" /> 보호자 대시보드
                        </Link>
                        <Link href="/dashboard/caregiver" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                          <FiUser className="w-4 h-4" /> 간병인 대시보드
                        </Link>
                      </>
                    )}
                    <hr className="my-1 border-gray-100" />
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                      <FiLogOut className="w-4 h-4" /> 로그아웃
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              <Link
                href="/care-request"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 transition-all shadow-md shadow-primary-500/20"
              >
                간병 신청
              </Link>
            )}
          </div>

          {/* Mobile: phone + menu button */}
          <div className="flex lg:hidden items-center gap-2">
            <a
              href={`tel:${SITE.phone}`}
              className="p-2 rounded-lg text-primary-500"
              aria-label="전화하기"
            >
              <FiPhone className="w-5 h-5" />
            </a>
            <button
              type="button"
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="메뉴 열기"
            >
              {mobileOpen ? (
                <FiX className="w-6 h-6" />
              ) : (
                <FiMenu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

    </header>

    {/* Mobile drawer (header 밖으로 빼서 stacking context 독립) */}
    <div
      className={`lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
        mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={() => setMobileOpen(false)}
      aria-hidden="true"
    />

    <aside
      className={`lg:hidden fixed top-0 right-0 bottom-0 w-[86%] max-w-sm bg-white shadow-2xl z-[70] transition-transform duration-300 ease-out flex flex-col ${
        mobileOpen ? "translate-x-0" : "translate-x-full"
      }`}
      role="dialog"
      aria-modal="true"
    >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center">
            <Image src="/img/care_logo.png" alt="케어매치" width={120} height={32} className="h-8 w-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* User section / auth CTAs */}
          {user ? (
            <div className="px-5 py-5 border-b border-gray-100 bg-gradient-to-br from-primary-50/50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center text-lg font-bold shadow-sm shadow-primary-500/30">
                  {user.name?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-gray-900 truncate">{user.name}</span>
                    {roleInfo && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${roleInfo.color} ${roleInfo.bg} border flex-shrink-0`}>
                        {roleInfo.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {user.email || user.phone || "로그인됨"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Link
                  href={getDashboardLink()}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-primary-600 bg-white border border-primary-200 hover:bg-primary-50 transition-colors"
                >
                  <FiUser className="w-4 h-4" /> 마이페이지
                </Link>
                <Link
                  href={user.role === "CAREGIVER" ? "/dashboard/caregiver?tab=notifications" : "/dashboard/guardian?tab=notifications"}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <FiBell className="w-4 h-4" /> 알림
                </Link>
              </div>
            </div>
          ) : (
            <div className="px-5 py-5 border-b border-gray-100 bg-gradient-to-br from-primary-50 to-white">
              <p className="text-sm font-semibold text-gray-900 mb-0.5">간병 매칭, 케어매치로 시작하세요</p>
              <p className="text-xs text-gray-500 mb-4">로그인하고 맞춤 서비스 이용</p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/auth/login"
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-primary-600 bg-white border border-primary-200 hover:bg-primary-50 transition-colors"
                >
                  <FiLogIn className="w-4 h-4" /> 로그인
                </Link>
                <Link
                  href="/auth/register"
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 shadow-sm shadow-primary-500/20 transition-colors"
                >
                  <FiUserPlus className="w-4 h-4" /> 회원가입
                </Link>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="px-3 py-3">
            <div className="px-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">메뉴</span>
            </div>
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                        isActive
                          ? "bg-primary-50 text-primary-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive ? "bg-primary-100 text-primary-600" : "bg-gray-100 text-gray-500"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[15px] font-semibold ${isActive ? "text-primary-600" : "text-gray-900"}`}>
                          {item.label}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">{item.desc}</div>
                      </div>
                      <FiChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Admin-only section */}
          {user?.role === "ADMIN" && (
            <div className="px-3 py-3 border-t border-gray-100">
              <div className="px-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">관리자</span>
              </div>
              <ul className="space-y-0.5">
                <li>
                  <a
                    href="/admin/"
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 hover:bg-red-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-50 text-red-500 flex-shrink-0">
                      <FiSettings className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-[15px] font-semibold text-gray-900">관리자 패널</span>
                    <FiChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </a>
                </li>
                <li>
                  <Link
                    href="/dashboard/guardian"
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 text-blue-500 flex-shrink-0">
                      <FiUser className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-[15px] font-semibold text-gray-900">보호자 대시보드</span>
                    <FiChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/caregiver"
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-50 text-green-500 flex-shrink-0">
                      <FiUser className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-[15px] font-semibold text-gray-900">간병인 대시보드</span>
                    <FiChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {/* Customer support */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
            <div className="mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">고객센터</span>
            </div>
            <a
              href={`tel:${SITE.phone}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                <FiPhone className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-gray-900">{SITE.phone}</div>
                <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                  <FiClock className="w-3 h-3" />
                  평일 09:30~17:30 (점심 12~13시)
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Drawer footer - logout for logged in users */}
        {user && (
          <div className="px-5 py-3 border-t border-gray-100 bg-white">
            <button
              onClick={() => { handleLogout(); setMobileOpen(false); }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <FiLogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>
        )}
    </aside>
    </>
  );
}
