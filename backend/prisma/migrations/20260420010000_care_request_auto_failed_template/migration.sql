-- 주말/공휴일 1시간 경과 자동 매칭 실패 알림 템플릿
INSERT INTO "NotificationTemplate" (id, key, name, type, title, body, description, enabled, "isSystem", "createdAt", "updatedAt") VALUES
(gen_random_uuid()::text, 'CARE_REQUEST_AUTO_FAILED', '간병 요청 자동 매칭 실패', 'MATCHING', '매칭 자동 실패', '{{patientName}} 환자의 간병 요청이 1시간 내 매칭되지 않아 자동 실패 처리되었습니다. (주말/공휴일)', '주말/공휴일 1시간 경과 시 보호자에게 자동 발송', true, true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  "isSystem" = EXCLUDED."isSystem",
  "updatedAt" = NOW();
