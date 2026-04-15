"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { contractAPI, guardianAPI, paymentAPI } from "@/lib/api";
import {
  formatDate,
  formatMoney,
  formatCareType,
} from "@/lib/format";

interface ContractInfo {
  id: string;
  patientName: string;
  caregiverName: string;
  careType: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  totalAmount: number;
}

type PaymentMethod = "CARD" | "BANK_TRANSFER" | "DIRECT";

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [pointsAvailable, setPointsAvailable] = useState(0);
  const [pointsUsed, setPointsUsed] = useState(0);

  const fetchContract = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Load available points from localStorage user or guardian API
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("cm_user") : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          setPointsAvailable(parsed.points || 0);
        }
      } catch {
        // ignore parse errors
      }

      // Try fetching contract directly
      let found: any = null;
      try {
        const res = await contractAPI.get(contractId);
        const data = res.data?.data || res.data;
        if (data) {
          found = data;
        }
      } catch (err: any) {
        // If 404, fall through to care history
        if (err?.response?.status !== 404) {
          throw err;
        }
      }

      // Fallback: fetch from care history
      if (!found) {
        const historyRes = await guardianAPI.getCareHistory();
        const historyData = historyRes.data?.data || historyRes.data || {};
        const contracts = historyData.contracts || [];
        found = contracts.find((c: any) => c.id === contractId);
      }

      if (!found) {
        setError("계약 정보를 찾을 수 없습니다.");
        return;
      }

      // Also try to get points from guardian API if not in localStorage
      try {
        const guardianRes = await guardianAPI.getInfo();
        const gData = guardianRes.data?.data || guardianRes.data || {};
        const user = gData.user || {};
        if (typeof user.points === "number") {
          setPointsAvailable(user.points);
        }
      } catch {
        // ignore - use localStorage value
      }

      setContract({
        id: found.id,
        patientName:
          found.careRequest?.patient?.name || found.patientName || "-",
        caregiverName:
          found.caregiver?.user?.name || found.caregiverName || "-",
        careType: found.careRequest?.careType || found.careType || "",
        startDate: found.startDate ? new Date(found.startDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : "",
        endDate: found.endDate ? new Date(found.endDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : "",
        dailyRate: found.dailyRate || 0,
        totalAmount: found.totalAmount || 0,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "데이터를 불러오는 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  // Calculated amounts
  const serviceAmount = contract?.totalAmount || 0;
  const vatAmount = Math.round(serviceAmount / 11);
  const totalBeforeDiscount = serviceAmount + vatAmount;
  const clampedPoints = Math.min(pointsUsed, pointsAvailable, totalBeforeDiscount);
  const finalAmount = totalBeforeDiscount - clampedPoints;

  const handlePointsChange = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) {
      setPointsUsed(0);
      return;
    }
    const maxUsable = Math.min(num, pointsAvailable, totalBeforeDiscount);
    setPointsUsed(maxUsable);
  };

  const handleUseAllPoints = () => {
    const maxUsable = Math.min(pointsAvailable, totalBeforeDiscount);
    setPointsUsed(maxUsable);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contract) return;

    setSubmitting(true);
    try {
      const res = await paymentAPI.create({
        contractId: contract.id,
        method,
        pointsUsed: clampedPoints,
      });

      const data = res.data?.data || res.data || {};

      if (method === "CARD") {
        alert("카드 결제 페이지로 이동합니다");
      } else if (method === "BANK_TRANSFER") {
        const accountInfo = data.virtualAccount
          ? `입금 계좌: ${data.virtualAccount.bankName} ${data.virtualAccount.accountNumber}\n입금액: ${formatMoney(data.amount)}\n입금 기한: ${data.virtualAccount.dueDate || "24시간 이내"}`
          : `주문번호: ${data.orderId}\n결제 금액: ${formatMoney(data.amount)}\n무통장입금 안내가 등록된 연락처로 발송됩니다.`;
        alert(accountInfo);
      } else if (method === "DIRECT") {
        alert("직접결제가 등록되었습니다");
      }

      router.push("/dashboard/guardian");
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : "결제 처리 중 오류가 발생했습니다.");
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-primary-500 mx-auto mb-4"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-gray-500">결제 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            오류가 발생했습니다
          </h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button type="button" onClick={fetchContract} className="btn-primary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const paymentMethods: { value: PaymentMethod; label: string; desc: string }[] = [
    { value: "CARD", label: "카드 결제", desc: "신용/체크카드로 결제합니다" },
    { value: "BANK_TRANSFER", label: "무통장입금", desc: "가상계좌로 입금합니다" },
    { value: "DIRECT", label: "직접결제", desc: "간병인에게 직접 결제합니다" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/dashboard/guardian"
          className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          대시보드로 돌아가기
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-8">결제하기</h1>

        <form onSubmit={handleSubmit}>
          {/* 1. Contract info card */}
          <div className="card mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              계약 정보
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">환자</span>
                <p className="font-medium text-gray-900">
                  {contract?.patientName}
                </p>
              </div>
              <div>
                <span className="text-gray-500">간병인</span>
                <p className="font-medium text-gray-900">
                  {contract?.caregiverName}
                </p>
              </div>
              <div>
                <span className="text-gray-500">간병 유형</span>
                <p className="font-medium text-gray-900">
                  {formatCareType(contract?.careType || "")}
                </p>
              </div>
              <div>
                <span className="text-gray-500">기간</span>
                <p className="font-medium text-gray-900">
                  {formatDate(contract?.startDate)} ~{" "}
                  {formatDate(contract?.endDate)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">일당</span>
                <p className="font-medium text-gray-900">
                  {formatMoney(contract?.dailyRate || 0)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">총 금액</span>
                <p className="font-medium text-gray-900">
                  {formatMoney(contract?.totalAmount || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Payment method */}
          <div className="card mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              결제 방법
            </h2>
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <label
                  key={pm.value}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    method === pm.value
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={pm.value}
                    checked={method === pm.value}
                    onChange={() => setMethod(pm.value)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{pm.label}</p>
                    <p className="text-sm text-gray-500">{pm.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Points */}
          <div className="card mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              포인트 사용
            </h2>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">
                보유 포인트:{" "}
                <span className="font-semibold text-primary-600">
                  {pointsAvailable.toLocaleString()}원
                </span>
              </span>
              <button
                type="button"
                onClick={handleUseAllPoints}
                disabled={pointsAvailable === 0}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                전액 사용
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={Math.min(pointsAvailable, totalBeforeDiscount)}
                value={pointsUsed}
                onChange={(e) => handlePointsChange(e.target.value)}
                className="input-field flex-1"
                placeholder="사용할 포인트를 입력하세요"
              />
              <span className="text-sm text-gray-500 shrink-0">원</span>
            </div>
            {pointsUsed > 0 && pointsUsed > pointsAvailable && (
              <p className="text-sm text-red-500 mt-2">
                보유 포인트를 초과할 수 없습니다.
              </p>
            )}
          </div>

          {/* 4. Payment summary */}
          <div className="card mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              결제 금액 계산
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">서비스 비용</span>
                <span className="text-gray-900">
                  {formatMoney(serviceAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">VAT (별도)</span>
                <span className="text-gray-900">
                  {formatMoney(vatAmount)}
                </span>
              </div>
              {clampedPoints > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">포인트 할인</span>
                  <span className="text-primary-600 font-medium">
                    -{formatMoney(clampedPoints)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-gray-900">
                    최종 결제
                  </span>
                  <span className="text-xl font-bold text-primary-600">
                    {formatMoney(finalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Submit */}
          <div className="flex gap-3">
            <Link
              href="/dashboard/guardian"
              className="btn-secondary flex-1 text-center"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={submitting || finalAmount < 0}
              className="btn-primary flex-1"
            >
              {submitting ? (
                <svg
                  className="animate-spin h-5 w-5 mx-auto"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                `${formatMoney(finalAmount)} 결제하기`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
