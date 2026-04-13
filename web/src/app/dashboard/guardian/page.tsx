"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dashboardAPI, careRequestAPI, paymentAPI, guardianAPI, contractAPI } from "@/lib/api";
import { formatDate, formatMoney, formatCareStatus, formatContractStatus, formatPaymentStatus, formatPaymentMethod, formatCareType, formatLocation, formatMobility } from "@/lib/format";

interface CareHistory {
  id: string;
  patientName: string;
  caregiverName: string;
  startDate: string;
  endDate: string;
  status: string;
  careType: string;
  location: string;
  amount: number;
  careRequestId: string;
  applicantCount: number;
  contractStatus: string;
  hasReview: boolean;
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
  mobilityStatus: string;
  hasDementia: boolean;
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
  consciousness: string;
  mobility: string;
  dementia: string;
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
  mobilityStatus: string;
  hasDementia: boolean;
  hasInfection: boolean;
  infectionDetail: string;
  weight: string;
  height: string;
  diagnosis: string;
  medicalNotes: string;
}

const emptyPatientForm: PatientFormData = {
  name: '',
  birthDate: '',
  gender: 'M',
  mobilityStatus: 'INDEPENDENT',
  hasDementia: false,
  hasInfection: false,
  infectionDetail: '',
  weight: '',
  height: '',
  diagnosis: '',
  medicalNotes: '',
};

export default function GuardianDashboard() {
  const [activeTab, setActiveTab] = useState<"history" | "payments" | "patients" | "referral">("history");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [careHistory, setCareHistory] = useState<CareHistory[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Cancel contract modal state
  const [cancelContractId, setCancelContractId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

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
      const monthlyTotal = paymentList.reduce((s: number, p: any) => s + (p.totalAmount || 0), 0);

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
          consciousness: '-',
          mobility: formatMobility(p.mobilityStatus || ''),
          dementia: p.hasDementia ? '있음' : '없음',
          raw: {
            id: p.id,
            name: p.name,
            birthDate: p.birthDate ? new Date(p.birthDate).toISOString().split('T')[0] : '',
            gender: p.gender || 'M',
            mobilityStatus: p.mobilityStatus || 'INDEPENDENT',
            hasDementia: p.hasDementia ?? false,
            hasInfection: p.hasInfection ?? false,
            infectionDetail: p.infectionDetail || null,
            weight: p.weight,
            height: p.height,
            diagnosis: p.diagnosis || null,
            medicalNotes: p.medicalNotes || null,
          },
        })),
      });

      setCareHistory(contracts.map((c: any) => ({
        id: c.id,
        patientName: c.careRequest?.patient?.name || '-',
        caregiverName: c.caregiver?.user?.name || '-',
        startDate: formatDate(c.startDate),
        endDate: formatDate(c.endDate),
        status: formatContractStatus(c.status),
        careType: formatCareType(c.careRequest?.careType || ''),
        location: formatLocation(c.careRequest?.location || ''),
        amount: c.totalAmount || 0,
        careRequestId: c.careRequest?.id || c.careRequestId || '',
        applicantCount: c.careRequest?._count?.applications ?? c.careRequest?.applications?.length ?? 0,
        contractStatus: c.status || '',
        hasReview: !!c.review,
      })));

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
      mobilityStatus: patient.raw.mobilityStatus,
      hasDementia: patient.raw.hasDementia,
      hasInfection: patient.raw.hasInfection,
      infectionDetail: patient.raw.infectionDetail || '',
      weight: patient.raw.weight != null ? String(patient.raw.weight) : '',
      height: patient.raw.height != null ? String(patient.raw.height) : '',
      diagnosis: patient.raw.diagnosis || '',
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

  const handlePatientFormChange = (field: keyof PatientFormData, value: string | boolean) => {
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
        mobilityStatus: patientForm.mobilityStatus,
        hasDementia: patientForm.hasDementia,
        hasInfection: patientForm.hasInfection,
        infectionDetail: patientForm.hasInfection ? patientForm.infectionDetail : null,
        weight: patientForm.weight ? parseFloat(patientForm.weight) : null,
        height: patientForm.height ? parseFloat(patientForm.height) : null,
        diagnosis: patientForm.diagnosis || null,
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

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="badge-success">진행 중</span>;
      case "completed":
        return <span className="badge-primary">완료</span>;
      case "cancelled":
        return <span className="badge-danger">취소</span>;
      case "pending":
        return <span className="badge-warning">대기 중</span>;
      default:
        return <span className="badge-primary">{status}</span>;
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
    { key: "referral" as const, label: "추천인 코드" },
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">진행 중 간병</div>
            <div className="text-2xl font-bold text-primary-600">{activeCareCount}건</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">완료 간병</div>
            <div className="text-2xl font-bold text-gray-900">{completedCareCount}건</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">이번 달 비용</div>
            <div className="text-2xl font-bold text-gray-900">
              {monthlyExpense >= 10000
                ? `${(monthlyExpense / 10000).toFixed(0)}만원`
                : `${monthlyExpense.toLocaleString()}원`}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">추천 적립금</div>
            <div className="text-2xl font-bold text-accent-500">
              {referralCredits.toLocaleString()}원
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
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
            <div className="divide-y divide-gray-100">
              {careHistory.map((care) => (
                <div key={care.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-400">{care.id}</span>
                        {statusBadge(care.status)}
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
                          {care.amount.toLocaleString()}원
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {care.careRequestId && care.applicantCount > 0 && (
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
                            // TODO: POST /api/care-requests/:id/extend API 연동 후 온라인 연장 처리
                            onClick={() => alert("간병 연장은 1555-0801로 문의해주세요.")}
                          >
                            연장 요청
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
          )}

          {/* Payment history */}
          {activeTab === "payments" && (
            <div className="divide-y divide-gray-100">
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-2 font-semibold text-gray-600">결제일</th>
                        <th className="text-left py-3 px-2 font-semibold text-gray-600">내용</th>
                        <th className="text-left py-3 px-2 font-semibold text-gray-600">결제수단</th>
                        <th className="text-right py-3 px-2 font-semibold text-gray-600">금액</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-600">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((pay) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payments.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      결제 내역이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">나이</span>
                          <p className="font-medium text-gray-900">{patient.age}세</p>
                        </div>
                        <div>
                          <span className="text-gray-500">성별</span>
                          <p className="font-medium text-gray-900">{patient.gender}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">체중</span>
                          <p className="font-medium text-gray-900">{patient.weight}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">의식상태</span>
                          <p className="font-medium text-gray-900">{patient.consciousness}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">거동</span>
                          <p className="font-medium text-gray-900">{patient.mobility}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">치매</span>
                          <p className="font-medium text-gray-900">{patient.dementia}</p>
                        </div>
                      </div>
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

      {/* Contract Cancel Modal */}
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

      {/* Patient Registration/Edit Modal */}
      {showPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingPatientId ? '환자 정보 수정' : '환자 등록'}
                </h2>
                <button
                  type="button"
                  onClick={closePatientModal}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>
            </div>

            <form onSubmit={handlePatientFormSubmit} className="p-6 space-y-4">
              {patientFormError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {patientFormError}
                </div>
              )}

              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={patientForm.name}
                  onChange={(e) => handlePatientFormChange('name', e.target.value)}
                  placeholder="환자 이름"
                  className="input-field"
                />
              </div>

              {/* 생년월일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  생년월일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={patientForm.birthDate}
                  onChange={(e) => handlePatientFormChange('birthDate', e.target.value)}
                  className="input-field"
                />
              </div>

              {/* 성별 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  성별 <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={patientForm.gender}
                  onChange={(e) => handlePatientFormChange('gender', e.target.value)}
                  className="input-field"
                >
                  <option value="M">남성</option>
                  <option value="F">여성</option>
                </select>
              </div>

              {/* 이동상태 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이동상태</label>
                <select
                  value={patientForm.mobilityStatus}
                  onChange={(e) => handlePatientFormChange('mobilityStatus', e.target.value)}
                  className="input-field"
                >
                  <option value="INDEPENDENT">독립 보행</option>
                  <option value="PARTIAL">부분 도움</option>
                  <option value="DEPENDENT">완전 의존</option>
                </select>
              </div>

              {/* 체중 / 키 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">체중 (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    value={patientForm.weight}
                    onChange={(e) => handlePatientFormChange('weight', e.target.value)}
                    placeholder="예: 65"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">키 (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    value={patientForm.height}
                    onChange={(e) => handlePatientFormChange('height', e.target.value)}
                    placeholder="예: 170"
                    className="input-field"
                  />
                </div>
              </div>

              {/* 치매 여부 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasDementia"
                  checked={patientForm.hasDementia}
                  onChange={(e) => handlePatientFormChange('hasDementia', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="hasDementia" className="text-sm font-medium text-gray-700">
                  치매 여부
                </label>
              </div>

              {/* 감염 여부 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasInfection"
                    checked={patientForm.hasInfection}
                    onChange={(e) => handlePatientFormChange('hasInfection', e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="hasInfection" className="text-sm font-medium text-gray-700">
                    감염 여부
                  </label>
                </div>
                {patientForm.hasInfection && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">감염 상세</label>
                    <input
                      type="text"
                      value={patientForm.infectionDetail}
                      onChange={(e) => handlePatientFormChange('infectionDetail', e.target.value)}
                      placeholder="감염 관련 상세 정보"
                      className="input-field"
                    />
                  </div>
                )}
              </div>

              {/* 진단명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">진단명</label>
                <input
                  type="text"
                  value={patientForm.diagnosis}
                  onChange={(e) => handlePatientFormChange('diagnosis', e.target.value)}
                  placeholder="진단명 입력"
                  className="input-field"
                />
              </div>

              {/* 특이사항 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">특이사항</label>
                <textarea
                  value={patientForm.medicalNotes}
                  onChange={(e) => handlePatientFormChange('medicalNotes', e.target.value)}
                  placeholder="특이사항이나 주의사항을 입력해주세요"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePatientModal}
                  className="btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={patientFormLoading}
                  className="btn-primary flex-1"
                >
                  {patientFormLoading
                    ? '저장 중...'
                    : editingPatientId ? '수정하기' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
