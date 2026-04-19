"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DataTable, { Column } from "@/components/DataTable";
import StatsCard from "@/components/StatsCard";
import {
  getAdminCareRequests,
  getAdminCareRequest,
  AdminCareRequestRow,
} from "@/lib/api";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "공고중", cls: "bg-blue-100 text-blue-700" },
  MATCHING: { label: "매칭중", cls: "bg-amber-100 text-amber-700" },
  MATCHED: { label: "매칭완료", cls: "bg-green-100 text-green-700" },
  IN_PROGRESS: { label: "진행중", cls: "bg-indigo-100 text-indigo-700" },
  COMPLETED: { label: "완료", cls: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "취소", cls: "bg-red-100 text-red-700" },
};

const CARE_TYPE_LABEL: Record<string, string> = {
  INDIVIDUAL: "1:1 간병",
  FAMILY: "가족 간병",
};

const SCHEDULE_LABEL: Record<string, string> = {
  FULL_TIME: "24시간",
  PART_TIME: "시간제",
};

const LOCATION_LABEL: Record<string, string> = {
  HOSPITAL: "병원",
  HOME: "자택",
  FACILITY: "요양시설",
};

const APP_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "대기", cls: "bg-gray-100 text-gray-600" },
  ACCEPTED: { label: "수락", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "거절", cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소", cls: "bg-gray-100 text-gray-500" },
};

function formatDate(d: string | null): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return d;
  }
}

const REGION_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

export default function CareRequestsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [applicantFilter, setApplicantFilter] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [startTo, setStartTo] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState<AdminCareRequestRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [detailRow, setDetailRow] = useState<AdminCareRequestRow | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminCareRequests({
        status: statusFilter || undefined,
        careType: typeFilter || undefined,
        scheduleType: scheduleFilter || undefined,
        location: locationFilter || undefined,
        region: regionFilter || undefined,
        hasApplicants: applicantFilter || undefined,
        startFrom: startFrom || undefined,
        startTo: startTo || undefined,
        search: search || undefined,
        page: currentPage,
        limit,
      });
      setRows(res.requests || []);
      setTotalItems(res.pagination?.total ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "간병 요청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, scheduleFilter, locationFilter, regionFilter, applicantFilter, startFrom, startTo, search, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, scheduleFilter, locationFilter, regionFilter, applicantFilter, startFrom, startTo, search]);

  const resetFilters = () => {
    setStatusFilter("");
    setTypeFilter("");
    setScheduleFilter("");
    setLocationFilter("");
    setRegionFilter("");
    setApplicantFilter("");
    setStartFrom("");
    setStartTo("");
    setSearch("");
  };

  const openDetail = useCallback(async (row: AdminCareRequestRow) => {
    setDetailRow(row);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await getAdminCareRequest(row.id);
      setDetailData(res);
    } catch (err: any) {
      alert(err?.message || "상세 조회 실패");
      setDetailRow(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openCount = rows.filter((r) => r.status === "OPEN" || r.status === "MATCHING").length;
  const matchedCount = rows.filter((r) => r.status === "MATCHED" || r.status === "IN_PROGRESS").length;
  const completedCount = rows.filter((r) => r.status === "COMPLETED").length;

  const columns: Column<AdminCareRequestRow>[] = [
    {
      key: "id",
      label: "요청 ID",
      render: (v) => (
        <span className="font-mono text-xs font-bold text-primary-600">
          {((v as string) || "-").substring(0, 8)}...
        </span>
      ),
    },
    {
      key: "patientName",
      label: "환자 / 보호자",
      render: (_v, row) => {
        const r = row as AdminCareRequestRow;
        return (
          <div>
            <div className="font-semibold text-gray-900">{r.patientName}</div>
            <div className="text-xs text-gray-500">{r.guardianName} · {r.guardianPhone}</div>
          </div>
        );
      },
    },
    {
      key: "careType",
      label: "유형",
      align: "center",
      render: (_v, row) => {
        const r = row as AdminCareRequestRow;
        return (
          <div className="flex flex-col items-center gap-0.5 text-xs">
            <span className="font-medium">{CARE_TYPE_LABEL[r.careType] || r.careType}</span>
            <span className="text-gray-500">
              {SCHEDULE_LABEL[r.scheduleType] || r.scheduleType} · {LOCATION_LABEL[r.location] || r.location}
            </span>
          </div>
        );
      },
    },
    {
      key: "address",
      label: "위치",
      render: (_v, row) => {
        const r = row as AdminCareRequestRow;
        return (
          <div className="text-xs">
            <div className="text-gray-900 truncate max-w-[200px]" title={r.address}>{r.address}</div>
            {r.hospitalName && (
              <div className="text-gray-500 truncate max-w-[200px]">{r.hospitalName}</div>
            )}
          </div>
        );
      },
    },
    {
      key: "startDate",
      label: "기간",
      render: (_v, row) => {
        const r = row as AdminCareRequestRow;
        return (
          <div className="text-xs text-gray-600">
            <div>{formatDate(r.startDate)}</div>
            <div className="text-gray-400">~ {formatDate(r.endDate)} ({r.durationDays || "-"}일)</div>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "상태",
      align: "center",
      render: (v) => {
        const s = (v as string) || "";
        const st = STATUS_LABEL[s] || { label: s, cls: "bg-gray-100 text-gray-600" };
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
        );
      },
    },
    {
      key: "applicationCount",
      label: "지원",
      align: "center",
      render: (_v, row) => {
        const r = row as AdminCareRequestRow;
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              r.applicationCount > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
            }`}>
              지원 {r.applicationCount}
            </span>
            {r.contractCount > 0 && (
              <span className="text-[10px] text-green-600">계약 {r.contractCount}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "createdAt",
      label: "등록일",
      render: (v) => <span className="text-xs text-gray-500">{formatDate(v as string)}</span>,
    },
    {
      key: "id",
      label: "관리",
      align: "center",
      render: (_v, row) => (
        <button
          type="button"
          onClick={() => openDetail(row as AdminCareRequestRow)}
          className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium"
        >
          상세
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">간병 일감 관리</h1>
        <p className="mt-1 text-sm text-gray-500">보호자가 등록한 간병 요청(일감)과 지원 현황을 조회합니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="전체 요청" value={`${totalItems}건`} color="blue" />
        <StatsCard title="공고/매칭중" value={`${openCount}건`} color="green" />
        <StatsCard title="매칭완료/진행" value={`${matchedCount}건`} color="purple" />
        <StatsCard title="완료" value={`${completedCount}건`} color="red" />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="환자/보호자/주소/병원 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 상태</option>
            <option value="OPEN">공고중</option>
            <option value="MATCHING">매칭중</option>
            <option value="MATCHED">매칭완료</option>
            <option value="IN_PROGRESS">진행중</option>
            <option value="COMPLETED">완료</option>
            <option value="CANCELLED">취소</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 유형</option>
            <option value="INDIVIDUAL">1:1 간병</option>
            <option value="FAMILY">가족 간병</option>
          </select>
          <select
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 일정</option>
            <option value="FULL_TIME">24시간</option>
            <option value="PART_TIME">시간제</option>
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 위치</option>
            <option value="HOSPITAL">병원</option>
            <option value="HOME">자택</option>
            <option value="FACILITY">요양시설</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">전체 지역</option>
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={applicantFilter}
            onChange={(e) => setApplicantFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">지원 여부 전체</option>
            <option value="yes">지원자 있음</option>
            <option value="no">지원자 없음</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">시작일</label>
            <input
              type="date"
              value={startFrom}
              onChange={(e) => setStartFrom(e.target.value)}
              className="input-field w-auto"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={startTo}
              onChange={(e) => setStartTo(e.target.value)}
              className="input-field w-auto"
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
          <button onClick={fetchData} className="ml-4 underline">다시 시도</button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={totalItems}
        emptyMessage="등록된 간병 요청이 없습니다."
      />

      {detailRow && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">간병 요청 상세</h3>
                <p className="text-xs text-gray-500 mt-0.5">ID: {detailRow.id}</p>
              </div>
              <button
                onClick={() => setDetailRow(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {detailLoading ? (
              <div className="py-20 text-center text-gray-400">불러오는 중...</div>
            ) : !detailData ? (
              <div className="py-20 text-center text-gray-400">데이터가 없습니다.</div>
            ) : (
              <div className="p-6 space-y-5">
                {/* 기본 정보 */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">기본 정보</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-blue-600">보호자</div>
                      <div className="font-semibold text-gray-900 mt-1">{detailData.guardian?.user?.name || "-"}</div>
                      <div className="text-xs text-gray-500">{detailData.guardian?.user?.phone || "-"}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-xs text-purple-600">환자</div>
                      <div className="font-semibold text-gray-900 mt-1">{detailData.patient?.name || "-"}</div>
                      <div className="text-xs text-gray-500">
                        {detailData.patient?.birthDate
                          ? new Date(detailData.patient.birthDate).toLocaleDateString("ko-KR")
                          : "-"}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-600">상태</div>
                      <div className="mt-1">
                        {(() => {
                          const st = STATUS_LABEL[detailData.status] || { label: detailData.status, cls: "bg-gray-100 text-gray-600" };
                          return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>;
                        })()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        등록: {formatDate(detailData.createdAt)}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 요청 상세 */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">요청 내용</h4>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                    <InfoRow label="간병 유형" value={`${CARE_TYPE_LABEL[detailData.careType] || detailData.careType} · ${SCHEDULE_LABEL[detailData.scheduleType] || detailData.scheduleType}`} />
                    <InfoRow label="위치" value={`${LOCATION_LABEL[detailData.location] || detailData.location}${detailData.hospitalName ? ` (${detailData.hospitalName})` : ""}`} />
                    <InfoRow label="주소" value={detailData.address || "-"} />
                    {detailData.regions?.length > 0 && (
                      <InfoRow label="지역" value={detailData.regions.join(", ")} />
                    )}
                    <InfoRow label="기간" value={`${formatDate(detailData.startDate)} ~ ${formatDate(detailData.endDate)} (${detailData.durationDays || "-"}일)`} />
                    {detailData.dailyRate && (
                      <InfoRow label="일당" value={`${detailData.dailyRate.toLocaleString()}원`} />
                    )}
                    {detailData.hourlyRate && (
                      <InfoRow label="시급" value={`${detailData.hourlyRate.toLocaleString()}원`} />
                    )}
                    {detailData.preferredGender && (
                      <InfoRow label="선호 성별" value={detailData.preferredGender} />
                    )}
                    {detailData.preferredNationality && (
                      <InfoRow label="선호 국적" value={detailData.preferredNationality} />
                    )}
                    {detailData.specialRequirements && (
                      <InfoRow label="특이사항" value={detailData.specialRequirements} />
                    )}
                  </div>
                </section>

                {/* 지원자 목록 */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">
                    지원자 <span className="text-xs font-normal text-gray-400">{detailData.applications?.length || 0}명</span>
                  </h4>
                  {!detailData.applications || detailData.applications.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-400 text-center">지원자가 없습니다.</div>
                  ) : (
                    <div className="border border-gray-100 rounded-lg overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1.5 text-left text-gray-600">간병인</th>
                            <th className="px-2 py-1.5 text-left text-gray-600">연락처</th>
                            <th className="px-2 py-1.5 text-right text-gray-600">제안 일당</th>
                            <th className="px-2 py-1.5 text-center text-gray-600">상태</th>
                            <th className="px-2 py-1.5 text-left text-gray-600">지원일</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.applications.map((a: any) => {
                            const st = APP_STATUS_LABEL[a.status] || { label: a.status, cls: "bg-gray-100 text-gray-600" };
                            return (
                              <tr key={a.id} className="border-t border-gray-100">
                                <td className="px-2 py-1.5">
                                  <Link href={`/caregivers/${a.caregiver?.id}`} className="text-orange-600 hover:underline">
                                    {a.caregiver?.user?.name || "-"}
                                  </Link>
                                </td>
                                <td className="px-2 py-1.5">{a.caregiver?.user?.phone || "-"}</td>
                                <td className="px-2 py-1.5 text-right">
                                  {a.proposedRate
                                    ? `${a.proposedRate.toLocaleString()}원`
                                    : a.isAccepted
                                      ? <span className="text-gray-400">제시가 수락</span>
                                      : "-"}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                                </td>
                                <td className="px-2 py-1.5">{formatDate(a.createdAt)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* 체결 계약 */}
                {detailData.contracts?.length > 0 && (
                  <section>
                    <h4 className="text-sm font-bold text-gray-900 mb-2">
                      체결된 계약 <span className="text-xs font-normal text-gray-400">{detailData.contracts.length}건</span>
                    </h4>
                    <div className="space-y-1 text-xs">
                      {detailData.contracts.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between bg-green-50 rounded px-3 py-2">
                          <div>
                            <div className="font-semibold text-gray-900">{c.caregiver?.user?.name || "-"}</div>
                            <div className="text-gray-500">
                              {formatDate(c.startDate)} ~ {formatDate(c.endDate)} · {c.totalAmount?.toLocaleString()}원
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">{c.status}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1 gap-3">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}
