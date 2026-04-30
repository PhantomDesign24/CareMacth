"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { paymentAPI } from "@/lib/api";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "fail">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amt = searchParams.get("amount");

    if (!paymentKey || !orderId || !amt) {
      setStatus("fail");
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      return;
    }

    setAmount(Number(amt));

    // 백엔드에 결제 승인 요청 (서버가 orderId 기준 ledger 금액 재검증)
    paymentAPI
      .confirm({ paymentKey, orderId, amount: Number(amt) })
      .then(() => {
        setStatus("success");
        // URL 정리 — paymentKey/amount 가 history/Referer/log 에 남지 않도록
        try {
          window.history.replaceState({}, '', '/payment/success');
        } catch {}
      })
      .catch((err: any) => {
        const message = err?.response?.data?.message || "결제 승인 중 오류가 발생했습니다.";
        setErrorMsg(message);
        setStatus("fail");
      });
  }, [searchParams]);

  // 성공 시 3초 후 자동 이동 (WebView 뒤로가기 문제 회피)
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        router.replace("/dashboard/guardian?tab=history");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-primary-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-600">결제를 승인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (status === "fail") {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-red-500 text-3xl">✕</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">결제 승인 실패</h1>
          <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
          <button onClick={() => router.push("/dashboard/guardian")} className="btn-primary w-full">
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">결제 완료</h1>
        <p className="text-sm text-gray-500 mb-1">결제가 성공적으로 처리되었습니다.</p>
        <div className="my-6 py-4 border-y border-gray-100">
          <div className="text-2xl font-bold text-primary-600">{amount.toLocaleString()}원</div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/guardian" className="btn-primary flex-1">
            대시보드
          </Link>
          <Link href="/dashboard/guardian?tab=payments" className="btn-secondary flex-1">
            결제 내역
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">로딩 중...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
