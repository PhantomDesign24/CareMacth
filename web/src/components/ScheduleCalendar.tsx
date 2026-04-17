"use client";

import React, { useState, useMemo } from "react";

interface ContractLike {
  id: string;
  patientName: string;
  startDate: string;
  endDate: string;
  contractStatus: string;
}

interface Props {
  contracts: ContractLike[];
}

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function parseDate(s: string): Date | null {
  if (!s) return null;
  const parts = s.split(/[.\-\/\s]/).filter(Boolean);
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ScheduleCalendar({ contracts }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // 월의 첫 날 / 마지막 날
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const totalDays = lastDay.getDate();

  // 날짜별 진행 중인 계약 매핑
  const eventsByDate = useMemo(() => {
    const map: Record<string, ContractLike[]> = {};
    contracts.forEach((c) => {
      const start = parseDate(c.startDate);
      const end = parseDate(c.endDate);
      if (!start || !end) return;
      const cur = new Date(start);
      while (cur <= end) {
        const key = ymd(cur);
        if (!map[key]) map[key] = [];
        map[key].push(c);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [contracts]);

  // 달력 셀 생성
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = ymd(new Date());

  return (
    <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="px-2 py-1 text-sm border border-gray-200 rounded hover:bg-white"
        >
          ◀
        </button>
        <h4 className="text-sm font-bold text-gray-900">
          {year}년 {month + 1}월
        </h4>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="px-2 py-1 text-sm border border-gray-200 rounded hover:bg-white"
        >
          ▶
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {DAYS_OF_WEEK.map((d, i) => (
          <div
            key={d}
            className={`text-center font-semibold py-1 ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
            }`}
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;
          const key = ymd(d);
          const events = eventsByDate[key] || [];
          const isToday = key === today;
          const weekday = d.getDay();
          return (
            <div
              key={i}
              className={`aspect-square border rounded p-1 text-xs relative ${
                isToday ? "border-primary-500 bg-primary-50" : "border-gray-200 bg-white"
              }`}
            >
              <div
                className={`text-right ${
                  weekday === 0 ? "text-red-500" : weekday === 6 ? "text-blue-500" : "text-gray-700"
                }`}
              >
                {d.getDate()}
              </div>
              {events.length > 0 && (
                <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                  {events.slice(0, 2).map((e, j) => (
                    <div
                      key={j}
                      className="bg-orange-500 text-white rounded text-[10px] px-1 py-0.5 truncate"
                      title={e.patientName}
                    >
                      {e.patientName}
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-[10px] text-gray-500">+{events.length - 2}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
