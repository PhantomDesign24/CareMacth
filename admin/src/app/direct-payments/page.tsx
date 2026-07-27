"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getDirectPayments,
  completeDirectPayment,
  DirectPaymentItem,
} from "@/lib/api";

const won = (n: number) => `${(n || 0).toLocaleString()}원`;
const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }) : "-";

const STATUS_CHIPS = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "미확인" },
  { value: "COMPLETED", label: "완료" },
];

export default function DirectPaymentsPage() {
  const [items, setItems] = useState<DirectPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // 사이드바 '직접결제 요청' 배지 클릭 진입 시 ?status=PENDING → 입금확인 대기만 표시(배지와 일치)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    if (s) setStatusFilter(s);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDirectPayments({ status: statusFilter || undefined, limit: 100 });
      setItems(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleComplete = async (id: string) => {
    if (!confirm("이용료 입금을 확인하고 처리완료로 표시할까요?")) return;
    setProcessing(id);
    try {
      await completeDirectPayment(id);
      setToast("처리완료로 표시되었습니다.");
      await load();
    } catch (e: any) {
      alert(e?.message || "처리 실패");
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = items.filter((i) => i.status === "PENDING").length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">직접결제 요청</h1>
        <p className="text-sm text-gray-500 mt-1">
          보호자가 간병비를 간병사님께 직접 지급하고, 플랫폼은 매칭 이용료(정액수수료 × 일수)만 수취하는 건입니다.
          이용료 입금을 확인한 뒤 <b>처리완료</b>로 표시하세요.
        </p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.value || "all"}
            onClick={() => setStatusFilter(c.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              statusFilter === c.value
                ? "bg-orange-500 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
            }`}
          >
            {c.label}
            {c.value === "PENDING" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-gray-400">직접결제 요청이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">요청일</th>
                  <th className="px-4 py-3 font-medium">보호자</th>
                  <th className="px-4 py-3 font-medium">간병사</th>
                  <th className="px-4 py-3 font-medium">환자</th>
                  <th className="px-4 py-3 font-medium text-right">기간</th>
                  <th className="px-4 py-3 font-medium text-right">이용료</th>
                  <th className="px-4 py-3 font-medium text-center">상태</th>
                  <th className="px-4 py-3 font-medium text-center">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDateTime(it.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{it.guardianName}</div>
                      {it.guardianPhone && <div className="text-xs text-gray-400">{it.guardianPhone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{it.caregiverName}</div>
                      {it.caregiverPhone && <div className="text-xs text-gray-400">{it.caregiverPhone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{it.patientName}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{it.days}일</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-bold text-gray-900">{won(it.matchFee)}</div>
                      <div className="text-xs text-gray-400">{won(it.feePerDay)} × {it.days}일</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {it.status === "COMPLETED" ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">완료</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">미확인</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {it.status === "PENDING" ? (
                        <button
                          onClick={() => handleComplete(it.id)}
                          disabled={processing === it.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {processing === it.id ? "처리 중..." : "입금확인(처리완료)"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">{fmtDateTime(it.processedAt)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
