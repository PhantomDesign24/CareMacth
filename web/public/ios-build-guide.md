# CareMatch iOS 빌드 가이드 (Mac + Claude Code)

이 문서는 **Mac 의 Claude Code** 가 이 한 페이지만 읽고 CareMatch iOS 앱을 빌드/테스트/수정할 수 있도록 작성되었습니다.

---

## 1. 프로젝트 정보

| 항목 | 값 |
|---|---|
| **Git 저장소** | https://github.com/PhantomDesign24/CareMacth.git |
| **브랜치** | `main` (단일 브랜치) |
| **프레임워크** | Expo (React Native) — Bare 워크플로 prebuild |
| **앱 개수** | 2개 — 보호자(`app-patient`) + 간병인(`app-caregiver`) |
| **백엔드 (참고)** | https://cm.phantomdesign.kr/api (Node/Express + Prisma) |
| **웹 (참고)** | https://cm.phantomdesign.kr (Next.js) |

### 패키지명 / Bundle ID

| 앱 | iOS bundleIdentifier | Android package |
|---|---|---|
| 보호자 (`app-patient`) | `kr.carematch.patient` | `kr.carematch.patient` |
| 간병인 (`app-caregiver`) | `kr.carematch.giver` | `kr.carematch.giver` |

> 참고: 간병인 앱의 Android `caregiver` 와 `giver` 두 패키지가 Firebase 에 등록돼 있는데, **현재 활성 패키지는 `giver`** (Play Store 등록명 기준).

---

## 2. Mac 사전 준비

### 필수 도구

```bash
# Xcode (App Store 에서 설치) — 최신 버전 권장
xcode-select --install   # CLI tools

# Homebrew + Node
brew install node@20 watchman cocoapods git

# 글로벌 패키지
npm install -g expo-cli eas-cli
```

### Apple 계정

- **Apple Developer Program** ($99/년) — https://developer.apple.com/programs/
- 가입 완료 후 Apple ID 로 `eas login` 가능

### 저장소 클론

```bash
mkdir -p ~/dev && cd ~/dev
git clone https://github.com/PhantomDesign24/CareMacth.git
cd CareMacth
```

> 기존에 다른 경로에 있으면 그대로 사용해도 됩니다.

---

## 3. 빌드 방식 선택

### 방식 A: **EAS Build (클라우드)** — 추천

장점: 인증서/프로비저닝 자동 관리, Mac 없이도 가능한 옵션, App Store 직접 제출
단점: 무료 플랜 월 30회 제한

```bash
cd ~/dev/CareMacth/app-patient   # 또는 app-caregiver

# 1. 의존성 설치
npm install

# 2. EAS 로그인 (Expo 계정 + Apple 계정 연결)
eas login
eas build:configure   # 처음 한 번만 (eas.json 생성)

# 3. 빌드 — production
eas build --platform ios --profile production

# 4. App Store 제출
eas submit --platform ios
```

### 방식 B: **로컬 Xcode 빌드**

장점: 빠른 디바이스 테스트, 시뮬레이터 실행 가능
단점: 인증서 수동 관리

```bash
cd ~/dev/CareMacth/app-patient

npm install
npx expo prebuild -p ios --clean
cd ios
pod install
open *.xcworkspace   # Xcode 에서 Signing 설정 후 Archive
```

### 시뮬레이터로 빠른 테스트

```bash
cd ~/dev/CareMacth/app-patient
npx expo run:ios   # 자동으로 시뮬레이터 실행
```

---

## 4. 빌드 전 체크리스트

### `app.json` 확인 (양 앱 공통)

- `expo.ios.bundleIdentifier` — 위 표와 일치
- `expo.ios.googleServicesFile` — `./GoogleService-Info.plist` (Firebase iOS 설정 파일)
- `expo.ios.infoPlist`:
  - `NSCameraUsageDescription`
  - `NSPhotoLibraryUsageDescription`
  - `NSLocationWhenInUseUsageDescription`
  - `NSFaceIDUsageDescription`

### 푸시 알림 활성화 (현재 비활성)

코드에 `PUSH_ENABLED = Platform.OS === 'android'` 가드가 있어 iOS 푸시 비활성화 상태입니다.

iOS 푸시를 켜려면:

#### 1단계: APNs Auth Key (.p8) 발급
**Apple Developer Console — Keys 페이지에서 발급**
- 발급 페이지: https://developer.apple.com/account/resources/authkeys/list
- "Create a key (+)" 클릭
- **Key Name**: `CareMatch APNs` (자유)
- **Key Services** 에서 **"Apple Push Notifications service (APNs)"** 체크
- Configure → Continue → Register
- 다운로드되는 **.p8 파일** (예: `AuthKey_ABC123XYZ.p8`) **딱 한 번만 받을 수 있음** — 반드시 안전한 곳에 백업
- 표시되는 **Key ID** (예: `ABC123XYZ`) 와 Apple Developer 화면 우상단의 **Team ID** (예: `12ABCD3456`) 함께 메모

> .p8 파일은 분실 시 재발급 불가 (revoke 후 새로 생성). Google Drive / 1Password 같은 안전한 곳에 보관 권장.

#### 2단계: Firebase Console 에 APNs 키 업로드
- https://console.firebase.google.com → `carematch-fc707` → 프로젝트 설정(톱니바퀴) → **Cloud Messaging** 탭
- "Apple app configuration" 섹션에서 등록된 iOS 앱 2개 각각:
  - **APNs Authentication Key** → "Upload" 클릭
  - .p8 파일 + Key ID + Team ID 입력 → Upload
- 양쪽 앱 모두 같은 .p8 키 사용 가능 (같은 팀이라면)

#### 3단계: 코드 수정
- `app-patient/App.tsx` 와 `app-caregiver/App.tsx` 에서 `PUSH_ENABLED = Platform.OS === 'android'` 검색
- `PUSH_ENABLED = true` 로 변경 (모든 플랫폼 활성화)
- `ios.entitlements.aps-environment: production` 은 이미 설정됨 (app.json)

#### 4단계: 빌드 + 테스트
- `npx expo prebuild -p ios --clean`
- 실기기에서만 푸시 가능 (시뮬레이터는 푸시 안 됨)
- 어드민에서 본인에게 푸시 발송 → 잠금화면에 알림 도착 확인

### Firebase iOS 설정

각 앱 디렉토리에 **`GoogleService-Info.plist`** 가 있어야 합니다. 없으면 Firebase Console 에서 다운로드:
- Firebase 프로젝트: `carematch-fc707`
- iOS 앱 → 다운로드 → `app-patient/GoogleService-Info.plist`, `app-caregiver/GoogleService-Info.plist` 저장

---

## 5. 주요 코드 위치

| 위치 | 역할 |
|---|---|
| `app-patient/App.tsx` | 보호자 앱 메인 (WebView 래퍼 + 푸시 + 탭 네비) |
| `app-caregiver/App.tsx` | 간병인 앱 메인 |
| `app-*/app.json` | Expo 설정 (bundleId, permissions, plugins) |
| `app-*/plugins/withAndroidQueries.js` | Android intent queries config plugin (iOS 무관) |
| `app-*/src/config.ts` | 도메인/URL 환경변수 |

### 백엔드 API 도메인

- Production: `https://cm.phantomdesign.kr/api`
- 환경변수는 `app-*/src/config.ts` 에서 관리

---

## 6. 빌드 후 검증 시나리오

1. 시뮬레이터/실기기에서 앱 실행
2. **로그인 흐름** — 이메일/카카오/네이버 로그인 → WebView 안 dashboard 진입
3. **탭 전환** — 홈 / 간병요청(보호자) 또는 일감(간병인) / 내간병 / 마이페이지 — 마이페이지 ↔ 다른 탭 전환 시 홈으로 리셋 안 되는지
4. **푸시 알림** (iOS 푸시 활성화 후) — 알림 트레이 탭 → 정확한 URL 로 이동 + 자동 markRead
5. **카메라/사진/위치 권한** — 첫 사용 시 권한 요청 팝업
6. **결제** (보호자 앱 전용) — 토스/카카오페이 WebView 내부 흐름

---

## 7. 트러블슈팅

### `pod install` 실패
```bash
cd ios
pod repo update
pod install --repo-update
```

### CocoaPods 캐시 문제
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
```

### Xcode 빌드 캐시
- Xcode 메뉴 → Product → Clean Build Folder (Shift+Cmd+K)
- 또는 `~/Library/Developer/Xcode/DerivedData` 삭제

### Expo prebuild 가 ios 폴더 삭제 안 됨
```bash
rm -rf ios
npx expo prebuild -p ios --clean
```

### Firebase 토큰 발급 실패
- `GoogleService-Info.plist` 가 ios 폴더 안에 복사됐는지 확인
- `Info.plist` 에 `FirebaseAppDelegateProxyEnabled` 가 false 가 아닌지

---

## 8. 변경 → 푸시 → 빌드 표준 흐름

```bash
# 1. Mac 에서 최신 가져오기
cd ~/dev/CareMacth
git pull

# 2. 변경 후 의존성 갱신 (package.json 바뀌면)
cd app-patient
npm install

# 3. 네이티브 코드 변경 있으면 prebuild
npx expo prebuild -p ios --clean

# 4. 빌드 (EAS 추천)
eas build --platform ios --profile production

# 5. 빌드 완료 후 (~10-20분)
eas submit --platform ios   # App Store Connect 자동 업로드
```

---

## 9. 참고 문서

- **이 가이드 URL**: https://cm.phantomdesign.kr/ios-build-guide.md
- **프로젝트 CLAUDE.md** (서버 운영 가이드): https://github.com/PhantomDesign24/CareMacth/blob/main/CLAUDE.md
- **Expo iOS 빌드 공식**: https://docs.expo.dev/build/setup/
- **EAS Submit**: https://docs.expo.dev/submit/ios/

---

## 10. Claude Code 사용 시 권장 첫 명령

Mac 의 Claude Code 에 이 문서 링크를 던지면, 다음 명령부터 시작하세요:

```
이 가이드 읽고 카레매치 iOS 빌드 환경 세팅해줘:
https://cm.phantomdesign.kr/ios-build-guide.md

먼저 git clone + npm install 만 진행하고 결과 알려줘.
```

이후 차근차근:
- 시뮬레이터 빌드 → `npx expo run:ios`
- 프로덕션 빌드 → `eas build --platform ios --profile production`
- App Store 업로드 → `eas submit --platform ios`
