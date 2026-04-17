"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const totalDays = lastDay.getDate();

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

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = ymd(new Date());

  const handleCellClick = (date: Date, events: ContractLike[]) => {
    if (events.length === 0) return;
    // 하나면 바로 이동, 여러 개면 첫 번째 (나중에 선택 모달 가능)
    const contract = events[0];
    router.push(`/dashboard/caregiver/journal/${contract.id}?date=${ymd(date)}`);
  };

  return (
    <div className="px-3 sm:px-4 py-3 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:bg-white"
        >
          ◀
        </button>
        <h4 className="text-sm font-bold text-gray-900">
          {year}. {String(month + 1).padStart(2, "0")}
        </h4>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:bg-white"
        >
          ▶
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px]">
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
          if (!d) return <div key={i} className="h-12" />;
          const key = ymd(d);
          const events = eventsByDate[key] || [];
          const isToday = key === today;
          const weekday = d.getDay();
          const hasEvent = events.length > 0;
          return (
            <div
              key={i}
              onClick={() => handleCellClick(d, events)}
              className={`h-12 border rounded px-1 py-0.5 relative overflow-hidden ${
                isToday ? "border-primary-500 bg-primary-50" : "border-gray-200 bg-white"
              } ${hasEvent ? "cursor-pointer hover:bg-orange-50" : ""}`}
            >
              <div
                className={`text-[10px] leading-none text-right ${
                  weekday === 0 ? "text-red-500" : weekday === 6 ? "text-blue-500" : "text-gray-700"
                }`}
              >
                {d.getDate()}
              </div>
              {hasEvent && (
                <div className="mt-0.5 space-y-0.5">
                  {events.slice(0, 1).map((e, j) => (
                    <div
                      key={j}
                      className="bg-orange-500 text-white rounded-sm text-[9px] px-1 py-0.5 truncate leading-tight"
                      title={e.patientName}
                    >
                      {e.patientName}
                    </div>
                  ))}
                  {events.length > 1 && (
                    <div className="text-[9px] text-orange-600 font-bold">
                      +{events.length - 1}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {Object.keys(eventsByDate).length > 0 && (
        <p className="text-[10px] text-gray-400 mt-2">※ 날짜 클릭 시 해당 일자의 간병일지로 이동합니다.</p>
      )}
    </div>
  );
}
