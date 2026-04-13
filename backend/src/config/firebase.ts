import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Firebase Admin SDK 초기화
const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase] Admin SDK 초기화 완료');
  }
} else {
  console.warn('[Firebase] firebase-service-account.json 파일이 없습니다. 푸시 알림이 작동하지 않습니다.');
}

export default admin;
