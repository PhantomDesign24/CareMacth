# CareMatch 프로젝트 지침

## 서버 구성

| 서비스 | 포트 | 경로 | 실행 방법 |
|--------|------|------|-----------|
| Backend API | **4000** | `/var/www/carematch/backend` | `npx ts-node-dev --respawn src/server.ts` |
| Web Frontend | **3000** | `/var/www/carematch/web` | `npx next start -p 3000` |
| Admin Panel | **3010** | `/var/www/carematch/admin` | `npx next start -p 3010` |
| PostgreSQL | 5432 | - | 시스템 서비스 |
| Redis | 6379 | - | 시스템 서비스 |

## Apache 프록시 (SSL)

- 설정 파일: `/etc/apache2/sites-available/cm.phantomdesign.kr-le-ssl.conf`
- `/api/*` → `localhost:4000`
- `/admin/*` → `localhost:3010`
- `/uploads/*` → 백엔드 정적 파일
- `/*` → `localhost:3000` (기본)

## 빌드/배포 순서

```bash
# 1. 백엔드 (코드 수정 시 자동 재시작 - ts-node-dev)
cd /var/www/carematch/backend
kill $(lsof -t -i:4000); sleep 2
npx ts-node-dev --respawn src/server.ts &>/tmp/carematch-backend.log &

# 2. 웹 (빌드 필수)
cd /var/www/carematch/web
rm -rf .next && npm run build
fuser -k 3000/tcp; sleep 1
PORT=3000 npx next start -p 3000 &>/tmp/carematch-web.log &

# 3. 어드민 (빌드 필수)
cd /var/www/carematch/admin
rm -rf .next && npm run build
fuser -k 3010/tcp; sleep 1
PORT=3010 npx next start -p 3010 &>/tmp/carematch-admin.log &
```

## 자주 하는 실수 방지

### Next.js Link vs a 태그 (Admin)
- Admin은 `basePath: '/admin'` 설정
- `<Link href="/caregivers">` → Next.js가 자동으로 `/admin/caregivers`로 변환 ✅
- `<a href="/admin/caregivers">` → 직접 절대경로 필요 ✅
- `<Link href="/admin/caregivers">` → `/admin/admin/caregivers` 이중 경로 ❌

### localStorage 토큰 키
- **Web**: `cm_access_token`, `cm_refresh_token`
- **Admin**: `token`
- **절대 섞지 말 것**

### API 응답 구조
- 백엔드 응답: `{ success: true, data: { ... } }`
- Admin api.ts의 `apiRequest()`가 자동으로 `data`만 반환
- Web api.ts의 axios는 `res.data` (전체 응답), 실제 데이터는 `res.data.data`

### 백엔드 필드명 vs 프론트 필드명
- 백엔드 DB: `individualFeePercent`, `familyFeePercent`, `totalMatches`
- Admin 프론트: `oneOnOneFeePercentage`, `familyCareFeePercentage`, `totalMatchings`
- api.ts에서 매핑 처리 중 - 새 필드 추가 시 양쪽 이름 확인 필수

### Prisma 변경 시
```bash
# 스키마 수정 후
npx prisma migrate dev --name 설명
npx prisma generate  # 클라이언트 재생성 (migrate가 자동 실행하지만 확인용)
```

### PrismaClient 싱글톤
- `app.ts`에서 한 번만 생성하고 export
- 서비스 파일에서 `import { prisma } from '../app'` 사용
- **절대 `new PrismaClient()` 새로 만들지 말 것**

## 테스트

```bash
cd /var/www/carematch/backend
npm test                    # 전체 테스트 (54개)
npx jest tests/unit/        # 단위 테스트만
npx jest tests/integration/ # 통합 테스트만
```

## 시드 데이터

```bash
npx prisma migrate reset --force  # DB 초기화 + 시드
npx prisma db seed                # 시드만 재실행
```

### 로그인 정보
- 관리자: `admin` / `1234`
- 보호자: `guardian1@test.com` ~ `guardian5@test.com` / `test1234!`
- 간병인: `cg1@test.com` ~ `cg10@test.com` / `test1234!`

## 주요 파일 경로

### 백엔드
- 앱 진입점: `backend/src/app.ts` (Express 설정), `backend/src/server.ts` (시작)
- DB 스키마: `backend/prisma/schema.prisma`
- 라우트: `backend/src/routes/*.ts`
- 컨트롤러: `backend/src/controllers/*.ts`
- 미들웨어: `backend/src/middlewares/*.ts`
- Firebase: `backend/src/config/firebase.ts`, `backend/firebase-service-account.json`

### 프론트엔드
- Web API: `web/src/lib/api.ts`
- Web 포맷: `web/src/lib/format.ts`
- Admin API: `admin/src/lib/api.ts`
- Admin 사이드바: `admin/src/components/Sidebar.tsx`

### 모바일
- Patient 앱: `app-patient/App.tsx` (WebView 래퍼)
- Caregiver 앱: `app-caregiver/App.tsx` (WebView 래퍼)
- 네이티브 화면: `app-*/src/screens/*.tsx` (현재 미사용, 향후 전환용)

## 수수료 구조
- 1:1 간병: 10% (설정 변경 가능)
- 가족 간병: 15% (설정 변경 가능)
- 세금: 3.3% (간병인 원천징수)
- VAT: `Math.round(amount / 11)` (별도 계산)
