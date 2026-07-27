"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getBusinessInquiries,
  updateBusinessInquiry,
  BusinessInquiryItem,
} from "@/lib/api";
import { formatPhone } from "@/lib/constants";

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }) : "-";

const typeLabel = (t: string) => (t === "hospital" ? "병원" : t === "company" ? "기업" : "기타");

const STATUS_CHIPS = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "미확인" },
  { value: "DONE", label: "처리완료" },
];

export default function BusinessInquiriesPage() {
  const [items, setItems] = useState<BusinessInquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // 사이드바 '제휴 문의' 배지 클릭 진입 시 ?status=PENDING → 미확인만
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    if (s) setStatusFilter(s);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBusinessInquiries({ status: statusFilter || undefined });
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
    if (!confirm("이 문의를 처리완료로 표시할까요?")) return;
    setProcessing(id);
    try {
      await updateBusinessInquiry(id, { status: "DONE" });
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
        <h1 className="text-2xl font-bold text-gray-900">병원·기업 제휴 문의</h1>
        <p className="text-sm text-gray-500 mt-1">홈페이지 제휴 문의 접수 내역입니다. 처리 후 <b>처리완료</b>로 표시하세요.</p>
      </div>

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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-gray-400">제휴 문의가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">접수일</th>
                  <th className="px-4 py-3 font-medium">구분</th>
                  <th className="px-4 py-3 font-medium">업체 / 담당자</th>
                  <th className="px-4 py-3 font-medium">연락처</th>
                  <th className="px-4 py-3 font-medium">문의 내용</th>
                  <th className="px-4 py-3 font-medium text-center">상태</th>
                  <th className="px-4 py-3 font-medium text-center">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDateTime(it.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{typeLabel(it.type)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{it.companyName}</div>
                      <div className="text-xs text-gray-500">{it.contactName}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      <div>{formatPhone(it.phone)}</div>
                      {it.email && <div className="text-xs text-gray-400">{it.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs whitespace-pre-wrap">{it.message || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      {it.status === "DONE" ? (
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
                          {processing === it.id ? "처리 중..." : "처리완료"}
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
