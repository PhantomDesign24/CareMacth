import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { caregiverApi } from '../services/api';

// 포그라운드 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] 실제 기기에서만 푸시 알림을 사용할 수 있습니다.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] 푸시 알림 권한이 거부되었습니다.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('carematch-default', {
      name: '케어매치 간병인 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  // 백엔드가 Firebase Admin SDK 로 직접 FCM 발송하므로 Expo 푸시 토큰이 아닌 네이티브 FCM 토큰 사용
  // (getExpoPushTokenAsync 는 Expo Push Service 경유라 우리 백엔드와 연동 안 됨)
  const tokenData = await Notifications.getDevicePushTokenAsync();
  return tokenData.data as string;
}

export function usePushNotifications(isLoggedIn: boolean) {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    if (!isLoggedIn) return;

    registerForPushNotifications().then((token) => {
      if (token) {
        caregiverApi.registerFcmToken(token).catch((err) =>
          console.error('[Push] FCM 토큰 등록 실패:', err)
        );
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[Push] 알림 수신:', notification.request.content.title);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('[Push] 알림 탭:', data);
        // TODO: data.type에 따라 화면 이동 (MATCHING → 공고 상세)
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [isLoggedIn]);
}
