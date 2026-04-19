-- 전체 알림 템플릿 seed + upsert
-- 각 키는 코드에서 sendFromTemplate(userId, 'KEY', vars)로 호출
-- 플레이스홀더: {{variable}} 형식

INSERT INTO "NotificationTemplate" (id, key, name, type, title, body, description, enabled, "isSystem", "createdAt", "updatedAt") VALUES
-- === 매칭/지원 ===
(gen_random_uuid()::text, 'MATCHING_NEW', '새 간병 요청 알림', 'MATCHING', '새로운 간병 요청', '{{address}}에서 {{scheduleType}} 간병인을 찾고 있습니다.', '간병인에게 조건 매칭된 공고 노출 시', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'MATCHING_RATE_RAISED', '공고 금액 인상', 'MATCHING', '간병비 인상 재공고', '{{patientName}} 환자의 일당이 {{newRate}}원으로 인상되어 재공고되었습니다.', '보호자가 금액 올릴 때 간병인에게 재알림', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'MATCHING_REGION_EXPANDED', '지역 확대', 'MATCHING', '지역 확대 공고', '{{patientName}} 환자 간병 공고가 {{regions}} 지역으로 확대되었습니다.', '보호자가 지역 추가 시', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'APPLICATION_ACCEPTED', '지원 수락', 'APPLICATION', '지원이 수락되었습니다', '{{patientName}} 환자의 간병 지원이 수락되었습니다. 계약 내용을 확인해주세요.', '보호자가 간병인 선택 시', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'APPLICATION_REJECTED', '지원 미선택', 'APPLICATION', '지원 결과 안내', '{{patientName}} 환자의 간병 지원이 다른 간병인으로 매칭되었습니다.', '다른 간병인 선택되었을 때', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'APPLICATION_GUARDIAN_NEW', '새 지원자', 'APPLICATION', '새 간병인 지원', '{{patientName}} 공고에 새 간병인이 지원했습니다.', '보호자에게 새 지원 알림', true, true, NOW(), NOW()),

-- === 계약 ===
(gen_random_uuid()::text, 'CONTRACT_CREATED', '계약 생성', 'CONTRACT', '매칭 확정', '{{patientName}} 환자의 간병이 확정되었습니다. 계약 내용을 확인해주세요.', '계약 생성 시 간병인에게', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'CONTRACT_CANCELLED_BY_GUARDIAN', '계약 취소 (보호자)', 'CONTRACT', '보호자가 계약을 취소했습니다', '보호자가 계약을 취소했습니다. 사용일: {{usedDays}}일, 정산금액: {{netEarning}}원', '보호자 취소 시 간병인에게', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'CONTRACT_CANCELLED_BY_CAREGIVER', '계약 취소 (간병인)', 'CONTRACT', '간병인이 계약을 취소했습니다', '간병인이 계약을 취소했습니다. 사유: {{reason}}', '간병인 취소 시 보호자에게', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'CONTRACT_FORCE_CANCELLED', '관리자 강제 취소', 'CONTRACT', '계약이 관리자에 의해 취소됨', '관리자에 의해 계약이 취소되었습니다. {{reasonText}}', '관리자 강제 취소', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'CONTRACT_EMERGENCY_REMATCH', '긴급 재매칭', 'CONTRACT', '긴급 재매칭 안내', '기존 간병 계약이 취소되고 새로운 간병인을 찾고 있습니다.', '긴급 재매칭 발생 시 보호자', true, true, NOW(), NOW()),

-- === 연장 ===
(gen_random_uuid()::text, 'EXTENSION_REQUEST', '연장 요청', 'EXTENSION', '간병 연장 요청', '{{additionalDays}}일 연장 요청이 있습니다. 수락 여부를 확인해주세요.', '보호자 또는 간병인에게', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'EXTENSION_CONFIRMED', '연장 확정', 'EXTENSION', '연장 확정', '계약이 연장되었습니다. 정산 예정 금액: {{netAmount}}원', '연장 수락 시', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'EXTENSION_REMINDER_3D', '종료 3일 전', 'EXTENSION', '간병 종료 예정 안내', '{{patientName}} 환자의 간병 서비스가 3일 후 종료됩니다. 연장을 원하시면 마이페이지에서 연장 요청해주세요.', '종료 3일 전 자동 알림', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'EXTENSION_REMINDER_1D', '종료 1일 전', 'EXTENSION', '간병 종료 예정 안내', '{{patientName}} 환자의 간병이 1일 후 종료됩니다.', '종료 1일 전 자동 알림', true, true, NOW(), NOW()),

-- === 결제 ===
(gen_random_uuid()::text, 'PAYMENT_COMPLETED', '결제 완료', 'PAYMENT', '결제 완료', '{{amount}}원 결제가 완료되었습니다.', '결제 성공 시', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'PAYMENT_EXTENSION_REQUIRED', '연장 결제 필요', 'PAYMENT', '연장 결제 필요', '{{amount}}원의 연장 결제가 생성되었습니다. 결제를 완료해주세요.', '연장 Payment 생성 시 보호자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'PAYMENT_EXTENSION_DIRECT', '연장 결제 (직접결제)', 'PAYMENT', '연장 결제 완료 (직접결제)', '{{amount}}원 연장 결제가 기록되었습니다.', '직접결제로 연장 시', true, true, NOW(), NOW()),

-- === 환불 ===
(gen_random_uuid()::text, 'REFUND_REQUEST_ADMIN', '환불 요청 접수 (관리자)', 'PAYMENT', '환불 요청 접수', '{{guardianName}}님이 {{refundAmount}}원 환불을 요청했습니다.', '관리자에게 환불 요청 알림', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'REFUND_APPROVED_GUARDIAN', '환불 완료 (보호자)', 'PAYMENT', '환불 완료', '{{refundAmount}}원이 환불 처리되었습니다.', '환불 승인 후 보호자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'REFUND_PARTIAL_GUARDIAN', '부분 환불 완료 (보호자)', 'PAYMENT', '부분 환불 완료', '{{refundAmount}}원이 부분 환불 처리되었습니다.', '부분 환불 시 보호자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'REFUND_APPROVED_CAREGIVER', '환불로 계약 취소 (간병인)', 'PAYMENT', '계약 환불 및 취소', '보호자의 환불로 인해 계약이 취소되었습니다.', '전액 환불로 계약 취소 시 간병인', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'REFUND_PARTIAL_CAREGIVER', '부분 환불 안내 (간병인)', 'PAYMENT', '계약 일부 환불 알림', '계약 결제 중 {{refundAmount}}원이 보호자에게 환불되었습니다. 정산 금액이 조정됩니다.', '부분 환불 시 간병인', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'REFUND_REJECTED', '환불 요청 거절', 'PAYMENT', '환불 요청 거절', '환불 요청이 거절되었습니다. {{reason}}', '환불 요청 거절 시', true, true, NOW(), NOW()),

-- === 추가 간병비 ===
(gen_random_uuid()::text, 'ADDITIONAL_FEE_REQUEST', '추가 간병비 요청', 'PAYMENT', '추가 간병비 요청', '간병인이 {{amount}}원 추가 간병비를 요청했습니다. 사유: {{reason}}', '간병인 요청 시 보호자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'ADDITIONAL_FEE_APPROVED', '추가 간병비 승인', 'PAYMENT', '추가 간병비 승인', '보호자가 {{amount}}원 추가 간병비를 승인했습니다.', '보호자 승인 시 간병인', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'ADDITIONAL_FEE_REJECTED', '추가 간병비 거절', 'PAYMENT', '추가 간병비 거절', '보호자가 {{amount}}원 추가 간병비 요청을 거절했습니다.{{reasonSuffix}}', '보호자 거절 시 간병인', true, true, NOW(), NOW()),

-- === 정산 ===
(gen_random_uuid()::text, 'SETTLEMENT_PAID', '정산 완료', 'PAYMENT', '정산 완료', '{{netAmount}}원이 정산 처리되었습니다.', '정산 지급 완료 시 간병인', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'SETTLEMENT_BULK_PAID', '일괄 정산 완료', 'PAYMENT', '정산 완료', '{{count}}건 · 총 {{total}}원이 정산 처리되었습니다.', '일괄 정산 시 간병인', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'SETTLEMENT_MID_CREATED', '중간정산 생성', 'PAYMENT', '중간정산 생성', '{{billDays}}일분 중간정산이 생성되었습니다. 실지급: {{netAmount}}원', '중간정산 생성 시 간병인', true, true, NOW(), NOW()),

-- === 패널티 ===
(gen_random_uuid()::text, 'PENALTY_ISSUED', '패널티 부여', 'PENALTY', '패널티 부여 안내', '[{{penaltyType}}] {{reason}}', '패널티 부여 시 간병인', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'PENALTY_SUSPENDED', '활동 정지', 'PENALTY', '활동 정지 안내', '{{reason}} 3회 이상 누적으로 활동이 정지되었습니다.', '패널티 3회 이상 시', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'PENALTY_BLACKLISTED', '블랙리스트', 'SYSTEM', '계정 정지 안내', '{{reason}}', '블랙리스트 등록 시', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'PENALTY_UNBLACKLISTED', '블랙리스트 해제', 'SYSTEM', '블랙리스트 해제 안내', '블랙리스트가 해제되었습니다. 다시 활동이 가능합니다.', '블랙리스트 해제 시', true, true, NOW(), NOW()),

-- === 간병 기록 ===
(gen_random_uuid()::text, 'CARE_RECORD_CREATED', '간병일지 작성', 'CARE_RECORD', '간병일지 작성 완료', '{{patientName}} 환자의 간병일지가 작성되었습니다.', '간병일지 작성 시 보호자', true, true, NOW(), NOW()),

-- === 보험서류 ===
(gen_random_uuid()::text, 'INSURANCE_REQUESTED_ADMIN', '보험서류 신청 접수 (관리자)', 'SYSTEM', '간병보험 서류 신청', '{{patientName}} 환자의 {{documentType}} 신청이 접수되었습니다. (보험사: {{insuranceCompany}})', '보호자 신청 시 관리자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'INSURANCE_PROCESSING', '보험서류 처리 시작', 'SYSTEM', '보험서류 처리 시작', '{{patientName}} 환자분 {{docLabel}} 신청이 접수되어 관리자가 처리 중입니다.', '처리중 전환 시 보호자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'INSURANCE_COMPLETED', '보험서류 발급 완료', 'SYSTEM', '보험서류 발급 완료', '{{patientName}} 환자분 {{docLabel}} 발급이 완료되었습니다. 마이페이지 → 보험서류 탭에서 다운로드하실 수 있습니다.', '발급 완료 시 보호자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'INSURANCE_REJECTED', '보험서류 거절', 'SYSTEM', '보험서류 신청 거절', '{{patientName}} 환자분 {{docLabel}} 신청이 거절되었습니다. 사유: {{reasonText}}', '거절 시 보호자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'INSURANCE_REREVIEW', '보험서류 재심사', 'SYSTEM', '보험서류 재심사 접수', '{{patientName}} 환자분 {{docLabel}} 신청이 관리자에 의해 재심사 대기 상태로 전환되었습니다.', '재심사 전환 시 보호자', true, true, NOW(), NOW()),

-- === 분쟁 ===
(gen_random_uuid()::text, 'DISPUTE_CREATED_ADMIN', '분쟁 접수 (관리자)', 'SYSTEM', '분쟁 접수', '{{category}} 분쟁이 접수되었습니다. 신고자: {{reporterName}}', '분쟁 접수 시 관리자', true, true, NOW(), NOW()),
(gen_random_uuid()::text, 'DISPUTE_STATUS_UPDATED', '분쟁 처리 결과', 'SYSTEM', '분쟁 처리 안내', '분쟁이 {{statusLabel}}되었습니다. {{resolution}}', '분쟁 상태 변경 시 당사자', true, true, NOW(), NOW()),

-- === 신고 ===
(gen_random_uuid()::text, 'REPORT_CREATED_ADMIN', '신고 접수 (관리자)', 'SYSTEM', '신고 접수', '{{targetType}} ({{reason}}) 신고가 접수되었습니다.', '신고 접수 시 관리자', true, true, NOW(), NOW()),

-- === 시스템 ===
(gen_random_uuid()::text, 'SYSTEM_SESSION_EXPIRED', '세션 만료', 'SYSTEM', '세션이 만료되었습니다', '다시 로그인해주세요.', '세션 만료 시', true, true, NOW(), NOW())

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  "isSystem" = EXCLUDED."isSystem",
  "updatedAt" = NOW();
