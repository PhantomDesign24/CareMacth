"use client";

import React, { useEffect, useState } from "react";
import { notificationAPI } from "@/lib/api";
import { showToast } from "@/components/Toast";

const CATEGORIES: { key: string; label: string; desc: string }[] = [
  { key: "MATCHING", label: "매칭", desc: "조건에 맞는 간병 요청 알림 (간병인)" },
  { key: "APPLICATION", label: "지원", desc: "내 요청에 지원한 간병인 알림 (보호자)" },
  { key: "CONTRACT", label: "계약", desc: "계약 생성/취소/연장 알림" },
  { key: "PAYMENT", label: "결제", desc: "결제 완료/환불/정산 알림" },
  { key: "CARE_RECORD", label: "간병 기록", desc: "출퇴근·일지 작성 알림" },
  { key: "EXTENSION", label: "연장", desc: "간병 종료 전 연장 리마인더" },
  { key: "PENALTY", label: "패널티", desc: "패널티 부과/해제 알림 (간병인)" },
  { key: "SYSTEM", label: "시스템", desc: "공지사항·이벤트·중요 공지" },
];

export default function NotificationPrefsSection() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // 앱 내부에서 실행 중인지 (WebView의 injectedJS가 window.IS_CAREMATCH_APP 설정)
  const [isApp, setIsApp] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).IS_CAREMATCH_APP) {
      setIsApp(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await notificationAPI.getPushSetting();
        const data = res.data?.data || res.data || {};
        setPushEnabled(data.pushEnabled !== false);
        setPrefs(data.notificationPrefs || {});
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const togglePush = async () => {
    const next = !pushEnabled;
    setSaving(true);
    try {
      await notificationAPI.updatePushSetting(next);
      setPushEnabled(next);
      showToast(next ? "푸시 알림이 켜졌습니다." : "푸시 알림이 꺼졌습니다.", "success");
    } catch {
      showToast("설정 변경 실패", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (key: string) => {
    const next = { ...prefs, [key]: !(prefs[key] !== false) };
    setPrefs(next);
    try {
      await notificationAPI.updateCategoryPrefs(next);
    } catch {
      showToast("설정 변경 실패", "error");
      setPrefs(prefs); // revert
    }
  };

  if (loading) return null;

  return (
    <div className="border border-gray-200 bg-white rounded-2xl p-6">
      <h4 className="font-bold text-gray-900 mb-1">알림 설정</h4>
      <p className="text-xs text-gray-500 mb-4">
        받고 싶은 알림 카테고리를 선택하세요.
      </p>

      {/* 전체 푸시 on/off — 앱 전용 */}
      {isApp && (
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <div className="text-sm font-semibold text-gray-900">전체 푸시 알림</div>
            <div className="text-xs text-gray-500 mt-0.5">모든 푸시를 한 번에 차단합니다.</div>
          </div>
          <button
            type="button"
            onClick={togglePush}
            disabled={saving}
            className={`relative w-11 h-6 rounded-full transition-colors ${pushEnabled ? "bg-orange-500" : "bg-gray-300"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${pushEnabled ? "left-5" : "left-0.5"}`}
            />
          </button>
        </div>
      )}
      {!isApp && (
        <p className="text-xs text-gray-400 mb-3">
          ※ 푸시 알림은 모바일 앱에서만 받을 수 있습니다. 아래 카테고리 설정은 인앱 알림에도 적용됩니다.
        </p>
      )}

      {/* 카테고리별 */}
      <div className={`${isApp && !pushEnabled ? "opacity-40 pointer-events-none" : ""} mt-2`}>
        {CATEGORIES.map((c) => {
          const enabled = prefs[c.key] !== false;
          return (
            <div
              key={c.key}
              className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{c.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => toggleCategory(c.key)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${enabled ? "bg-orange-400" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? "left-5" : "left-0.5"}`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
