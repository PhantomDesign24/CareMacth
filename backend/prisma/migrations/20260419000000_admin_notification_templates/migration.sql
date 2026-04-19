-- 관리자 전용 추가 템플릿 (가입 승인 대기, 서류 검증, 자동 정지 모니터링)
INSERT INTO "NotificationTemplate" (id, key, name, type, title, body, description, enabled, "isSystem", "createdAt", "updatedAt") VALUES
-- 간병인 가입 승인 대기
(gen_random_uuid()::text, 'CAREGIVER_SIGNUP_PENDING_ADMIN', '간병인 가입 신청 (관리자)', 'SYSTEM', '간병인 가입 신청', '{{caregiverName}}님이 간병인 가입을 신청했습니다. 서류 검증 후 승인해주세요.', '간병인 회원가입 시 관리자에게', true, true, NOW(), NOW()),

-- 서류 업로드 검증 요청
(gen_random_uuid()::text, 'CERTIFICATE_UPLOADED_ADMIN', '자격증 업로드 (관리자)', 'SYSTEM', '자격증 검증 요청', '{{caregiverName}}님이 자격증({{certName}})을 등록했습니다. 검증해주세요.', '자격증 업로드 시 관리자에게', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'ID_CARD_UPLOADED_ADMIN', '신분증 업로드 (관리자)', 'SYSTEM', '신분증 본인 인증 요청', '{{caregiverName}}님이 신분증을 등록했습니다. 본인 인증 확인해주세요.', '신분증 업로드 시 관리자에게', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'CRIMINAL_CHECK_UPLOADED_ADMIN', '범죄이력 조회서 업로드 (관리자)', 'SYSTEM', '범죄이력 조회서 검증 요청', '{{caregiverName}}님이 범죄이력 조회서를 등록했습니다. 검증해주세요.', '범죄이력 업로드 시 관리자에게', true, true, NOW(), NOW()),

-- 자동 정지/만료 모니터링
(gen_random_uuid()::text, 'CAREGIVER_AUTO_SUSPENDED_ADMIN', '간병인 자동 정지 (관리자)', 'SYSTEM', '간병인 자동 활동 정지', '{{caregiverName}}({{phone}}) 간병인이 {{reason}}으로 자동 정지되었습니다.', '패널티/노쇼 누적으로 자동 정지 시', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'PAYMENT_AUTO_EXPIRED_ADMIN', '결제 자동 만료 (관리자)', 'SYSTEM', '결제 자동 만료', '{{guardianName}}님의 {{amount}}원 결제가 5분 초과로 자동 만료되었습니다.', 'PENDING 결제 5분 초과 cron 처리 시', true, true, NOW(), NOW())

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  "isSystem" = EXCLUDED."isSystem",
  "updatedAt" = NOW();
