-- User(authProvider, socialId) 유니크 제약 — 소셜 가입 race 시 중복 계정 차단
-- 기존 NULL 행은 partial unique 가 필요한데 PostgreSQL 의 일반 unique 는 NULL 을 중복 허용하므로 그대로 적용 가능.
CREATE UNIQUE INDEX IF NOT EXISTS "User_authProvider_socialId_key" ON "User" ("authProvider", "socialId");
