"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function KakaoCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      const code = params.get("code");
      const errParam = params.get("error");
      if (errParam) {
        setError(`카카오 로그인이 취소되었거나 실패했습니다. (${errParam})`);
        return;
      }
      if (!code) {
        setError("인가 코드가 없습니다.");
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/kakao/callback`;
        const res = await fetch("/api/auth/kakao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });
        const data = await res.json();

        if (!data.success) {
          setError(data.message || "카카오 로그인 처리에 실패했습니다.");
          return;
        }

        // 기존 사용자 → 토큰 저장 후 대시보드로
        if (data.data.access_token) {
          localStorage.setItem("cm_access_token", data.data.access_token);
          if (data.data.refresh_token) {
            localStorage.setItem("cm_refresh_token", data.data.refresh_token);
          }
          localStorage.setItem("user", JSON.stringify(data.data.user));
          const role = data.data.user.role;
          if (role === "GUARDIAN" || role === "ADMIN") {
            router.replace("/dashboard/guardian");
          } else if (role === "CAREGIVER") {
            router.replace("/dashboard/caregiver");
          } else {
            router.replace("/");
          }
          return;
        }

        // 신규 사용자 → 가입 페이지로 프리필하여 이동
        if (data.data.isNew) {
          const qs = new URLSearchParams({
            social: "kakao",
            socialId: data.data.socialId || "",
            email: data.data.email || "",
            name: data.data.name || "",
            phone: data.data.phone || "",
          });
          router.replace(`/auth/register?${qs.toString()}`);
          return;
        }

        setError("알 수 없는 응답입니다.");
      } catch {
        setError("서버 연결에 실패했습니다.");
      }
    };
    run();
  }, [params, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        {error ? (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">카카오 로그인 실패</h2>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <button
              type="button"
              onClick={() => router.replace("/auth/login")}
              className="btn-primary mt-6 w-full"
            >
              로그인 페이지로
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto mb-3 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
            <p className="text-sm text-gray-500">카카오 로그인 처리 중...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    }>
      <KakaoCallbackInner />
    </Suspense>
  );
}
