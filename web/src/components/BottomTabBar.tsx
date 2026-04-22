"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiHome, FiSearch, FiClipboard, FiUser, FiBell, FiBriefcase } from "react-icons/fi";

interface UserInfo {
  id: string;
  role: string;
  name?: string;
}

export default function BottomTabBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const token = localStorage.getItem("cm_access_token");
      const stored = localStorage.getItem("user");
      if (token && stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      setUser(null);
    }
  }, [pathname]);

  if (!mounted || !user) return null;

  // ADMIN은 웹 탭바 숨김 (관리자 패널 별도)
  if (user.role === "ADMIN") return null;

  const role = user.role;
  const isGuardian = role === "GUARDIAN" || role === "HOSPITAL";
  const isCaregiver = role === "CAREGIVER";

  // 역할별 탭 구성
  const tabs = isGuardian
    ? [
        { href: "/", label: "홈", icon: FiHome },
        { href: "/care-request", label: "간병 신청", icon: FiClipboard },
        { href: "/dashboard/guardian?tab=history", label: "내 이력", icon: FiBriefcase },
        { href: "/dashboard/guardian?tab=notifications", label: "알림", icon: FiBell },
        { href: "/dashboard/guardian?tab=settings", label: "마이", icon: FiUser },
      ]
    : isCaregiver
    ? [
        { href: "/", label: "홈", icon: FiHome },
        { href: "/find-work", label: "일감 찾기", icon: FiSearch },
        { href: "/dashboard/caregiver?tab=activity", label: "내 활동", icon: FiBriefcase },
        { href: "/dashboard/caregiver?tab=notifications", label: "알림", icon: FiBell },
        { href: "/dashboard/caregiver?tab=settings", label: "마이", icon: FiUser },
      ]
    : [];

  if (tabs.length === 0) return null;

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (path === "/") return pathname === "/";
    if (pathname === path) {
      // tab 쿼리가 있는 경우도 매칭 (간단히 path 만 검사)
      return true;
    }
    return pathname.startsWith(path + "/");
  };

  return (
    <>
      {/* 페이지 하단 여백 보정 (탭바 높이만큼) — lg 이하만 적용 */}
      <div className="h-16 lg:hidden" aria-hidden="true" />

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="하단 네비게이션"
      >
        <div className="flex items-stretch h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-primary-600" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.4]" : "stroke-[1.8]"}`} />
                <span className={`text-[10px] font-semibold ${active ? "text-primary-600" : "text-gray-500"}`}>
                  {tab.label}
                </span>
                {active && <span className="absolute top-0 w-10 h-0.5 bg-primary-500 rounded-b-full" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
