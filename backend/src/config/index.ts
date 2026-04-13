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
