"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CareRequestForm from "@/components/CareRequestForm";
import { FiInfo, FiSearch } from "react-icons/fi";
import { careRequestAPI, guardianAPI } from "@/lib/api";
import { AxiosError } from "axios";
import { showToast } from "@/components/Toast";
import { SITE } from "@/config/site";

export default function CareRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  // 역할 가드: GUARDIAN / HOSPITAL / ADMIN 만 접근 가능
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("cm_access_token");
    if (!token) {
      router.replace("/auth/register?role=guardian");
      return;
    }
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const role = user?.role;
      // 간병인은 일감 찾기 페이지로 자동 우회 (alert 없이 즉시 라우팅)
      if (role === "CAREGIVER") {
        router.replace("/find-work");
        return;
      }
      if (role && !["GUARDIAN", "HOSPITAL", "ADMIN"].includes(role)) {
        alert("간병 신청은 보호자 또는 병원 회원만 가능합니다.");
        router.replace("/");
        return;
      }
      // 역할 검사 통과
      setAuthorized(true);
    } catch {
      router.replace("/auth/login");
    }
  }, [router]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);

    try {
      // 1. 환자 먼저 등록 (또는 기존 환자 사용)
      // Gender mapping: form sends "male"/"female", Prisma expects "M"/"F"
      const genderMap: Record<string, string> = { male: 'M', female: 'F', '남성': 'M', '여성': 'F', m: 'M', f: 'F' };
      const resolvedGender = genderMap[data.patientGender?.toLowerCase()] || 'M';

      // Mobility mapping: form sends "independent"/"assisted"/"wheelchair"/"bedridden"/"partial", Prisma expects "INDEPENDENT"/"PARTIAL"/"DEPENDENT"
      const mobilityMap: Record<string, string> = {
        independent: 'INDEPENDENT',
        partial: 'PARTIAL',
        assisted: 'PARTIAL',
        wheelchair: 'DEPENDENT',
        bedridden: 'DEPENDENT',
        dependent: 'DEPENDENT',
      };
      const resolvedMobility = mobilityMap[data.mobility?.toLowerCase()] || 'INDEPENDENT';

      const ynToBool = (v: string): boolean | undefined => v === 'YES' ? true : v === 'NO' ? false : undefined;

      const patientPayload: Record<string, unknown> = {
        name: data.patientName,
        birthDate: data.patientAge ? `${new Date().getFullYear() - parseInt(data.patientAge)}-01-01` : undefined,
        gender: resolvedGender,
        weight: data.patientWeight ? parseFloat(data.patientWeight) : undefined,
        height: data.patientHeight ? parseFloat(data.patientHeight) : undefined,
        consciousness: data.consciousness || undefined,
        mobilityStatus: resolvedMobility,
        hasDementia: data.hasDementia || false,
        dementiaLevel: data.hasDementia ? (data.dementiaLevel || undefined) : undefined,
        hasInfection: data.hasInfection || false,
        infectionDetail: data.infectionDetails || undefined,
        diagnosis: Array.isArray(data.diagnosis) ? data.diagnosis.join(', ') : data.diagnosis || undefined,
        diagnoses: Array.isArray(data.diagnosis) ? data.diagnosis : undefined,
        medicalNotes: data.specialNotes || undefined,
        // ── 신규 환자 상태
        infections: Array.isArray(data.infections) ? data.infections : undefined,
        roomType: data.roomType || undefined,
        roomTypeEtc: data.roomTypeEtc || undefined,
        longTermCareGrade: data.longTermCareGrade || undefined,
        hasSurgery: ynToBool(data.hasSurgery),
        treatments: Array.isArray(data.treatments) ? data.treatments : undefined,
        treatmentsEtc: data.treatmentsEtc || undefined,
        paralysisStatus: data.paralysisStatus || undefined,
        hygieneStatus: data.hygieneStatus || undefined,
        hygieneStatusEtc: data.hygieneStatusEtc || undefined,
        mealStatus: data.mealStatus || undefined,
        mealStatusEtc: data.mealStatusEtc || undefined,
        toiletStatus: data.toiletStatus || undefined,
        toiletStatusEtc: data.toiletStatusEtc || undefined,
        exerciseStatus: data.exerciseStatus || undefined,
        exerciseStatusEtc: data.exerciseStatusEtc || undefined,
        hasDelirium: ynToBool(data.hasDelirium),
        hasBedsore: ynToBool(data.hasBedsore),
        needsSuction: ynToBool(data.needsSuction),
        hasStoma: ynToBool(data.hasStoma),
        hospitalizationReason: data.hospitalizationReason || undefined,
        hospitalizationReasonEtc: data.hospitalizationReasonEtc || undefined,
        covidTestRequirement: data.covidTestRequirement || undefined,
        vaccineCheckRequirement: data.vaccineCheckRequirement || undefined,
      };

      const patientRes = await guardianAPI.createPatient(patientPayload);
      const patientId = patientRes.data?.data?.id || patientRes.data?.id;

      if (!patientId) {
        throw new Error("환자 등록에 실패했습니다.");
      }

      // 2. 간병 요청 생성
      // CareType mapping: form sends "hospital"/"home"/"visit"/"daily", Prisma expects "INDIVIDUAL"/"FAMILY"
      const careTypeMap: Record<string, string> = { hospital: 'INDIVIDUAL', home: 'FAMILY', visit: 'INDIVIDUAL', daily: 'INDIVIDUAL' };
      // Schedule mapping: form sends "24h"/"hourly", Prisma expects "FULL_TIME"/"PART_TIME"
      const scheduleMap: Record<string, string> = { '24h': 'FULL_TIME', hourly: 'PART_TIME', parttime: 'PART_TIME' };
      // Location mapping: form sends "hospital"/"home", Prisma expects "HOSPITAL"/"HOME"
      const locationMap: Record<string, string> = { hospital: 'HOSPITAL', home: 'HOME' };
      // PreferredGender mapping: form sends "male"/"female"/"", Prisma expects "M"/"F"/undefined
      const preferredGenderMap: Record<string, string> = { male: 'M', female: 'F', '남성': 'M', '여성': 'F' };

      // Address mapping: locationName is hospital name (for hospital) or main address (for home)
      const isHospital = data.locationType === 'hospital';
      const hospitalName = isHospital ? (data.locationName || undefined) : undefined;
      const address = isHospital
        ? (data.locationAddress || data.locationName || '주소 미입력')
        : ([data.locationName, data.locationAddress].filter(Boolean).join(' ') || '주소 미입력');

      const requestPayload: Record<string, unknown> = {
        patientId,
        careType: careTypeMap[data.careType] || 'INDIVIDUAL',
        scheduleType: scheduleMap[data.careSchedule] || 'FULL_TIME',
        location: locationMap[data.locationType] || 'HOSPITAL',
        hospitalName,
        address,
        region: Array.isArray(data.regions) && data.regions.length > 0 ? data.regions[0] : undefined,
        regions: Array.isArray(data.regions) ? data.regions : [],
        startDate: data.startDate || new Date().toISOString(),
        endDate: data.duration ? undefined : undefined,
        durationDays: data.duration ? parseInt(data.duration) * (data.durationUnit === 'months' || data.durationUnit === '개월' ? 30 : data.durationUnit === 'weeks' || data.durationUnit === '주' ? 7 : 1) : undefined,
        dailyRate: data.dailyRate ? parseInt(data.dailyRate) : undefined,
        preferredGender: data.preferredGender ? (preferredGenderMap[data.preferredGender.toLowerCase()] || undefined) : undefined,
        specialRequirements: data.specialNotes || undefined,
        // ── 신규: 신청인-환자 관계 / 희망 서비스 / 희망 급여
        relationToPatient: data.relationToPatient || undefined,
        preferredServices: Array.isArray(data.preferredServices) ? data.preferredServices : undefined,
        preferredWageType: data.preferredWageType || undefined,
        preferredWageAmount: data.preferredWageAmount ? parseInt(data.preferredWageAmount) : undefined,
      };

      await careRequestAPI.create(requestPayload);
      setSubmitSuccess(true);
      showToast("간병 요청이 접수되었습니다. 매칭을 시작합니다.", "success");
      setTimeout(() => {
        router.push("/dashboard/guardian");
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const respData = err.response.data;
        const msg = respData?.message || respData?.error || "간병 요청 중 오류가 발생했습니다.";
        setSubmitError(msg);
        showToast(msg, "error");
      } else {
        const msg = "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
        setSubmitError(msg);
        showToast(msg, "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 인증 확인 전에는 콘텐츠 노출 금지 (비회원이 폼 보이지 않도록)
  if (!authorized) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
          <p className="mt-4 text-sm text-gray-500">로그인 상태를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* 제출 중 전체화면 로딩 오버레이 — 모든 클릭/입력 차단 */}
      {submitting && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
          aria-busy="true"
          aria-live="polite"
          onClick={(e) => e.preventDefault()}
        >
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-7 max-w-sm w-full text-center">
            <svg className="animate-spin h-12 w-12 mx-auto text-primary-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h3 className="mt-4 text-base font-bold text-gray-900">간병 요청을 접수 중입니다</h3>
            <p className="mt-1 text-xs text-gray-500">잠시만 기다려주세요. 페이지를 닫지 마세요.</p>
          </div>
        </div>
      )}

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
          <CareRequestForm onSubmit={handleSubmit} submitting={submitting} />
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
                  href={`tel:${SITE.phone}`}
                  className="text-primary-500 font-semibold hover:underline"
                >
                  {SITE.phone}
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
