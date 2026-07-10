# CareMatch iOS 재빌드/재제출 핸드오프 (맥용)

> 맥의 Claude Code(또는 AI)에 이 파일 내용을 붙여넣고 시작하세요.

---

CareMatch(케어매치) iOS 앱 2개를 재빌드해서 App Store에 재제출하려고 해. 맥에서 iOS 빌드/제출을 단계별로 도와줘.

## 프로젝트
- Korean 간병 매칭 플랫폼. Expo React Native **WebView 래퍼** 앱 2개 (https://care-match.kr 를 로드함)
- 저장소: https://github.com/PhantomDesign24/CareMacth (main 브랜치) — 먼저 git pull 로 최신화
- 보호자앱: `app-patient` / iOS 번들 `kr.phantomdesign.carematch.patient`
- 간병인앱: `app-caregiver` / iOS 번들 `kr.phantomdesign.carematch.giver`
- Apple 개발자 계정: **조직 계정 "Carematch Inc" (케어매치(주))** 로 전환 완료됨

## 중요: 앱은 WebView 래퍼라 콘텐츠 수정은 전부 서버(웹)에 이미 배포됨
아래 Apple 거절 이슈들은 **코드(웹)에서 이미 다 해결**됨. iOS 앱은 그냥 재빌드만 하면 수정이 자동 반영됨:
- 2.3.10 Google Play 참조 → 앱 내부(IS_CAREMATCH_APP)에서 스토어 버튼 숨김 처리됨
- 5.1.1(v) 계정 삭제 → 대시보드 회원탈퇴 + https://care-match.kr/account-deletion 페이지 있음
- 5.1.1(ix) 조직 계정 → Carematch Inc 로 해결됨
- 2.1(a) 회원가입 버튼 미반응(간병인) → 수정됨

## 맥에서 할 일 (앱 2개 각각)
1. git pull 로 최신 코드
2. `npx expo prebuild -p ios --clean` (ios 폴더 생성)
3. iOS **buildNumber(빌드번호) 올리기** (Apple이 1.0(1) 심사했음 → 더 높게)
4. **Carematch Inc 조직 계정**의 인증서/프로비저닝으로 서명 (기존 개인계정 인증서면 조직용으로 재발급 필요할 수 있음)
5. Xcode Archive 또는 EAS 로 빌드 → App Store Connect 업로드
6. 재제출

## 빌드 전 확인해줘
- Xcode 설치/버전, CocoaPods 상태
- Apple 로그인(Sign in with Apple), 푸시(GoogleService-Info.plist), expo-notifications/location/image-picker 사용 중 → 프로비저닝에 해당 capability 포함됐는지
- 조직 계정 전환 후 서명 인증서가 유효한지

## App Store Connect 에서 추가로 (빌드 후)
- 스크린샷에서 Google Play 이미지 있으면 교체
- 계정삭제 화면녹화(로그인→마이페이지→회원탈퇴→확정)를 App Review Notes 에 첨부
- 데모 계정: 보호자 `guardian1@test.com` / `test1234!`, 간병인 `cg1@test.com` / `test1234!`

먼저 저장소 클론 여부와 Xcode/EAS 환경부터 확인하고, iOS 빌드를 어떻게 진행할지 알려줘.
