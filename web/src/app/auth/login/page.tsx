"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session") {
      setSessionNotice("세션이 종료되었거나 계정 권한이 변경되었습니다. 다시 로그인해주세요.");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "로그인에 실패했습니다.");
        return;
      }
      localStorage.setItem("cm_access_token", data.data.access_token || data.data.token);
      if (data.data.refresh_token) {
        localStorage.setItem("cm_refresh_token", data.data.refresh_token);
      }
      localStorage.setItem("user", JSON.stringify(data.data.user));
      const role = data.data.user.role;
      if (role === "ADMIN") {
        window.location.href = "/dashboard/guardian";
      } else if (role === "GUARDIAN") {
        window.location.href = "/dashboard/guardian";
      } else if (role === "CAREGIVER") {
        window.location.href = "/dashboard/caregiver";
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              Care<span className="text-primary-500">Match</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          <p className="text-gray-500 mt-1">케어매치에 오신 것을 환영합니다</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {sessionNotice && !error && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
                {sessionNotice}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
              <input
                type="text"
                className="input-field"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-12"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-400 flex-shrink-0"
                />
                <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">로그인 유지</span>
              </label>
              <Link href="/auth/forgot-password" className="text-xs sm:text-sm text-primary-600 hover:underline whitespace-nowrap">
                비밀번호 찾기
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  로그인 중...
                </span>
              ) : (
                "로그인"
              )}
            </button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID || "";
                const redirectUri = `${window.location.origin}/auth/kakao/callback`;
                if (!clientId) {
                  setError("NEXT_PUBLIC_KAKAO_CLIENT_ID 환경변수가 설정되지 않았습니다.");
                  return;
                }
                const url = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=account_email,profile_nickname,phone_number`;
                window.location.href = url;
              }}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-medium transition-colors text-sm hover:opacity-90"
              style={{ backgroundColor: "#FEE500", color: "#191919" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.48 3 2 6.58 2 10.94c0 2.8 1.87 5.27 4.68 6.67-.2.77-.74 2.8-.85 3.24-.13.55.2.54.43.39.17-.12 2.77-1.88 3.89-2.65.59.09 1.2.13 1.85.13 5.52 0 10-3.58 10-7.78S17.52 3 12 3z" />
              </svg>
              카카오로 로그인
            </button>

            <button
              type="button"
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || "";
                const redirectUri = `${window.location.origin}/auth/naver/callback`;
                if (!clientId) {
                  setError("NEXT_PUBLIC_NAVER_CLIENT_ID 환경변수가 설정되지 않았습니다.");
                  return;
                }
                const state = Math.random().toString(36).slice(2);
                sessionStorage.setItem("naver_oauth_state", state);
                const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
                window.location.href = url;
              }}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-medium transition-colors text-sm text-white hover:opacity-90"
              style={{ backgroundColor: "#03C75A" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
              </svg>
              네이버로 로그인
            </button>
          </div>
        </div>

        {/* Register link */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-gray-500">
            아직 회원이 아니신가요?{" "}
            <Link href="/auth/register" className="text-primary-600 font-semibold hover:underline">
              회원가입
            </Link>
          </p>
          <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs text-gray-400">
            <Link href="/auth/register?role=guardian" className="hover:text-primary-500 transition-colors whitespace-nowrap">
              보호자 가입
            </Link>
            <span>|</span>
            <Link href="/auth/register?role=caregiver" className="hover:text-primary-500 transition-colors whitespace-nowrap">
              간병인 가입
            </Link>
            <span>|</span>
            <Link href="/auth/register?role=hospital" className="hover:text-primary-500 transition-colors whitespace-nowrap">
              병원 가입
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
