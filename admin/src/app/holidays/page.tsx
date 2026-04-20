"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  AdminHoliday,
} from "@/lib/api";

const TYPE_LABEL: Record<string, { label: string; cls: string; desc: string }> = {
  CUSTOM: {
    label: "추가",
    cls: "bg-amber-100 text-amber-700",
    desc: "라이브러리에 없는 회사 휴무일",
  },
  EXCLUDE: {
    label: "제외",
    cls: "bg-gray-100 text-gray-600",
    desc: "라이브러리엔 공휴일이지만 이 날은 영업",
  },
};

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 월별 달력 날짜 배열 생성 (이전 달 회색 채움 포함)
function buildMonthGrid(year: number, month: number /* 1-12 */): { date: string; inMonth: boolean }[] {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay(); // 0(일) ~ 6(토)
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells: { date: string; inMonth: boolean }[] = [];
  // 이전 달 채움
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const dt = new Date(year, month - 2, d);
    cells.push({ date: dt.toISOString().slice(0, 10), inMonth: false });
  }
  // 현재 달
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    cells.push({ date: dt.toISOString().slice(0, 10), inMonth: true });
  }
  // 다음 달 채움 (6행 맞추기)
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = new Date(cells[cells.length - 1].date);
    last.setDate(last.getDate() + 1);
    cells.push({ date: last.toISOString().slice(0, 10), inMonth: false });
    if (cells.length >= 42) break;
  }
  return cells;
}

export default function HolidaysPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [calMonth, setCalMonth] = useState<number>(now.getMonth() + 1);
  const [overrides, setOverrides] = useState<AdminHoliday[]>([]);
  const [library, setLibrary] = useState<{ date: string; names: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 신규 입력 폼
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"CUSTOM" | "EXCLUDE">("CUSTOM");
  const [newDesc, setNewDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getHolidays(year);
      setOverrides(res.overrides || []);
      setLibrary(res.library || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "공휴일 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!newDate) return alert("날짜를 선택해주세요.");
    if (!newName.trim()) return alert("이름을 입력해주세요.");
    setSubmitting(true);
    try {
      await createHoliday({ date: newDate, name: newName.trim(), type: newType, description: newDesc.trim() || undefined });
      setNewDate("");
      setNewName("");
      setNewDesc("");
      setNewType("CUSTOM");
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "등록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (h: AdminHoliday) => {
    if (!confirm(`${h.date} "${h.name}" 을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteHoliday(h.id);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "삭제 실패");
    }
  };

  const handleExcludeLibraryDate = async (date: string, names: string[]) => {
    if (!confirm(`${date} "${names.join(', ')}" 을(를) 이 날만 영업일로 지정하시겠습니까?`)) return;
    try {
      await createHoliday({ date, name: names.join(', '), type: "EXCLUDE", description: "라이브러리 공휴일 예외 영업" });
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "등록 실패");
    }
  };

  // 병합: 라이브러리 + override 통합 뷰
  const overrideByDate = new Map(overrides.map((o) => [o.date, o]));
  const merged = [
    ...library.map((l) => ({
      date: l.date,
      names: l.names,
      override: overrideByDate.get(l.date) || null,
      source: "library" as const,
    })),
    ...overrides
      .filter((o) => o.type === "CUSTOM" && !library.find((l) => l.date === o.date))
      .map((o) => ({ date: o.date, names: [o.name], override: o, source: "custom" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">공휴일 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          기본 공휴일은 관보 기준 라이브러리(<code className="text-xs">@hyunbinseo/holidays-kr</code>)로 자동 제공되며,
          관리자는 회사 휴무를 추가하거나 특정 공휴일을 제외할 수 있습니다.
        </p>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">override 추가</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">날짜</label>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">유형</label>
            <select value={newType} onChange={(e) => setNewType(e.target.value as any)} className="input-field">
              <option value="CUSTOM">추가 (회사 휴무)</option>
              <option value="EXCLUDE">제외 (예외 영업)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-gray-500">이름</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 창립기념일" className="input-field" />
          </div>
          <div className="flex items-end">
            <button type="button" onClick={handleCreate} disabled={submitting} className="btn-primary w-full">
              {submitting ? "..." : "등록"}
            </button>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs text-gray-500">설명 (선택)</label>
          <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="input-field" />
        </div>
        <p className="mt-3 text-xs text-gray-400">
          <strong>추가</strong>: 라이브러리에 없는 날짜를 휴일로 처리 · <strong>제외</strong>: 라이브러리 공휴일이지만 이 날은 영업일
        </p>
      </div>

      {/* 달력 뷰 */}
      {(() => {
        const libMap = new Map(library.map((l) => [l.date, l.names]));
        const grid = buildMonthGrid(year, calMonth);
        const goPrev = () => {
          if (calMonth === 1) { setCalMonth(12); setYear(year - 1); }
          else setCalMonth(calMonth - 1);
        };
        const goNext = () => {
          if (calMonth === 12) { setCalMonth(1); setYear(year + 1); }
          else setCalMonth(calMonth + 1);
        };
        const goToday = () => { setYear(now.getFullYear()); setCalMonth(now.getMonth() + 1); };
        const todayStr = new Date().toISOString().slice(0, 10);

        return (
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={goPrev} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">‹</button>
                <h3 className="text-lg font-semibold text-gray-900 min-w-[110px] text-center">
                  {year}년 {calMonth}월
                </h3>
                <button type="button" onClick={goNext} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">›</button>
                <button type="button" onClick={goToday} className="ml-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-50">오늘</button>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" /> 휴일</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" /> 추가</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-300" /> 제외</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden text-sm">
              {WEEK_DAYS.map((w, i) => (
                <div key={w} className={`bg-gray-50 text-center py-2 text-xs font-semibold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"}`}>{w}</div>
              ))}
              {grid.map((cell) => {
                const d = new Date(cell.date);
                const dow = d.getDay();
                const libNames = libMap.get(cell.date);
                const override = overrideByDate.get(cell.date);
                const isWeekend = dow === 0 || dow === 6;
                // 실제 휴일 여부: EXCLUDE면 false, CUSTOM이면 true, 그 외 라이브러리/주말
                const effectiveHoliday = override?.type === "EXCLUDE"
                  ? false
                  : !!(override?.type === "CUSTOM" || libNames || isWeekend);

                let bgClass = cell.inMonth ? "bg-white" : "bg-gray-50";
                let borderAccent = "";
                if (cell.inMonth) {
                  if (override?.type === "EXCLUDE") {
                    bgClass = "bg-gray-100";
                    borderAccent = "ring-1 ring-gray-400";
                  } else if (override?.type === "CUSTOM") {
                    bgClass = "bg-amber-50";
                    borderAccent = "ring-1 ring-amber-400";
                  } else if (libNames) {
                    bgClass = "bg-red-50";
                  }
                }
                const isToday = cell.date === todayStr;
                const dayColor =
                  !cell.inMonth ? "text-gray-400" :
                  dow === 0 ? "text-red-500" :
                  dow === 6 ? "text-blue-500" :
                  "text-gray-800";

                const handleClick = async () => {
                  if (!cell.inMonth) return;
                  if (override) {
                    if (confirm(`${cell.date} "${override.name}" override를 삭제하시겠습니까?`)) {
                      try { await deleteHoliday(override.id); await fetchData(); }
                      catch (err: any) { alert(err?.message || "삭제 실패"); }
                    }
                    return;
                  }
                  if (libNames) {
                    if (confirm(`${cell.date} "${libNames.join(', ')}" 을(를) 영업일로 지정하시겠습니까?`)) {
                      try {
                        await createHoliday({ date: cell.date, name: libNames.join(', '), type: "EXCLUDE", description: "라이브러리 공휴일 예외 영업" });
                        await fetchData();
                      } catch (err: any) { alert(err?.message || "등록 실패"); }
                    }
                    return;
                  }
                  const name = window.prompt(`${cell.date} 회사 휴무로 추가합니다. 이름을 입력해주세요.`, "회사 휴무");
                  if (!name || !name.trim()) return;
                  try {
                    await createHoliday({ date: cell.date, name: name.trim(), type: "CUSTOM" });
                    await fetchData();
                  } catch (err: any) { alert(err?.message || "등록 실패"); }
                };

                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={handleClick}
                    disabled={!cell.inMonth}
                    className={`relative text-left p-2 min-h-[78px] transition-colors ${bgClass} ${borderAccent} ${cell.inMonth ? "hover:bg-opacity-80 cursor-pointer" : "cursor-default"}`}
                  >
                    <div className={`flex items-center justify-between`}>
                      <span className={`text-xs font-semibold ${dayColor} ${isToday ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white" : ""}`}>
                        {d.getDate()}
                      </span>
                      {cell.inMonth && effectiveHoliday && (
                        <span className="text-[9px] font-bold text-red-500">휴</span>
                      )}
                    </div>
                    {cell.inMonth && libNames && (
                      <div className="mt-1 text-[10px] text-red-600 truncate" title={libNames.join(', ')}>
                        {libNames.join(', ')}
                      </div>
                    )}
                    {cell.inMonth && override && (
                      <div className={`mt-0.5 text-[10px] truncate ${override.type === "CUSTOM" ? "text-amber-700" : "text-gray-500"}`} title={override.name}>
                        {override.type === "CUSTOM" ? "+ " : "× "}{override.name}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              날짜 클릭 — 빈 날짜: 회사 휴무 추가 · 라이브러리 공휴일: 영업일 지정 · override: 삭제
            </p>
          </div>
        );
      })()}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">{year}년 공휴일 목록</h3>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="input-field w-auto">
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-3">{error}</div>
        )}

        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : merged.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">{year}년 공휴일 데이터가 없습니다.</div>
        ) : (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">날짜</th>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-center">상태</th>
                  <th className="px-3 py-2 text-left">설명</th>
                  <th className="px-3 py-2 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {merged.map((row) => {
                  const dt = new Date(row.date + "T00:00:00+09:00");
                  const dow = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
                  const override = row.override;
                  const isEffectivelyHoliday =
                    override?.type === "EXCLUDE" ? false : true;
                  return (
                    <tr key={row.date} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.date} ({dow})
                      </td>
                      <td className="px-3 py-2">{row.names.join(", ")}</td>
                      <td className="px-3 py-2 text-center">
                        {override ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_LABEL[override.type].cls}`}>
                            {TYPE_LABEL[override.type].label}
                          </span>
                        ) : row.source === "library" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">기본</span>
                        ) : null}
                        <div className={`mt-1 text-[10px] font-bold ${isEffectivelyHoliday ? "text-red-600" : "text-gray-400"}`}>
                          {isEffectivelyHoliday ? "휴일 처리됨" : "영업일 처리됨"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {override?.description || ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {override ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(override)}
                            className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                          >
                            override 삭제
                          </button>
                        ) : row.source === "library" ? (
                          <button
                            type="button"
                            onClick={() => handleExcludeLibraryDate(row.date, row.names)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          >
                            영업일로 지정
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
