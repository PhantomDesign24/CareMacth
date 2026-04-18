"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FiBell, FiCheck, FiArrowLeft } from "react-icons/fi";
import { notificationAPI } from "@/lib/api";
import { showToast } from "@/components/Toast";

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
        return isGuardian ? `${guardianDash}?tab=insurance&insuranceId=${iid}` : null;
      }
      if (d.disputeId) return `${guardianDash}?tab=history`;
      return null;
    default:
      return null;
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

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [userRole, setUserRole] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.list();
      const payload = res.data?.data ?? res.data;
      let list: Notification[] = [];
      if (Array.isArray(payload)) list = payload;
      else if (Array.isArray(payload?.notifications)) list = payload.notifications;
      else if (Array.isArray(payload?.data)) list = payload.data;
      setItems(list);
    } catch {
      showToast("알림을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) setUserRole(JSON.parse(u)?.role);
    } catch {}
    load();
  }, [load]);

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
    if (href) window.location.href = href;
  };

  const handleMarkAll = async () => {
    try {
      await notificationAPI.markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      showToast("모든 알림을 읽음 처리했습니다.", "success");
    } catch {
      showToast("처리 실패", "error");
    }
  };

  const filtered = filter ? items.filter((n) => n.type === filter) : items;
  const unreadCount = items.filter((n) => !n.isRead).length;
  const typeCounts = items.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={userRole === "CAREGIVER" ? "/dashboard/caregiver" : "/dashboard/guardian"}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <FiArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FiBell className="w-5 h-5" />
                알림
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                전체 {items.length}건 · 안 읽음 {unreadCount}건
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-white text-orange-600"
            >
              <FiCheck className="w-4 h-4" /> 모두 읽음
            </button>
          )}
        </div>

        {/* 필터 칩 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilter("")}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
              filter === "" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
            }`}
          >
            전체 ({items.length})
          </button>
          {Object.entries(TYPE_LABELS).map(([key, def]) => {
            const count = typeCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                  filter === key
                    ? "bg-orange-500 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
                }`}
              >
                {def.label} ({count})
              </button>
            );
          })}
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              {filter ? "해당 카테고리 알림이 없습니다." : "알림이 없습니다."}
            </div>
          ) : (
            filtered.map((n) => {
              const typeDef = TYPE_LABELS[n.type] || { label: n.type, color: "bg-gray-100 text-gray-600" };
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition ${
                    !n.isRead ? "bg-orange-50/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!n.isRead && <span className="mt-2 w-2 h-2 rounded-full bg-orange-500 shrink-0" />}
                    {n.isRead && <span className="mt-2 w-2 h-2 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeDef.color}`}>
                          {typeDef.label}
                        </span>
                        <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{n.title}</div>
                      <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{n.body}</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
