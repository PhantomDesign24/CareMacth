"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifyAppLogin } from "@/lib/api";

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
        // 계정 열거 차단 — 백엔드 메시지 그대로 노출하지 않고 일반화 (서버 로그에는 상세 남아있음)
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      const accessToken = data.data.access_token || data.data.token;
      localStorage.setItem("cm_access_token", accessToken);
      if (data.data.refresh_token) {
        localStorage.setItem("cm_refresh_token", data.data.refresh_token);
      }
      localStorage.setItem("user", JSON.stringify(data.data.user));
      localStorage.setItem("cm_user", JSON.stringify(data.data.user));
      // WebView 앱일 경우 네이티브에 로그인 이벤트 전달 → FCM 토큰을 해당 유저에 연결
      notifyAppLogin(data.data.user, accessToken);
      const role = data.data.user.role;
      if (role === "ADMIN") {
        // 어드민 패널이 별도 'token' key 를 쓰므로 동기화만 해두고, 리디렉션은 보호자 대시보드
        // (관리자가 직접 /admin 진입 시 토큰 인식되도록)
        localStorage.setItem("token", accessToken);
        localStorage.setItem("admin_user", JSON.stringify(data.data.user));
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

  // 백엔드 /auth/* 응답 공통 후처리 (kakao/naver 콜백과 동일 규칙)
  const handleSocialAuthResult = (data: any, provider: string) => {
    if (!data.success) {
      if (data.code === "PROVIDER_CONFLICT") {
        setError(data.message || "이미 다른 방식으로 가입된 계정입니다. 해당 방식으로 로그인해주세요.");
        return;
      }
      setError(data.message || `${provider} 로그인 처리에 실패했습니다.`);
      return;
    }
    // 기존 사용자 → 토큰 저장 후 대시보드
    if (data.data.access_token) {
      localStorage.setItem("cm_access_token", data.data.access_token);
      if (data.data.refresh_token) localStorage.setItem("cm_refresh_token", data.data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      localStorage.setItem("cm_user", JSON.stringify(data.data.user));
      notifyAppLogin(data.data.user, data.data.access_token);
      const role = data.data.user.role;
      if (role === "GUARDIAN" || role === "ADMIN") window.location.href = "/dashboard/guardian";
      else if (role === "CAREGIVER") window.location.href = "/dashboard/caregiver";
      else window.location.href = "/";
      return;
    }
    // 신규 사용자 → 가입 페이지로 프리필
    if (data.data.isNew) {
      try {
        sessionStorage.setItem("cm_signup_payload", JSON.stringify({
          provider,
          signupToken: data.data.signupToken || "",
          email: data.data.email || "",
          name: data.data.name || "",
          phone: data.data.phone || "",
          ts: Date.now(),
        }));
      } catch {}
      router.replace(`/auth/register?social=${provider}`);
      return;
    }
    setError("알 수 없는 응답입니다.");
  };

  // Apple JS SDK 동적 로드
  const loadAppleSDK = (): Promise<any> =>
    new Promise((resolve, reject) => {
      const w = window as any;
      if (w.AppleID?.auth) return resolve(w.AppleID);
      const existing = document.getElementById("apple-signin-sdk");
      if (existing) {
        existing.addEventListener("load", () => resolve((window as any).AppleID));
        existing.addEventListener("error", reject);
        return;
      }
      const s = document.createElement("script");
      s.id = "apple-signin-sdk";
      s.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
      s.async = true;
      s.onload = () => resolve((window as any).AppleID);
      s.onerror = reject;
      document.head.appendChild(s);
    });

  const handleAppleLogin = async () => {
    setError("");
    const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "";
    if (!clientId) {
      setError("NEXT_PUBLIC_APPLE_CLIENT_ID 환경변수가 설정되지 않았습니다.");
      return;
    }
    try {
      const AppleID = await loadAppleSDK();
      AppleID.auth.init({
        clientId,
        scope: "name email",
        redirectURI: `${window.location.origin}/auth/login`,
        usePopup: true,
      });
      const result = await AppleID.auth.signIn();
      const identityToken = result?.authorization?.id_token;
      if (!identityToken) {
        setError("애플 인증 토큰을 받지 못했습니다.");
        return;
      }
      // 애플은 최초 1회만 이름 제공 → 합쳐서 전달
      const u = result?.user;
      const name = u?.name ? `${u.name.lastName || ""}${u.name.firstName || ""}`.trim() || undefined : undefined;
      const res = await fetch("/api/auth/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityToken, name }),
      });
      const data = await res.json();
      handleSocialAuthResult(data, "apple");
    } catch (err: any) {
      // 사용자가 팝업을 닫은 경우(popup_closed) 는 조용히 무시
      if (err?.error === "popup_closed_by_user" || err?.error === "user_cancelled_authorize") return;
      setError("애플 로그인에 실패했습니다. 다시 시도해주세요.");
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
                // OAuth state CSRF 방어 — crypto 기반 랜덤
                const arr = new Uint8Array(16);
                crypto.getRandomValues(arr);
                const state = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
                sessionStorage.setItem('kakao_oauth_state', state);
                const url = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=account_email,profile_nickname&state=${state}`;
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
                // OAuth state CSRF 방어 — crypto 기반 랜덤 (Math.random 은 예측 가능)
                const arr = new Uint8Array(16);
                crypto.getRandomValues(arr);
                const state = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
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

            <button
              type="button"
              onClick={handleAppleLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-medium transition-colors text-sm text-white hover:opacity-90"
              style={{ backgroundColor: "#000000" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.89-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.13zM14.53 4.42c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45z" />
              </svg>
              Apple로 로그인
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
