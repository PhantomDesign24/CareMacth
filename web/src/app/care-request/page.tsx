"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import CareRequestForm from "@/components/CareRequestForm";
import { FiInfo, FiSearch } from "react-icons/fi";
import { careRequestAPI, guardianAPI } from "@/lib/api";
import { AxiosError } from "axios";

export default function CareRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);

    try {
      // 1. 환자 먼저 등록 (또는 기존 환자 사용)
      const patientPayload: Record<string, unknown> = {
        name: data.patientName,
        birthDate: data.patientAge ? `${new Date().getFullYear() - parseInt(data.patientAge)}-01-01` : undefined,
        gender: data.patientGender === '남성' ? 'M' : data.patientGender === '여성' ? 'F' : (data.patientGender || 'M').substring(0, 1).toUpperCase(),
        weight: data.patientWeight ? parseFloat(data.patientWeight) : undefined,
        mobilityStatus: (data.mobility || 'INDEPENDENT').toUpperCase(),
        hasDementia: data.hasDementia || false,
        hasInfection: data.hasInfection || false,
        infectionDetail: data.infectionDetails || undefined,
        diagnosis: Array.isArray(data.diagnosis) ? data.diagnosis.join(', ') : data.diagnosis || undefined,
        medicalNotes: data.specialNotes || undefined,
      };

      const patientRes = await guardianAPI.createPatient(patientPayload);
      const patientId = patientRes.data?.data?.id || patientRes.data?.id;

      if (!patientId) {
        throw new Error("환자 등록에 실패했습니다.");
      }

      // 2. 간병 요청 생성
      const careTypeMap: Record<string, string> = { '1:1 간병': 'INDIVIDUAL', '가족 간병': 'FAMILY' };
      const scheduleMap: Record<string, string> = { '24시간': 'FULL_TIME', '시간제': 'PART_TIME' };
      const locationMap: Record<string, string> = { '병원': 'HOSPITAL', '자택': 'HOME' };

      const requestPayload: Record<string, unknown> = {
        patientId,
        careType: careTypeMap[data.careType] || data.careType || 'INDIVIDUAL',
        scheduleType: scheduleMap[data.careSchedule] || data.careSchedule || 'FULL_TIME',
        location: locationMap[data.locationType] || data.locationType || 'HOSPITAL',
        hospitalName: data.locationName || undefined,
        address: data.locationAddress || '주소 미입력',
        region: data.region || undefined,
        startDate: data.startDate || new Date().toISOString(),
        endDate: data.duration ? undefined : undefined,
        durationDays: data.duration ? parseInt(data.duration) * (data.durationUnit === '개월' ? 30 : data.durationUnit === '주' ? 7 : 1) : undefined,
        dailyRate: data.dailyRate ? parseInt(data.dailyRate) : 150000,
        preferredGender: data.preferredGender || undefined,
        specialRequirements: data.specialNotes || undefined,
      };

      await careRequestAPI.create(requestPayload);
      setSubmitSuccess(true);
      // Redirect to dashboard after brief delay so user sees success message
      setTimeout(() => {
        router.push("/dashboard/guardian");
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const respData = err.response.data;
        setSubmitError(
          respData?.message || respData?.error || "간병 요청 중 오류가 발생했습니다."
        );
      } else {
        setSubmitError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* Hero Banner - Clean, action-oriented */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 40%, #0F3460 100%)" }}>
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 sm:w-[400px] h-72 sm:h-[400px] rounded-full bg-[#FF922E]/10 blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-48 sm:w-[300px] h-48 sm:h-[300px] rounded-full bg-[#37CEB3]/10 blur-[100px]" />
          {/* Subtle search icon pattern */}
          <div className="absolute top-8 right-[10%] opacity-[0.04]">
            <FiSearch className="w-32 h-32 sm:w-48 sm:h-48 text-white" />
          </div>
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white/90 text-xs sm:text-sm font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-[#FF922E] animate-pulse" />
            AI 매칭 시스템
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
            간병인을 찾고 계신가요?
          </h1>
          <p className="text-sm sm:text-lg text-gray-300 leading-relaxed">
            환자 정보와 원하는 간병 조건을 입력하면,
            <br className="hidden sm:block" />
            최적의 간병인을 매칭해 드립니다.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10 pb-12 sm:pb-16">
        {/* Success message */}
        {submitSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-700 text-center">
            간병 요청이 접수되었습니다. 매칭을 시작합니다. 잠시 후 대시보드로 이동합니다.
          </div>
        )}

        {/* Error message */}
        {submitError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 text-center">
            {submitError}
          </div>
        )}

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 md:p-10">
          {submitting && (
            <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-primary-50 border border-primary-200 rounded-xl text-sm text-primary-700">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              간병 요청을 접수하고 있습니다...
            </div>
          )}
          <CareRequestForm onSubmit={handleSubmit} />
        </div>

        {/* Info notice */}
        <div className="mt-4 sm:mt-6 bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
          <div className="flex items-start gap-3">
            <FiInfo className="shrink-0 text-primary-400 mt-0.5 w-5 h-5" />
            <div className="text-xs sm:text-sm text-gray-600 leading-relaxed space-y-1">
              <p>
                요청 접수 후 AI 자동 매칭을 통해 평균 30분 이내에 간병인이
                매칭됩니다.
              </p>
              <p>
                긴급한 경우 고객센터(
                <a
                  href="tel:1555-0801"
                  className="text-primary-500 font-semibold hover:underline"
                >
                  1555-0801
                </a>
                )로 연락해 주세요.
              </p>
              <p>
                케어코디네이터가 간병 전 과정을 함께 관리합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
