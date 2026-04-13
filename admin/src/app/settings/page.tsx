"use client";

import { useState, useEffect, useCallback } from "react";
import { getPlatformConfig, updatePlatformConfig, PlatformSettings } from "@/lib/api";

const defaultSettings: PlatformSettings = {
  oneOnOneFeePercentage: 5,
  oneOnOneFeeFixed: 0,
  familyCareFeePercentage: 4,
  familyCareFeeFixed: 10000,
  taxRate: 3.3,
  referralPointAmount: 10000,
  noShowPenaltyThreshold: 3,
  excellentBadgeThreshold: 100,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getPlatformConfig();
      setSettings({ ...defaultSettings, ...res });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (field: keyof PlatformSettings, value: number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await updatePlatformConfig(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">설정 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">플랫폼 설정</h1>
          <p className="mt-1 text-sm text-gray-500">케어매치 플랫폼의 핵심 설정을 관리합니다.</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            설정이 저장되었습니다.
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        {/* 1:1 매칭 수수료 */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">1:1 매칭 수수료</h3>
            <p className="mt-1 text-sm text-gray-500">1:1 간병 매칭 시 플랫폼에서 수취하는 수수료입니다.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">수수료율</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.oneOnOneFeePercentage ?? 0}
                  onChange={(e) => handleChange("oneOnOneFeePercentage", Number(e.target.value))}
                  className="input-field pr-8"
                  step="0.1"
                  min="0"
                  max="100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">고정 수수료</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.oneOnOneFeeFixed ?? 0}
                  onChange={(e) => handleChange("oneOnOneFeeFixed", Number(e.target.value))}
                  className="input-field pr-8"
                  step="1000"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              예시: 간병비 200만원 시 수수료 = (2,000,000 x {settings.oneOnOneFeePercentage ?? 0}%) + {(settings.oneOnOneFeeFixed ?? 0).toLocaleString()}원
              = <span className="font-semibold text-primary-600">
                {(2000000 * (settings.oneOnOneFeePercentage ?? 0) / 100 + (settings.oneOnOneFeeFixed ?? 0)).toLocaleString()}원
              </span>
            </p>
          </div>
        </div>

        {/* 가족 간병 수수료 */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">가족 간병 수수료</h3>
            <p className="mt-1 text-sm text-gray-500">가족 간병 매칭 시 플랫폼에서 수취하는 수수료입니다.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">수수료율</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.familyCareFeePercentage ?? 0}
                  onChange={(e) => handleChange("familyCareFeePercentage", Number(e.target.value))}
                  className="input-field pr-8"
                  step="0.1"
                  min="0"
                  max="100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">고정 수수료</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.familyCareFeeFixed ?? 0}
                  onChange={(e) => handleChange("familyCareFeeFixed", Number(e.target.value))}
                  className="input-field pr-8"
                  step="1000"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              예시: 간병비 300만원 시 수수료 = (3,000,000 x {settings.familyCareFeePercentage ?? 0}%) + {(settings.familyCareFeeFixed ?? 0).toLocaleString()}원
              = <span className="font-semibold text-primary-600">
                {(3000000 * (settings.familyCareFeePercentage ?? 0) / 100 + (settings.familyCareFeeFixed ?? 0)).toLocaleString()}원
              </span>
            </p>
          </div>
        </div>

        {/* 세율 */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">세율</h3>
            <p className="mt-1 text-sm text-gray-500">간병인 정산 시 원천징수되는 세율입니다.</p>
          </div>
          <div className="max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">원천징수 세율</label>
            <div className="relative">
              <input
                type="number"
                value={settings.taxRate ?? 0}
                onChange={(e) => handleChange("taxRate", Number(e.target.value))}
                className="input-field pr-8"
                step="0.1"
                min="0"
                max="100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
            </div>
          </div>
        </div>

        {/* 추천인 포인트 */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">추천인 포인트 금액</h3>
            <p className="mt-1 text-sm text-gray-500">추천인 코드로 가입 시 양 측에 지급되는 포인트입니다.</p>
          </div>
          <div className="max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">포인트 금액</label>
            <div className="relative">
              <input
                type="number"
                value={settings.referralPointAmount ?? 0}
                onChange={(e) => handleChange("referralPointAmount", Number(e.target.value))}
                className="input-field pr-8"
                step="1000"
                min="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
            </div>
          </div>
        </div>

        {/* 노쇼 패널티 임계값 */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">노쇼 패널티 임계값</h3>
            <p className="mt-1 text-sm text-gray-500">이 횟수 이상 노쇼 발생 시 자동 정지 처리됩니다.</p>
          </div>
          <div className="max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">임계값 (횟수)</label>
            <div className="relative">
              <input
                type="number"
                value={settings.noShowPenaltyThreshold ?? 0}
                onChange={(e) => handleChange("noShowPenaltyThreshold", Number(e.target.value))}
                className="input-field pr-8"
                step="1"
                min="1"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">회</span>
            </div>
          </div>
        </div>

        {/* 우수 간병사 뱃지 기준 */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">우수 간병사 뱃지 기준</h3>
            <p className="mt-1 text-sm text-gray-500">이 횟수 이상 매칭 완료 시 우수 간병사 뱃지 부여 대상이 됩니다.</p>
          </div>
          <div className="max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">매칭 횟수 기준</label>
            <div className="relative">
              <input
                type="number"
                value={settings.excellentBadgeThreshold ?? 0}
                onChange={(e) => handleChange("excellentBadgeThreshold", Number(e.target.value))}
                className="input-field pr-8"
                step="10"
                min="1"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">회</span>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm text-gray-500">
            변경 사항이 있으면 반드시 저장 버튼을 눌러주세요.
          </p>
          <button className="btn-primary px-8" onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                저장 중...
              </span>
            ) : (
              "설정 저장"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
