"use client";

import "./globals.css";
import Sidebar from "@/components/Sidebar";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import { useState, useEffect, useCallback } from "react";
import { getToken, setToken, clearToken, login } from "@/lib/api";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { ADMIN_SITE } from "@/config/site";

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.token) {
        // 관리자 권한 확인
        if (res.user?.role !== "ADMIN") {
          setError("관리자 권한이 없는 계정입니다.");
          return;
        }
        setToken(res.token);
        // 홈페이지와 user 정보 공유
        localStorage.setItem("user", JSON.stringify(res.user));
        onLogin(res.token);
      } else {
        setError("로그인 응답에 토큰이 없습니다.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-xl font-bold text-white">
            CM
          </div>
          <h1 className="text-2xl font-bold text-gray-900">케어매치 관리자</h1>
          <p className="mt-2 text-sm text-gray-500">관리자 계정으로 로그인해주세요.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">아이디</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="아이디 입력"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="비밀번호 입력"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                로그인 중...
              </span>
            ) : (
              "로그인"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function MobileHeader() {
  const { toggleMobile } = useSidebar();
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md lg:hidden">
      <button
        onClick={toggleMobile}
        className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        aria-label="메뉴 열기"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-xs font-bold text-white">
          CM
        </div>
        <span className="text-sm font-bold text-gray-900">케어매치</span>
      </div>
    </div>
  );
}

function AuthenticatedLayout({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout: () => void;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar onLogout={onLogout} />
        <main className="ml-0 flex-1 overflow-x-hidden lg:ml-64">
          {/* Mobile header with hamburger */}
          <MobileHeader />
          {/* Desktop top bar */}
          <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md sm:px-8 lg:flex">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-800">케어매치 관리자</h2>
            </div>
            <div className="flex items-center gap-4">
              <AdminNotificationBell />
              {/* Date */}
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </span>
            </div>
          </header>
          {/* Content */}
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthenticated(false);
      return;
    }
    // ADMIN 역할 확인 — admin 패널은 ADMIN만 접근 가능
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      if (user?.role !== "ADMIN") {
        clearToken();
        setAuthenticated(false);
        return;
      }
      setAuthenticated(true);
    } catch {
      clearToken();
      setAuthenticated(false);
    }
  }, []);

  const handleLogin = useCallback((token: string) => {
    setToken(token);
    setAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setAuthenticated(false);
  }, []);

  // Still checking auth state
  if (authenticated === null) {
    return (
      <html lang="ko">
        <AdminHead />
        <body>
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
              <p className="text-sm text-gray-500">로딩 중...</p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  if (!authenticated) {
    return (
      <html lang="ko">
        <AdminHead />
        <body>
          <LoginForm onLogin={handleLogin} />
        </body>
      </html>
    );
  }

  return (
    <html lang="ko">
      <AdminHead />
      <body>
        <AuthenticatedLayout onLogout={handleLogout}>
          {children}
        </AuthenticatedLayout>
      </body>
    </html>
  );
}

function AdminHead() {
  return (
    <head>
      <title>{ADMIN_SITE.title}</title>
      <meta name="description" content={ADMIN_SITE.description} />
      <meta name="robots" content="noindex, nofollow" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/admin/favicon.ico" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
    </head>
  );
}
