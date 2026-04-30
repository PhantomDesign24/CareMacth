"use client";

import React, { useEffect, useState, useCallback } from "react";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;
let addToastFn: ((msg: string, type: "success" | "error" | "info") => void) | null = null;
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

// 어디서든 호출 가능한 글로벌 함수
export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  addToastFn?.(message, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info") => {
    setToasts((prev) => {
      // 같은 메시지+type 이 이미 있으면 → 기존 타이머만 리셋해서 4초 더 노출
      const existing = prev.find((t) => t.message === message && t.type === type);
      if (existing) {
        const oldTimer = toastTimers.get(existing.id);
        if (oldTimer) clearTimeout(oldTimer);
        const newTimer = setTimeout(() => {
          setToasts((cur) => cur.filter((t) => t.id !== existing.id));
          toastTimers.delete(existing.id);
        }, 4000);
        toastTimers.set(existing.id, newTimer);
        return prev;
      }
      // 화면에 5개 초과 누적 방지 — 가장 오래된 것 제거
      const id = ++toastId;
      const next = [...prev, { id, message, type }];
      const trimmed = next.length > 5 ? next.slice(next.length - 5) : next;
      if (trimmed.length !== next.length) {
        const visibleIds = new Set(trimmed.map((t) => t.id));
        next.forEach((t) => {
          if (!visibleIds.has(t.id)) {
            const oldTimer = toastTimers.get(t.id);
            if (oldTimer) clearTimeout(oldTimer);
            toastTimers.delete(t.id);
          }
        });
      }
      const timer = setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== id));
        toastTimers.delete(id);
      }, 4000);
      toastTimers.set(id, timer);
      return trimmed;
    });
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
      toastTimers.forEach((timer) => clearTimeout(timer));
      toastTimers.clear();
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  const colors = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-gray-800",
  };

  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90vw] max-w-md pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${colors[t.type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up pointer-events-auto`}
        >
          <span className="text-lg font-bold shrink-0">{icons[t.type]}</span>
          <span className="text-sm font-medium leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
