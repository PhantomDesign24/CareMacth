import { registerRootComponent } from 'expo';
import React, { useRef, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Platform,
  BackHandler,
  Alert,
  ActivityIndicator,
  View,
  Text,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
// import { caregiverApi } from './src/services/api';
const caregiverApi: any = null;

const DOMAIN = 'cm.phantomdesign.kr';
const WEB_URL = `https://${DOMAIN}/find-work`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  // 푸시 알림 등록
  useEffect(() => {
    registerPushNotifications();
  }, []);

  // 알림 수신 리스너
  useEffect(() => {
    const sub1 = Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('[Push] 알림 수신:', notification.request.content.title);
    });

    const sub2 = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.url && webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.location.href = '${data.url}'; true;`
        );
      }
    });

    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  const registerPushNotifications = async () => {
    if (!Device.isDevice) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      let finalStatus = status;
      if (status !== 'granted') {
        const { status: s } = await Notifications.requestPermissionsAsync();
        finalStatus = s;
      }
      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('carematch-default', {
          name: '케어매치 간병인 알림',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }

      // FCM 네이티브 토큰 사용
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const fcmToken = tokenData.data;
      console.log('FCM Token:', fcmToken);
      // 비회원도 디바이스 토큰 등록
      try {
        await fetch(`https://${DOMAIN}/api/notifications/device-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: fcmToken, platform: Platform.OS }),
        });
        console.log('Push: 디바이스 토큰 등록 완료');
      } catch (e) { console.log('Push: 디바이스 토큰 등록 실패', e); }
      await caregiverApi?.registerFcmToken(fcmToken);
    } catch (e) {
      console.log('Push setup error:', e);
    }
  };

  // Android 뒤로가기
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        Alert.alert('앱 종료', '케어매치를 종료하시겠습니까?', [
          { text: '취소', style: 'cancel' },
          { text: '종료', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      });
      return () => backHandler.remove();
    }
  }, [canGoBack]);

  const injectedJS = `
    window.IS_CAREMATCH_APP = true;
    window.APP_TYPE = 'CAREGIVER';
    window.APP_PLATFORM = '${Platform.OS}';

    // 앱에서는 웹 푸터만 숨기기 (헤더는 유지)
    var style = document.createElement('style');
    style.textContent = 'footer { display: none !important; }';
    document.head.appendChild(style);

    // 보호자 전용 메뉴 숨기기
    document.querySelectorAll('[href*="care-request"], [href*="guardian"]').forEach(function(el) {
      if(el.closest('nav')) el.style.display = 'none';
    });

    true;
  `;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#37CEB3" />
          <Text style={styles.loadingText}>케어매치 간병인</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
        onLoadEnd={() => setLoading(false)}
        injectedJavaScript={injectedJS}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsBackForwardNavigationGestures={true}
        allowsInlineMediaPlayback={true}
        sharedCookiesEnabled={true}
        pullToRefreshEnabled={true}
        geolocationEnabled={true}
        userAgent={`CareMatch-Caregiver/${Platform.OS}`}
      />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#37CEB3',
  },
});
