"use client";

import { useCallback, useEffect, useState } from "react";
import StatsCard from "@/components/StatsCard";
import {
  getNotificationTemplates,
  updateNotificationTemplate,
  createNotificationTemplate,
  getAlimtalkTemplateStats,
  NotificationTemplate,
  AlimtalkTemplateStat,
} from "@/lib/api";

const ROLE_LABEL: Record<string, string> = { GUARDIAN: '보호자', CAREGIVER: '간병인', ADMIN: '관리자', HOSPITAL: '병원' };

export default function AlimtalkTemplatesPage() {
  const [all, setAll] = useState<NotificationTemplate[]>([]);
  const [stats, setStats] = useState<Record<string, AlimtalkTemplateStat>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"alimtalk" | "candidate" | "all">("alimtalk");

  // 인라인 편집
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editButtons, setEditButtons] = useState("");
  const [saving, setSaving] = useState(false);

  // 신규 등록 모달
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({
    key: "",
    name: "",
    title: "",
    body: "",
    description: "",
    type: "SYSTEM",
    targetRoles: [] as string[],
    alimtalkTemplateCode: "",
    alimtalkButtonsJson: "",
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, statsRes] = await Promise.allSettled([
        getNotificationTemplates(),
        getAlimtalkTemplateStats(),
      ]);
      if (tpls.status === "fulfilled") setAll(tpls.value);
      if (statsRes.status === "fulfilled") {
        const map: Record<string, AlimtalkTemplateStat> = {};
        for (const s of statsRes.value?.stats || []) map[s.templateKey] = s;
        setStats(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (() => {
    if (filter === "alimtalk") return all.filter((t) => (t.channels || []).includes("ALIMTALK"));
    if (filter === "candidate") return all.filter((t) => !(t.channels || []).includes("ALIMTALK"));
    return all;
  })();

  const summary = {
    total: all.filter((t) => (t.channels || []).includes("ALIMTALK")).length,
    withCode: all.filter((t) => (t.channels || []).includes("ALIMTALK") && !!t.alimtalkTemplateCode).length,
    enabled: all.filter((t) => (t.channels || []).includes("ALIMTALK") && t.enabled).length,
  };

  const openEdit = (t: NotificationTemplate) => {
    setEditing(t);
    setEditCode(t.alimtalkTemplateCode || "");
    setEditButtons(t.alimtalkButtonsJson || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editButtons.trim()) {
      try {
        JSON.parse(editButtons);
      } catch {
        alert("버튼 JSON 형식이 올바르지 않습니다.");
        return;
      }
    }
    setSaving(true);
    try {
      await updateNotificationTemplate(editing.id, {
        alimtalkTemplateCode: editCode.trim() || null,
        alimtalkButtonsJson: editButtons.trim() || null,
        // ALIMTALK 채널이 없으면 자동 활성화
        channels: (editing.channels || []).includes("ALIMTALK")
          ? editing.channels
          : ([...(editing.channels || []), "ALIMTALK"] as any),
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (t: NotificationTemplate) => {
    try {
      await updateNotificationTemplate(t.id, { enabled: !t.enabled });
      setAll((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled: !t.enabled } : x)));
    } catch {
      alert("상태 변경 실패");
    }
  };

  const toggleNewRole = (role: string) => {
    setNewForm((prev) => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter((r) => r !== role)
        : [...prev.targetRoles, role],
    }));
  };

  const submitCreate = async () => {
    const keyTrim = newForm.key.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]*$/.test(keyTrim)) {
      alert("키는 영문 대문자/숫자/_ 만 사용 가능합니다. 예: CUSTOM_ANNOUNCE_2026");
      return;
    }
    if (!newForm.title.trim() || !newForm.body.trim()) {
      alert("제목과 본문을 입력해주세요.");
      return;
    }
    if (newForm.alimtalkButtonsJson.trim()) {
      try { JSON.parse(newForm.alimtalkButtonsJson); }
      catch { alert("버튼 JSON 형식이 올바르지 않습니다."); return; }
    }
    setCreating(true);
    try {
      await createNotificationTemplate({
        key: keyTrim,
        name: newForm.name.trim() || newForm.title.trim(),
        title: newForm.title.trim(),
        body: newForm.body.trim(),
        description: newForm.description.trim() || undefined,
        type: newForm.type,
        channels: ["ALIMTALK"],
        targetRoles: newForm.targetRoles,
        alimtalkTemplateCode: newForm.alimtalkTemplateCode.trim() || null,
        alimtalkButtonsJson: newForm.alimtalkButtonsJson.trim() || null,
      } as any);
      setShowCreate(false);
      setNewForm({
        key: "",
        name: "",
        title: "",
        body: "",
        description: "",
        type: "SYSTEM",
        targetRoles: [],
        alimtalkTemplateCode: "",
        alimtalkButtonsJson: "",
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "생성 실패");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">알림톡 템플릿 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            알리고에 등록된 카카오 알림톡 템플릿 코드 매핑·버튼 설정·발송 통계를 한눈에 관리합니다.
            본문/제목 편집은 <a className="text-primary-600 underline" href="/admin/notification-templates">알림 템플릿</a> 페이지에서 합니다.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary self-start whitespace-nowrap">
          + 신규 알림톡 등록
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatsCard title="알림톡 활성 템플릿" value={`${summary.total}개`} color="blue" />
        <StatsCard title="TPL_CODE 등록 완료" value={`${summary.withCode}/${summary.total}`} color="green" />
        <StatsCard title="발송 활성" value={`${summary.enabled}/${summary.total}`} color="purple" />
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { v: "alimtalk", label: "알림톡 활성" },
            { v: "candidate", label: "후보 (미연결)" },
            { v: "all", label: "전체" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filter === f.v ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button onClick={load} className="ml-auto btn-secondary btn-sm">새로고침</button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            {filter === "alimtalk" ? "아직 알림톡으로 등록된 템플릿이 없습니다." : "표시할 템플릿이 없습니다."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">템플릿</th>
                  <th className="px-3 py-2 text-left">대상</th>
                  <th className="px-3 py-2 text-left">TPL_CODE</th>
                  <th className="px-3 py-2 text-left">버튼</th>
                  <th className="px-3 py-2 text-center">최근 30일</th>
                  <th className="px-3 py-2 text-center">상태</th>
                  <th className="px-3 py-2 text-center">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => {
                  const s = stats[t.key];
                  let buttonCount = 0;
                  try {
                    if (t.alimtalkButtonsJson) {
                      const parsed = JSON.parse(t.alimtalkButtonsJson);
                      const arr = Array.isArray(parsed) ? parsed : parsed?.button;
                      buttonCount = Array.isArray(arr) ? arr.length : 0;
                    }
                  } catch {}
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">{t.title || t.key}</div>
                        <div className="font-mono text-[10px] text-gray-400">{t.key}</div>
                        {t.body && (
                          <div className="text-xs text-gray-500 mt-1 max-w-[300px] truncate" title={t.body}>
                            {t.body}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(t.targetRoles || []).map((r) => (
                            <span key={r} className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                              {ROLE_LABEL[r] || r}
                            </span>
                          ))}
                          {(t.targetRoles || []).length === 0 && (
                            <span className="text-xs text-gray-400">미지정</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {t.alimtalkTemplateCode ? (
                          <code className="text-xs font-mono px-2 py-0.5 rounded bg-yellow-50 text-yellow-700">
                            {t.alimtalkTemplateCode}
                          </code>
                        ) : (
                          <span className="text-xs text-red-600">미등록</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {buttonCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                            {buttonCount}개
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">없음</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {s && s.total > 0 ? (
                          <div>
                            <div className="text-sm font-medium">{s.total}건</div>
                            <div className={`text-xs ${
                              s.successRate >= 95 ? 'text-emerald-600'
                              : s.successRate >= 80 ? 'text-amber-600'
                              : 'text-red-600'
                            }`}>
                              성공률 {s.successRate}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleEnabled(t)}
                          className={`px-2.5 py-1 rounded text-xs font-medium ${
                            t.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {t.enabled ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => openEdit(t)}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          코드/버튼 편집
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 신규 등록 모달 */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">신규 알림톡 템플릿 등록</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                알리고에 검수 통과한 템플릿을 등록하거나, 어드민에서 일괄 발송용 알림톡을 추가합니다.
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mb-4">
              ⚠ <b>주의</b>: 새 키는 코드에서 자동 호출되지 않습니다.
              일괄/수동 발송용으로만 사용되며, 자동 발송이 필요하면 백엔드에 <code className="px-1 bg-amber-100 rounded">sendFromTemplate(KEY)</code> 호출 추가가 필요합니다.
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">키 *</label>
                  <input
                    type="text"
                    value={newForm.key}
                    onChange={(e) => setNewForm({ ...newForm, key: e.target.value })}
                    placeholder="CUSTOM_ANNOUNCE_2026"
                    className="input-field font-mono uppercase"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">대문자/숫자/_ 만 사용</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">표시명 (선택)</label>
                  <input
                    type="text"
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="(미입력 시 제목 사용)"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={newForm.title}
                  onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                  placeholder="알림 제목"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">본문 *</label>
                <textarea
                  value={newForm.body}
                  onChange={(e) => setNewForm({ ...newForm, body: e.target.value })}
                  rows={5}
                  placeholder="안녕하세요 {{name}}님, ..."
                  className="input-field"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">변수는 {"{{name}}"} 형태로 작성</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                <input
                  type="text"
                  value={newForm.description}
                  onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  placeholder="이 템플릿의 사용 시점/목적"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대상 역할</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: "GUARDIAN", label: "보호자" },
                    { v: "CAREGIVER", label: "간병인" },
                    { v: "HOSPITAL", label: "병원" },
                    { v: "ADMIN", label: "관리자" },
                  ].map((r) => (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => toggleNewRole(r.v)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        newForm.targetRoles.includes(r.v)
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">알리고 TPL_CODE (선택)</label>
                <input
                  type="text"
                  value={newForm.alimtalkTemplateCode}
                  onChange={(e) => setNewForm({ ...newForm, alimtalkTemplateCode: e.target.value })}
                  placeholder="TX_2026..."
                  className="input-field font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">알리고 콘솔에서 비즈채널 검수 통과 후 발급된 코드</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">버튼 JSON (선택)</label>
                <textarea
                  value={newForm.alimtalkButtonsJson}
                  onChange={(e) => setNewForm({ ...newForm, alimtalkButtonsJson: e.target.value })}
                  rows={4}
                  placeholder={`[{"name":"바로가기","linkType":"WL","linkMo":"https://..","linkPc":"https://.."}]`}
                  className="input-field font-mono text-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>취소</button>
              <button className="btn-primary" disabled={creating} onClick={submitCreate}>
                {creating ? "생성 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 편집 모달 — TPL_CODE + 버튼 JSON 만 */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing.title || editing.key}</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{editing.key}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">알리고 TPL_CODE</label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="TX_2026..."
                  className="input-field font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">알리고 콘솔에서 카카오 비즈채널 검수 통과 후 발급된 코드</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">버튼 JSON (선택)</label>
                <textarea
                  value={editButtons}
                  onChange={(e) => setEditButtons(e.target.value)}
                  rows={6}
                  placeholder={`예시:\n[{"name":"공고 보기","linkType":"WL","linkMo":"https://cm.phantomdesign.kr/find-work","linkPc":"https://cm.phantomdesign.kr/find-work"}]`}
                  className="input-field font-mono text-xs"
                />
                <p className="text-xs text-gray-400 mt-1">
                  배열 형식. linkType: WL(웹링크) / AL(앱링크) / BC(상담말하기) / AC(채널추가) / BK(배송조회) / MD(메시지전달) / DS(보안인증)
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                ⚠ 본문/제목 편집은 <a className="underline" href="/admin/notification-templates">알림 템플릿</a> 페이지에서 진행하세요.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>취소</button>
              <button className="btn-primary" disabled={saving} onClick={saveEdit}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
