"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { careRecordAPI, contractAPI } from "@/lib/api";
import { compressImages } from "@/lib/imageCompress";
import { showToast } from "@/components/Toast";
import { FiClock, FiLogOut, FiLogIn, FiSave, FiArrowLeft, FiDownload } from "react-icons/fi";

interface CareRecord {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  careHours: number | null;         // 자동 계산
  careHoursManual: number | null;   // 수동 입력
  mealCare: boolean;
  activityCare: boolean;
  excretionCare: boolean;
  hygieneCare: boolean;
  otherCare: boolean;
  otherCareNote: string | null;
  notes: string | null;
  photos: string[];
}

// 로컬 날짜 기준 YYYY-MM-DD (타임존 버그 방지)
function localDateStr(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function localDateStrFromToday(): string {
  return localDateStr(new Date());
}

export default function JournalPageWrapper() {
  return (
    <Suspense fallback={null}>
      <JournalPage />
    </Suspense>
  );
}

function JournalPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractId = params.contractId as string;
  const dateFromQuery = searchParams.get("date");

  const [contract, setContract] = useState<any>(null);
  const [today, setToday] = useState<CareRecord | null>(null);
  const [history, setHistory] = useState<CareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // 선택된 일자 (쿼리스트링 ?date= 우선, 없으면 오늘)
  const [selectedDate, setSelectedDate] = useState<string>(() => dateFromQuery || localDateStrFromToday());
  // 이 계약 한정 법인명
  const [contractCorporateName, setContractCorporateName] = useState<string>("");
  const [form, setForm] = useState({
    careHoursManual: "",
    mealCare: false,
    activityCare: false,
    excretionCare: false,
    hygieneCare: false,
    otherCare: false,
    otherCareNote: "",
    notes: "",
  });
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPhotoUploading(true);
    try {
      // 업로드 전 이미지 압축
      const compressed = await compressImages(Array.from(files));
      const fd = new FormData();
      fd.append('contractId', contractId);
      if (today?.id) fd.append('recordId', today.id);
      fd.append('date', selectedDate);
      for (const f of compressed) {
        fd.append('photos', f);
      }
      const res = await careRecordAPI.uploadPhotos(fd);
      const payload = res.data?.data || {};
      const newPhotos: string[] = payload.photos || [];
      const newRecordId: string | undefined = payload.recordId;
      setToday((prev) => {
        if (prev) return { ...prev, photos: newPhotos };
        // 새로 생성된 빈 기록
        return {
          id: newRecordId || "",
          date: selectedDate,
          checkInTime: null,
          checkOutTime: null,
          careHours: null,
          careHoursManual: null,
          mealCare: false,
          activityCare: false,
          excretionCare: false,
          hygieneCare: false,
          otherCare: false,
          otherCareNote: null,
          notes: null,
          photos: newPhotos,
        };
      });
      showToast(`사진 ${files.length}장 업로드 완료`, "success");
    } catch (err: any) {
      showToast(err?.response?.data?.message || "업로드 실패", "error");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [contractRes, recordsRes] = await Promise.all([
        contractAPI.get(contractId),
        careRecordAPI.list(contractId, { limit: 30 }),
      ]);
      const loadedContract = contractRes.data?.data || contractRes.data;
      setContract(loadedContract);
      // 계약별 값 우선, 없으면 간병인 프로필 기본값
      setContractCorporateName(
        loadedContract?.corporateName || loadedContract?.caregiver?.corporateName || ""
      );
      const records: CareRecord[] = recordsRes.data?.data?.records || recordsRes.data?.data || [];
      // 선택된 날짜에 해당하는 기록 찾기 (기본: 오늘)
      const t = records.find((r) => r.date && localDateStr(r.date) === selectedDate) || null;
      setToday(t);
      setHistory(records);
      if (t) {
        setForm({
          careHoursManual: t.careHoursManual?.toString() || "",
          mealCare: !!t.mealCare,
          activityCare: !!t.activityCare,
          excretionCare: !!t.excretionCare,
          hygieneCare: !!t.hygieneCare,
          otherCare: !!t.otherCare,
          otherCareNote: t.otherCareNote || "",
          notes: t.notes || "",
        });
      } else {
        setForm({
          careHoursManual: "",
          mealCare: false,
          activityCare: false,
          excretionCare: false,
          hygieneCare: false,
          otherCare: false,
          otherCareNote: "",
          notes: "",
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [contractId, selectedDate]);

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
      showToast("출근 체크 완료", "success");
    } catch (e: any) {
      showToast(e?.response?.data?.message || "출근 체크 실패", "error");
    }
  };

  const handleCheckOut = async () => {
    try {
      await careRecordAPI.checkOut(contractId);
      await loadData();
      showToast("퇴근 체크 완료 (간병시간 자동 기록)", "success");
    } catch (e: any) {
      showToast(e?.response?.data?.message || "퇴근 체크 실패", "error");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await careRecordAPI.saveDailyLog({
        contractId,
        date: selectedDate,
        careHoursManual: form.careHoursManual ? parseFloat(form.careHoursManual) : null,
        mealCare: form.mealCare,
        activityCare: form.activityCare,
        excretionCare: form.excretionCare,
        hygieneCare: form.hygieneCare,
        otherCare: form.otherCare,
        otherCareNote: form.otherCare ? (form.otherCareNote || null) : null,
        notes: form.notes || null,
      });
      await loadData();
      showToast("간병 일지 저장 완료", "success");
    } catch (e: any) {
      showToast(e?.response?.data?.message || "저장 실패", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    // 백엔드 PDF 생성 엔드포인트로 이동 (새 탭)
    const token = typeof window !== "undefined" ? localStorage.getItem("cm_access_token") : "";
    const url = `/api/care-records/${contractId}/pdf?token=${encodeURIComponent(token || "")}`;
    window.open(url, "_blank");
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
  // 자동 계산된 간병시간 (표시용)
  const autoHours = today?.checkInTime && today?.checkOutTime
    ? Math.round(((new Date(today.checkOutTime).getTime() - new Date(today.checkInTime).getTime()) / 3600000) * 10) / 10
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 sticky top-16 md:top-[104px] z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">간병 일지</h1>
            {contract && (
              <p className="text-xs text-gray-500">
                {contract.careRequest?.patient?.name || "환자"} · {new Date(selectedDate).toLocaleDateString("ko-KR")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            title="보험사 제출용 PDF"
          >
            <FiDownload className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* 환자/간병인 정보 */}
        {contract && (
          <div className="bg-white rounded-xl p-4 border border-gray-100 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <InfoRow label="환자명" value={contract.careRequest?.patient?.name || "-"} />
              <InfoRow label="병원명" value={contract.careRequest?.hospitalName || contract.careRequest?.address || "-"} />
              <InfoRow label="간병 시작일" value={contract.startDate ? new Date(contract.startDate).toLocaleDateString("ko-KR") : "-"} />
              <InfoRow label="간병 종료일" value={contract.endDate ? new Date(contract.endDate).toLocaleDateString("ko-KR") : "-"} />
            </div>
            {/* 이 계약에서 사용된 법인명 (간병일지 PDF에 반영) */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <label className="block text-xs text-gray-500 mb-1">
                간병인 사용 법인명 <span className="text-gray-400">(이 간병건 한정, 비워두면 프로필 기본값 사용)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contractCorporateName}
                  onChange={(e) => setContractCorporateName(e.target.value)}
                  placeholder="파견 법인명 (선택)"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await contractAPI.updateCorporateName(contractId, contractCorporateName);
                      showToast("법인명 저장됨", "success");
                    } catch {
                      showToast("저장 실패", "error");
                    }
                  }}
                  className="px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 날짜 선택 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-gray-900">기록 날짜</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(localDateStr(d));
                }}
                className="px-2 py-1 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
              >
                ◀
              </button>
              <input
                type="date"
                value={selectedDate}
                max={localDateStrFromToday()}
                min={contract?.startDate ? localDateStr(contract.startDate) : undefined}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
              />
              <button
                type="button"
                disabled={selectedDate >= localDateStrFromToday()}
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(localDateStr(d));
                }}
                className="px-2 py-1 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
              >
                ▶
              </button>
              {selectedDate !== localDateStrFromToday() && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(localDateStrFromToday())}
                  className="px-2 py-1 text-xs bg-gray-900 text-white rounded-md"
                >
                  오늘
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            과거 일자를 선택해 해당 날짜의 기록을 확인·수정할 수 있습니다.
          </p>
        </div>

        {/* 출퇴근 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FiClock className="w-4 h-4 text-orange-500" /> 출퇴근 체크
          </h2>
          <div className="grid grid-cols-3 gap-3">
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
            <div>
              <div className="text-xs text-gray-400">간병시간</div>
              <div className={`text-base font-bold ${autoHours ? "text-blue-600" : "text-gray-300"}`}>
                {autoHours ? `${autoHours}h` : "-"}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={checkedIn || selectedDate !== localDateStrFromToday()}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-green-500 text-white font-bold text-sm hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              <FiLogIn className="w-4 h-4" /> 출근 체크
            </button>
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={!checkedIn || checkedOut || selectedDate !== localDateStrFromToday()}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              <FiLogOut className="w-4 h-4" /> 퇴근 체크
            </button>
          </div>
          {selectedDate !== localDateStrFromToday() && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠ 과거 일자에는 출퇴근 체크할 수 없습니다. 간병시간은 수동 입력을 사용하세요.
            </p>
          )}
        </div>

        {/* 간병시간 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">간병시간</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-xs text-blue-600 mb-1">자동 (출퇴근 기반)</div>
              <div className="text-lg font-bold text-blue-700">
                {today?.careHours ?? autoHours ?? '-'}{(today?.careHours || autoHours) ? '시간' : ''}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-xs text-orange-600 mb-1">수동 입력</div>
              <div className="text-lg font-bold text-orange-700">
                {today?.careHoursManual ?? '-'}{today?.careHoursManual ? '시간' : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              min={0}
              max={24}
              value={form.careHoursManual}
              onChange={(e) => setForm({ ...form, careHoursManual: e.target.value })}
              placeholder="수동 간병시간 (선택, 예: 9)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
            <span className="text-sm text-gray-600">시간</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            자동 시간은 출퇴근 체크로 계산되며 출퇴근 할 때마다 갱신됩니다. 수동 입력값은 별도 보관되며 PDF에선 수동값이 우선 사용됩니다.
          </p>
        </div>

        {/* 간병 업무 체크 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">간병 업무 (해당 항목 모두 체크)</h2>
          <div className="grid grid-cols-2 gap-2">
            <CheckboxItem label="식사보조" checked={form.mealCare} onChange={(v) => setForm({ ...form, mealCare: v })} />
            <CheckboxItem label="활동보조" checked={form.activityCare} onChange={(v) => setForm({ ...form, activityCare: v })} />
            <CheckboxItem label="배변보조" checked={form.excretionCare} onChange={(v) => setForm({ ...form, excretionCare: v })} />
            <CheckboxItem label="위생보조" checked={form.hygieneCare} onChange={(v) => setForm({ ...form, hygieneCare: v })} />
            <div className="col-span-2">
              <CheckboxItem label="기타" checked={form.otherCare} onChange={(v) => setForm({ ...form, otherCare: v })} />
              {form.otherCare && (
                <input
                  type="text"
                  value={form.otherCareNote}
                  onChange={(e) => setForm({ ...form, otherCareNote: e.target.value })}
                  placeholder="기타 업무 내용 입력"
                  className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              )}
            </div>
          </div>
        </div>

        {/* 특이사항 (선택) */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">특이사항 (선택)</h2>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="특별히 기록할 내용이 있으면 입력"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none"
          />
        </div>

        {/* 사진 첨부 (저장 후 업로드 가능) */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            사진 첨부 (선택)
            {today?.photos && today.photos.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">{today.photos.length}장</span>
            )}
          </h2>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={photoUploading}
            onChange={handlePhotoUpload}
            className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-700 file:text-xs file:font-semibold hover:file:bg-orange-100 disabled:opacity-50"
          />
          {photoUploading && (
            <p className="mt-2 text-xs text-orange-500">업로드 중...</p>
          )}
          {today?.photos && today.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {today.photos.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
                >
                  <img src={url} alt={`photo-${idx + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 저장 */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50"
        >
          <FiSave className="w-5 h-5" /> {saving ? "저장 중..." : "간병 일지 저장"}
        </button>

        {/* 과거 일지 이력 */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-gray-100 mt-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">최근 일지 ({history.length}건)</h2>
            <div className="divide-y divide-gray-50">
              {history.slice(0, 10).map((r) => {
                const tasks: string[] = [];
                if (r.mealCare) tasks.push("식사");
                if (r.activityCare) tasks.push("활동");
                if (r.excretionCare) tasks.push("배변");
                if (r.hygieneCare) tasks.push("위생");
                if (r.otherCare) tasks.push("기타");
                return (
                  <div key={r.id} className="py-2 text-sm flex items-center justify-between gap-2">
                    <span className="text-gray-700 shrink-0">{new Date(r.date).toLocaleDateString("ko-KR")}</span>
                    <span className="text-xs text-gray-500 flex-1 text-right truncate">
                      {r.careHours ? `${r.careHours}h` : "-"}
                      {tasks.length > 0 && ` · ${tasks.join("/")}`}
                    </span>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-900 truncate">{value}</div>
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? "bg-orange-50 border-orange-300" : "bg-white border-gray-200"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-orange-500"
      />
      <span className={`text-sm font-medium ${checked ? "text-orange-700" : "text-gray-700"}`}>{label}</span>
    </label>
  );
}
