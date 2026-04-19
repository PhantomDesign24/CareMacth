"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  data: any;
  createdAt: string;
}

const API_BASE =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "/api"
    : "http://localhost:4000/api";

// 관리자 전용 알림 판별 — admin-role만 받는 알림은 특정 data 필드 포함
function isAdminRelevant(n: Notification): boolean {
  const d = n.data || {};
  // admin 대상임을 명시적으로 표시하는 필드들
  if (d.reportId) return true;
  if (d.disputeId) return true;
  if (d.insuranceDocRequestId) return true; // insuranceId는 보호자 알림에서도 쓰임
  if (d.adminAlert === true) return true;
  if (d.forAdmin === true) return true;
  // 제목/본문 패턴 (보조)
  if (/신고 접수|분쟁 접수|환불 요청 접수|간병보험 서류 신청/.test(n.title || "")) return true;
  return false;
}

async function fetchNotifications(): Promise<Notification[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  if (!token) return [];
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const payload = json?.data ?? json;
    let list: Notification[] = [];
    if (Array.isArray(payload)) list = payload;
    else if (Array.isArray(payload?.notifications)) list = payload.notifications;
    // 관리자 전용 알림만 노출 (Guardian/Caregiver 개인 알림 제외)
    return list.filter(isAdminRelevant);
  } catch {
    return [];
  }
}

async function markRead(id: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function markAllRead() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  await fetch(`${API_BASE}/notifications/all/read`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MATCHING: { label: "매칭", color: "bg-orange-50 text-orange-600" },
  APPLICATION: { label: "지원", color: "bg-blue-50 text-blue-600" },
  CONTRACT: { label: "계약", color: "bg-green-50 text-green-600" },
  PAYMENT: { label: "결제", color: "bg-purple-50 text-purple-600" },
  CARE_RECORD: { label: "간병 기록", color: "bg-teal-50 text-teal-600" },
  EXTENSION: { label: "연장", color: "bg-amber-50 text-amber-600" },
  PENALTY: { label: "패널티", color: "bg-red-50 text-red-600" },
  SYSTEM: { label: "공지", color: "bg-gray-100 text-gray-700" },
};

// 관리자는 basePath '/admin' 설정이라 window.location.href 이동 시 /admin 접두사 필수
const BP = "/admin";

function typeToHref(n: Notification): string | null {
  const d = n.data || {};
  switch (n.type) {
    case "SYSTEM":
      if (d.insuranceId || d.insuranceDocRequestId) return `${BP}/insurance`;
      if (d.disputeId) return `${BP}/disputes`;
      if (d.reportId) return `${BP}/reports`;
      if (d.caregiverId) return `${BP}/caregivers/${d.caregiverId}`;
      return `${BP}/`;
    case "PAYMENT":
      if (d.paymentId && d.refundRequest) return `${BP}/payments?tab=refunds`;
      if (d.feeId) return `${BP}/payments?tab=additional-fees`;
      if (d.earningId || d.bulk) return `${BP}/payments?tab=settlements`;
      return `${BP}/payments`;
    case "CONTRACT":
    case "EXTENSION":
      if (d.contractId) return `${BP}/matchings?contract=${d.contractId}`;
      return `${BP}/matchings`;
    case "MATCHING":
    case "APPLICATION":
      if (d.careRequestId) return `${BP}/matchings?careRequest=${d.careRequestId}`;
      return `${BP}/matchings`;
    case "CARE_RECORD":
      if (d.contractId) return `${BP}/matchings?contract=${d.contractId}`;
      return `${BP}/matchings`;
    case "PENALTY":
      if (d.caregiverId) return `${BP}/caregivers/${d.caregiverId}`;
      return `${BP}/caregivers`;
    default:
      return `${BP}/`;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const list = await fetchNotifications();
    setItems(list);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = items.filter((n) => !n.isRead).length;

  const handleClick = async (n: Notification) => {
    try {
      if (!n.isRead) {
        await markRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      }
    } catch {}
    const href = typeToHref(n);
    if (href) window.location.href = href;
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } catch {}
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        aria-label="알림"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-900">알림</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-orange-500 hover:text-orange-600"
              >
                모두 읽음
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400">알림이 없습니다.</div>
            ) : (
              items.slice(0, 20).map((n) => {
                const typeDef = TYPE_LABELS[n.type] || { label: n.type, color: "bg-gray-100 text-gray-600" };
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !n.isRead ? "bg-orange-50/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeDef.color}`}>
                            {typeDef.label}
                          </span>
                          <span className="text-[10px] text-gray-400">{timeAgo(n.createdAt)}</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 truncate">{n.title}</div>
                        <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.body}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
