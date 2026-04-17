"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { dashboardAPI, careRequestAPI, paymentAPI, guardianAPI, contractAPI, extensionAPI, authAPI, insuranceAPI, disputeAPI } from "@/lib/api";
import { formatDate, formatMoney, formatCareStatus, formatContractStatus, formatPaymentStatus, formatPaymentMethod, formatCareType, formatLocation, formatMobility } from "@/lib/format";
import { showToast } from "@/components/Toast";
import NotificationPrefsSection from "@/components/NotificationPrefsSection";
import InsuranceTab from "@/components/InsuranceTab";
import { SITE } from "@/config/site";

interface CareHistory {
  id: string;
  patientName: string;
  caregiverName: string;
  startDate: string;
  endDate: string;
  startDateRaw: string;
  endDateRaw: string;
  status: string;
  careType: string;
  location: string;
  amount: number;
  dailyRate: number;
  careRequestId: string;
  applicantCount: number;
  contractStatus: string;
  hasReview: boolean;
  isVirtual: boolean; // 계약 없는 케어리퀘스트 (매칭 전)
  requestStatus: string; // CareRequest.status (OPEN/MATCHING/MATCHED/CANCELLED/COMPLETED)
  isPaid: boolean; // 결제 완료 여부
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  status: string;
  description: string;
}

interface PatientRaw {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  consciousness: string | null;
  mobilityStatus: string;
  hasDementia: boolean;
  dementiaLevel: string | null;
  hasInfection: boolean;
  infectionDetail: string | null;
  weight: number | null;
  height: number | null;
  diagnosis: string | null;
  medicalNotes: string | null;
}

interface PatientDisplay {
  id: string;
  name: string;
  age: number;
  gender: string;
  weight: string;
  height: string;
  diagnosis: string;
  mobility: string;
  dementia: string;
  infection: string;
  infectionDetail: string;
  medicalNotes: string;
  raw: PatientRaw;
}

interface DashboardSummary {
  userName: string;
  activeCareCount: number;
  completedCareCount: number;
  monthlyExpense: number;
  referralCredits: number;
  referralCode: string;
  patients: PatientDisplay[];
}

interface PatientFormData {
  name: string;
  birthDate: string;
  gender: string;
  consciousness: string;
  mobilityStatus: string;
  hasDementia: boolean;
  dementiaLevel: string;
  hasInfection: boolean;
  infectionDetail: string;
  weight: string;
  height: string;
  diagnosis: string[];
  medicalNotes: string;
}

const emptyPatientForm: PatientFormData = {
  name: '',
  birthDate: '',
  gender: 'M',
  consciousness: '',
  mobilityStatus: 'INDEPENDENT',
  hasDementia: false,
  dementiaLevel: '',
  hasInfection: false,
  infectionDetail: '',
  weight: '',
  height: '',
  diagnosis: [],
  medicalNotes: '',
};

const DIAGNOSIS_CATEGORIES = [
  { label: "감염성 질환", items: ["CRE", "VRE", "MRSA", "결핵", "COVID-19", "간염(A/B/C형)", "HIV/AIDS", "패혈증"] },
  { label: "암/종양", items: ["위암", "폐암", "간암", "대장암", "유방암", "췌장암", "갑상선암", "전립선암", "방광암", "자궁암", "뇌종양", "혈액암(백혈병)", "림프종", "기타 암"] },
  { label: "뇌/신경계 질환", items: ["뇌졸중(뇌경색/뇌출혈)", "치매(알츠하이머)", "파킨슨병", "뇌손상/두부외상", "간질(뇌전증)", "척수손상", "다발성경화증", "근위축성측삭경화증(ALS)"] },
  { label: "근골격계 질환", items: ["골절(대퇴골/척추/골반 등)", "관절염", "디스크(추간판탈출증)", "골다공증", "인공관절수술", "척추수술 후"] },
  { label: "심혈관 질환", items: ["심근경색", "심부전", "부정맥", "협심증", "고혈압", "대동맥질환"] },
  { label: "호흡기 질환", items: ["폐렴", "만성폐쇄성폐질환(COPD)", "천식", "폐섬유증", "기관지확장증"] },
  { label: "소화기 질환", items: ["간경화", "장폐색", "크론병", "궤양성대장염", "췌장염"] },
  { label: "내분비/대사 질환", items: ["당뇨병(1형/2형)", "갑상선질환", "신부전/투석"] },
  { label: "기타", items: ["욕창", "연하장애(삼킴곤란)", "인공호흡기", "기관절개 상태", "비위관(L-tube)", "장루/요루", "수술 후 회복", "노환/노쇠", "기타(직접입력)"] },
];

export default function GuardianDashboardPage() {
  return (
    <Suspense fallback={null}>
      <GuardianDashboard />
    </Suspense>
  );
}

function GuardianDashboard() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const validTabs = ["history", "payments", "patients", "insurance", "referral", "settings"] as const;
  type TabKey = typeof validTabs[number];
  const tabFromUrl = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(validTabs.includes(tabFromUrl as TabKey) ? (tabFromUrl as TabKey) : "history");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [careHistory, setCareHistory] = useState<CareHistory[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Cancel contract modal state
  const [cancelContractId, setCancelContractId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // 환불 모달
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  // 보험서류 신청 모달
  const [insuranceTarget, setInsuranceTarget] = useState<CareHistory | null>(null);
  const [insuranceForm, setInsuranceForm] = useState({
    insuranceCompany: "",
    documentType: "간병확인서",
  });
  const [insuranceLoading, setInsuranceLoading] = useState(false);

  // 분쟁 접수 모달
  const [disputeTarget, setDisputeTarget] = useState<CareHistory | null>(null);
  const [disputeForm, setDisputeForm] = useState({
    category: "CARE_QUALITY",
    title: "",
    description: "",
  });
  const [disputeLoading, setDisputeLoading] = useState(false);

  // Extend contract modal state
  const [extendTarget, setExtendTarget] = useState<CareHistory | null>(null);
  const [extendEndDate, setExtendEndDate] = useState("");
  const [extendNewCaregiver, setExtendNewCaregiver] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState("");

  // History filter
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  // Payment filter
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Delete account modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "탈퇴합니다") {
      setDeleteError('"탈퇴합니다"를 정확히 입력해주세요.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await authAPI.deleteAccount(deletePassword, deleteReason);
      alert("회원 탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다.");
      localStorage.removeItem("cm_access_token");
      localStorage.removeItem("cm_refresh_token");
      window.location.href = "/";
    } catch (err: unknown) {
      const message =
        (err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null) || "탈퇴 처리 중 오류가 발생했습니다.";
      setDeleteError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Patient modal state
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [patientForm, setPatientForm] = useState<PatientFormData>(emptyPatientForm);
  const [patientFormError, setPatientFormError] = useState("");
  const [patientFormLoading, setPatientFormLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [guardianRes, careHistoryRes, payRes] = await Promise.all([
        dashboardAPI.guardianSummary(),
        guardianAPI.getCareHistory(),
        guardianAPI.getPayments(),
      ]);
      // 보호자 정보
      const g = guardianRes.data?.data || guardianRes.data || {};
      const user = g.user || {};
      const patients = g.patients || [];

      // 간병 이력 (계약 기반)
      const historyData = careHistoryRes.data?.data || careHistoryRes.data || {};
      const contracts = historyData.contracts || [];
      const activeCount = contracts.filter((c: any) => c.status === 'ACTIVE').length;
      const completedCount = contracts.filter((c: any) => c.status === 'COMPLETED').length;

      // 결제 내역
      const payData = payRes.data?.data || payRes.data || {};
      const paymentList = payData.payments || [];
      // 이번 달 비용: 이번 달에 결제 완료(COMPLETED)된 금액만 합산 (PENDING 제외)
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthlyTotal = paymentList
        .filter((p: any) => {
          if (p.status !== 'COMPLETED' && p.status !== 'ESCROW') return false;
          const paidAt = p.paidAt || p.createdAt;
          if (!paidAt) return false;
          return new Date(paidAt).getTime() >= thisMonthStart;
        })
        .reduce((s: number, p: any) => s + (p.totalAmount || 0), 0);

      setSummary({
        userName: user.name || '',
        activeCareCount: activeCount,
        completedCareCount: completedCount,
        monthlyExpense: monthlyTotal,
        referralCredits: user.points || 0,
        referralCode: user.referralCode || '',
        patients: patients.map((p: any) => ({
          id: p.id,
          name: p.name,
          age: p.birthDate ? new Date().getFullYear() - new Date(p.birthDate).getFullYear() : 0,
          gender: p.gender === 'F' ? '여' : '남',
          weight: p.weight ? `${p.weight}kg` : '-',
          height: p.height ? `${p.height}cm` : '-',
          diagnosis: p.diagnosis || '-',
          mobility: formatMobility(p.mobilityStatus || ''),
          dementia: p.hasDementia ? '있음' : '없음',
          infection: p.hasInfection ? '있음' : '없음',
          infectionDetail: p.infectionDetail || '',
          medicalNotes: p.medicalNotes || '',
          raw: {
            id: p.id,
            name: p.name,
            birthDate: p.birthDate ? new Date(p.birthDate).toISOString().split('T')[0] : '',
            gender: p.gender || 'M',
            consciousness: p.consciousness || null,
            mobilityStatus: p.mobilityStatus || 'INDEPENDENT',
            hasDementia: p.hasDementia ?? false,
            dementiaLevel: p.dementiaLevel || null,
            hasInfection: p.hasInfection ?? false,
            infectionDetail: p.infectionDetail || null,
            weight: p.weight,
            height: p.height,
            diagnosis: p.diagnosis || null,
            medicalNotes: p.medicalNotes || null,
          },
        })),
      });

      setCareHistory(contracts.map((c: any) => {
        const isVirtual = !!c.virtualContract;
        const crStatus = c.careRequest?.status || c.status || '';
        // 결제 상태 판정
        // - COMPLETED: 최종 결제 완료
        // - ESCROW: 에스크로 보관 중 (결제는 됨, 서비스 정산 전)
        // - PENDING/FAILED/REFUNDED: 미결제
        const payments = Array.isArray(c.payments) ? c.payments : [];
        const isPaid = !isVirtual && payments.some((p: any) => p.status === 'COMPLETED');
        const isEscrow = !isVirtual && !isPaid && payments.some((p: any) => p.status === 'ESCROW');

        // 상태 라벨
        let statusLabel: string;
        if (isVirtual) {
          statusLabel = formatCareStatus(crStatus);
        } else if ((c.status === 'ACTIVE' || c.status === 'EXTENDED') && !isPaid && !isEscrow) {
          statusLabel = '결제 대기';
        } else if ((c.status === 'ACTIVE' || c.status === 'EXTENDED') && isEscrow) {
          statusLabel = '에스크로 보관중';
        } else {
          statusLabel = formatContractStatus(c.status);
        }
        return {
          id: c.id,
          patientName: c.careRequest?.patient?.name || '-',
          caregiverName: isVirtual ? '-' : (c.caregiver?.user?.name || '대기 중'),
          startDate: formatDate(c.startDate),
          endDate: formatDate(c.endDate),
          startDateRaw: c.startDate,
          endDateRaw: c.endDate,
          status: statusLabel,
          careType: formatCareType(c.careRequest?.careType || ''),
          location: formatLocation(c.careRequest?.location || ''),
          amount: c.totalAmount || 0,
          dailyRate: c.dailyRate || 0,
          careRequestId: c.careRequest?.id || c.careRequestId || '',
          applicantCount: c.careRequest?._count?.applications ?? c.careRequest?.applications?.length ?? 0,
          contractStatus: c.status || '',
          hasReview: !!c.review,
          isVirtual,
          requestStatus: crStatus,
          isPaid,
        };
      }));

      setPayments(paymentList.map((p: any) => ({
        id: p.id,
        date: formatDate(p.paidAt || p.createdAt),
        amount: p.totalAmount,
        method: formatPaymentMethod(p.method),
        status: formatPaymentStatus(p.status),
        description: '간병 서비스 이용료',
      })));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cm_access_token') : null;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    fetchData();
  }, [fetchData, router]);

  const referralCode = summary?.referralCode ?? "";

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    alert("추천인 코드가 복사되었습니다.");
  };

  // Patient modal handlers
  const openCreatePatientModal = () => {
    setEditingPatientId(null);
    setPatientForm(emptyPatientForm);
    setPatientFormError("");
    setShowPatientModal(true);
  };

  const openEditPatientModal = (patient: PatientDisplay) => {
    setEditingPatientId(patient.raw.id);
    setPatientForm({
      name: patient.raw.name,
      birthDate: patient.raw.birthDate,
      gender: patient.raw.gender,
      consciousness: (patient.raw as any).consciousness || '',
      mobilityStatus: patient.raw.mobilityStatus,
      hasDementia: patient.raw.hasDementia,
      dementiaLevel: (patient.raw as any).dementiaLevel || '',
      hasInfection: patient.raw.hasInfection,
      infectionDetail: patient.raw.infectionDetail || '',
      weight: patient.raw.weight != null ? String(patient.raw.weight) : '',
      height: patient.raw.height != null ? String(patient.raw.height) : '',
      diagnosis: patient.raw.diagnosis ? patient.raw.diagnosis.split(', ').filter(Boolean) : [],
      medicalNotes: patient.raw.medicalNotes || '',
    });
    setPatientFormError("");
    setShowPatientModal(true);
  };

  const closePatientModal = () => {
    setShowPatientModal(false);
    setEditingPatientId(null);
    setPatientFormError("");
  };

  const handlePatientFormChange = (field: keyof PatientFormData, value: string | boolean | string[]) => {
    setPatientForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePatientFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatientFormError("");
    setPatientFormLoading(true);

    try {
      if (!patientForm.name.trim()) {
        setPatientFormError("이름을 입력해주세요.");
        setPatientFormLoading(false);
        return;
      }
      if (!patientForm.birthDate) {
        setPatientFormError("생년월일을 입력해주세요.");
        setPatientFormLoading(false);
        return;
      }

      const payload: Record<string, unknown> = {
        name: patientForm.name.trim(),
        birthDate: patientForm.birthDate,
        gender: patientForm.gender,
        consciousness: patientForm.consciousness || null,
        mobilityStatus: patientForm.mobilityStatus,
        hasDementia: patientForm.hasDementia,
        dementiaLevel: patientForm.hasDementia ? (patientForm.dementiaLevel || null) : null,
        hasInfection: patientForm.hasInfection,
        infectionDetail: patientForm.hasInfection ? patientForm.infectionDetail : null,
        weight: patientForm.weight ? parseFloat(patientForm.weight) : null,
        height: patientForm.height ? parseFloat(patientForm.height) : null,
        diagnosis: patientForm.diagnosis.length > 0 ? patientForm.diagnosis.join(', ') : null,
        medicalNotes: patientForm.medicalNotes || null,
      };

      if (editingPatientId) {
        await guardianAPI.updatePatient(editingPatientId, payload);
      } else {
        await guardianAPI.createPatient(payload);
      }

      closePatientModal();
      await fetchData();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string; errors?: Array<{ msg: string }> } } };
        const msg = axiosErr.response?.data?.errors?.[0]?.msg || axiosErr.response?.data?.message || '환자 정보 저장에 실패했습니다.';
        setPatientFormError(msg);
      } else {
        setPatientFormError('환자 정보 저장에 실패했습니다.');
      }
    } finally {
      setPatientFormLoading(false);
    }
  };

  const handleCancelContract = async () => {
    if (!cancelContractId || !cancelReason.trim()) {
      alert("취소 사유를 입력해주세요.");
      return;
    }
    setCancelLoading(true);
    try {
      await contractAPI.cancel(cancelContractId, cancelReason.trim());
      alert("계약이 취소되었습니다.");
      setCancelContractId(null);
      setCancelReason("");
      await fetchData();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || "계약 취소 중 오류가 발생했습니다.");
      } else {
        alert("계약 취소 중 오류가 발생했습니다.");
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const openExtendModal = (care: CareHistory) => {
    setExtendTarget(care);
    // 기본값: 현재 종료일의 7일 후
    const base = new Date(care.endDateRaw);
    base.setDate(base.getDate() + 7);
    setExtendEndDate(base.toISOString().slice(0, 10));
    setExtendNewCaregiver(false);
    setExtendError("");
  };

  const handleExtendContract = async () => {
    if (!extendTarget || !extendEndDate) {
      setExtendError("새 종료일을 선택해주세요.");
      return;
    }
    const curEnd = new Date(extendTarget.endDateRaw);
    const newEnd = new Date(extendEndDate);
    if (newEnd <= curEnd) {
      setExtendError("새 종료일은 기존 종료일 이후여야 합니다.");
      return;
    }
    const extraDays = Math.ceil((newEnd.getTime() - curEnd.getTime()) / (1000 * 60 * 60 * 24));
    const additionalAmount = extendTarget.dailyRate * extraDays;

    setExtendLoading(true);
    setExtendError("");
    try {
      await extensionAPI.extend(extendTarget.id, {
        newEndDate: new Date(extendEndDate).toISOString(),
        isNewCaregiver: extendNewCaregiver,
        additionalAmount,
      });
      alert(
        extendNewCaregiver
          ? "연장 요청이 접수되었습니다. 새 간병인 공고가 올라갔습니다."
          : `연장 완료되었습니다. (추가 ${extraDays}일 · ${additionalAmount.toLocaleString()}원)`
      );
      setExtendTarget(null);
      await fetchData();
    } catch (err: unknown) {
      const message =
        (err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null) || "연장 요청 중 오류가 발생했습니다.";
      setExtendError(message);
    } finally {
      setExtendLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "결제 대기":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">결제 대기</span>;
      case "active":
      case "진행 중":
        return <span className="badge-success">진행 중</span>;
      case "completed":
      case "완료":
        return <span className="badge-primary">완료</span>;
      case "cancelled":
      case "취소":
        return <span className="badge-danger">취소</span>;
      case "pending":
      case "대기 중":
        return <span className="badge-warning">대기 중</span>;
      case "extended":
      case "연장됨":
        return <span className="badge-primary">연장됨</span>;
      default:
        return <span className="badge-primary">{formatContractStatus(status)}</span>;
    }
  };

  // Check if any active care is ending within 3 days
  const showExtendButton = (endDate: string, status: string) => {
    if (status !== "active") return false;
    const end = new Date(endDate);
    const now = new Date();
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 3 && diff >= 0;
  };

  const tabs = [
    { key: "history" as const, label: "간병 이력" },
    { key: "payments" as const, label: "결제 내역" },
    { key: "patients" as const, label: "환자 정보" },
    { key: "insurance" as const, label: "보험서류" },
    { key: "referral" as const, label: "추천인 코드" },
    { key: "settings" as const, label: "계정 설정" },
  ];

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-primary-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500">대시보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button type="button" onClick={fetchData} className="btn-primary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const userName = summary?.userName ?? "보호자";
  const activeCareCount = summary?.activeCareCount ?? 0;
  const completedCareCount = summary?.completedCareCount ?? 0;
  const monthlyExpense = summary?.monthlyExpense ?? 0;
  const referralCredits = summary?.referralCredits ?? 0;
  const patients = summary?.patients ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">보호자 대시보드</h1>
            <p className="text-gray-500 mt-1">안녕하세요, {userName}님</p>
          </div>
          <Link href="/care-request" className="btn-primary">
            새 간병 요청하기
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <div className="card p-3 sm:p-5">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">진행 중</div>
            <div className="text-lg sm:text-2xl font-bold text-primary-600 whitespace-nowrap">{activeCareCount}건</div>
          </div>
          <div className="card p-3 sm:p-5">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">완료</div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 whitespace-nowrap">{completedCareCount}건</div>
          </div>
          <div className="card p-3 sm:p-5">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">이번 달 비용</div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 whitespace-nowrap">
              {monthlyExpense >= 100000000
                ? `${(monthlyExpense / 100000000).toFixed(1)}억`
                : monthlyExpense >= 10000
                ? `${Math.round(monthlyExpense / 10000).toLocaleString()}만원`
                : `${monthlyExpense.toLocaleString()}원`}
            </div>
          </div>
          <div className="card p-3 sm:p-5">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">추천 적립금</div>
            <div className="text-lg sm:text-2xl font-bold text-accent-500 whitespace-nowrap">
              {referralCredits >= 10000
                ? `${Math.round(referralCredits / 10000).toLocaleString()}만원`
                : `${referralCredits.toLocaleString()}원`}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 min-w-[100px] px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {/* Care history */}
          {activeTab === "history" && (
            <div>
              {/* 상단 툴바: 필터 + 새 요청 버튼 */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: `전체 (${careHistory.length})` },
                    { value: "OPEN", label: `매칭대기 (${careHistory.filter(c => c.requestStatus === 'OPEN').length})` },
                    { value: "MATCHING", label: `매칭중 (${careHistory.filter(c => c.requestStatus === 'MATCHING').length})` },
                    { value: "ACTIVE", label: `진행중 (${careHistory.filter(c => c.contractStatus === 'ACTIVE' || c.contractStatus === 'EXTENDED').length})` },
                    { value: "COMPLETED", label: `완료 (${careHistory.filter(c => c.contractStatus === 'COMPLETED').length})` },
                    { value: "CANCELLED", label: `취소 (${careHistory.filter(c => c.requestStatus === 'CANCELLED' || c.contractStatus === 'CANCELLED').length})` },
                  ].map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setHistoryFilter(f.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        historyFilter === f.value
                          ? "bg-primary-500 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-primary-300"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <Link
                  href="/care-request"
                  className="inline-flex items-center gap-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600"
                >
                  + 새 간병 요청
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
              {careHistory.filter((care) => {
                if (historyFilter === "all") return true;
                if (historyFilter === "OPEN") return care.requestStatus === 'OPEN';
                if (historyFilter === "MATCHING") return care.requestStatus === 'MATCHING';
                if (historyFilter === "ACTIVE") return care.contractStatus === 'ACTIVE' || care.contractStatus === 'EXTENDED';
                if (historyFilter === "COMPLETED") return care.contractStatus === 'COMPLETED';
                if (historyFilter === "CANCELLED") return care.requestStatus === 'CANCELLED' || care.contractStatus === 'CANCELLED';
                return true;
              }).map((care) => (
                <div key={care.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {statusBadge(care.status)}
                        <span className="text-xs text-gray-400">요청일: {care.startDate}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900">
                        {care.patientName} - {care.careType}
                      </h3>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                        <span>간병인: {care.caregiverName}</span>
                        <span>장소: {care.location}</span>
                        <span>
                          기간: {care.startDate} ~ {care.endDate}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {care.dailyRate > 0 ? `${care.dailyRate.toLocaleString()}원/일` : `${care.amount.toLocaleString()}원`}
                        </div>
                        {care.dailyRate > 0 && care.amount > care.dailyRate && (
                          <div className="text-xs text-gray-400">총 {care.amount.toLocaleString()}원</div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 결제 대기 중이면 결제 버튼 최우선 표시 */}
                        {!care.isVirtual && (care.contractStatus === 'ACTIVE' || care.contractStatus === 'EXTENDED') && !care.isPaid && (
                          <Link
                            href={`/dashboard/guardian/payment/${care.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                          >
                            💳 결제하기
                          </Link>
                        )}
                        {/* OPEN 상태: 공고 관리 (지원자 유무 관계없이 접근 가능) */}
                        {care.isVirtual && care.requestStatus === 'OPEN' && care.careRequestId && (
                          <>
                            <Link
                              href={`/dashboard/guardian/applicants/${care.careRequestId}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                            >
                              {care.applicantCount > 0 ? '지원자 보기' : '공고 관리'}
                              {care.applicantCount > 0 && (
                                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-primary-500 text-white rounded-full">
                                  {care.applicantCount}
                                </span>
                              )}
                            </Link>
                            {care.applicantCount === 0 && (
                              <button
                                type="button"
                                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                onClick={async () => {
                                  if (!confirm('이 공고를 취소하시겠습니까?')) return;
                                  try {
                                    await careRequestAPI.cancel(care.careRequestId!);
                                    showToast('공고가 취소되었습니다.', 'success');
                                    fetchData();
                                  } catch {
                                    showToast('공고 취소에 실패했습니다.', 'error');
                                  }
                                }}
                              >
                                공고 취소
                              </button>
                            )}
                          </>
                        )}
                        {/* 매칭 이후: 지원자 보기 */}
                        {care.careRequestId && !care.isVirtual && care.applicantCount > 0 && (
                          <Link
                            href={`/dashboard/guardian/applicants/${care.careRequestId}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                          >
                            지원자 보기
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-primary-500 text-white rounded-full">
                              {care.applicantCount}
                            </span>
                          </Link>
                        )}
                        {care.contractStatus === 'COMPLETED' && !care.hasReview && (
                          <Link
                            href={`/dashboard/guardian/review/${care.id}`}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-accent-600 bg-accent-50 rounded-lg hover:bg-accent-100 transition-colors"
                          >
                            리뷰 작성
                          </Link>
                        )}
                        {care.contractStatus === 'ACTIVE' && (
                          <button
                            type="button"
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            onClick={() => {
                              setCancelContractId(care.id);
                              setCancelReason("");
                            }}
                          >
                            취소
                          </button>
                        )}
                        {showExtendButton(care.endDate, care.status) && (
                          <button
                            type="button"
                            className="btn-accent text-sm px-4 py-2"
                            onClick={() => openExtendModal(care)}
                          >
                            연장 요청
                          </button>
                        )}
                        {!care.isVirtual && (
                          <button
                            type="button"
                            onClick={() => {
                              const t = typeof window !== "undefined" ? localStorage.getItem("cm_access_token") : "";
                              window.open(`/api/contracts/${care.id}/pdf?token=${encodeURIComponent(t || "")}`, "_blank");
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            📄 계약서
                          </button>
                        )}
                        {!care.isVirtual && (care.contractStatus === 'COMPLETED' || care.isPaid) && (
                          <button
                            type="button"
                            onClick={() => setInsuranceTarget(care)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                          >
                            🛡 보험서류
                          </button>
                        )}
                        {!care.isVirtual && (
                          <button
                            type="button"
                            onClick={() => setDisputeTarget(care)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            ⚠ 분쟁 접수
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {careHistory.length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  간병 이력이 없습니다.
                </div>
              )}
              </div>
            </div>
          )}

          {/* Payment history */}
          {activeTab === "payments" && (() => {
            // 실결제(완료/에스크로/환불)만 "유의미"한 내역으로 간주
            // PENDING/FAILED는 시도만 하고 완결 안 된 상태라 기본 숨김 (필터로 볼 수 있음)
            const meaningfulPayments = payments.filter(p => !/대기|PENDING|실패|FAILED/i.test(p.status));
            const paymentFilters = [
              { value: "all", label: "전체", count: meaningfulPayments.length },
              { value: "completed", label: "완료", count: payments.filter(p => /완료|COMPLETED|결제 완료/i.test(p.status)).length },
              { value: "escrow", label: "보관중", count: payments.filter(p => /ESCROW|에스크로/i.test(p.status)).length },
              { value: "refunded", label: "환불", count: payments.filter(p => /환불|REFUNDED/i.test(p.status)).length },
              { value: "pending", label: "대기", count: payments.filter(p => /대기|PENDING|결제 대기/i.test(p.status)).length },
              { value: "failed", label: "실패", count: payments.filter(p => /실패|FAILED/i.test(p.status)).length },
            ];
            const filteredPayments = payments.filter((p) => {
              // "전체"는 PENDING/FAILED 제외 (대기·실패는 명시적으로 선택해야 보임)
              if (paymentFilter === "all") return !/대기|PENDING|실패|FAILED/i.test(p.status);
              if (paymentFilter === "pending") return /대기|PENDING|결제 대기/i.test(p.status);
              if (paymentFilter === "completed") return /완료|COMPLETED|결제 완료/i.test(p.status);
              if (paymentFilter === "escrow") return /ESCROW|에스크로/i.test(p.status);
              if (paymentFilter === "refunded") return /환불|REFUNDED/i.test(p.status);
              if (paymentFilter === "failed") return /실패|FAILED/i.test(p.status);
              return true;
            });
            return (
              <div>
                {/* 필터 */}
                <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-1.5">
                  {paymentFilters.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setPaymentFilter(f.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        paymentFilter === f.value
                          ? "bg-primary-500 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-primary-300"
                      }`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>

                {filteredPayments.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    {paymentFilter === "all" ? "결제 내역이 없습니다." : "해당 조건의 결제 내역이 없습니다."}
                  </div>
                ) : (
                  <>
                    {/* 데스크톱: 테이블 */}
                    <div className="hidden md:block p-6">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-3 px-2 font-semibold text-gray-600">결제일</th>
                            <th className="text-left py-3 px-2 font-semibold text-gray-600">내용</th>
                            <th className="text-left py-3 px-2 font-semibold text-gray-600">결제수단</th>
                            <th className="text-right py-3 px-2 font-semibold text-gray-600">금액</th>
                            <th className="text-center py-3 px-2 font-semibold text-gray-600">상태</th>
                            <th className="text-center py-3 px-2 font-semibold text-gray-600">영수증</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPayments.map((pay) => {
                            const canReceipt = /완료|COMPLETED|ESCROW|에스크로/i.test(pay.status);
                            const canRefund = canReceipt;
                            return (
                            <tr key={pay.id} className="border-b border-gray-50 last:border-0">
                              <td className="py-3 px-2 text-gray-700">{pay.date}</td>
                              <td className="py-3 px-2 text-gray-700">{pay.description}</td>
                              <td className="py-3 px-2 text-gray-500">{pay.method}</td>
                              <td className="py-3 px-2 text-right font-semibold text-gray-900">
                                {pay.amount.toLocaleString()}원
                              </td>
                              <td className="py-3 px-2 text-center">
                                {statusBadge(pay.status)}
                              </td>
                              <td className="py-3 px-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {canReceipt && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const t = typeof window !== "undefined" ? localStorage.getItem("cm_access_token") : "";
                                        window.open(`/api/payments/${pay.id}/receipt?token=${encodeURIComponent(t || "")}`, "_blank");
                                      }}
                                      className="text-xs px-2 py-1 bg-gray-900 text-white rounded"
                                    >
                                      PDF
                                    </button>
                                  )}
                                  {canRefund && (
                                    <button
                                      type="button"
                                      onClick={() => setRefundTarget(pay)}
                                      className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                    >
                                      환불
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* 모바일: 컴팩트 카드 */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {filteredPayments.map((pay) => (
                        <div key={pay.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-gray-400 shrink-0">{pay.date}</span>
                              {statusBadge(pay.status)}
                            </div>
                            <div className="font-bold text-gray-900 text-sm whitespace-nowrap">
                              {pay.amount.toLocaleString()}원
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="truncate">{pay.description}</span>
                            <span className="shrink-0 ml-2">{pay.method}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Patient info */}
          {activeTab === "patients" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">환자 목록</h3>
                <button
                  type="button"
                  onClick={openCreatePatientModal}
                  className="btn-primary text-sm px-4 py-2"
                >
                  환자 등록
                </button>
              </div>
              {patients.length > 0 ? (
                <div className="space-y-4">
                  {patients.map((patient, idx) => (
                    <div key={idx} className="card bg-gray-50 border-gray-200">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">{patient.name}</h3>
                        <button
                          type="button"
                          onClick={() => openEditPatientModal(patient)}
                          className="text-sm text-primary-600 hover:underline"
                        >
                          수정
                        </button>
                      </div>

                      {/* 기본 정보 */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">생년월일</span>
                          <p className="font-medium text-gray-900">
                            {patient.raw.birthDate || '-'}
                            {patient.age > 0 && <span className="text-gray-400 ml-1">({patient.age}세)</span>}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">성별</span>
                          <p className="font-medium text-gray-900">{patient.gender === '여' ? '여성' : '남성'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">키 / 체중</span>
                          <p className="font-medium text-gray-900">{patient.height} / {patient.weight}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">진단명</span>
                          <p className="font-medium text-gray-900">{patient.diagnosis}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">거동상태</span>
                          <p className="font-medium text-gray-900">{patient.mobility}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">의식 상태</span>
                          <p className="font-medium text-gray-900">
                            {patient.raw.consciousness === 'clear' ? '명료' : patient.raw.consciousness === 'drowsy' ? '기면' : patient.raw.consciousness === 'stupor' ? '혼미' : patient.raw.consciousness === 'coma' ? '혼수' : '-'}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">치매</span>
                          <p className="font-medium text-gray-900">
                            {patient.dementia}
                            {patient.raw.hasDementia && patient.raw.dementiaLevel && (
                              <span className="text-gray-500 ml-1">
                                ({patient.raw.dementiaLevel === 'mild' ? '경증' : patient.raw.dementiaLevel === 'moderate' ? '중등도' : '중증'})
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">감염병</span>
                          <p className="font-medium text-gray-900">
                            {patient.infection}
                            {patient.infection === '있음' && patient.infectionDetail && (
                              <span className="text-gray-500 ml-1">({patient.infectionDetail})</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* 의료 특이사항 */}
                      {patient.medicalNotes && (
                        <div className="mt-4 pt-3 border-t border-gray-200 text-sm">
                          <span className="text-gray-500">의료 특이사항</span>
                          <p className="font-medium text-gray-900 mt-1 whitespace-pre-wrap">{patient.medicalNotes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400">
                  등록된 환자 정보가 없습니다.
                </div>
              )}
            </div>
          )}

          {/* Account Settings */}
          {activeTab === "settings" && (
            <div className="p-6 max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">계정 설정</h3>
                <p className="text-sm text-gray-500">계정 관련 설정을 변경합니다.</p>
              </div>

              {/* 알림 카테고리 설정 */}
              <NotificationPrefsSection />

              <div className="border border-red-200 bg-red-50 rounded-2xl p-6">
                <h4 className="font-bold text-red-700 mb-2">회원 탈퇴</h4>
                <p className="text-sm text-red-600 mb-4 leading-relaxed">
                  회원 탈퇴 시 계정이 즉시 비활성화되며, 개인정보는 익명 처리됩니다.<br />
                  관련 법령에 따라 간병 이력·결제 내역은 일정 기간 보관될 수 있습니다.<br />
                  <strong>진행 중인 계약이 있으면 탈퇴할 수 없습니다.</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
                >
                  회원 탈퇴하기
                </button>
              </div>
            </div>
          )}

          {/* 보험서류 신청 이력 */}
          {activeTab === "insurance" && <InsuranceTab />}

          {/* Referral code */}
          {activeTab === "referral" && (
            <div className="p-6">
              <div className="max-w-md mx-auto text-center py-8">
                <div className="text-5xl mb-4">&#127873;</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">친구 추천하고 적립금 받으세요!</h3>
                <p className="text-sm text-gray-500 mb-6">
                  추천인 코드로 가입한 친구와 본인 모두 10,000원 적립금을 받습니다.
                </p>
                <div className="bg-gray-50 rounded-2xl p-6 mb-4">
                  <div className="text-sm text-gray-500 mb-1">내 추천인 코드</div>
                  <div className="text-2xl font-mono font-bold text-primary-600 tracking-wider">
                    {referralCode || "-"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyReferralCode}
                  disabled={!referralCode}
                  className="btn-primary w-full"
                >
                  코드 복사하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-red-700 mb-4">회원 탈퇴</h3>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
              <p className="font-semibold mb-2">⚠️ 탈퇴 전 꼭 확인해주세요</p>
              <ul className="space-y-1 text-xs list-disc list-inside">
                <li>계정이 즉시 비활성화됩니다</li>
                <li>개인정보는 익명 처리됩니다</li>
                <li>동일 이메일/전화번호로 다시 가입할 수 없습니다</li>
                <li>간병 이력·결제 내역은 법령에 따라 일정 기간 보관됩니다</li>
                <li>보유 포인트는 모두 소멸됩니다</li>
              </ul>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 확인 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="현재 비밀번호"
                  className="input-field"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  탈퇴 사유 <span className="text-gray-400 text-xs">(선택)</span>
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="서비스 개선에 참고됩니다"
                  rows={2}
                  maxLength={500}
                  className="input-field resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  확인 문구 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='"탈퇴합니다" 를 입력하세요'
                  className="input-field"
                />
              </div>
              {deleteError && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeletePassword("");
                  setDeleteReason("");
                  setDeleteConfirmText("");
                  setDeleteError("");
                }}
                disabled={deleteLoading}
                className="btn-secondary flex-1"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword || deleteConfirmText !== "탈퇴합니다"}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
              >
                {deleteLoading ? "처리 중..." : "탈퇴 확정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Cancel Modal */}
      {/* 분쟁 접수 모달 */}
      {disputeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">⚠ 분쟁 접수</h3>
            <p className="text-sm text-gray-500 mb-4">
              {disputeTarget.patientName} 환자 간병 관련 분쟁을 접수합니다. 관리자가 검토 후 처리합니다.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  분류 <span className="text-red-500">*</span>
                </label>
                <select
                  value={disputeForm.category}
                  onChange={(e) => setDisputeForm({ ...disputeForm, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="CARE_QUALITY">간병 품질 불만</option>
                  <option value="CANCELLATION">취소 관련</option>
                  <option value="PAYMENT">결제 관련</option>
                  <option value="ABUSE">욕설/폭언</option>
                  <option value="NO_SHOW">노쇼</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={disputeForm.title}
                  onChange={(e) => setDisputeForm({ ...disputeForm, title: e.target.value })}
                  placeholder="예: 간병인이 시간 대로 오지 않음"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상세 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={disputeForm.description}
                  onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
                  placeholder="발생한 상황을 구체적으로 작성해주세요"
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => { setDisputeTarget(null); setDisputeForm({ category: "CARE_QUALITY", title: "", description: "" }); }}
                disabled={disputeLoading}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={
                  disputeLoading ||
                  !disputeForm.title.trim() ||
                  !disputeForm.description.trim()
                }
                onClick={async () => {
                  setDisputeLoading(true);
                  try {
                    await disputeAPI.create({
                      contractId: disputeTarget.id,
                      category: disputeForm.category,
                      title: disputeForm.title.trim(),
                      description: disputeForm.description.trim(),
                    });
                    showToast("분쟁이 접수되었습니다. 관리자가 검토 후 처리합니다.", "success");
                    setDisputeTarget(null);
                    setDisputeForm({ category: "CARE_QUALITY", title: "", description: "" });
                  } catch (err: any) {
                    showToast(err?.response?.data?.message || "접수 실패", "error");
                  } finally {
                    setDisputeLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
              >
                {disputeLoading ? "접수 중..." : "접수"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 보험서류 신청 모달 */}
      {insuranceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">간병보험 서류 신청</h3>
            <p className="text-sm text-gray-500 mb-4">
              {insuranceTarget.patientName} 환자 · {insuranceTarget.startDate} ~ {insuranceTarget.endDate}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  보험사 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={insuranceForm.insuranceCompany}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceCompany: e.target.value })}
                  placeholder="예: 삼성생명"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  서류 종류 <span className="text-red-500">*</span>
                </label>
                <select
                  value={insuranceForm.documentType}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, documentType: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                >
                  <option value="간병확인서">간병확인서</option>
                  <option value="영수증">영수증</option>
                  <option value="간병일지">간병일지</option>
                  <option value="진단서">진단서</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setInsuranceTarget(null)}
                disabled={insuranceLoading}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={insuranceLoading || !insuranceForm.insuranceCompany.trim()}
                onClick={async () => {
                  setInsuranceLoading(true);
                  try {
                    const patientName = insuranceTarget.patientName;
                    await insuranceAPI.create({
                      patientName,
                      birthDate: "1900-01-01", // 환자 정보에서 더 정확한 값을 넘길 수도 있음
                      carePeriod: `${insuranceTarget.startDate} ~ ${insuranceTarget.endDate}`,
                      insuranceCompany: insuranceForm.insuranceCompany.trim(),
                      documentType: insuranceForm.documentType,
                    });
                    showToast("보험서류 신청이 접수되었습니다. 1~2일 내 처리됩니다.", "success");
                    setInsuranceTarget(null);
                    setInsuranceForm({ insuranceCompany: "", documentType: "간병확인서" });
                  } catch (err: any) {
                    showToast(err?.response?.data?.message || "신청 실패", "error");
                  } finally {
                    setInsuranceLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
              >
                {insuranceLoading ? "처리 중..." : "신청"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 환불 모달 */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">환불 요청</h3>
            <p className="text-sm text-gray-500 mb-4">
              관리자 검토 후 환불이 처리됩니다.
            </p>
            <div className="bg-gray-50 rounded-xl p-3 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">결제 금액</span>
                <span className="font-semibold text-gray-900">
                  {refundTarget.amount.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">결제일</span>
                <span className="text-gray-700">{refundTarget.date}</span>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              환불 사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="환불 사유를 상세히 작성해주세요"
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
            />
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => { setRefundTarget(null); setRefundReason(""); }}
                disabled={refundLoading}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={refundLoading || !refundReason.trim()}
                onClick={async () => {
                  setRefundLoading(true);
                  try {
                    await paymentAPI.refund(refundTarget.id, refundReason.trim());
                    showToast("환불 요청이 접수되었습니다.", "success");
                    setRefundTarget(null);
                    setRefundReason("");
                    fetchData();
                  } catch (err: any) {
                    showToast(err?.response?.data?.message || "환불 요청 실패", "error");
                  } finally {
                    setRefundLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {refundLoading ? "처리 중..." : "환불 요청"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelContractId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              간병을 취소하시겠습니까?
            </h3>
            <div className="space-y-3 mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <ul className="space-y-1.5">
                  <li>- 진행 기간에 따라 일할 계산으로 환불됩니다</li>
                  <li>- 간병인에게 취소 알림이 발송됩니다</li>
                </ul>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  취소 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="취소 사유를 입력해주세요"
                  rows={3}
                  className="input-field resize-none"
                  maxLength={500}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setCancelContractId(null);
                  setCancelReason("");
                }}
                disabled={cancelLoading}
                className="btn-secondary flex-1"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={handleCancelContract}
                disabled={cancelLoading || !cancelReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
              >
                {cancelLoading ? "처리 중..." : "취소하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Contract Modal */}
      {extendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">간병 연장 요청</h3>
              <button
                type="button"
                onClick={() => setExtendTarget(null)}
                className="w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>환자</span>
                  <span className="text-gray-700 font-medium">{extendTarget.patientName}</span>
                </div>
                <div className="flex justify-between text-gray-500 mt-1">
                  <span>현재 종료일</span>
                  <span className="text-gray-700 font-medium">{extendTarget.endDate}</span>
                </div>
                <div className="flex justify-between text-gray-500 mt-1">
                  <span>일당</span>
                  <span className="text-gray-700 font-medium">{extendTarget.dailyRate.toLocaleString()}원</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 종료일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={extendEndDate}
                  onChange={(e) => setExtendEndDate(e.target.value)}
                  min={new Date(new Date(extendTarget.endDateRaw).getTime() + 86400000).toISOString().slice(0, 10)}
                  className="input-field"
                />
                {extendEndDate && (() => {
                  const extra = Math.ceil(
                    (new Date(extendEndDate).getTime() - new Date(extendTarget.endDateRaw).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  if (extra <= 0) return null;
                  const total = extra * extendTarget.dailyRate;
                  return (
                    <p className="mt-2 text-sm text-orange-600 font-medium">
                      추가 {extra}일 · {total.toLocaleString()}원
                    </p>
                  );
                })()}
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  id="extendNewCg"
                  checked={extendNewCaregiver}
                  onChange={(e) => setExtendNewCaregiver(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-orange-500"
                />
                <label htmlFor="extendNewCg" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">새로운 간병인 요청</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    체크 시 기존 간병인 대신 공고를 다시 올려 지원자 중 선택합니다.
                  </p>
                </label>
              </div>

              {extendError && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{extendError}</div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setExtendTarget(null)}
                disabled={extendLoading}
                className="btn-secondary flex-1"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleExtendContract}
                disabled={extendLoading || !extendEndDate}
                className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
              >
                {extendLoading ? "처리 중..." : "연장 요청"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Registration/Edit Modal */}
      {showPatientModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:rounded-2xl shadow-xl sm:max-w-lg flex flex-col max-h-[95vh] sm:max-h-[88vh] rounded-t-2xl">
            {/* Sticky header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-gray-900">
                {editingPatientId ? '환자 정보 수정' : '환자 등록'}
              </h2>
              <button type="button" onClick={closePatientModal}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-lg leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handlePatientFormSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              {patientFormError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  {patientFormError}
                </div>
              )}

              {/* 기본 정보 */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">기본 정보</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">이름 <span className="text-red-500">*</span></label>
                    <input type="text" required value={patientForm.name}
                      onChange={(e) => handlePatientFormChange('name', e.target.value)}
                      placeholder="환자 이름" className="input-field text-sm py-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">생년월일 <span className="text-red-500">*</span></label>
                      <input type="date" required value={patientForm.birthDate}
                        onChange={(e) => handlePatientFormChange('birthDate', e.target.value)}
                        className="input-field text-sm py-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">성별 <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[{ value: 'M', label: '남성' }, { value: 'F', label: '여성' }].map(opt => (
                          <label key={opt.value} className={`flex items-center justify-center py-2 rounded-lg border-2 cursor-pointer text-xs font-medium transition-all ${patientForm.gender === opt.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                            <input type="radio" name="gender" value={opt.value} checked={patientForm.gender === opt.value}
                              onChange={(e) => handlePatientFormChange('gender', e.target.value)} className="sr-only" />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">키 (cm)</label>
                      <input type="number" step="0.1" min="0" max="300" value={patientForm.height}
                        onChange={(e) => handlePatientFormChange('height', e.target.value)}
                        placeholder="예: 170" className="input-field text-sm py-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">체중 (kg)</label>
                      <input type="number" step="0.1" min="0" max="300" value={patientForm.weight}
                        onChange={(e) => handlePatientFormChange('weight', e.target.value)}
                        placeholder="예: 65" className="input-field text-sm py-2" />
                    </div>
                  </div>
                </div>
              </section>

              {/* 의식 상태 */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">의식 상태 <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[{ value: 'clear', label: '명료' }, { value: 'drowsy', label: '기면' }, { value: 'stupor', label: '혼미' }, { value: 'coma', label: '혼수' }].map(opt => (
                    <label key={opt.value} className={`flex items-center justify-center py-2 rounded-lg border-2 cursor-pointer text-xs font-medium transition-all ${patientForm.consciousness === opt.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="radio" name="consciousness" value={opt.value} checked={patientForm.consciousness === opt.value}
                        onChange={(e) => handlePatientFormChange('consciousness', e.target.value)} className="sr-only" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </section>

              {/* 거동 상태 */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">거동 상태 <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { value: 'INDEPENDENT', label: '독립 보행' },
                    { value: 'PARTIAL', label: '부분 도움' },
                    { value: 'DEPENDENT', label: '완전 의존' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center justify-center py-2.5 rounded-lg border-2 cursor-pointer text-xs font-semibold transition-all ${patientForm.mobilityStatus === opt.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="radio" name="mobilityStatus" value={opt.value} checked={patientForm.mobilityStatus === opt.value}
                        onChange={(e) => handlePatientFormChange('mobilityStatus', e.target.value)} className="sr-only" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </section>

              {/* 진단명 */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">진단명 / 질환</p>
                {patientForm.diagnosis.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {patientForm.diagnosis.map(d => (
                      <span key={d} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-md">
                        {d}
                        <button type="button" onClick={() => handlePatientFormChange('diagnosis', patientForm.diagnosis.filter(x => x !== d))}
                          className="text-primary-400 hover:text-primary-700 leading-none">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                  {DIAGNOSIS_CATEGORIES.map(cat => (
                    <div key={cat.label} className="border-b border-gray-100 last:border-0">
                      <div className="px-2.5 py-1 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0">{cat.label}</div>
                      <div className="px-2.5 py-1.5 flex flex-wrap gap-1">
                        {cat.items.map(item => {
                          const selected = patientForm.diagnosis.includes(item);
                          return (
                            <button key={item} type="button"
                              onClick={() => handlePatientFormChange('diagnosis', selected ? patientForm.diagnosis.filter(x => x !== item) : [...patientForm.diagnosis, item])}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${selected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 특이 질환 */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">특이 질환</p>
                <div className="space-y-2">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={patientForm.hasDementia}
                        onChange={(e) => handlePatientFormChange('hasDementia', e.target.checked)}
                        className="w-4 h-4 text-primary-500 border-gray-300 rounded" />
                      <span className="text-sm text-gray-700">치매 증상이 있습니다</span>
                    </label>
                    {patientForm.hasDementia && (
                      <select value={patientForm.dementiaLevel}
                        onChange={(e) => handlePatientFormChange('dementiaLevel', e.target.value)}
                        className="input-field text-sm py-2 mt-1.5 ml-6 w-[calc(100%-1.5rem)]">
                        <option value="">치매 정도 선택</option>
                        <option value="mild">경증 (일상생활 가능)</option>
                        <option value="moderate">중등도 (도움 필요)</option>
                        <option value="severe">중증 (지속적 관리 필요)</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={patientForm.hasInfection}
                        onChange={(e) => handlePatientFormChange('hasInfection', e.target.checked)}
                        className="w-4 h-4 text-primary-500 border-gray-300 rounded" />
                      <span className="text-sm text-gray-700">감염성 질환이 있습니다</span>
                    </label>
                    {patientForm.hasInfection && (
                      <input type="text" value={patientForm.infectionDetail}
                        onChange={(e) => handlePatientFormChange('infectionDetail', e.target.value)}
                        placeholder="예: MRSA, 결핵 등" className="input-field text-sm py-2 mt-1.5 ml-6 w-[calc(100%-1.5rem)]" />
                    )}
                  </div>
                </div>
              </section>

              {/* 의료 특이사항 */}
              <section className="pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">의료 특이사항</p>
                <textarea value={patientForm.medicalNotes}
                  onChange={(e) => handlePatientFormChange('medicalNotes', e.target.value)}
                  placeholder="투약 중인 약물, 알레르기, 주의사항 등"
                  rows={2} className="input-field resize-none text-sm py-2" maxLength={1000} />
                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{patientForm.medicalNotes.length}/1000</p>
              </section>
            </div>

            {/* Sticky footer */}
            <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-white shrink-0 rounded-b-2xl">
              <button type="button" onClick={closePatientModal} className="btn-secondary flex-1 text-sm py-2.5">
                취소
              </button>
              <button type="submit" disabled={patientFormLoading} className="btn-primary flex-1 text-sm py-2.5">
                {patientFormLoading ? '저장 중...' : editingPatientId ? '수정하기' : '등록하기'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
