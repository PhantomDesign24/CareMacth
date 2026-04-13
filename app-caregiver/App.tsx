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

// Expo Go 호환
const Notifications: any = null;
const Device: any = null;
const caregiverApi: any = null;

const DOMAIN = 'cm.phantomdesign.kr';
const WEB_URL = `https://${DOMAIN}/find-work`;

// 포그라운드 알림 표시 설정 (Expo Go에서는 건너뜀)
try {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {}

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
    if (!Notifications) return;
    try {
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
    } catch {}
  }, []);

  const registerPushNotifications = async () => {
    if (!Notifications || !Device?.isDevice) return;
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

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'carematch-fc707',
      });
      console.log('Push token:', tokenData.data);
      await caregiverApi?.registerFcmToken(tokenData.data);
    } catch (e) {
      console.log('Push setup skipped:', e);
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

    // 앱에서는 웹 헤더/푸터 숨기기
    var style = document.createElement('style');
    style.textContent = 'header { display: none !important; } footer { display: none !important; }';
    document.head.appendChild(style);

    // 보호자 전용 메뉴 숨기기
    document.querySelectorAll('[href*="care-request"], [href*="guardian"]').forEach(function(el) {
      if(el.closest('nav')) el.style.display = 'none';
    });

    true;
  `;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
