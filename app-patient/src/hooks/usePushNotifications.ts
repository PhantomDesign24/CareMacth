import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { patientApi } from '../services/api';

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

  // 권한 확인
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

  // Android 채널 설정
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('carematch-default', {
      name: '케어매치 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  // FCM 토큰 가져오기
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'carematch-fc707',
  });

  return tokenData.data;
}

export function usePushNotifications(isLoggedIn: boolean) {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    if (!isLoggedIn) return;

    // 토큰 등록
    registerForPushNotifications().then((token) => {
      if (token) {
        patientApi.registerFcmToken(token).catch((err) =>
          console.error('[Push] FCM 토큰 등록 실패:', err)
        );
      }
    });

    // 알림 수신 리스너
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[Push] 알림 수신:', notification.request.content.title);
      }
    );

    // 알림 탭 리스너
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('[Push] 알림 탭:', data);
        // TODO: data.type에 따라 화면 이동 처리
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
