'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authAPI } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSubmitted(false);

    try {
      // 백엔드는 임시 비밀번호를 응답 body 가 아닌 이메일로 발송 (보안 정책)
      // res.success === true 면 발송 큐 등록 성공으로 간주
      await authAPI.resetPassword(email);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || '비밀번호 재설정 중 오류가 발생했습니다.');
      } else {
        setError('비밀번호 재설정 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">비밀번호 찾기</h1>
        <p className="text-gray-500 text-center mb-8">
          가입한 이메일을 입력하시면 임시 비밀번호를 메일로 발송해드립니다.
        </p>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">📧</div>
            <h2 className="font-semibold text-green-800 mb-2">임시 비밀번호 메일 발송 완료</h2>
            <p className="text-sm text-green-700 mb-4">
              <span className="font-semibold">{email}</span> 으로 임시 비밀번호를 발송했습니다.<br />
              메일함을 확인하신 뒤 로그인 후 비밀번호를 변경해주세요.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              ※ 메일이 도착하지 않으면 스팸함을 확인하거나 잠시 후 다시 시도해주세요.
            </p>
            <Link href="/auth/login" className="inline-block text-sm text-primary-600 font-medium hover:underline">
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="가입한 이메일 주소"
                className="input-field"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? '처리 중...' : '임시 비밀번호 발급'}
            </button>
            <div className="text-center">
              <Link href="/auth/login" className="text-sm text-gray-500 hover:text-primary-600">
                로그인으로 돌아가기
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
