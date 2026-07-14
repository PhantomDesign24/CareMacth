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
    // 이니시스: 백엔드 returnUrl 에서 이미 승인 완료 후 리다이렉트됨 → confirm 불필요, 성공 표시만
    const provider = searchParams.get("provider");
    if (provider === "inicis") {
      const a = Number(searchParams.get("amount") || 0);
      if (a > 0) setAmount(a);
      setStatus("success");
      // provider(+amount) 마커는 URL에 유지 → 카카오페이 앱복귀로 페이지가 리로드돼도 실패로 안 빠짐
      const keep = a > 0 ? `/payment/success?provider=inicis&amount=${a}` : "/payment/success?provider=inicis";
      try { window.history.replaceState({}, "", keep); } catch {}
      return;
    }

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amt = searchParams.get("amount");

    if (!paymentKey || !orderId || !amt) {
      // 파라미터 없이 이 페이지에 도달 = 결제 성공 후 리로드/뒤로가기/앱복귀.
      // (실제 결제 실패는 /payment/fail 로 이동하므로 여기선 실패로 처리하지 않음)
      setStatus("success");
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
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-orange-50 via-white to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-orange-100/40 border border-orange-50 p-6 sm:p-8 text-center">
          {/* 성공 아이콘 */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <span className="absolute inset-0 rounded-full bg-green-200 opacity-40 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-200">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1.5">결제가 완료되었어요</h1>
          <p className="text-sm text-gray-500 mb-6">간병 서비스 예약이 확정되었습니다.</p>

          {amount > 0 && (
            <div className="bg-orange-50 rounded-2xl px-5 py-4 mb-5">
              <div className="text-xs font-medium text-orange-400 mb-1">결제 금액</div>
              <div className="text-3xl font-extrabold text-primary-600">
                {amount.toLocaleString()}<span className="text-lg font-bold ml-0.5">원</span>
              </div>
            </div>
          )}

          {/* 에스크로 안내 */}
          <div className="flex items-start gap-2.5 text-left bg-gray-50 rounded-xl px-4 py-3 mb-6">
            <svg className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-xs text-gray-500 leading-relaxed">
              결제 금액은 <b className="text-gray-700">안전하게 보관</b>되며, 간병이 완료되면 간병사에게 정산됩니다.
            </p>
          </div>

          <Link href="/dashboard/guardian?tab=history" className="btn-primary w-full block">
            간병 내역 보기
          </Link>
          <button
            type="button"
            onClick={() => router.replace("/dashboard/guardian")}
            className="w-full mt-2.5 py-2 text-sm text-gray-400 font-medium"
          >
            홈으로 이동
          </button>

          <p className="text-[11px] text-gray-300 mt-4">잠시 후 자동으로 이동합니다…</p>
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
