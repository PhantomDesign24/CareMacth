"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { careRecordAPI, contractAPI } from "@/lib/api";
import { FiClock, FiLogOut, FiLogIn, FiCamera, FiSave, FiArrowLeft } from "react-icons/fi";

interface CareRecord {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  bodyTemp: number | null;
  bloodPressure: string | null;
  pulse: number | null;
  meals: string | null;
  medication: string | null;
  excretion: string | null;
  sleep: string | null;
  mobility: string | null;
  mentalState: string | null;
  skinState: string | null;
  photos: string[];
  notes: string | null;
}

export default function JournalPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;

  const [contract, setContract] = useState<any>(null);
  const [today, setToday] = useState<CareRecord | null>(null);
  const [history, setHistory] = useState<CareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bodyTemp: "",
    bloodPressure: "",
    pulse: "",
    meals: "",
    medication: "",
    excretion: "",
    sleep: "",
    mobility: "",
    mentalState: "",
    skinState: "",
    notes: "",
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [contractRes, recordsRes] = await Promise.all([
        contractAPI.get(contractId),
        careRecordAPI.list(contractId, { limit: 30 }),
      ]);
      setContract(contractRes.data?.data || contractRes.data);
      const records: CareRecord[] = recordsRes.data?.data?.records || recordsRes.data?.data || [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const t = records.find((r) => r.date?.slice(0, 10) === todayStr) || null;
      setToday(t);
      setHistory(records);
      if (t) {
        setForm({
          bodyTemp: t.bodyTemp?.toString() || "",
          bloodPressure: t.bloodPressure || "",
          pulse: t.pulse?.toString() || "",
          meals: t.meals || "",
          medication: t.medication || "",
          excretion: t.excretion || "",
          sleep: t.sleep || "",
          mobility: t.mobility || "",
          mentalState: t.mentalState || "",
          skinState: t.skinState || "",
          notes: t.notes || "",
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckIn = async () => {
    try {
      const getPos = (): Promise<GeolocationPosition | null> =>
        new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            () => resolve(null),
            { timeout: 5000 }
          );
        });
      const pos = await getPos();
      await careRecordAPI.checkIn(
        contractId,
        pos?.coords.latitude,
        pos?.coords.longitude
      );
      await loadData();
      alert("출근 체크 완료");
    } catch (e: any) {
      alert(e?.response?.data?.message || "출근 체크 실패");
    }
  };

  const handleCheckOut = async () => {
    try {
      await careRecordAPI.checkOut(contractId);
      await loadData();
      alert("퇴근 체크 완료");
    } catch (e: any) {
      alert(e?.response?.data?.message || "퇴근 체크 실패");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await careRecordAPI.saveDailyLog({
        contractId,
        date: new Date().toISOString().slice(0, 10),
        bodyTemp: form.bodyTemp ? parseFloat(form.bodyTemp) : null,
        bloodPressure: form.bloodPressure || null,
        pulse: form.pulse ? parseInt(form.pulse) : null,
        meals: form.meals || null,
        medication: form.medication || null,
        excretion: form.excretion || null,
        sleep: form.sleep || null,
        mobility: form.mobility || null,
        mentalState: form.mentalState || null,
        skinState: form.skinState || null,
        notes: form.notes || null,
      });
      await loadData();
      alert("간병 일지 저장 완료");
    } catch (e: any) {
      alert(e?.response?.data?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("contractId", contractId);
      fd.append("date", new Date().toISOString().slice(0, 10));
      files.forEach((f) => fd.append("photos", f));
      await careRecordAPI.uploadPhotos(fd);
      await loadData();
      alert(`${files.length}장 업로드 완료`);
    } catch (e: any) {
      alert(e?.response?.data?.message || "업로드 실패");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <svg className="animate-spin h-8 w-8 text-orange-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const checkedIn = !!today?.checkInTime;
  const checkedOut = !!today?.checkOutTime;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">간병 일지</h1>
            {contract && (
              <p className="text-xs text-gray-500">
                {contract.careRequest?.patient?.name || "환자"} · {new Date().toLocaleDateString("ko-KR")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* 출퇴근 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FiClock className="w-4 h-4 text-orange-500" /> 출퇴근 체크
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-400">출근</div>
              <div className={`text-base font-bold ${checkedIn ? "text-green-600" : "text-gray-300"}`}>
                {today?.checkInTime ? new Date(today.checkInTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">퇴근</div>
              <div className={`text-base font-bold ${checkedOut ? "text-orange-600" : "text-gray-300"}`}>
                {today?.checkOutTime ? new Date(today.checkOutTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={checkedIn}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-green-500 text-white font-bold text-sm hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              <FiLogIn className="w-4 h-4" /> 출근 체크
            </button>
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={!checkedIn || checkedOut}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              <FiLogOut className="w-4 h-4" /> 퇴근 체크
            </button>
          </div>
        </div>

        {/* 건강 체크 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">건강 상태</h2>
          <div className="grid grid-cols-3 gap-2">
            <LabeledInput label="체온(℃)" value={form.bodyTemp} onChange={(v) => setForm({ ...form, bodyTemp: v })} type="number" step="0.1" />
            <LabeledInput label="혈압" value={form.bloodPressure} onChange={(v) => setForm({ ...form, bloodPressure: v })} placeholder="120/80" />
            <LabeledInput label="맥박" value={form.pulse} onChange={(v) => setForm({ ...form, pulse: v })} type="number" />
          </div>
        </div>

        {/* 일상 기록 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">일상 기록</h2>
          <div className="space-y-2.5">
            <LabeledTextarea label="식사" value={form.meals} onChange={(v) => setForm({ ...form, meals: v })} placeholder="아침/점심/저녁 및 섭취량" />
            <LabeledTextarea label="투약" value={form.medication} onChange={(v) => setForm({ ...form, medication: v })} placeholder="복용 약물 및 시간" />
            <LabeledTextarea label="배변/배뇨" value={form.excretion} onChange={(v) => setForm({ ...form, excretion: v })} />
            <LabeledTextarea label="수면 상태" value={form.sleep} onChange={(v) => setForm({ ...form, sleep: v })} />
            <LabeledTextarea label="거동 상태" value={form.mobility} onChange={(v) => setForm({ ...form, mobility: v })} />
            <LabeledTextarea label="정신 상태" value={form.mentalState} onChange={(v) => setForm({ ...form, mentalState: v })} />
            <LabeledTextarea label="피부 상태" value={form.skinState} onChange={(v) => setForm({ ...form, skinState: v })} />
            <LabeledTextarea label="기타 메모" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} rows={3} />
          </div>
        </div>

        {/* 사진 업로드 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FiCamera className="w-4 h-4 text-orange-500" /> 사진 ({today?.photos?.length || 0})
          </h2>
          {today?.photos && today.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {today.photos.map((url, i) => (
                <img
                  key={i}
                  src={url.startsWith("http") ? url : `https://cm.phantomdesign.kr${url}`}
                  alt={`간병 사진 ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-lg"
                />
              ))}
            </div>
          )}
          <label className="block">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
              className="hidden"
            />
            <span className="block w-full text-center py-3 bg-orange-50 text-orange-600 font-bold rounded-lg border-2 border-dashed border-orange-200 cursor-pointer hover:bg-orange-100">
              {uploadingPhoto ? "업로드 중..." : "+ 사진 추가"}
            </span>
          </label>
        </div>

        {/* 저장 버튼 */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50"
        >
          <FiSave className="w-5 h-5" /> {saving ? "저장 중..." : "간병 일지 저장"}
        </button>

        {/* 과거 이력 */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-gray-100 mt-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">최근 일지</h2>
            <div className="space-y-2">
              {history.slice(0, 7).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm last:border-0">
                  <span className="text-gray-700">{new Date(r.date).toLocaleDateString("ko-KR")}</span>
                  <span className="text-xs text-gray-400">
                    {r.checkInTime ? "✓ 출근" : ""} {r.checkOutTime ? "· 퇴근" : ""}
                    {r.photos?.length > 0 && ` · 사진 ${r.photos.length}장`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LabeledInput({
  label, value, onChange, type = "text", placeholder, step,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; step?: string; }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400"
      />
    </div>
  );
}

function LabeledTextarea({
  label, value, onChange, placeholder, rows = 2,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400 resize-none"
      />
    </div>
  );
}
