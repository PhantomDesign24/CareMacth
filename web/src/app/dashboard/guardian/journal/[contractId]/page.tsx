"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { careRecordAPI, contractAPI } from "@/lib/api";
import { FiArrowLeft, FiDownload } from "react-icons/fi";

interface CareRecord {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  careHours: number | null;
  careHoursManual: number | null;
  mealCare: boolean;
  activityCare: boolean;
  excretionCare: boolean;
  hygieneCare: boolean;
  otherCare: boolean;
  otherCareNote: string | null;
  notes: string | null;
  photos: string[];
}

function localDateStr(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function GuardianJournalPageWrapper() {
  return (
    <Suspense fallback={null}>
      <GuardianJournalPage />
    </Suspense>
  );
}

function GuardianJournalPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;

  const [contract, setContract] = useState<any>(null);
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateStr(new Date()));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cRes, rRes] = await Promise.all([
        contractAPI.get(contractId),
        careRecordAPI.list(contractId, { limit: 60 }),
      ]);
      setContract(cRes.data?.data || cRes.data);
      setRecords(rRes.data?.data?.records || rRes.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = records.find((r) => r.date && localDateStr(r.date) === selectedDate) || null;
  const careHours = selected?.careHoursManual ?? selected?.careHours ?? null;

  if (loading) {
    return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">간병 일지</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {contract?.caregiver?.user?.name || "간병인"} · {contract?.careRequest?.patient?.name || "환자"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const t = typeof window !== "undefined" ? localStorage.getItem("cm_access_token") : "";
              window.open(
                `/api/care-records/${contractId}/pdf?token=${encodeURIComponent(t || "")}`,
                "_blank"
              );
            }}
            className="flex items-center gap-1 text-xs px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
          >
            <FiDownload className="w-3.5 h-3.5" /> PDF 다운로드
          </button>
        </div>

        {/* 날짜 선택 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">일자 선택</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field flex-1"
            />
            <div className="text-xs text-gray-500">
              총 {records.length}건 기록
            </div>
          </div>
        </div>

        {/* 선택된 날짜 일지 */}
        {!selected ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
            해당 날짜에 작성된 일지가 없습니다.
          </div>
        ) : (
          <>
            {/* 출퇴근 */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">출퇴근</h2>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">출근</div>
                  <div className="font-semibold text-green-700 mt-1">{fmtTime(selected.checkInTime)}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">퇴근</div>
                  <div className="font-semibold text-red-700 mt-1">{fmtTime(selected.checkOutTime)}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">간병시간</div>
                  <div className="font-semibold text-orange-700 mt-1">
                    {careHours !== null ? `${careHours.toFixed(1)}h` : "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* 간병 유형 */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">수행 항목</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { key: "mealCare", label: "식사보조" },
                  { key: "activityCare", label: "활동보조" },
                  { key: "excretionCare", label: "배변보조" },
                  { key: "hygieneCare", label: "위생보조" },
                  { key: "otherCare", label: "기타" },
                ].map((item) => {
                  const checked = (selected as any)[item.key] as boolean;
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        checked ? "border-orange-200 bg-orange-50 text-orange-700" : "border-gray-100 bg-gray-50 text-gray-400"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[10px] ${
                        checked ? "bg-orange-500 text-white" : "bg-gray-200"
                      }`}>
                        {checked ? "✓" : ""}
                      </span>
                      {item.label}
                    </div>
                  );
                })}
              </div>
              {selected.otherCare && selected.otherCareNote && (
                <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  기타 상세: {selected.otherCareNote}
                </div>
              )}
            </div>

            {/* 특이사항 */}
            {selected.notes && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-bold text-gray-900 mb-2">특이사항</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}

            {/* 사진 */}
            {selected.photos && selected.photos.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-bold text-gray-900 mb-3">
                  첨부 사진 <span className="text-xs font-normal text-gray-400 ml-1">{selected.photos.length}장</span>
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {selected.photos.map((url, idx) => (
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
              </div>
            )}
          </>
        )}

        {/* 전체 기록 리스트 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">일자별 요약</h2>
          <div className="divide-y divide-gray-50">
            {records.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">작성된 일지가 없습니다.</div>
            ) : (
              records.map((r) => {
                const d = localDateStr(r.date);
                const hours = r.careHoursManual ?? r.careHours ?? null;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedDate(d)}
                    className={`w-full text-left py-3 px-2 rounded hover:bg-gray-50 transition ${
                      d === selectedDate ? "bg-orange-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-gray-900">{d}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {fmtTime(r.checkInTime)} ~ {fmtTime(r.checkOutTime)}
                          {hours !== null && ` · ${hours.toFixed(1)}h`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.photos && r.photos.length > 0 && (
                          <span className="text-xs text-orange-600">사진 {r.photos.length}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
