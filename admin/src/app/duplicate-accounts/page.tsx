"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getDuplicateAccounts, adminAddUserRole, DuplicateGroup } from "@/lib/api";
import { formatPhone } from "@/lib/constants";

const ROLE_LABEL: Record<string, string> = { GUARDIAN: "보호자", CAREGIVER: "간병인", HOSPITAL: "병원" };
const PROVIDER_LABEL: Record<string, string> = { LOCAL: "이메일", KAKAO: "카카오", NAVER: "네이버", APPLE: "애플" };

const fmt = (s: string) => new Date(s).toLocaleDateString("ko-KR");

export default function DuplicateAccountsPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getDuplicateAccounts();
      setGroups(res?.groups || []);
    } catch (e: any) {
      alert(e?.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 중복가입 승인 = 기존 계정에 역할 추가 (새 계정 생성 대신)
  const addRole = async (userId: string, role: "GUARDIAN" | "CAREGIVER", name: string) => {
    const label = role === "CAREGIVER" ? "간병인" : "보호자";
    if (!confirm(`${name} 님의 계정에 ${label} 역할을 추가할까요?\n\n· 같은 아이디로 두 역할을 모두 이용하게 됩니다\n· 새 계정을 만들지 않으므로 연락처 중복 문제가 없습니다${role === "CAREGIVER" ? "\n· 간병인은 승인 상태로 생성됩니다(관리자 확인 전제)" : ""}`)) return;
    setBusyUser(userId);
    try {
      await adminAddUserRole(userId, role);
      await load();
      alert(`${label} 역할이 추가되었습니다.`);
    } catch (e: any) {
      alert(e?.message || "역할 추가 실패");
    } finally {
      setBusyUser("");
    }
  };

  const detailHref = (a: DuplicateGroup["accounts"][number]) =>
    a.caregiverId ? `/caregivers/${a.caregiverId}` : a.guardianId ? `/guardians` : "#";

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">중복 가입 의심 · 역할 추가</h1>
          <p className="text-sm text-gray-500 mt-1">
            같은 이름으로 2개 이상 가입된 계정입니다. 연락처·가입경로를 확인해 중복이면 회원 상세에서 삭제하세요.
            <br className="hidden sm:block" />(정확 전화번호 중복은 가입 시 자동 차단되며, 소셜 가입 등으로 우회된 중복을 여기서 관리합니다.)
          </p>
          <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
            <b>중복 가입 문의가 오면</b> — 같은 분이 보호자와 간병인을 함께 이용하려는 경우입니다. 연락처·이메일은 중복 가입이 불가하므로
            새 계정을 만들지 말고, 아래 <b>&quot;역할 추가&quot;</b> 버튼으로 기존 계정에 역할을 더해주세요. (같은 아이디로 두 역할 모두 이용)
          </div>
        </div>
        <button onClick={load} className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">새로고침</button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">불러오는 중...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-gray-400">
          중복 의심 계정이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.name} className="rounded-xl border border-amber-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between bg-amber-50 px-4 py-2.5">
                <span className="font-semibold text-gray-900">{g.name}</span>
                <span className="text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-2.5 py-0.5">{g.count}건</span>
              </div>
              <div className="divide-y divide-gray-100">
                {g.accounts.map((a) => (
                  <div key={a.userId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <span className="inline-block w-14 shrink-0 rounded bg-gray-100 px-2 py-0.5 text-center text-xs font-medium text-gray-600">
                      {ROLE_LABEL[a.role] || a.role}
                    </span>
                    <span className="text-gray-700">{formatPhone(a.phone).startsWith("DELETED") ? "—" : formatPhone(a.phone) || "—"}</span>
                    <span className="text-gray-500">{a.email}</span>
                    <span className="text-xs text-gray-400">{PROVIDER_LABEL[a.authProvider] || a.authProvider}</span>
                    <span className="text-xs text-gray-400">가입 {fmt(a.createdAt)}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {/* 역할 추가 — 없는 역할만 노출 */}
                      {!a.caregiverId && (
                        <button
                          type="button"
                          onClick={() => addRole(a.userId, "CAREGIVER", g.name)}
                          disabled={busyUser === a.userId}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          + 간병인 역할
                        </button>
                      )}
                      {!a.guardianId && (
                        <button
                          type="button"
                          onClick={() => addRole(a.userId, "GUARDIAN", g.name)}
                          disabled={busyUser === a.userId}
                          className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                        >
                          + 보호자 역할
                        </button>
                      )}
                      {detailHref(a) !== "#" && (
                        <Link href={detailHref(a)} className="text-xs text-orange-600 hover:underline">
                          회원 관리 →
                        </Link>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
