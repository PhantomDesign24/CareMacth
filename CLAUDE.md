# CareMatch 프로젝트 지침

## 서버 구성

| 서비스 | 포트 | 경로 | 실행 방법 |
|--------|------|------|-----------|
| Backend API | **4000** | `/var/www/carematch/backend` | `npm run build && pm2 restart carematch-backend` |
| Web Frontend | **3000** | `/var/www/carematch/web` | `rm -rf .next && npm run build && pm2 restart carematch-web` |
| Admin Panel | **3010** | `/var/www/carematch/admin` | `rm -rf .next && npm run build && pm2 restart carematch-admin` |
| PostgreSQL | 5432 | - | 시스템 서비스 |
| Redis | 6379 | - | 시스템 서비스 |

## PM2 프로세스 관리

```bash
pm2 list                          # 전체 상태 확인
pm2 restart carematch-backend     # 백엔드 재시작
pm2 restart carematch-web         # 웹 재시작
pm2 restart carematch-admin       # 어드민 재시작
pm2 logs carematch-backend        # 백엔드 로그
```

## Git 저장소

- **원격**: `https://github.com/PhantomDesign24/CareMacth.git`
- **브랜치**: `main` (단일 브랜치)
- 사용자(Windows)가 PowerShell에서 `git pull` 후 앱 빌드

## Apache 프록시 (SSL)

- 설정 파일: `/etc/apache2/sites-available/cm.phantomdesign.kr-le-ssl.conf`
- `/api/*` → `localhost:4000`
- `/admin/*` → `localhost:3010`
- `/uploads/*` → 백엔드 정적 파일
- `/*` → `localhost:3000` (기본)

## 빌드/배포 순서

```bash
# 1. 백엔드
cd /var/www/carematch/backend
npm run build
pm2 restart carematch-backend

# 2. 웹
cd /var/www/carematch/web
rm -rf .next && npm run build
pm2 restart carematch-web

# 3. 어드민
cd /var/www/carematch/admin
rm -rf .next && npm run build
pm2 restart carematch-admin
```

## 모바일 앱 빌드 (사용자 Windows PowerShell)

```powershell
# 보호자 앱 (app-patient)
cd C:\Users\KSH\Desktop\care\CareMacth
git pull
cd app-patient\android
./gradlew assembleRelease
adb install -r app\build\outputs\apk\release\app-release.apk

# 간병인 앱 (app-caregiver)
cd C:\Users\KSH\Desktop\care\CareMacth\app-caregiver\android
./gradlew assembleRelease
adb install -r app\build\outputs\apk\release\app-release.apk
```

### 네이티브 모듈 변경 시 (prebuild 필요)
```powershell
cd app-patient
npx expo prebuild -p android --clean
cd android
./gradlew assembleRelease
```

### 앱 패키지명
- 보호자: `kr.carematch.patient`
- 간병인: `kr.carematch.caregiver`

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
npx prisma migrate dev --name 설명
npx prisma generate
```

### PrismaClient 싱글톤
- `app.ts`에서 한 번만 생성하고 export
- 서비스 파일에서 `import { prisma } from '../app'` 사용
- **절대 `new PrismaClient()` 새로 만들지 말 것**

### 결제 WebView (app-patient)
- 토스/카카오페이 결제창은 **WebView 내부에서** 열기 (외부 브라우저 X → 토큰 유실)
- `intent://` URL은 직접 파싱하여 `scheme://path`로 변환 후 `Linking.openURL`
- Android 11+ `<queries>` 필수 (`plugins/withAndroidQueries.js` config plugin)
- 결제 도메인 진입 시 하단 탭바 자동 숨김 (`paymentActive` 상태)
- 결제 중 상대경로 이동 금지 → `${WEB_URL}/path` 절대경로 사용

## 결제 연동 (토스페이먼츠)

- SDK: `@tosspayments/payment-sdk` v1
- 테스트 키: `test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq` / `test_sk_ZORzdMaqN3wQd5k6ygr5AkYXQGwy`
- successUrl: `${origin}/payment/success`
- failUrl: `${origin}/payment/fail`
- 테스트 결제: `testMode=true` → 100원 (VAT 제외)
- PENDING 결제 자동 만료: 5분 후 FAILED (2분 주기 cron)

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
- 크론잡: `backend/src/services/cronJobs.ts`
- Firebase: `backend/src/config/firebase.ts`, `backend/firebase-service-account.json`

### 프론트엔드
- Web API: `web/src/lib/api.ts`
- Web 포맷: `web/src/lib/format.ts`
- Web 토스트: `web/src/components/Toast.tsx` (`showToast()` 글로벌 함수)
- Admin API: `admin/src/lib/api.ts`
- Admin 사이드바: `admin/src/components/Sidebar.tsx`
- Admin 상수: `admin/src/lib/constants.ts`

### 모바일
- Patient 앱: `app-patient/App.tsx` (WebView 래퍼)
- Patient config: `app-patient/src/config.ts` (도메인, URL)
- Patient queries plugin: `app-patient/plugins/withAndroidQueries.js`
- Caregiver 앱: `app-caregiver/App.tsx` (WebView 래퍼)

## 수수료 구조
- 1:1 간병: 10% (설정 변경 가능)
- 가족 간병: 15% (설정 변경 가능)
- 세금: 3.3% (간병인 원천징수)
- VAT: `Math.round(amount / 11)` (별도 계산)
- 결제 방식: 무통장(VAT별도) / 카드(VAT별도) / 직접결제(VAT포함)

## 중복 방지 체계
- 간병 요청: 프론트 disabled + 백엔드 10초 제한 + DB 유니크 인덱스 (guardianId+patientId WHERE OPEN/MATCHED)
- 결제: 10초 내 PENDING 중복 차단
- 환자: 같은 이름+생년월일 기존 환자 자동 반환

## 크론잡 (7개)
| 크론 | 주기 |
|------|------|
| 간병 종료 리마인더 (3일/1일 전) | 매일 09:00 |
| 정산 처리 | 매일 10:00 |
| 계약 상태 자동 완료 | 매일 00:00 |
| 우수 간병사 뱃지 자동 부여 | 매일 00:00 |
| 월별 통계 자동 생성 | 매월 1일 01:00 |
| PENDING 결제 자동 만료 | 매 2분 (5분 초과) |
| 노쇼 3회 자동 활동 정지 | 매일 02:00 |
