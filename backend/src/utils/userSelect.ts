/**
 * 응답에 사용할 User 필드 select.
 * password / tokenVersion / fcmToken / socialId / notificationPrefs / deletedAt
 * 같은 민감·내부 필드는 제외한다.
 */
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  role: true,
  authProvider: true,
  profileImage: true,
  pushEnabled: true,
  isActive: true,
  referralCode: true,
  referredBy: true,
  points: true,
  createdAt: true,
  updatedAt: true,
} as const;
