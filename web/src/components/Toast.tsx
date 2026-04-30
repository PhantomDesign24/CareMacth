"use client";

import React, { useEffect, useState, useCallback } from "react";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;
let addToastFn: ((msg: string, type: "success" | "error" | "info") => void) | null = null;

// 어디서든 호출 가능한 글로벌 함수
export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  addToastFn?.(message, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info") => {
    setToasts((prev) => {
      // 1) 같은 메시지가 이미 떠있으면 중복 추가 안 함 (dedup)
      const existing = prev.find((t) => t.message === message && t.type === type);
      if (existing) return prev;
      // 2) 화면에 5개 초과 누적 방지 — 가장 오래된 것 제거
      const id = ++toastId;
      const next = [...prev, { id, message, type }];
      const trimmed = next.length > 5 ? next.slice(next.length - 5) : next;
      // auto-dismiss
      setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== id));
      }, 4000);
      return trimmed;
    });
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
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
