"use client";

import { useState, useEffect, useCallback } from "react";
import { getPlatformConfig, PlatformSettings } from "@/lib/api";

export default function PromotionsPage() {
  const [config, setConfig] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPlatformConfig();
      setConfig(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  const referralPoints = config?.referralPointAmount ?? config?.referralPoints ?? 10000;
  const badgeThreshold = config?.excellentBadgeThreshold ?? config?.badgeThreshold ?? 10;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">프로모션 관리</h1>
        <p className="mt-1 text-sm text-gray-500">진행 중인 프로모션 프로그램 현황을 확인합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="card text-center">
          <p className="text-sm text-gray-500">추천인 포인트</p>
          <p className="mt-2 text-2xl font-bold text-primary-600">{referralPoints.toLocaleString()}원</p>
          <p className="mt-1 text-xs text-gray-400">가입 시 양측 지급</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">우수 뱃지 기준</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{badgeThreshold}회 이상</p>
          <p className="mt-1 text-xs text-gray-400">매칭 완료 기준</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">프로그램 상태</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">활성</p>
          <p className="mt-1 text-xs text-gray-400">2개 프로그램 운영 중</p>
        </div>
      </div>

      {/* 추천인 프로그램 */}
      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">추천인 프로그램</h3>
            <p className="mt-1 text-sm text-gray-500">신규 가입 시 추천인 코드를 입력하면 양측에 포인트가 지급됩니다.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">활성</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">추천인 지급</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{referralPoints.toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">피추천인 지급</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{referralPoints.toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">지급 방식</p>
            <p className="mt-1 text-lg font-bold text-gray-900">자동</p>
          </div>
        </div>
      </div>

      {/* 우수 간병사 뱃지 */}
      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">우수 간병사 뱃지 프로그램</h3>
            <p className="mt-1 text-sm text-gray-500">매칭 횟수 기준을 달성한 간병인에게 자동으로 우수 뱃지가 부여됩니다.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">활성</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">기준 매칭 횟수</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{badgeThreshold}회</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">부여 방식</p>
            <p className="mt-1 text-lg font-bold text-gray-900">자동 (매일 자정)</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">혜택</p>
            <p className="mt-1 text-lg font-bold text-gray-900">매칭 점수 +5</p>
          </div>
        </div>
      </div>

      {/* 안내 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          💡 포인트 금액, 뱃지 기준 등 수치 변경은 <a href="/admin/settings" className="font-medium underline">플랫폼 설정</a> 페이지에서 가능합니다.
        </p>
      </div>
    </div>
  );
}
