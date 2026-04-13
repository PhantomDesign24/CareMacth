"use client";

import { clsx } from "clsx";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ReactNode;
  color?: "blue" | "green" | "red" | "amber" | "purple" | "indigo";
}

const colorMap = {
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-100 text-blue-600",
    delta: "text-blue-600",
  },
  green: {
    bg: "bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-600",
    delta: "text-emerald-600",
  },
  red: {
    bg: "bg-red-50",
    icon: "bg-red-100 text-red-600",
    delta: "text-red-600",
  },
  amber: {
    bg: "bg-amber-50",
    icon: "bg-amber-100 text-amber-600",
    delta: "text-amber-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-100 text-purple-600",
    delta: "text-purple-600",
  },
  indigo: {
    bg: "bg-indigo-50",
    icon: "bg-indigo-100 text-indigo-600",
    delta: "text-indigo-600",
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  delta,
  deltaLabel,
  icon,
  color = "blue",
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div className="card flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        {(delta !== undefined || subtitle) && (
          <div className="mt-2 flex items-center gap-1.5">
            {delta !== undefined && (
              <span
                className={clsx(
                  "flex items-center text-xs font-semibold",
                  delta >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                {delta >= 0 ? (
                  <svg className="mr-0.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                ) : (
                  <svg className="mr-0.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                  </svg>
                )}
                {delta > 0 ? "+" : ""}
                {delta}%
              </span>
            )}
            {(deltaLabel || subtitle) && (
              <span className="text-xs text-gray-400">{deltaLabel || subtitle}</span>
            )}
          </div>
        )}
      </div>
      {icon && (
        <div className={clsx("flex h-11 w-11 items-center justify-center rounded-xl", colors.icon)}>
          {icon}
        </div>
      )}
    </div>
  );
}
