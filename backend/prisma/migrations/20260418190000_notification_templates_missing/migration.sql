-- 전수조사로 파악한 누락 템플릿 추가 (9종)
INSERT INTO "NotificationTemplate" (id, key, name, type, title, body, description, enabled, "isSystem", "createdAt", "updatedAt") VALUES
-- 간병인 가입/승인
(gen_random_uuid()::text, 'CAREGIVER_APPROVED', '간병인 승인 완료', 'SYSTEM', '간병인 승인 완료', '간병인 승인이 완료되었습니다. 이제 간병 매칭을 받을 수 있습니다.', '관리자 승인 시 간병인', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'CAREGIVER_REJECTED', '간병인 승인 거절', 'SYSTEM', '간병인 승인 거절', '{{reason}}', '관리자 거절 시 간병인', true, true, NOW(), NOW()),

-- 계약 체결 (매칭 확정 후 양쪽)
(gen_random_uuid()::text, 'CONTRACT_SIGNED_CAREGIVER', '계약 체결 (간병인)', 'CONTRACT', '계약이 체결되었습니다', '{{patientName}} 환자의 간병 계약이 체결되었습니다. 시작일: {{startDate}}', '계약 생성 시 간병인', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'CONTRACT_SIGNED_GUARDIAN', '계약 체결 (보호자)', 'CONTRACT', '매칭이 완료되었습니다', '{{caregiverName}} 간병인과 매칭되었습니다. 계약 내용을 확인해주세요.', '계약 생성 시 보호자', true, true, NOW(), NOW()),

-- 계약 복구 (긴급 재매칭 되돌리기)
(gen_random_uuid()::text, 'CONTRACT_RESTORED', '계약 복구', 'CONTRACT', '계약이 복구되었습니다', '{{patientName}} 환자의 계약이 다시 활성화되었습니다.', '긴급 재매칭 되돌리기 시', true, true, NOW(), NOW()),

-- 출퇴근
(gen_random_uuid()::text, 'CHECK_IN', '간병인 출근', 'CARE_RECORD', '간병인 출근', '{{caregiverName}} 간병인이 {{time}}에 출근하였습니다.', '간병인 출근 체크 시 보호자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'CHECK_OUT', '간병인 퇴근', 'CARE_RECORD', '간병인 퇴근', '{{caregiverName}} 간병인이 {{time}}에 퇴근하였습니다. 총 근무시간: {{hours}}시간', '간병인 퇴근 체크 시 보호자', true, true, NOW(), NOW()),

-- 리뷰
(gen_random_uuid()::text, 'REVIEW_CREATED', '새 리뷰 등록', 'APPLICATION', '새로운 리뷰가 등록되었습니다', '{{guardianName}}님이 별점 {{rating}}점 리뷰를 남겼습니다.', '리뷰 작성 시 간병인', true, true, NOW(), NOW()),

-- 계약 취소 (보호자 수동 취소 전용 - 기존 CONTRACT_CANCELLED_BY_* 와 다름)
(gen_random_uuid()::text, 'CONTRACT_DISSOLVED', '계약 해제 안내', 'CONTRACT', '계약 해제 안내', '{{patientName}} 환자의 간병 계약이 해제되었습니다. {{reason}}', '양방향 계약 해제 공통', true, true, NOW(), NOW())

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  "isSystem" = EXCLUDED."isSystem",
  "updatedAt" = NOW();
