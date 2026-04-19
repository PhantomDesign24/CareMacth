"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { FiBell, FiCheck } from "react-icons/fi";
import { notificationAPI } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  data: any;
  createdAt: string;
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

function typeToHref(n: Notification, role?: string): string | null {
  const d = n.data || {};
  const isCaregiver = role === "CAREGIVER";
  const isGuardian = role === "GUARDIAN";
  const guardianDash = "/dashboard/guardian";
  const caregiverDash = "/dashboard/caregiver";
  const myDash = isCaregiver ? caregiverDash : guardianDash;

  switch (n.type) {
    case "PAYMENT":
      if (isCaregiver) {
        if (d.contractId) return `/dashboard/caregiver/journal/${d.contractId}`;
        return `${caregiverDash}?tab=earnings`;
      }
      if (d.feeId) return `${guardianDash}?tab=history&feeId=${d.feeId}`;
      return `${guardianDash}?tab=payments`;
    case "CONTRACT":
      if (d.contractId && isCaregiver) return `/dashboard/caregiver/journal/${d.contractId}`;
      if (d.contractId && isGuardian) return `/dashboard/guardian/journal/${d.contractId}`;
      return `${myDash}?tab=history`;
    case "EXTENSION":
      if (d.contractId && isCaregiver) return `/dashboard/caregiver/journal/${d.contractId}`;
      if (d.contractId && isGuardian) return `/dashboard/guardian/journal/${d.contractId}`;
      return myDash;
    case "MATCHING":
      if (isCaregiver) return "/find-work";
      if (d.careRequestId) return `/dashboard/guardian/applicants/${d.careRequestId}`;
      return `${guardianDash}?tab=history`;
    case "APPLICATION":
      if (isCaregiver) return "/find-work";
      if (d.careRequestId) return `/dashboard/guardian/applicants/${d.careRequestId}`;
      return `${guardianDash}?tab=history`;
    case "CARE_RECORD":
      if (d.contractId) {
        return isCaregiver
          ? `/dashboard/caregiver/journal/${d.contractId}`
          : `/dashboard/guardian/journal/${d.contractId}`;
      }
      return myDash;
    case "PENALTY":
      return `${caregiverDash}?tab=penalties`;
    case "SYSTEM":
      if (d.insuranceId || d.insuranceDocRequestId) {
        const iid = d.insuranceId || d.insuranceDocRequestId;
        return isGuardian ? `${guardianDash}?tab=insurance&insuranceId=${iid}` : "/dashboard/notifications";
      }
      if (d.disputeId) return `${guardianDash}?tab=history`;
      return "/dashboard/notifications";
    default:
      return "/dashboard/notifications";
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

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) {
        const parsed = JSON.parse(u);
        setUserRole(parsed?.role);
      }
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    // 토큰 없으면 호출 자체를 건너뜀 (로그아웃 직후 401 루프 방지)
    if (typeof window !== "undefined" && !localStorage.getItem("cm_access_token")) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await notificationAPI.list();
      const payload = res.data?.data ?? res.data;
      // 백엔드 응답: { notifications: [...], unreadCount, pagination } 또는 배열 직접
      let list: Notification[] = [];
      if (Array.isArray(payload)) list = payload;
      else if (Array.isArray(payload?.notifications)) list = payload.notifications;
      else if (Array.isArray(payload?.data)) list = payload.data;
      setItems(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // 1분마다 폴링
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

  const unreadCount = items.filter((n) => !n.isRead).length;

  const handleClick = async (n: Notification) => {
    try {
      if (!n.isRead) {
        await notificationAPI.markRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      }
    } catch {
      // ignore
    }
    const href = typeToHref(n, userRole);
    if (href) {
      window.location.href = href;
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationAPI.markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } catch {
      // ignore
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="알림"
      >
        <FiBell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-900">알림</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1"
              >
                <FiCheck className="w-3 h-3" /> 모두 읽음
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400">불러오는 중...</div>
            ) : items.length === 0 ? (
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
                      {!n.isRead && (
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                      )}
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
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-gray-600 hover:text-orange-500"
            >
              전체 알림 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
