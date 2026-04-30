-- Patient: 같은 보호자 아래 동일 이름+생년월일 환자 1명으로 강제 (동시 등록 race 방지)
CREATE UNIQUE INDEX "Patient_guardianId_name_birthDate_key"
  ON "Patient" ("guardianId", "name", "birthDate");
