/**
 * 사이트 전역 설정 — 도메인/브랜드 변경 시 이 파일 하나만 수정하세요.
 */

export const SITE = {
  /** 정식 도메인 (scheme 포함) */
  url: "https://cm.phantomdesign.kr",
  /** 브랜드명(한글) */
  name: "케어매치",
  /** 브랜드명(영문) */
  nameEn: "CareMatch",
  /** 메타 타이틀 (기본) */
  title: "케어매치 | AI 간병 매칭 플랫폼 · 병원·재택·방문 간병",
  /** 타이틀 템플릿 (페이지별 prefix 뒤에 %s 치환) */
  titleTemplate: "%s | 케어매치",
  /** 메타 설명 */
  description:
    "검증된 간병인과 보호자를 AI가 실시간 매칭해드립니다. 병원간병, 재택간병, 방문요양, 생활돌봄, 24시간 간병 모두 지원. 1555-0801 전화상담 가능.",
  /** 대표 연락처 */
  phone: "1555-0801",
  /** 카카오톡 채널 페이지 (홈) */
  kakaoChannelUrl: "https://pf.kakao.com/_UTRjX",
  /** 카카오톡 채널 1:1 상담 (상담말하기 대체용 WL 링크) */
  kakaoChannelChatUrl: "https://pf.kakao.com/_UTRjX/chat",
  /** 대표 이메일 */
  email: "support@carematch.kr",
  /** 주요 키워드 */
  keywords: [
    "간병", "간병인", "간병매칭", "케어매치", "care-match",
    "병원간병", "재택간병", "방문요양", "생활돌봄", "24시간간병",
    "AI매칭", "케어코디", "간병인구하기", "간병사구하기",
    "간병비", "간병료", "가족간병", "1:1간병", "전문간병인",
  ],
  /** OG 이미지 경로 (도메인 root 기준 절대경로) */
  ogImage: "/og-image.png",
  /** 로고 이미지 경로 */
  logo: "/logo.png",
  /** 주소 */
  address: {
    country: "KR",
    locality: "서울",
  },
} as const;
