"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FiPhone, FiMenu, FiX, FiChevronDown, FiUser, FiLogOut } from "react-icons/fi";

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
    localStorage.removeItem("cm_access_token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/");
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

  const navItems = [
    { href: "/care-request", label: "간병인 찾기" },
    { href: "/find-work", label: "간병 일감 찾기" },
    { href: "/business", label: "병원·기업회원" },
    { href: "/community", label: "커뮤니티" },
    { href: "/home-care", label: "방문요양" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.06)]"
          : "bg-white"
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
                href="tel:1555-0801"
                className="flex items-center gap-1.5 text-primary-400 font-semibold hover:text-primary-300 transition-colors"
              >
                <FiPhone className="w-3 h-3" />
                1555-0801
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
              href="tel:1555-0801"
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary-600"
            >
              <FiPhone className="w-4 h-4" />
              1555-0801
            </a>
            {user ? (
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
              href="tel:1555-0801"
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

      {/* Mobile menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? "max-h-[500px] border-t border-gray-100" : "max-h-0"
        }`}
      >
        <div className="bg-white px-4 py-3 space-y-1 shadow-xl">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-3.5 rounded-xl text-[15px] font-medium transition-colors ${
                pathname === item.href
                  ? "text-primary-600 bg-primary-50"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <hr className="my-2 border-gray-100" />
          {user ? (
            <div className="px-4 py-2 space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                  {user.name?.[0]}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${roleInfo?.color} ${roleInfo?.bg} border`}>
                    {roleInfo?.label}
                  </span>
                </div>
              </div>
              <Link href={getDashboardLink()} className="block py-3 rounded-xl text-sm font-medium text-center border border-gray-200 hover:bg-gray-50">
                마이페이지
              </Link>
              {user.role === "ADMIN" && (
                <>
                  <a href="/admin/" className="block py-3 rounded-xl text-sm font-medium text-center text-red-600 border border-red-200 hover:bg-red-50">
                    관리자 패널
                  </a>
                  <Link href="/dashboard/guardian" className="block py-3 rounded-xl text-sm font-medium text-center border border-gray-200 hover:bg-gray-50">
                    보호자 대시보드
                  </Link>
                  <Link href="/dashboard/caregiver" className="block py-3 rounded-xl text-sm font-medium text-center border border-gray-200 hover:bg-gray-50">
                    간병인 대시보드
                  </Link>
                </>
              )}
              <button onClick={handleLogout} className="w-full py-3 rounded-xl text-sm font-medium text-red-600 text-center border border-red-200 hover:bg-red-50">
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex gap-2 px-4 py-2">
              <Link
                href="/auth/login"
                className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-700 text-center border border-gray-200 hover:bg-gray-50"
              >
                로그인
              </Link>
              <Link
                href="/auth/register"
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-primary-500 text-center hover:bg-primary-600"
              >
                회원가입
              </Link>
            </div>
          )}
          <div className="px-4 py-2">
            <a
              href="tel:1555-0801"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-primary-600 bg-primary-50"
            >
              <FiPhone className="w-4 h-4" />
              상담전화 1555-0801
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
