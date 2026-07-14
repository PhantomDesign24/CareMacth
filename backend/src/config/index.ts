import dotenv from 'dotenv';
dotenv.config();

// 프로덕션 환경에서 JWT 시크릿 미설정 시 서버 시작 차단
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET 환경변수가 설정되지 않았습니다. 프로덕션에서는 반드시 안전한 시크릿을 설정하세요.');
  process.exit(1);
}

export const config = {
  port: parseInt(process.env.PORT || '4000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-carematch-secret-DO-NOT-USE-IN-PRODUCTION',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID || '',
    clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
    redirectUri: process.env.KAKAO_REDIRECT_URI || '',
  },

  naver: {
    clientId: process.env.NAVER_CLIENT_ID || '',
    clientSecret: process.env.NAVER_CLIENT_SECRET || '',
    redirectUri: process.env.NAVER_REDIRECT_URI || '',
  },

  toss: {
    clientKey: process.env.TOSS_CLIENT_KEY || '',
    secretKey: process.env.TOSS_SECRET_KEY || '',
  },

  // KG이니시스 INIStdPay 웹표준결제
  // INICIS_MODE=test 면 공개 테스트 MID/signKey 사용(실결제 X), production 이면 운영값 사용.
  inicis: (() => {
    const mode = process.env.INICIS_MODE || 'test';
    const isProd = mode === 'production';
    return {
      mode,
      isProd,
      // 테스트: 이니시스 공개 테스트 상점 (실제 청구 없음)
      mid: isProd ? (process.env.INICIS_MID_PROD || '') : 'INIpayTest',
      signKey: isProd ? (process.env.INICIS_SIGNKEY_PROD || '') : 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS',
      // iniapiKey/IV (취소/환불 INIAPI용, AES 암호화) — 운영 전환 시 상점관리자에서 발급
      iniApiKey: isProd ? (process.env.INICIS_INIAPIKEY_PROD || '') : '',
      iniApiIv: isProd ? (process.env.INICIS_INIAPI_IV_PROD || '') : '',
      // 결제창 JS / 결제 도메인 (테스트는 stg)
      stdJsUrl: isProd
        ? 'https://stdpay.inicis.com/stdjs/INIStdPay.js'
        : 'https://stgstdpay.inicis.com/stdjs/INIStdPay.js',
      // 취소 API 인증서 키파일 경로 (운영)
      certDir: process.env.INICIS_CERT_DIR || 'key/SIRmatch11',
    };
  })(),

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },

  channelTalk: {
    pluginKey: process.env.CHANNEL_TALK_PLUGIN_KEY || '',
    secret: process.env.CHANNEL_TALK_SECRET || '',
  },
};
