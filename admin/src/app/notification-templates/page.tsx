"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getNotificationTemplates,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  NotificationTemplate,
} from "@/lib/api";
import { NOTIFICATION_TYPES } from "@/lib/constants";

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    body: string;
    enabled: boolean;
    channels: string[];
    targetRoles: string[];
    alimtalkTemplateCode: string;
    alimtalkButtonsJson: string;
  }>({
    title: "",
    body: "",
    enabled: true,
    channels: [],
    targetRoles: [],
    alimtalkTemplateCode: "",
    alimtalkButtonsJson: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationTemplates();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const openEdit = (t: NotificationTemplate) => {
    setEditing(t);
    setEditForm({
      title: t.title,
      body: t.body,
      enabled: t.enabled,
      channels: t.channels || [],
      targetRoles: t.targetRoles || [],
      alimtalkTemplateCode: t.alimtalkTemplateCode || "",
      alimtalkButtonsJson: t.alimtalkButtonsJson || "",
    });
  };

  const toggleChannel = (channel: string) => {
    setEditForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };
  const toggleRole = (role: string) => {
    setEditForm((prev) => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter((r) => r !== role)
        : [...prev.targetRoles, role],
    }));
  };

  const ROLE_LABELS: Record<string, string> = { GUARDIAN: '보호자', CAREGIVER: '간병인', ADMIN: '관리자', HOSPITAL: '병원' };
  const CHANNEL_LABELS: Record<string, string> = { PUSH: '푸시', ALIMTALK: '알림톡', EMAIL: '이메일' };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateNotificationTemplate(editing.id, editForm);
      setToast("템플릿 저장 완료");
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
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, enabled: !t.enabled } : x));
      setToast(t.enabled ? "비활성화됨" : "활성화됨");
    } catch {
      alert("상태 변경 실패");
    }
  };

  const handleDelete = async (t: NotificationTemplate) => {
    if (!confirm(`"${t.name}" 템플릿을 삭제하시겠습니까?`)) return;
    try {
      await deleteNotificationTemplate(t.id);
      setToast("삭제됨");
      await load();
    } catch (e: any) {
      alert(e?.message || "삭제 실패");
    }
  };

  const filtered = useMemo(() => {
    if (!filterType) return templates;
    return templates.filter((t) => t.type === filterType);
  }, [templates, filterType]);

  const typeLabel = (type: string) => NOTIFICATION_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">알림 템플릿 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          사용자에게 발송되는 시스템 알림 문구를 편집합니다. 변수는 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{"{{name}}"}</code> 형태로 사용됩니다. 예: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{"{{patientName}}"}</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{"{{amount}}"}</code>
        </p>
      </div>

      {/* 타입 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterType("")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            filterType === "" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
          }`}
        >
          전체 ({templates.length})
        </button>
        {NOTIFICATION_TYPES.map((t) => {
          const count = templates.filter((x) => x.type === t.value).length;
          if (count === 0) return null;
          return (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filterType === t.value ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* 템플릿 목록 */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">템플릿이 없습니다.</div>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className={`bg-white border rounded-xl p-4 ${t.enabled ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">{typeLabel(t.type)}</span>
                    {t.isSystem && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">시스템</span>
                    )}
                    {/* 채널 뱃지 */}
                    {(t.channels || []).map((c) => (
                      <span key={c} className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        c === 'PUSH' ? 'bg-orange-50 text-orange-700' :
                        c === 'ALIMTALK' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-purple-50 text-purple-700'
                      }`}>
                        {c === 'PUSH' ? '🔔 푸시' : c === 'ALIMTALK' ? '💬 알림톡' : '📧 이메일'}
                      </span>
                    ))}
                    {(!t.channels || t.channels.length === 0) && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-xs">채널 없음</span>
                    )}
                    {/* 대상 역할 뱃지 + 양측발송 표시 */}
                    {(t.targetRoles || []).map((r) => (
                      <span key={r} className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                        👤 {ROLE_LABELS[r] || r}
                      </span>
                    ))}
                    {(t.targetRoles?.length || 0) >= 2 && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        ⚠ 양측발송
                      </span>
                    )}
                    {t.alimtalkTemplateCode && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-mono">
                        TPL: {t.alimtalkTemplateCode}
                      </span>
                    )}
                    <code className="text-xs text-gray-400">{t.key}</code>
                  </div>
                  {t.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleEnabled(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      t.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.enabled ? "활성" : "비활성"}
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                  >
                    편집
                  </button>
                  {!t.isSystem && (
                    <button
                      onClick={() => handleDelete(t)}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                <div className="font-medium mb-1">{t.title}</div>
                <div className="text-gray-600 whitespace-pre-wrap text-xs">{t.body}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 편집 모달 */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editing.name} 편집</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* 사용 가능 변수 + 미리보기 */}
            {(() => {
              // title+body에서 {{var}} 추출
              const extractVars = (s: string) => {
                const matches = s.match(/\{\{(\w+)\}\}/g) || [];
                return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ""))));
              };
              const vars = Array.from(new Set([
                ...extractVars(editForm.title),
                ...extractVars(editForm.body),
              ]));
              // 변수 사전 — 샘플값 + 설명
              const VAR_DICT: Record<string, { sample: string; desc: string }> = {
                // 사람 이름
                patientName: { sample: "홍길동", desc: "환자 이름" },
                caregiverName: { sample: "김간병", desc: "간병인 이름" },
                guardianName: { sample: "이보호", desc: "보호자 이름" },
                reporterName: { sample: "박신고", desc: "신고한 사용자 이름" },
                // 금액
                amount: { sample: "500,000", desc: "금액 (원, 천단위 콤마 포함)" },
                refundAmount: { sample: "450,000", desc: "환불 금액 (원)" },
                netAmount: { sample: "4,000,000", desc: "실수령액 (수수료/세금 차감 후)" },
                netEarning: { sample: "3,500,000", desc: "정산 예정 금액 (간병인 지급)" },
                total: { sample: "1,200,000", desc: "총액 합계" },
                newRate: { sample: "150,000", desc: "인상된 새 일당 (원)" },
                // 사유
                reason: { sample: "추가 간병 필요", desc: "요청/처리/거절의 사유 (사용자 입력)" },
                reasonText: { sample: "서류 미비", desc: "관리자가 작성한 처리 사유" },
                reasonSuffix: { sample: " 사유: 추가 간병 필요", desc: "사유 접미사 (있을 때만 '사유: ~' 형태)" },
                resolution: { sample: "관리자 조정", desc: "분쟁 처리 결과 내용" },
                // 서류/분쟁
                documentType: { sample: "간병확인서", desc: "보험서류 종류" },
                insuranceCompany: { sample: "삼성생명", desc: "보험사 이름" },
                docLabel: { sample: "보험청구용 간병확인서", desc: "서류 표시 레이블" },
                targetType: { sample: "리뷰", desc: "신고 대상 종류 (리뷰/사용자/메시지 등)" },
                category: { sample: "간병 불성실", desc: "분쟁 카테고리" },
                statusLabel: { sample: "해결 완료", desc: "분쟁/요청 상태 한글 라벨" },
                // 일수/카운트
                additionalDays: { sample: "7", desc: "연장 요청 추가 일수" },
                billDays: { sample: "10", desc: "중간정산 청구 일수" },
                usedDays: { sample: "5", desc: "계약 중 실제 사용한 일수" },
                count: { sample: "3", desc: "건수 (알림·항목 등)" },
                daysLeft: { sample: "3", desc: "남은 일수" },
                rating: { sample: "5", desc: "리뷰 별점 (1-5)" },
                // 기타
                address: { sample: "서울 강남구 테헤란로", desc: "공고 주소" },
                scheduleType: { sample: "24시간", desc: "간병 일정 타입 (24시간/시간제)" },
                regions: { sample: "서울, 경기", desc: "확대된 지역 목록" },
                penaltyType: { sample: "취소", desc: "패널티 유형 (취소/노쇼/민원/수동)" },
                startDate: { sample: "2026. 04. 25.", desc: "간병 시작일" },
                time: { sample: "09:00", desc: "출퇴근 시각" },
                hours: { sample: "8", desc: "근무 시간(시간)" },
              };
              const renderPreview = (s: string) =>
                s.replace(/\{\{(\w+)\}\}/g, (_, v) => VAR_DICT[v]?.sample || `[${v}]`);
              const previewTitle = renderPreview(editForm.title);
              const previewBody = renderPreview(editForm.body);
              return (
                <div className="mb-4 space-y-3">
                  {vars.length > 0 && (
                    <div className="rounded-lg p-3 bg-blue-50 border border-blue-100">
                      <div className="text-xs font-semibold text-blue-700 mb-2">📝 사용 가능 변수</div>
                      <div className="space-y-1">
                        {vars.map((v) => {
                          const info = VAR_DICT[v];
                          return (
                            <div key={v} className="flex items-start gap-2 text-[11px]">
                              <code className="shrink-0 px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-700 font-mono">
                                {"{{"}{v}{"}}"}
                              </code>
                              {info ? (
                                <div className="flex-1 min-w-0">
                                  <span className="text-gray-700">{info.desc}</span>
                                  <span className="text-gray-400 ml-2">예: {info.sample}</span>
                                </div>
                              ) : (
                                <span className="text-red-500 italic">등록되지 않은 변수 — 코드 확인 필요</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-blue-600 mt-2">
                        변수는 코드에서 자동 치환됩니다. 새 변수를 쓰려면 개발자에게 문의.
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg p-3 bg-amber-50 border border-amber-100">
                    <div className="text-xs font-semibold text-amber-700 mb-2">👁 실시간 미리보기 (샘플 값으로 치환)</div>
                    <div className="bg-white rounded-md p-2 border border-amber-100">
                      <div className="text-sm font-semibold text-gray-900">{previewTitle}</div>
                      <div className="text-xs text-gray-700 whitespace-pre-wrap mt-1">{previewBody}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">제목</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">본문</label>
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  maxLength={2000}
                />
                {editing.description && (
                  <p className="text-xs text-gray-500 mt-1">💡 {editing.description}</p>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm text-gray-700">활성화</span>
              </label>

              {/* 발송 채널 */}
              <div className="border-t border-gray-200 pt-3">
                <label className="block text-sm font-medium mb-2 text-gray-700">발송 채널</label>
                <div className="flex flex-wrap gap-2">
                  {(['PUSH', 'ALIMTALK', 'EMAIL'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleChannel(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        editForm.channels.includes(c)
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300'
                      }`}
                    >
                      {c === 'PUSH' ? '🔔 푸시' : c === 'ALIMTALK' ? '💬 알림톡' : '📧 이메일'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">선택된 모든 채널로 발송. 비워두면 발송 안 됨.</p>
              </div>

              {/* 대상 역할 */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  발송 대상
                  {editForm.targetRoles.length >= 2 && (
                    <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">⚠ 양측발송</span>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['GUARDIAN', 'CAREGIVER', 'ADMIN', 'HOSPITAL'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        editForm.targetRoles.includes(r)
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      👤 {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">2개 이상 선택 시 동일 알림이 양측에 발송됨.</p>
              </div>

              {/* 알림톡 전용 */}
              {editForm.channels.includes('ALIMTALK') && (
                <div className="border-t border-gray-200 pt-3 space-y-3 bg-yellow-50/30 -mx-1 px-3 pb-3 rounded-lg">
                  <div className="text-xs font-semibold text-yellow-800">💬 알림톡 설정</div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">템플릿 코드 (TPL_CODE)</label>
                    <input
                      type="text"
                      value={editForm.alimtalkTemplateCode}
                      onChange={(e) => setEditForm({ ...editForm, alimtalkTemplateCode: e.target.value })}
                      placeholder="예: TT_xxxxx (카카오 검수 통과 후 발급)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">알리고에서 카카오 승인 후 발급된 템플릿 코드. 비어 있으면 알림톡 미발송.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">버튼 JSON (선택)</label>
                    <textarea
                      value={editForm.alimtalkButtonsJson}
                      onChange={(e) => setEditForm({ ...editForm, alimtalkButtonsJson: e.target.value })}
                      rows={4}
                      placeholder={`예:\n[\n  {"name":"전화 상담","linkType":"WL","linkMo":"tel:1588-0000","linkPc":"tel:1588-0000"},\n  {"name":"매칭 취소","linkType":"WL","linkMo":"https://cm.phantomdesign.kr/...","linkPc":"https://..."}\n]`}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono resize-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">최대 5개. linkType: WL(웹링크)/AL(앱링크)/AC(채널추가)/BC(상담톡전환). tel: 도 WL 로.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
