"use client";

import React, { useEffect, useState } from "react";
import { insuranceAPI } from "@/lib/api";

interface Req {
  id: string;
  patientName: string;
  birthDate: string;
  carePeriod: string;
  insuranceCompany: string;
  documentType: string;
  status: string;
  createdAt: string;
  documentUrl?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "접수됨", color: "bg-gray-100 text-gray-700" },
  PENDING: { label: "접수됨", color: "bg-gray-100 text-gray-700" },
  PROCESSING: { label: "처리중", color: "bg-amber-100 text-amber-700" },
  IN_PROGRESS: { label: "처리중", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "완료", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "거절", color: "bg-red-100 text-red-700" },
};

export default function InsuranceTab() {
  const [list, setList] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await insuranceAPI.list();
        setList(res.data?.data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2">보험서류 신청 이력</h3>
        <p className="text-sm text-gray-500">간병 이력 탭에서 &quot;🛡 보험서류&quot; 버튼으로 신청할 수 있습니다.</p>
      </div>
      {list.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl">
          신청 이력이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const st = STATUS_LABELS[r.status] || { label: r.status, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{r.patientName} 환자</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 space-y-0.5">
                      <div>보험사: <span className="text-gray-700 font-medium">{r.insuranceCompany}</span></div>
                      <div>서류 종류: <span className="text-gray-700 font-medium">{r.documentType}</span></div>
                      <div>간병 기간: {r.carePeriod}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        신청일: {new Date(r.createdAt).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  </div>
                  {r.status === "COMPLETED" && r.documentUrl && (
                    <a
                      href={r.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                    >
                      📄 서류 다운로드
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
