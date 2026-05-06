"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import NotificationPrefsSection from "@/components/NotificationPrefsSection";

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [backHref, setBackHref] = useState("/dashboard/guardian?tab=settings");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("cm_access_token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      if (u?.role === "CAREGIVER") setBackHref("/dashboard/caregiver?tab=settings");
    } catch {}
    setAuthorized(true);
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={backHref}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="뒤로"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">알림 설정</h1>
        </div>
        <NotificationPrefsSection />
      </div>
    </div>
  );
}
