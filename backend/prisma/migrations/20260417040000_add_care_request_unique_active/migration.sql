-- 같은 환자+보호자로 OPEN/MATCHED 상태의 간병 요청은 1개만 허용
-- (부분 유니크 인덱스: PostgreSQL 고유 기능)
CREATE UNIQUE INDEX "CareRequest_active_guardian_patient_unique"
  ON "CareRequest" ("guardianId", "patientId")
  WHERE status IN ('OPEN', 'MATCHED');
