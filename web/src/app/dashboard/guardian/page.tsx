"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { dashboardAPI, careRequestAPI, paymentAPI, guardianAPI, contractAPI, extensionAPI, authAPI, insuranceAPI, disputeAPI, reviewAPI } from "@/lib/api";
import { formatDate, formatMoney, formatCareStatus, formatContractStatus, formatPaymentStatus, formatPaymentMethod, formatCareType, formatLocation, formatMobility } from "@/lib/format";
import { showToast } from "@/components/Toast";
import NotificationPrefsSection from "@/components/NotificationPrefsSection";
import InsuranceTab from "@/components/InsuranceTab";
import SignaturePad from "@/components/SignaturePad";
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
  selectableApplicantCount: number;
  contractStatus: string;
  hasReview: boolean;
  isVirtual: boolean; // 계약 없는 케어리퀘스트 (매칭 전)
  requestStatus: string; // CareRequest.status (OPEN/MATCHING/MATCHED/CANCELLED/COMPLETED)
  isPaid: boolean; // 결제 완료 여부
  createdAtRaw: string; // 요청 생성 시각
  // 디지털 서명
  guardianSigned?: boolean;
  caregiverSigned?: boolean;
  // 진행 중 연장 (보호자 시점)
  pendingExtension?: {
    id: string;
    additionalDays: number;
    additionalAmount: number;
    newEndDate: string;
    status: string; // PENDING_CAREGIVER_APPROVAL | PENDING_PAYMENT
  } | null;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  status: string;
  description: string;
  // 상세 정보
  rawAmount: number;        // amount (공급가)
  vatAmount: number;
  totalAmount: number;
  pointsUsed: number;
  paidAt: string | null;
  createdAt: string;
  rawStatus: string;        // PaymentStatus enum
  rawMethod: string;
  // 환불 정보
  refundAmount: number | null;
  refundedAt: string | null;
  refundReason: string | null;
  refundRequestStatus: string | null;
  refundRequestedAt: string | null;
  refundRequestAmount: number | null;
  refundRequestReason: string | null;
  refundReviewedAt: string | null;
  refundRejectReason: string | null;
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
  const validTabs = ["history", "payments", "reviews", "patients", "insurance", "referral", "settings"] as const;
  type TabKey = typeof validTabs[number];
  const tabFromUrl = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(validTabs.includes(tabFromUrl as TabKey) ? (tabFromUrl as TabKey) : "history");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [careHistory, setCareHistory] = useState<CareHistory[]>([]);
  const [contactInfo, setContactInfo] = useState<{ companyPhone: string | null; isNonBusinessDay: boolean }>({
    companyPhone: null,
    isNonBusinessDay: false,
  });
  const [nowTick, setNowTick] = useState(Date.now());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<{
    totalPaid: number;
    totalRefunded: number;
    totalPending: number;
    totalPointsUsed: number;
    pendingRefundRequests: number;
    count: number;
  }>({ totalPaid: 0, totalRefunded: 0, totalPending: 0, totalPointsUsed: 0, pendingRefundRequests: 0, count: 0 });

  // Cancel contract modal state
  const [cancelContractId, setCancelContractId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // 환불 모달
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<Payment | null>(null);
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
  const [signTarget, setSignTarget] = useState<CareHistory | null>(null);
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
      // 모든 세션 캐시 정리 (탈퇴 후 잔존 토큰으로 재진입 방지)
      localStorage.removeItem("cm_access_token");
      localStorage.removeItem("cm_refresh_token");
      localStorage.removeItem("user");
      localStorage.removeItem("cm_user");
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
      if (payData.summary) {
        setPaymentSummary({
          totalPaid: payData.summary.totalPaid || 0,
          totalRefunded: payData.summary.totalRefunded || 0,
          totalPending: payData.summary.totalPending || 0,
          totalPointsUsed: payData.summary.totalPointsUsed || 0,
          pendingRefundRequests: payData.summary.pendingRefundRequests || 0,
          count: payData.summary.count || 0,
        });
      }
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
          selectableApplicantCount: c.careRequest?._count?.selectableApplications ?? c.careRequest?._count?.applications ?? 0,
          contractStatus: c.status || '',
          hasReview: !!c.review,
          isVirtual,
          requestStatus: crStatus,
          isPaid,
          createdAtRaw: c.careRequest?.createdAt || c.createdAt || '',
          guardianSigned: !!c.guardianSignedAt,
          caregiverSigned: !!c.caregiverSignedAt,
          pendingExtension: (() => {
            const exts = Array.isArray(c.extensions) ? c.extensions : [];
            const pending = exts.find((e: any) =>
              e.status === 'PENDING_CAREGIVER_APPROVAL' || e.status === 'PENDING_PAYMENT'
            );
            return pending
              ? {
                  id: pending.id,
                  additionalDays: pending.additionalDays,
                  additionalAmount: pending.additionalAmount,
                  newEndDate: formatDate(pending.newEndDate),
                  status: pending.status,
                }
              : null;
          })(),
        };
      }));

      setPayments(paymentList.map((p: any) => ({
        id: p.id,
        date: formatDate(p.paidAt || p.createdAt),
        amount: p.totalAmount,
        method: formatPaymentMethod(p.method),
        status: formatPaymentStatus(p.status),
        description: p.method === 'DIRECT' ? '간병 서비스 이용료 (직접결제)' : '간병 서비스 이용료',
        rawAmount: p.amount || 0,
        vatAmount: p.vatAmount || 0,
        totalAmount: p.totalAmount || 0,
        pointsUsed: p.pointsUsed || 0,
        paidAt: p.paidAt || null,
        createdAt: p.createdAt || '',
        rawStatus: p.status || '',
        rawMethod: p.method || '',
        refundAmount: p.refundAmount ?? null,
        refundedAt: p.refundedAt || null,
        refundReason: p.refundReason || null,
        refundRequestStatus: p.refundRequestStatus || null,
        refundRequestedAt: p.refundRequestedAt || null,
        refundRequestAmount: p.refundRequestAmount ?? null,
        refundRequestReason: p.refundRequestReason || null,
        refundReviewedAt: p.refundReviewedAt || null,
        refundRejectReason: p.refundRejectReason || null,
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
    // 역할 가드 — GUARDIAN / HOSPITAL / ADMIN 만 허용
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const role = user?.role;
      if (role === 'CAREGIVER') {
        router.replace('/dashboard/caregiver');
        return;
      }
      if (role && !['GUARDIAN', 'HOSPITAL', 'ADMIN'].includes(role)) {
        router.replace('/');
        return;
      }
    } catch {}
    fetchData();
  }, [fetchData, router]);

  // 상담사 연결용 회사 번호 + 주말/공휴일 여부
  useEffect(() => {
    fetch('/api/public/contact')
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res?.data) setContactInfo(res.data);
      })
      .catch(() => {});
  }, []);

  // 1분 단위 재렌더링 (경과 시간 갱신용)
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const referralCode = summary?.referralCode ?? "";

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // URL tab 변경 시 activeTab 동기화 (BottomTabBar Link 클릭 등)
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl as TabKey) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl as TabKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

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
      const res = await extensionAPI.extend(extendTarget.id, {
        additionalDays: extraDays,
        isNewCaregiver: extendNewCaregiver,
      });
      const data = res.data?.data || res.data || {};
      const extensionId = data?.extension?.id;
      const contractId = extendTarget.id;
      setExtendTarget(null);

      if (extendNewCaregiver) {
        // 새 간병인: 즉시 결제 가능
        const proceed = confirm(
          `새 간병인 매칭으로 ${extraDays}일 연장이 신청되었습니다.\n추가금 ${additionalAmount.toLocaleString()}원 결제 페이지로 이동하시겠습니까?`
        );
        if (proceed && extensionId) {
          window.location.href = `/dashboard/guardian/payment/${contractId}?extensionId=${extensionId}`;
          return;
        }
      } else {
        // 기존 간병인: 간병인 수락 대기
        alert(
          `연장 요청이 발송되었습니다.\n간병인 수락 후 결제 안내가 전달됩니다.`
        );
      }
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
    {
      key: "history" as const, label: "간병 이력",
      icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />),
    },
    {
      key: "payments" as const, label: "결제 내역",
      icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />),
    },
    {
      key: "reviews" as const, label: "내 리뷰",
      icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />),
    },
    {
      key: "patients" as const, label: "환자 정보",
      icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />),
    },
    {
      key: "insurance" as const, label: "보험서류",
      icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />),
    },
    {
      key: "referral" as const, label: "추천인 코드",
      icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />),
    },
    {
      key: "settings" as const, label: "계정 설정",
      icon: (<><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>),
    },
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

  const fmtWon = (v: number) =>
    v >= 100000000 ? `${(v / 100000000).toFixed(1)}억` :
    v >= 10000 ? `${Math.round(v / 10000).toLocaleString()}만원` :
    `${v.toLocaleString()}원`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-primary-50/30 via-gray-50 to-gray-50 py-4 sm:py-6 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 px-5 py-4 text-white relative">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center text-lg font-bold shadow-sm flex-shrink-0 border-2 border-white/30">
                  {userName?.[0] || "보"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-bold truncate">{userName}</h1>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 backdrop-blur">
                      보호자
                    </span>
                  </div>
                  <p className="text-sm text-white/80 mt-0.5">보호자 마이페이지</p>
                </div>
              </div>
              <Link
                href="/care-request"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-primary-600 hover:bg-white/90 transition-colors flex-shrink-0 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                새 간병 요청
              </Link>
            </div>
          </div>

          <Link
            href="/care-request"
            className="sm:hidden flex items-center justify-center gap-1.5 mx-3 my-3 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            새 간병 요청하기
          </Link>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
          {/* 진행 중 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center mb-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
            </div>
            <div className="text-xs text-gray-500 mb-1">진행 중</div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">
              {activeCareCount}<span className="text-sm font-semibold text-gray-500 ml-0.5">건</span>
            </div>
          </div>

          {/* 완료 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            </div>
            <div className="text-xs text-gray-500 mb-1">완료</div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">
              {completedCareCount}<span className="text-sm font-semibold text-gray-500 ml-0.5">건</span>
            </div>
          </div>

          {/* 이번 달 비용 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
            </div>
            <div className="text-xs text-gray-500 mb-1">이번 달 비용</div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums whitespace-nowrap">
              {fmtWon(monthlyExpense)}
            </div>
          </div>

          {/* 추천 적립금 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="w-8 h-8 rounded-lg bg-accent-100 text-accent-600 flex items-center justify-center mb-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
            </div>
            <div className="text-xs text-gray-500 mb-1">추천 적립금</div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums whitespace-nowrap">
              {fmtWon(referralCredits)}
            </div>
          </div>
        </div>

        {/* Tabs — 가로 스크롤 + 아이콘 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 p-1.5 min-w-max">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                    active
                      ? "bg-primary-500 text-white shadow-sm shadow-primary-500/25"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
                    {tab.icon}
                  </svg>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {/* Care history */}
          {activeTab === "history" && (
            <div>
              {/* 추가 간병비 요청 알림 배너 */}
              <GuardianAdditionalFeesBanner onChanged={fetchData} />
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
                        {/* PENDING_SIGNATURE: 서명 흐름 */}
                        {!care.isVirtual && care.contractStatus === 'PENDING_SIGNATURE' && !care.guardianSigned && (
                          <button
                            type="button"
                            onClick={() => setSignTarget(care)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                          >
                            ✍ 계약서 서명
                          </button>
                        )}
                        {!care.isVirtual && care.contractStatus === 'PENDING_SIGNATURE' && care.guardianSigned && !care.caregiverSigned && (
                          <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                            ⏱ 간병인 서명 대기 중
                          </span>
                        )}
                        {/* 결제 대기 중이면 결제 버튼 최우선 표시 */}
                        {!care.isVirtual && (care.contractStatus === 'ACTIVE' || care.contractStatus === 'EXTENDED') && !care.isPaid && (
                          <Link
                            href={`/dashboard/guardian/payment/${care.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                          >
                            💳 결제하기
                          </Link>
                        )}
                        {/* OPEN/MATCHING 상태: 공고 관리 (지원자 유무 관계없이 접근 가능) */}
                        {care.isVirtual && ['OPEN', 'MATCHING'].includes(care.requestStatus) && care.careRequestId && (() => {
                          const createdMs = care.createdAtRaw ? new Date(care.createdAtRaw).getTime() : 0;
                          const elapsedMin = createdMs ? Math.floor((nowTick - createdMs) / 60000) : 0;
                          const isStale = elapsedMin >= 60;
                          // 선택 가능한 지원자(근무중 제외) 0명일 때만 상담 옵션 노출
                          const noSelectableApplicants = care.selectableApplicantCount === 0;
                          const showConsultationButtons =
                            isStale && noSelectableApplicants && !contactInfo.isNonBusinessDay && !!contactInfo.companyPhone;
                          return (
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
                              {isStale && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-md">
                                  ⏱ {Math.floor(elapsedMin / 60)}시간 {elapsedMin % 60}분 경과
                                </span>
                              )}
                              {showConsultationButtons && (
                                <a
                                  href={`tel:${contactInfo.companyPhone}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                  📞 상담사와 연결하기
                                </a>
                              )}
                              {(care.applicantCount === 0 || showConsultationButtons) && (
                                <button
                                  type="button"
                                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                  onClick={async () => {
                                    if (!confirm(showConsultationButtons ? '매칭을 취소하시겠습니까?' : '이 공고를 취소하시겠습니까?')) return;
                                    try {
                                      await careRequestAPI.cancel(care.careRequestId!);
                                      showToast(showConsultationButtons ? '매칭이 취소되었습니다.' : '공고가 취소되었습니다.', 'success');
                                      fetchData();
                                    } catch {
                                      showToast('취소에 실패했습니다.', 'error');
                                    }
                                  }}
                                >
                                  {showConsultationButtons ? '매칭 취소' : '공고 취소'}
                                </button>
                              )}
                            </>
                          );
                        })()}
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
                        {showExtendButton(care.endDate, care.status) && !care.pendingExtension && (
                          <button
                            type="button"
                            className="btn-accent text-sm px-4 py-2"
                            onClick={() => openExtendModal(care)}
                          >
                            연장 요청
                          </button>
                        )}
                        {care.pendingExtension && care.pendingExtension.status === 'PENDING_CAREGIVER_APPROVAL' && (
                          <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                            ⏱ 간병인 응답 대기 중 (+{care.pendingExtension.additionalDays}일)
                          </span>
                        )}
                        {care.pendingExtension && care.pendingExtension.status === 'PENDING_PAYMENT' && (
                          <Link
                            href={`/dashboard/guardian/payment/${care.id}?extensionId=${care.pendingExtension.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                          >
                            💳 연장 결제 ({care.pendingExtension.additionalAmount.toLocaleString()}원)
                          </Link>
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
                        {!care.isVirtual && (
                          <Link
                            href={`/dashboard/guardian/journal/${care.id}`}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                          >
                            📋 간병일지
                          </Link>
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
                {/* 정산 요약 */}
                <div className="px-4 sm:px-6 pt-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">정산 요약</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <div className="text-xs text-blue-700">총 결제 금액</div>
                      <div className="text-base sm:text-lg font-bold text-blue-700 mt-1">
                        {paymentSummary.totalPaid.toLocaleString()}원
                      </div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                      <div className="text-xs text-red-700">환불 받은 금액</div>
                      <div className="text-base sm:text-lg font-bold text-red-700 mt-1">
                        {paymentSummary.totalRefunded.toLocaleString()}원
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <div className="text-xs text-amber-700">결제 대기</div>
                      <div className="text-base sm:text-lg font-bold text-amber-700 mt-1">
                        {paymentSummary.totalPending.toLocaleString()}원
                      </div>
                    </div>
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                      <div className="text-xs text-purple-700">사용 포인트</div>
                      <div className="text-base sm:text-lg font-bold text-purple-700 mt-1">
                        {paymentSummary.totalPointsUsed.toLocaleString()}P
                      </div>
                    </div>
                  </div>
                  {paymentSummary.pendingRefundRequests > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-800 flex items-center gap-2">
                      <span>⏳</span>
                      <span>환불 요청 {paymentSummary.pendingRefundRequests}건이 관리자 검토 중입니다.</span>
                    </div>
                  )}
                </div>

                {/* 필터 */}
                <div className="px-4 sm:px-6 py-3 mt-4 bg-gray-50 border-y border-gray-100 flex flex-wrap gap-1.5">
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
                            <tr
                              key={pay.id}
                              className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                              onClick={() => setPaymentDetail(pay)}
                            >
                              <td className="py-3 px-2 text-gray-700">{pay.date}</td>
                              <td className="py-3 px-2 text-gray-700">
                                {pay.description}
                                {pay.refundRequestStatus === "PENDING" && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">환불 검토중</span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-gray-500">{pay.method}</td>
                              <td className="py-3 px-2 text-right font-semibold text-gray-900">
                                {pay.amount.toLocaleString()}원
                              </td>
                              <td className="py-3 px-2 text-center">
                                {statusBadge(pay.status)}
                              </td>
                              <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                  {canRefund && pay.refundRequestStatus !== "PENDING" && (
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
                        <button
                          key={pay.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-gray-50"
                          onClick={() => setPaymentDetail(pay)}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="text-xs text-gray-400 shrink-0">{pay.date}</span>
                              {statusBadge(pay.status)}
                              {pay.refundRequestStatus === "PENDING" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">환불 검토중</span>
                              )}
                            </div>
                            <div className="font-bold text-gray-900 text-sm whitespace-nowrap">
                              {pay.amount.toLocaleString()}원
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="truncate">{pay.description}</span>
                            <span className="shrink-0 ml-2">{pay.method} ›</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* My reviews */}
          {activeTab === "reviews" && <GuardianReviewsTab />}

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

      {/* 결제 상세 모달 */}
      {paymentDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">결제 상세</h3>
              <button
                type="button"
                onClick={() => setPaymentDetail(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                aria-label="닫기"
              >×</button>
            </div>
            <div className="px-5 py-4 space-y-4 text-sm">
              {/* 상태 */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">상태</span>
                <div className="flex items-center gap-2">
                  {statusBadge(paymentDetail.status)}
                  {paymentDetail.refundRequestStatus === "PENDING" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700">환불 검토중</span>
                  )}
                  {paymentDetail.refundRequestStatus === "APPROVED" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">환불 승인</span>
                  )}
                  {paymentDetail.refundRequestStatus === "REJECTED" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">환불 거절</span>
                  )}
                </div>
              </div>

              {/* 결제 정보 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">결제일</span><span className="text-gray-900 font-medium">{paymentDetail.date}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">결제 수단</span><span className="text-gray-900">{paymentDetail.method}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">결제번호</span><span className="text-gray-700 font-mono text-xs">{paymentDetail.id.slice(0, 12)}…</span></div>
              </div>

              {/* 금액 분해 */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-gray-700"><span>공급가</span><span>{paymentDetail.rawAmount.toLocaleString()}원</span></div>
                {paymentDetail.vatAmount > 0 && (
                  <div className="flex justify-between text-gray-700"><span>VAT</span><span>{paymentDetail.vatAmount.toLocaleString()}원</span></div>
                )}
                {paymentDetail.pointsUsed > 0 && (
                  <div className="flex justify-between text-blue-600"><span>포인트 사용</span><span>−{paymentDetail.pointsUsed.toLocaleString()}P</span></div>
                )}
                <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-gray-900"><span>총 결제금액</span><span>{paymentDetail.totalAmount.toLocaleString()}원</span></div>
              </div>

              {/* 환불 요청 진행 상태 */}
              {paymentDetail.refundRequestStatus && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-amber-800 text-sm">환불 요청 상태</div>
                  <ol className="space-y-1.5 text-xs text-amber-900">
                    <li className="flex items-start gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0"></span>
                      <div>
                        <div className="font-medium">접수</div>
                        <div className="text-amber-700">{paymentDetail.refundRequestedAt ? formatDate(paymentDetail.refundRequestedAt) : '-'}</div>
                        {paymentDetail.refundRequestAmount && (
                          <div className="text-amber-700">요청 금액: {paymentDetail.refundRequestAmount.toLocaleString()}원</div>
                        )}
                        {paymentDetail.refundRequestReason && (
                          <div className="text-amber-700">사유: {paymentDetail.refundRequestReason}</div>
                        )}
                      </div>
                    </li>
                    {paymentDetail.refundReviewedAt && (
                      <li className="flex items-start gap-2">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${paymentDetail.refundRequestStatus === 'APPROVED' ? 'bg-emerald-600' : 'bg-red-600'}`}></span>
                        <div>
                          <div className="font-medium">{paymentDetail.refundRequestStatus === 'APPROVED' ? '승인 처리' : '거절 처리'}</div>
                          <div className="text-amber-700">{formatDate(paymentDetail.refundReviewedAt)}</div>
                          {paymentDetail.refundRejectReason && (
                            <div className="text-red-700">거절 사유: {paymentDetail.refundRejectReason}</div>
                          )}
                        </div>
                      </li>
                    )}
                    {!paymentDetail.refundReviewedAt && paymentDetail.refundRequestStatus === 'PENDING' && (
                      <li className="text-amber-700 pl-3.5">관리자 검토 대기 중...</li>
                    )}
                  </ol>
                </div>
              )}

              {/* 실제 환불 완료 정보 */}
              {paymentDetail.refundedAt && paymentDetail.refundAmount && (
                <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-1.5">
                  <div className="font-semibold text-emerald-800 text-sm">환불 완료</div>
                  <div className="flex justify-between text-emerald-900"><span>환불 금액</span><span className="font-bold">{paymentDetail.refundAmount.toLocaleString()}원</span></div>
                  <div className="flex justify-between text-emerald-900"><span>환불 일시</span><span>{formatDate(paymentDetail.refundedAt)}</span></div>
                  {paymentDetail.refundReason && (
                    <div className="text-emerald-900 text-xs">사유: {paymentDetail.refundReason}</div>
                  )}
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex gap-2 pt-2">
                {(/완료|COMPLETED|ESCROW|에스크로/i.test(paymentDetail.status)) && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = typeof window !== "undefined" ? localStorage.getItem("cm_access_token") : "";
                      window.open(`/api/payments/${paymentDetail.id}/receipt?token=${encodeURIComponent(t || "")}`, "_blank");
                    }}
                    className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold"
                  >
                    영수증 PDF
                  </button>
                )}
                {(/완료|COMPLETED|ESCROW|에스크로/i.test(paymentDetail.status)) && paymentDetail.refundRequestStatus !== "PENDING" && (
                  <button
                    type="button"
                    onClick={() => { setPaymentDetail(null); setRefundTarget(paymentDetail); }}
                    className="flex-1 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100"
                  >
                    환불 요청
                  </button>
                )}
              </div>
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

      {/* 디지털 서명 모달 */}
      <SignaturePad
        open={!!signTarget}
        onClose={() => setSignTarget(null)}
        signerName={userName}
        title="계약서 보호자 서명"
        description="아래 영역에 서명해주세요. 양측 서명이 완료되면 계약이 활성화되며 결제를 진행할 수 있습니다."
        onSubmit={async (signatureDataUrl) => {
          if (!signTarget) return;
          try {
            await contractAPI.sign(signTarget.id, signatureDataUrl);
            showToast("서명이 저장되었습니다.", "success");
            setSignTarget(null);
            await fetchData();
          } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "서명 저장에 실패했습니다.";
            throw new Error(msg);
          }
        }}
      />
    </div>
  );
}

// ---- GuardianAdditionalFeesBanner (간병인이 요청한 추가 간병비 — 승인/거절) ----
function GuardianAdditionalFeesBanner({ onChanged }: { onChanged: () => void }) {
  const [fees, setFees] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const bannerRef = React.useRef<HTMLDivElement>(null);

  // URL의 feeId 쿼리 파라미터 추출 (notification → 특정 요청 하이라이트)
  const [highlightFeeId, setHighlightFeeId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const feeId = params.get("feeId");
    if (feeId) setHighlightFeeId(feeId);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentAPI.getAdditionalFees();
      const list = res.data?.data || res.data || [];
      setFees(Array.isArray(list) ? list : []);
    } catch {
      setFees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // 하이라이트 대상이 있고 데이터 로드 완료되면 스크롤
  React.useEffect(() => {
    if (!loading && highlightFeeId && bannerRef.current) {
      bannerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightFeeId]);

  // 거절된 건 제외, 아직 승인 안 된 건만 배너 노출
  const pending = fees.filter((f) => !f.approvedByGuardian && !f.rejected);
  const history = fees.filter((f) => f.approvedByGuardian || f.rejected);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const handleApprove = async (id: string) => {
    if (!confirm("이 추가 간병비를 승인하시겠습니까?")) return;
    setActionLoading(id);
    try {
      await paymentAPI.approveAdditionalFee(id);
      showToast("추가 간병비를 승인했습니다.", "success");
      await load();
      onChanged();
    } catch (err: any) {
      showToast(err?.response?.data?.message || "승인 실패", "error");
    } finally {
      setActionLoading(null);
    }
  };
  const handleReject = async (id: string) => {
    if (!confirm("이 추가 간병비 요청을 거절하시겠습니까?")) return;
    setActionLoading(id);
    try {
      await paymentAPI.rejectAdditionalFee(id);
      showToast("추가 간병비 요청을 거절했습니다.", "success");
      await load();
      onChanged();
    } catch (err: any) {
      showToast(err?.response?.data?.message || "거절 실패", "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || (pending.length === 0 && history.length === 0)) return null;

  const hasPending = pending.length > 0;

  return (
    <div ref={bannerRef} className="mx-4 sm:mx-6 mt-4 mb-4">
      <div className={`rounded-2xl overflow-hidden border ${hasPending ? "border-amber-200 shadow-sm" : "border-gray-200"}`}>
        {/* 헤더 */}
        <div className={`px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 ${
          hasPending ? "bg-gradient-to-r from-amber-50 to-amber-50/60" : "bg-gray-50"
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              hasPending ? "bg-amber-500 text-white shadow-sm" : "bg-gray-200 text-gray-500"
            }`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-gray-900">추가 간병비</h3>
                {hasPending && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    대기 {pending.length}건
                  </span>
                )}
                {history.length > 0 && (
                  <span className="text-[11px] text-gray-500">이력 {history.length}</span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {hasPending ? "간병인이 간병 중 추가로 청구한 비용입니다. 승인 시 결제가 진행됩니다." : "과거 처리된 추가 간병비 내역"}
              </p>
            </div>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70 px-2 py-1 rounded-lg transition-colors"
            >
              {historyOpen ? "이력 접기" : "이력 보기"}
              <svg className={`w-3 h-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </div>

        {/* 대기 중 요청 */}
        {hasPending && (
          <div className="divide-y divide-gray-100 bg-white">
            {pending.map((f: any) => {
              const isHighlighted = highlightFeeId === f.id;
              return (
                <div
                  key={f.id}
                  className={`p-4 sm:p-5 transition-all ${isHighlighted ? "bg-orange-50 ring-2 ring-orange-300 ring-inset" : ""}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700">
                          {f.contract?.careRequest?.patient?.name || "-"}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(f.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })} 요청
                        </span>
                        {isHighlighted && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
                            알림에서 이동
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-2xl font-bold text-amber-600 tabular-nums">
                          +{f.amount?.toLocaleString()}
                        </span>
                        <span className="text-sm font-semibold text-gray-500">원</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-sm text-gray-700">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                        <div className="min-w-0 flex-1 break-words">{f.reason}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:flex-col sm:gap-1.5 sm:w-28 flex-shrink-0">
                      <button
                        type="button"
                        disabled={actionLoading === f.id}
                        onClick={() => handleApprove(f.id)}
                        className="flex-1 sm:w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 shadow-sm shadow-emerald-500/20 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === f.id ? (
                          <>처리중...</>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            승인
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === f.id}
                        onClick={() => handleReject(f.id)}
                        className="flex-1 sm:w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                        거절
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 처리 이력 */}
        {historyOpen && history.length > 0 && (
          <div className="bg-white border-t border-gray-100">
            <div className="px-4 sm:px-5 py-3 bg-gray-50/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">처리 이력</span>
            </div>
            <div className="divide-y divide-gray-100">
              {history
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((f: any) => {
                  const statusBadge = f.rejected
                    ? { label: "거절", cls: "bg-red-50 text-red-700 border-red-200", icon: "×" }
                    : f.paid
                    ? { label: "지급완료", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "✓" }
                    : f.approvedByGuardian
                    ? { label: "승인", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: "✓" }
                    : { label: "대기", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: "⏱" };
                  return (
                    <div key={f.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusBadge.cls}`}>
                            {statusBadge.icon} {statusBadge.label}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {f.contract?.careRequest?.patient?.name || "-"}
                          </span>
                          <span className="text-sm font-bold text-gray-900 tabular-nums">
                            {f.amount?.toLocaleString()}원
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">{f.reason}</div>
                        {f.rejected && f.rejectReason && (
                          <div className="text-[11px] text-red-600 mt-0.5">거절 사유: {f.rejectReason}</div>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">
                        {new Date(f.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- GuardianReviewsTab (내가 작성한 리뷰 목록) ----
function GuardianReviewsTab() {
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    (async () => {
      try {
        const res = await reviewAPI.myWritten();
        const list = res.data?.data?.reviews || res.data?.data || [];
        setReviews(list);
      } catch {
        setReviews([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-gray-400">불러오는 중...</div>;
  }
  if (reviews.length === 0) {
    return (
      <div className="p-12 text-center text-gray-400">
        <p>아직 작성한 리뷰가 없습니다.</p>
        <p className="text-xs mt-2 text-gray-400">간병 이력 탭에서 완료된 간병에 대해 리뷰를 작성할 수 있습니다.</p>
      </div>
    );
  }
  return (
    <div className="p-4 sm:p-6 space-y-3">
      {reviews.map((rv: any) => (
        <div key={rv.id} className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                {rv.caregiver?.user?.profileImage ? (
                  <img src={rv.caregiver.user.profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">👤</span>
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{rv.caregiver?.user?.name || "간병인"}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {rv.contract?.careRequest?.patient?.name && `환자: ${rv.contract.careRequest.patient.name} · `}
                  {rv.contract?.startDate && `${new Date(rv.contract.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(rv.contract.endDate).toLocaleDateString("ko-KR")}`}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-amber-500 font-bold">
                {"★".repeat(Math.round(rv.rating))}
                <span className="text-gray-300">{"★".repeat(5 - Math.round(rv.rating))}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {new Date(rv.createdAt).toLocaleDateString("ko-KR")}
              </div>
            </div>
          </div>
          {rv.comment && (
            <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{rv.comment}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {rv.wouldRehire && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                재고용 의사 있음
              </span>
            )}
            {rv.isHidden && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                관리자 숨김 처리됨
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
