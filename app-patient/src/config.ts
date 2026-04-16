/**
 * 앱 공통 설정 — 도메인·브랜드 변경 시 이 파일만 수정
 */
export const APP_CONFIG = {
  domain: 'cm.phantomdesign.kr',
  get webUrl() { return `https://${this.domain}`; },
  get apiUrl() { return `https://${this.domain}/api`; },
  phone: '1555-0801',
  name: '케어매치',
  email: 'support@carematch.kr',
} as const;
