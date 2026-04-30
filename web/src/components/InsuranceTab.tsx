"use client";

import React, { useEffect, useState, useRef } from "react";
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
  updatedAt?: string;
  documentUrl?: string | null;
  rejectReason?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  REQUESTED: { label: "접수됨", color: "bg-gray-100 text-gray-700", desc: "관리자 검토를 기다리고 있습니다." },
  PENDING: { label: "접수됨", color: "bg-gray-100 text-gray-700", desc: "관리자 검토를 기다리고 있습니다." },
  PROCESSING: { label: "처리중", color: "bg-amber-100 text-amber-700", desc: "관리자가 서류를 발급 중입니다." },
  IN_PROGRESS: { label: "처리중", color: "bg-amber-100 text-amber-700", desc: "관리자가 서류를 발급 중입니다." },
  COMPLETED: { label: "발급완료", color: "bg-green-100 text-green-700", desc: "발급 완료된 서류를 다운로드하세요." },
  REJECTED: { label: "거절", color: "bg-red-100 text-red-700", desc: "신청이 거절되었습니다. 사유를 확인해주세요." },
};

export default function InsuranceTab() {
  const [list, setList] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const iid = params.get("insuranceId");
    if (iid) setHighlightId(iid);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await insuranceAPI.list();
        // axios interceptor 가 이미 { success, data } 언래핑 → res.data 가 곧 payload
        setList(Array.isArray(res.data) ? res.data : ((res.data as any)?.items || []));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 하이라이트 항목 스크롤
  useEffect(() => {
    if (!loading && highlightId && itemRefs.current[highlightId]) {
      itemRefs.current[highlightId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightId]);

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
        <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-lg">
          신청 이력이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const st = STATUS_LABELS[r.status] || { label: r.status, color: "bg-gray-100 text-gray-700", desc: "" };
            const isHighlighted = highlightId === r.id;
            return (
              <div
                key={r.id}
                ref={(el) => {
                  itemRefs.current[r.id] = el;
                }}
                className={`bg-white border rounded-lg p-4 transition-all ${
                  isHighlighted ? "border-orange-500 ring-2 ring-orange-200 shadow-md" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-semibold text-gray-900">{r.patientName} 환자</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>
                        {st.label}
                      </span>
                      {isHighlighted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-semibold">
                          알림에서 이동
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{st.desc}</div>
                    <div className="text-sm text-gray-500 space-y-0.5">
                      <div>보험사: <span className="text-gray-700 font-medium">{r.insuranceCompany}</span></div>
                      <div>서류 종류: <span className="text-gray-700 font-medium">{r.documentType}</span></div>
                      <div>간병 기간: {r.carePeriod}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        신청일: {new Date(r.createdAt).toLocaleString("ko-KR")}
                        {r.updatedAt && r.updatedAt !== r.createdAt && (
                          <span> · 최근 업데이트: {new Date(r.updatedAt).toLocaleString("ko-KR")}</span>
                        )}
                      </div>
                    </div>

                    {/* 진행 상황 타임라인 */}
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-400">
                      <ProgressStep active label="접수" done={r.status !== "REQUESTED"} current={r.status === "REQUESTED"} />
                      <ProgressLine done={["PROCESSING", "IN_PROGRESS", "COMPLETED", "REJECTED"].includes(r.status)} />
                      <ProgressStep
                        active={["PROCESSING", "IN_PROGRESS", "COMPLETED", "REJECTED"].includes(r.status)}
                        done={["COMPLETED", "REJECTED"].includes(r.status)}
                        current={r.status === "PROCESSING" || r.status === "IN_PROGRESS"}
                        label="처리중"
                      />
                      <ProgressLine done={r.status === "COMPLETED" || r.status === "REJECTED"} />
                      <ProgressStep
                        active={r.status === "COMPLETED" || r.status === "REJECTED"}
                        done={r.status === "COMPLETED" || r.status === "REJECTED"}
                        current={r.status === "COMPLETED" || r.status === "REJECTED"}
                        label={r.status === "REJECTED" ? "거절" : "완료"}
                        reject={r.status === "REJECTED"}
                      />
                    </div>

                    {r.status === "REJECTED" && r.rejectReason && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                        <strong>거절 사유:</strong> {r.rejectReason}
                      </div>
                    )}
                  </div>
                  {r.status === "COMPLETED" && r.documentUrl && (
                    <a
                      href={(() => {
                        if (!r.documentUrl) return '#';
                        // 인증 라우트(/api/files/private/...)는 토큰 쿼리 동봉
                        if (r.documentUrl.startsWith('/api/files/private/')) {
                          const token = typeof window !== 'undefined' ? localStorage.getItem('cm_access_token') : null;
                          return token ? `${r.documentUrl}?token=${encodeURIComponent(token)}` : r.documentUrl;
                        }
                        return r.documentUrl;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 shrink-0"
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

function ProgressStep({ active, done, current, label, reject }: {
  active?: boolean;
  done?: boolean;
  current?: boolean;
  label: string;
  reject?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
          reject
            ? "bg-red-500 text-white"
            : done
            ? "bg-green-500 text-white"
            : current
            ? "bg-amber-500 text-white animate-pulse"
            : active
            ? "bg-gray-400 text-white"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {reject ? "!" : done ? "✓" : current ? "…" : "·"}
      </div>
      <span className={`${active ? "text-gray-700 font-medium" : "text-gray-400"}`}>{label}</span>
    </div>
  );
}

function ProgressLine({ done }: { done: boolean }) {
  return (
    <div className={`flex-1 h-0.5 min-w-[20px] max-w-[60px] ${done ? "bg-green-400" : "bg-gray-200"}`} />
  );
}
