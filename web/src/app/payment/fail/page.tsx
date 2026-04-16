"use client";

import React, { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") || "";
  const message = searchParams.get("message") || "결제가 취소되었습니다.";

  // 사용자가 결제 취소했을 때 자동으로 대시보드로 이동
  // (WebView 환경에서 router.back() 문제 회피)
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/dashboard/guardian");
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  const isCancel = code === "USER_CANCEL" || code === "PAY_PROCESS_CANCELED" || /취소/.test(message);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isCancel ? "bg-gray-100" : "bg-red-50"}`}>
          <span className={`text-3xl ${isCancel ? "text-gray-500" : "text-red-500"}`}>
            {isCancel ? "×" : "!"}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {isCancel ? "결제가 취소되었습니다" : "결제에 실패했습니다"}
        </h1>
        <p className="text-sm text-gray-600 mb-2">{message}</p>
        {code && !isCancel && <p className="text-xs text-gray-400 mb-2">오류 코드: {code}</p>}
        <p className="text-xs text-gray-400 mt-4 mb-6">잠시 후 대시보드로 이동합니다...</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.replace("/dashboard/guardian")}
            className="btn-secondary flex-1"
          >
            대시보드로
          </button>
          <Link href="/dashboard/guardian?tab=history" className="btn-primary flex-1">
            간병 이력
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">로딩 중...</div>}>
      <PaymentFailContent />
    </Suspense>
  );
}
