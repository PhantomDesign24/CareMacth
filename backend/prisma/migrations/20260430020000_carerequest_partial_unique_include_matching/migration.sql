-- CareRequest 활성 요청 부분 유니크: OPEN/MATCHED 외에 MATCHING 도 포함
DROP INDEX IF EXISTS "CareRequest_guardianId_patientId_active_unique";
CREATE UNIQUE INDEX "CareRequest_guardianId_patientId_active_unique"
  ON "CareRequest" ("guardianId", "patientId")
  WHERE status IN ('OPEN', 'MATCHING', 'MATCHED');
