"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { reviewAPI, guardianAPI } from "@/lib/api";
import { formatDate, formatCareType, formatLocation } from "@/lib/format";

interface ContractInfo {
  id: string;
  caregiverName: string;
  caregiverImage: string | null;
  patientName: string;
  careType: string;
  location: string;
  startDate: string;
  endDate: string;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [contract, setContract] = useState<ContractInfo | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [wouldRehire, setWouldRehire] = useState(false);

  const fetchContract = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await guardianAPI.getCareHistory();
      const data = res.data?.data || res.data || {};
      const contracts = data.contracts || [];
      const found = contracts.find((c: any) => c.id === contractId);
      if (!found) {
        setError("계약 정보를 찾을 수 없습니다.");
        return;
      }
      setContract({
        id: found.id,
        caregiverName: found.caregiver?.user?.name || "-",
        caregiverImage: found.caregiver?.user?.profileImage || null,
        patientName: found.careRequest?.patient?.name || "-",
        careType: found.careRequest?.careType || "",
        location: found.careRequest?.location || "",
        startDate: found.startDate ? new Date(found.startDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : "",
        endDate: found.endDate ? new Date(found.endDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : "",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "데이터를 불러오는 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      alert("별점을 선택해주세요.");
      return;
    }
    if (comment.trim().length === 0) {
      alert("리뷰 내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await reviewAPI.create({
        contractId,
        rating,
        comment: comment.trim(),
        wouldRehire,
      });
      alert("리뷰가 등록되었습니다. 감사합니다!");
      router.push("/dashboard/guardian");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "리뷰 등록 중 오류가 발생했습니다.";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-primary-500 mx-auto mb-4"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-gray-500">정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            오류가 발생했습니다
          </h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button type="button" onClick={fetchContract} className="btn-primary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/dashboard/guardian"
          className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          대시보드로 돌아가기
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-8">리뷰 작성</h1>

        {/* Contract summary */}
        <div className="card mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            간병 정보
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
              {contract?.caregiverImage ? (
                <img
                  src={contract.caregiverImage}
                  alt={contract.caregiverName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg
                  className="w-7 h-7 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">
                {contract?.caregiverName}
              </h3>
              <p className="text-sm text-gray-500">간병인</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">환자명</span>
              <p className="font-medium text-gray-900">
                {contract?.patientName}
              </p>
            </div>
            <div>
              <span className="text-gray-500">간병 유형</span>
              <p className="font-medium text-gray-900">
                {formatCareType(contract?.careType || "")}
              </p>
            </div>
            <div>
              <span className="text-gray-500">장소</span>
              <p className="font-medium text-gray-900">
                {formatLocation(contract?.location || "")}
              </p>
            </div>
            <div>
              <span className="text-gray-500">기간</span>
              <p className="font-medium text-gray-900">
                {formatDate(contract?.startDate)} ~{" "}
                {formatDate(contract?.endDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Review form */}
        <form onSubmit={handleSubmit}>
          <div className="card mb-6">
            {/* Star rating */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                별점 평가
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <svg
                      className={`w-10 h-10 ${
                        star <= displayRating
                          ? "text-amber-400"
                          : "text-gray-300"
                      } transition-colors`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-3 text-lg font-semibold text-gray-700">
                    {rating}점
                  </span>
                )}
              </div>
              {rating === 0 && (
                <p className="text-sm text-gray-400 mt-2">
                  별을 클릭하여 평가해주세요
                </p>
              )}
            </div>

            {/* Comment */}
            <div className="mb-8">
              <label
                htmlFor="review-comment"
                className="block text-sm font-semibold text-gray-700 mb-3"
              >
                리뷰 내용
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => {
                  if (e.target.value.length <= 1000) {
                    setComment(e.target.value);
                  }
                }}
                placeholder="간병 서비스에 대한 솔직한 리뷰를 작성해주세요."
                rows={6}
                className="input-field resize-none"
              />
              <div className="flex justify-end mt-1">
                <span
                  className={`text-sm ${
                    comment.length >= 950 ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  {comment.length}/1,000
                </span>
              </div>
            </div>

            {/* Would rehire */}
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wouldRehire}
                  onChange={(e) => setWouldRehire(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-700">
                    재고용 의사
                  </span>
                  <p className="text-sm text-gray-400">
                    이 간병인과 다시 함께하고 싶으신가요?
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Link
              href="/dashboard/guardian"
              className="btn-secondary flex-1 text-center"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="btn-primary flex-1"
            >
              {submitting ? (
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                "리뷰 등록"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
