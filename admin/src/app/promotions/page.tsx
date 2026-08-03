"use client";

import { useState, useEffect, useCallback } from "react";
import { getPlatformConfig, PlatformSettings, getReferralCodes, ReferralCodeRow } from "@/lib/api";

export default function PromotionsPage() {
  const [config, setConfig] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  // 회원별 추천코드 (요청: "프로모션에서 회원별 추천코드 확인")
  const [refRows, setRefRows] = useState<ReferralCodeRow[]>([]);
  const [refQuery, setRefQuery] = useState("");
  const [refRole, setRefRole] = useState("");
  const [refPage, setRefPage] = useState(1);
  const [refTotal, setRefTotal] = useState(0);
  const [refPages, setRefPages] = useState(1);
  const [refLoading, setRefLoading] = useState(false);
  const [refSearch, setRefSearch] = useState("");

  const fetchReferrals = useCallback(async () => {
    setRefLoading(true);
    try {
      const res = await getReferralCodes({ q: refSearch, role: refRole, page: refPage, limit: 20 });
      setRefRows(res.rows || []);
      setRefTotal(res.total || 0);
      setRefPages(res.totalPages || 1);
    } catch {
      setRefRows([]);
    } finally {
      setRefLoading(false);
    }
  }, [refSearch, refRole, refPage]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

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

      {/* 회원별 추천코드 */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">회원별 추천코드</h2>
            <p className="mt-0.5 text-xs text-gray-500">가입 시 자동 발급됩니다. 이름·연락처·코드로 검색하세요.</p>
          </div>
          <span className="text-sm text-gray-500">총 {refTotal.toLocaleString()}명</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="input-field w-auto min-w-[200px]"
            placeholder="이름 · 연락처 · 추천코드 검색"
            value={refQuery}
            onChange={(e) => setRefQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setRefPage(1); setRefSearch(refQuery); } }}
          />
          <select
            className="input-field w-auto"
            value={refRole}
            onChange={(e) => { setRefPage(1); setRefRole(e.target.value); }}
          >
            <option value="">전체 회원</option>
            <option value="GUARDIAN">보호자</option>
            <option value="CAREGIVER">간병인</option>
          </select>
          <button
            onClick={() => { setRefPage(1); setRefSearch(refQuery); }}
            className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700"
          >
            검색
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">구분</th>
                <th className="px-3 py-2 text-left">연락처</th>
                <th className="px-3 py-2 text-left">추천코드</th>
                <th className="px-3 py-2 text-center">추천 가입</th>
                <th className="px-3 py-2 text-left">추천인</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {refLoading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">불러오는 중...</td></tr>
              ) : refRows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">결과가 없습니다.</td></tr>
              ) : refRows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.role === "GUARDIAN" ? "보호자" : r.role === "CAREGIVER" ? "간병인" : r.role === "ADMIN" ? "관리자" : r.role}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.phone || "-"}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{r.referralCode || "-"}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={r.invitedCount > 0 ? "font-bold text-primary-600" : "text-gray-400"}>
                      {r.invitedCount}명
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.referredByName ? `${r.referredByName}${r.referredByCode ? ` (${r.referredByCode})` : ""}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {refPages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              disabled={refPage <= 1}
              onClick={() => setRefPage((p) => p - 1)}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40"
            >이전</button>
            <span className="text-sm text-gray-500">{refPage} / {refPages}</span>
            <button
              disabled={refPage >= refPages}
              onClick={() => setRefPage((p) => p + 1)}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40"
            >다음</button>
          </div>
        )}
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
