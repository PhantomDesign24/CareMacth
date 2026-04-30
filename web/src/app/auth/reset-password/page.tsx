"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { AxiosError } from "axios";
import { showToast } from "@/components/Toast";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("유효한 재설정 링크가 아닙니다. 비밀번호 찾기를 다시 시도해주세요.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!pw || !pw2) {
      setError("새 비밀번호를 입력해주세요.");
      return;
    }
    if (pw !== pw2) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    const ok = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
    if (!ok) {
      setError("비밀번호는 8자 이상, 영문·숫자·특수문자를 모두 포함해야 합니다.");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password/confirm", { token, newPassword: pw });
      showToast("비밀번호가 변경되었습니다. 다시 로그인해주세요.", "success");
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch (err: unknown) {
      let msg = "비밀번호 변경에 실패했습니다.";
      if (err instanceof AxiosError && err.response) {
        const d: any = err.response.data;
        msg = d?.message || (Array.isArray(d?.errors) ? d.errors[0]?.msg : "") || msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">비밀번호 재설정</h1>
        <p className="text-sm text-gray-500 mb-5">새 비밀번호를 입력해주세요.</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="input-field"
              placeholder="영문, 숫자, 특수문자 포함 8자 이상"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호 확인</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="input-field"
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading || !token}>
            {loading ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <Link href="/auth/login" className="text-primary-600 hover:underline">로그인 페이지로</Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">로딩 중...</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
