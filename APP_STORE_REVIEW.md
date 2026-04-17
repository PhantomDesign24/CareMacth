# Apple App Store / Google Play 심사 대응 메모

## IAP (In-App Purchase) 미적용 근거

Apple App Store 심사 가이드라인 **3.1.1 (In-App Purchase)** 은 **디지털 콘텐츠/서비스**에 대해 IAP 사용을 요구합니다. 본 앱이 처리하는 결제는 **실물 서비스(Physical Service)** 이므로 IAP가 **면제 대상**입니다.

### 근거 조항: Apple Guideline 3.1.3(e) Goods and Services Outside of the App
> "Apps may enable people to purchase goods or services that will be consumed outside of the app, such as food delivery, ride sharing, medical services, etc. **In-app purchase must not be used** to purchase these goods or services."

### 본 앱의 결제 서비스 분류
- **서비스 유형**: 실제 간병인이 오프라인에서 환자를 돌보는 **의료/돌봄 실물 서비스**
- **제공 방식**: 간병인이 병원/자택에 직접 방문하여 출퇴근 체크 + 간병 수행
- **디지털 콘텐츠 없음**: 앱 내에서 소비되는 디지털 상품 없음 (포인트는 결제 할인 수단, 독립 상품 아님)

### 사용 PG사
- **토스페이먼츠**: 국내 카드 결제 및 무통장입금
- **카카오페이**: 간편 결제
- 모두 한국 전자금융거래법 및 여신전문금융업법 준수

## 심사 대비 체크리스트

### ✅ 이미 구현된 항목 (iOS 심사 필수 요구)

| 가이드라인 | 항목 | 구현 상태 |
|-----------|------|----------|
| **1.2 User Generated Content** | UGC 신고/차단 시스템 | ✅ 리뷰/사용자/간병일지/메시지 신고 + 사용자 간 차단 |
| **5.1.1(v) Data Privacy** | 회원 탈퇴 기능 | ✅ Soft delete + 개인정보 익명화 |
| **5.1.1 Data Collection** | 개인정보 처리방침 | ✅ `/privacy` 페이지 |
| **3.1.3(e)** | 실물 서비스 외부결제 | ✅ 토스페이먼츠 (IAP 면제) |
| **5.1 Legal** | 위치 권한 설명 | ✅ NSLocationWhenInUseUsageDescription 명시 |
| **5.1 Legal** | 카메라 권한 설명 | ✅ NSCameraUsageDescription 명시 |
| **5.1 Legal** | 사진 권한 설명 | ✅ NSPhotoLibraryUsageDescription 명시 |
| **5.1 Legal** | Face ID 권한 설명 | ✅ NSFaceIDUsageDescription 명시 |
| **4.5.1** | LSApplicationQueriesSchemes | ✅ 카카오톡/카카오페이 등 명시 |

## 심사 제출 시 제공할 설명 (Apple Review Notes)

```
CareMatch is a platform connecting caregivers with patients/guardians for
in-person caregiving services (physical service, not digital content).
Payment is for real-world caregiver dispatch services performed at
hospitals or homes. Per Apple Guideline 3.1.3(e), in-app purchase is
not applicable to such physical services.

Payment gateway: TossPayments (Korean licensed PG, escrow-based).
Refund policy: Pro-rated refund on mid-termination, full escrow.

Demo accounts:
- Guardian: guardian1@test.com / test1234!
- Caregiver: cg1@test.com / test1234!
```

## 보안 및 개인정보

- JWT 인증 + 토큰 만료 처리
- TLS only (HTTPS)
- PII 저장 시 최소한 수집 (이름/전화/이메일)
- 회원 탈퇴 시 `deletedAt` 설정 + 이름·전화·이메일 익명화
- 결제 정보는 토스페이먼츠 측 저장, 앱에는 `paymentKey`/`orderId` 참조만 보관

## 참고 링크

- Apple Review Guidelines 3.1.3(e): https://developer.apple.com/app-store/review/guidelines/#3.1.3-e
- Apple Review Guidelines 1.2 (UGC): https://developer.apple.com/app-store/review/guidelines/#1.2
