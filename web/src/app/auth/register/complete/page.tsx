'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type Role = 'GUARDIAN' | 'CAREGIVER' | 'HOSPITAL' | 'ADMIN' | '';

function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 우선순위: 쿼리 param > localStorage(cm_user)
    const qRole = (params.get('role') || '').toUpperCase();
    const qName = params.get('name') || '';
    let resolvedRole: Role = (['GUARDIAN', 'CAREGIVER', 'HOSPITAL', 'ADMIN'].includes(qRole) ? qRole : '') as Role;
    let resolvedName = qName;
    let resolvedRef = '';

    if (typeof window !== 'undefined') {
      try {
        const u = localStorage.getItem('cm_user') || localStorage.getItem('user');
        if (u) {
          const parsed = JSON.parse(u);
          if (!resolvedRole && parsed.role) resolvedRole = parsed.role;
          if (!resolvedName && parsed.name) resolvedName = parsed.name;
          if (parsed.referralCode) resolvedRef = parsed.referralCode;
        }
      } catch {}
    }

    setRole(resolvedRole);
    setName(resolvedName);
    setReferralCode(resolvedRef);
  }, [params]);

  const dashboardPath =
    role === 'CAREGIVER'
      ? '/dashboard/caregiver'
      : role === 'HOSPITAL'
        ? '/dashboard/hospital'
        : '/dashboard/guardian';

  const copyReferral = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-12 px-4">
      <div className="w-full max-w-xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-10 text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="32" height="32" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">가입이 완료되었습니다</h1>
          <p className="mt-2 text-sm text-gray-500">
            {name ? `${name}님, ` : ''}케어매치에 오신 것을 환영합니다.
          </p>

          {/* 역할별 다음 액션 */}
          <div className="mt-8 text-left">
            {role === 'GUARDIAN' && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-gray-900">다음 단계</h2>
                <Link
                  href="/care-request"
                  className="block rounded-xl border-2 border-primary-500 bg-primary-50 p-4 hover:shadow-md transition"
                >
                  <div className="font-semibold text-primary-700">환자 정보 등록 + 간병 요청</div>
                  <div className="text-xs text-gray-600 mt-1">
                    환자 정보를 입력하고 간병 요청을 올리면 간병인이 지원합니다.
                  </div>
                </Link>
              </div>
            )}

            {role === 'CAREGIVER' && (
              <div className="space-y-3">
                <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
                  <div className="font-semibold mb-1">활동 시작 전 인증이 필요합니다</div>
                  <ul className="text-xs space-y-1 list-disc list-inside text-yellow-700">
                    <li>신분증 / 자격증 / 범죄경력회보서 업로드</li>
                    <li>관리자 검토 (영업일 1~3일 소요)</li>
                    <li>승인 후 간병 요청에 지원 가능</li>
                  </ul>
                </div>
                <h2 className="text-base font-bold text-gray-900 pt-2">다음 단계</h2>
                <Link
                  href="/dashboard/caregiver"
                  className="block rounded-xl border-2 border-primary-500 bg-primary-50 p-4 hover:shadow-md transition"
                >
                  <div className="font-semibold text-primary-700">필수 서류 등록</div>
                  <div className="text-xs text-gray-600 mt-1">대시보드에서 자격증/신분증을 업로드해주세요.</div>
                </Link>
                <Link
                  href="/find-work"
                  className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 transition"
                >
                  <div className="font-semibold text-gray-900">간병 요청 둘러보기</div>
                  <div className="text-xs text-gray-600 mt-1">승인 전이라도 어떤 요청이 있는지 미리 확인 가능</div>
                </Link>
              </div>
            )}

            {role === 'HOSPITAL' && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-gray-900">다음 단계</h2>
                <Link
                  href="/dashboard/hospital"
                  className="block rounded-xl border-2 border-primary-500 bg-primary-50 p-4 hover:shadow-md transition"
                >
                  <div className="font-semibold text-primary-700">기관 정보 보완</div>
                  <div className="text-xs text-gray-600 mt-1">기관 정보를 보완하고 환자 등록을 시작해주세요.</div>
                </Link>
              </div>
            )}
          </div>

          {/* 추천 코드 */}
          {referralCode && (
            <div className="mt-8 p-4 rounded-xl bg-gray-50 border border-gray-200 text-left">
              <div className="text-xs text-gray-500 mb-1">내 추천 코드</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-gray-900 flex-1">{referralCode}</span>
                <button
                  type="button"
                  onClick={copyReferral}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-medium hover:bg-gray-100"
                >
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                지인에게 이 코드를 공유하면 가입 시 포인트가 지급됩니다.
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push(dashboardPath)}
            className="btn-primary w-full mt-8 py-3"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RegisterCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    }>
      <CompleteInner />
    </Suspense>
  );
}
