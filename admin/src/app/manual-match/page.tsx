"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  getGuardians, getCaregivers,
  adminCreateGuardian, adminCreateCaregiver, adminCreateManualMatch,
  ManualAccountResult,
} from "@/lib/api";
import { formatPhone } from "@/lib/constants";

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

type Picked = { id: string; name: string; phone: string } | null;

// 계정 선택/신규등록 공용 카드
function AccountPicker({
  role, picked, onPick,
}: {
  role: "guardian" | "caregiver";
  picked: Picked;
  onPick: (p: Picked, creds?: ManualAccountResult) => void;
}) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", experienceYears: "", corporateName: "" });
  const [busy, setBusy] = useState(false);
  const label = role === "guardian" ? "보호자" : "간병인";

  const search = useCallback(async () => {
    setSearching(true);
    try {
      if (role === "guardian") {
        const res: any = await getGuardians({ search: q, limit: 20 });
        setResults((res?.guardians || []).filter((g: any) => g.guardianId));
      } else {
        const res: any = await getCaregivers({ search: q, limit: 20 });
        setResults(res?.caregivers || []);
      }
    } catch (e: any) {
      alert(e?.message || "검색 실패");
    } finally {
      setSearching(false);
    }
  }, [q, role]);

  const create = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      alert("이름과 전화번호를 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      const creds =
        role === "guardian"
          ? await adminCreateGuardian({ name: form.name.trim(), phone: form.phone.trim() })
          : await adminCreateCaregiver({
              name: form.name.trim(),
              phone: form.phone.trim(),
              ...(form.experienceYears && { experienceYears: parseInt(form.experienceYears) }),
              ...(form.corporateName.trim() && { corporateName: form.corporateName.trim() }),
            });
      const id = (role === "guardian" ? creds.guardianId : creds.caregiverId) as string;
      onPick({ id, name: creds.name, phone: creds.phone }, creds);
    } catch (e: any) {
      alert(e?.message || "등록 실패");
    } finally {
      setBusy(false);
    }
  };

  if (picked) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold text-gray-900">{picked.name}</span>
          <span className="ml-2 text-gray-500">{formatPhone(picked.phone)}</span>
        </div>
        <button onClick={() => onPick(null)} className="text-xs text-gray-500 hover:underline">
          변경
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setMode("search")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === "search" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          기존 회원
        </button>
        <button
          onClick={() => setMode("new")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === "new" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          신규 등록
        </button>
      </div>

      {mode === "search" ? (
        <div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder={`${label} 이름·전화 검색`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button onClick={search} disabled={searching} className="shrink-0 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50">
              검색
            </button>
          </div>
          <div className="mt-2 max-h-56 divide-y divide-gray-100 overflow-y-auto">
            {results.map((r: any) => (
              <button
                key={r.id}
                onClick={() => onPick({ id: role === "guardian" ? r.guardianId : r.id, name: r.name, phone: r.phone })}
                className="flex w-full items-center justify-between px-1 py-2.5 text-left text-sm hover:bg-gray-50"
              >
                <span>
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="ml-2 text-gray-500">{formatPhone(r.phone)}</span>
                </span>
                <span className="text-xs text-orange-600">선택</span>
              </button>
            ))}
            {!searching && results.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">검색 결과가 여기에 표시됩니다.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className={labelCls}>이름</label>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>전화번호</label>
            <input className={inputCls} placeholder="010-1234-5678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          {role === "caregiver" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>경력(년)</label>
                <input className={inputCls} type="number" min={0} value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>소속 법인(선택)</label>
                <input className={inputCls} value={form.corporateName} onChange={(e) => setForm({ ...form, corporateName: e.target.value })} />
              </div>
            </div>
          )}
          <button onClick={create} disabled={busy} className="btn-primary w-full">
            {busy ? "등록 중..." : `${label} 계정 생성`}
          </button>
          <p className="text-[11px] leading-snug text-gray-400">
            로그인 아이디·임시 비밀번호가 자동 발급됩니다. {role === "caregiver" && "간병인은 즉시 승인 상태로 등록됩니다."}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ManualMatchPage() {
  const [guardian, setGuardian] = useState<Picked>(null);
  const [caregiver, setCaregiver] = useState<Picked>(null);
  const [creds, setCreds] = useState<ManualAccountResult[]>([]);

  const [patient, setPatient] = useState({
    name: "", birthDate: "", gender: "M", mobilityStatus: "PARTIAL", diagnosis: "", medicalNotes: "",
  });
  const [care, setCare] = useState({
    careType: "INDIVIDUAL", scheduleType: "FULL_TIME", location: "HOSPITAL",
    hospitalName: "", address: "", startDate: "", startTime: "09:00", endDate: "", endTime: "18:00", dailyRate: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const durationDays =
    care.startDate && care.endDate
      ? Math.max(1, Math.ceil((new Date(care.endDate).getTime() - new Date(care.startDate).getTime()) / 86400000))
      : 0;
  const rate = parseInt(care.dailyRate) || 0;
  const totalAmount = durationDays * rate;

  const addCreds = (c?: ManualAccountResult) => {
    if (c) setCreds((prev) => [...prev, c]);
  };

  const submit = async () => {
    if (!guardian) return alert("보호자를 선택해주세요.");
    if (!caregiver) return alert("간병인을 선택해주세요.");
    if (!patient.name.trim() || !patient.birthDate) return alert("환자 이름·생년월일을 입력해주세요.");
    if (!care.startDate || !care.endDate) return alert("간병 시작일·종료일을 입력해주세요.");
    if (rate <= 0) return alert("일당(원)을 입력해주세요.");
    if (new Date(care.endDate) < new Date(care.startDate)) return alert("종료일은 시작일 이후여야 합니다.");

    setSubmitting(true);
    try {
      const res = await adminCreateManualMatch({
        guardianId: guardian.id,
        caregiverId: caregiver.id,
        careType: care.careType,
        scheduleType: care.scheduleType,
        location: care.location,
        hospitalName: care.hospitalName || undefined,
        address: care.address || undefined,
        startDate: care.startDate,
        startTime: care.startTime,
        endTime: care.endTime,
        endDate: care.endDate,
        dailyRate: rate,
        patient: {
          name: patient.name.trim(),
          birthDate: patient.birthDate,
          gender: patient.gender,
          mobilityStatus: patient.mobilityStatus,
          diagnosis: patient.diagnosis || undefined,
          medicalNotes: patient.medicalNotes || undefined,
        },
      });
      setResult(res);
    } catch (e: any) {
      alert(e?.message || "매칭 생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setGuardian(null); setCaregiver(null); setCreds([]);
    setPatient({ name: "", birthDate: "", gender: "M", mobilityStatus: "PARTIAL", diagnosis: "", medicalNotes: "" });
    setCare({ careType: "INDIVIDUAL", scheduleType: "FULL_TIME", location: "HOSPITAL", hospitalName: "", address: "", startDate: "", startTime: "09:00", endDate: "", endTime: "18:00", dailyRate: "" });
    setResult(null);
  };

  if (result) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="mb-2 text-2xl">✅</div>
          <h1 className="text-lg font-bold text-gray-900">수동 매칭이 완료되었습니다</h1>
          <p className="mt-1 text-sm text-gray-600">계약이 즉시 진행중(ACTIVE) 상태로 생성되었습니다.</p>
          <div className="mt-4 rounded-lg bg-white p-4 text-left text-sm">
            <div className="flex justify-between py-1"><span className="text-gray-500">계약 기간</span><span className="font-medium">{result.durationDays}일</span></div>
            <div className="flex justify-between py-1"><span className="text-gray-500">총 간병비</span><span className="font-medium">{result.totalAmount.toLocaleString()}원</span></div>
            <div className="flex justify-between py-1"><span className="text-gray-500">상태</span><span className="font-medium">{result.status}</span></div>
          </div>

          {creds.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-amber-800">신규 발급 로그인 정보 (지금 전달하세요 · 재확인 불가)</p>
              {creds.map((c) => (
                <div key={c.userId} className="mb-1 text-sm text-gray-800">
                  <span className="font-medium">{c.name}</span> · 아이디 <code className="rounded bg-white px-1.5 py-0.5">{c.loginId}</code> · 비번 <code className="rounded bg-white px-1.5 py-0.5">{c.tempPassword}</code>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex justify-center gap-2">
            <Link href={`/matchings`} className="rounded-lg bg-gray-800 px-5 py-2 text-sm text-white">매칭 목록</Link>
            <button onClick={reset} className="btn-primary px-5">새 매칭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">수동 매칭</h1>
        <p className="mt-1 text-sm text-gray-500">
          전화·내방으로 접수한 건을 공고 없이 바로 계약합니다. 서명은 관리자 대행으로 처리됩니다.
        </p>
      </div>

      {/* 신규 계정 발급 정보 — 계정 생성 즉시 노출(매칭 실패해도 유실 방지) */}
      {creds.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">발급된 로그인 정보 (지금 전달하세요 · 재확인 불가)</p>
          {creds.map((c) => (
            <div key={c.userId} className="mb-1 text-sm text-gray-800">
              <span className="font-medium">{c.name}</span> · 아이디 <code className="rounded bg-white px-1.5 py-0.5">{c.loginId}</code> · 비번 <code className="rounded bg-white px-1.5 py-0.5">{c.tempPassword}</code>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-amber-700">임시 비밀번호는 재확인이 불가합니다. 분실 시 회원관리에서 비밀번호를 재발급하세요.</p>
        </div>
      )}

      <div className="space-y-5">
        {/* 1. 보호자 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">1. 보호자</h2>
          <AccountPicker role="guardian" picked={guardian} onPick={(p, c) => { setGuardian(p); addCreds(c); }} />
        </section>

        {/* 2. 간병인 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">2. 간병인</h2>
          <AccountPicker role="caregiver" picked={caregiver} onPick={(p, c) => { setCaregiver(p); addCreds(c); }} />
        </section>

        {/* 3. 환자 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">3. 환자 정보</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>환자 이름</label>
              <input className={inputCls} value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>생년월일</label>
              <input className={inputCls} type="date" value={patient.birthDate} onChange={(e) => setPatient({ ...patient, birthDate: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>성별</label>
              <select className={inputCls} value={patient.gender} onChange={(e) => setPatient({ ...patient, gender: e.target.value })}>
                <option value="M">남</option>
                <option value="F">여</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>거동 상태</label>
              <select className={inputCls} value={patient.mobilityStatus} onChange={(e) => setPatient({ ...patient, mobilityStatus: e.target.value })}>
                <option value="INDEPENDENT">독립 가능</option>
                <option value="PARTIAL">부분 도움</option>
                <option value="DEPENDENT">완전 의존</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>진단명(선택)</label>
              <input className={inputCls} value={patient.diagnosis} onChange={(e) => setPatient({ ...patient, diagnosis: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>특이사항(선택)</label>
              <textarea className={inputCls} rows={2} value={patient.medicalNotes} onChange={(e) => setPatient({ ...patient, medicalNotes: e.target.value })} />
            </div>
          </div>
        </section>

        {/* 4. 간병 조건 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">4. 간병 조건</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>간병 유형</label>
              <select className={inputCls} value={care.careType} onChange={(e) => setCare({ ...care, careType: e.target.value })}>
                <option value="INDIVIDUAL">개인(1:1)</option>
                <option value="FAMILY">가족</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>근무 형태</label>
              <select className={inputCls} value={care.scheduleType} onChange={(e) => setCare({ ...care, scheduleType: e.target.value })}>
                <option value="FULL_TIME">24시간</option>
                <option value="PART_TIME">시간제</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>장소</label>
              <select className={inputCls} value={care.location} onChange={(e) => setCare({ ...care, location: e.target.value })}>
                <option value="HOSPITAL">병원</option>
                <option value="HOME">자택</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{care.location === "HOSPITAL" ? "병원명" : "장소명"}</label>
              <input className={inputCls} value={care.hospitalName} onChange={(e) => setCare({ ...care, hospitalName: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>주소(선택)</label>
              <input className={inputCls} value={care.address} onChange={(e) => setCare({ ...care, address: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>시작일</label>
              <input className={inputCls} type="date" value={care.startDate} onChange={(e) => setCare({ ...care, startDate: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>시작시간</label>
              <input className={inputCls} type="time" step={600} value={care.startTime} onChange={(e) => setCare({ ...care, startTime: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>종료일</label>
              <input className={inputCls} type="date" value={care.endDate} onChange={(e) => setCare({ ...care, endDate: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>종료시간</label>
              <input className={inputCls} type="time" step={600} value={care.endTime} onChange={(e) => setCare({ ...care, endTime: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>일당(원)</label>
              <input className={inputCls} type="number" min={0} value={care.dailyRate} onChange={(e) => setCare({ ...care, dailyRate: e.target.value })} />
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-500">{durationDays}일 · </span>
                <span className="font-semibold text-gray-900">{totalAmount.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </section>

        <button onClick={submit} disabled={submitting} className="btn-primary w-full py-3 text-base">
          {submitting ? "생성 중..." : "계약 생성 (수동 매칭)"}
        </button>
        <p className="pb-6 text-center text-[11px] text-gray-400">
          생성 즉시 진행중 계약이 되며 양측에 알림이 발송됩니다.
        </p>
      </div>
    </div>
  );
}
