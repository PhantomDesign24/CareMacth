import { registerRootComponent } from 'expo';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Platform,
  BackHandler,
  Alert,
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
// import { patientApi } from './src/services/api';
const patientApi: any = null;

const DOMAIN = 'cm.phantomdesign.kr';
const WEB_URL = `https://${DOMAIN}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type TabKey = 'home' | 'request' | 'status' | 'mypage';

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
  iconFocused: string;
  path: string;
}

const TABS: Tab[] = [
  { key: 'home', label: '홈', icon: 'home-outline', iconFocused: 'home', path: '/' },
  { key: 'request', label: '간병요청', icon: 'add-circle-outline', iconFocused: 'add-circle', path: '/care-request' },
  { key: 'status', label: '내간병', icon: 'heart-outline', iconFocused: 'heart', path: '/dashboard/guardian' },
  { key: 'mypage', label: '마이페이지', icon: 'person-outline', iconFocused: 'person', path: '/dashboard/guardian' },
];

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);

  // 생체 인증
  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    if (!LocalAuthentication) {
      setAuthenticated(true);
      setBiometricChecked(true);
      return;
    }
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) { setAuthenticated(true); setBiometricChecked(true); return; }
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) { setAuthenticated(true); setBiometricChecked(true); return; }
      const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const useFaceID = biometricTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: useFaceID ? 'Face ID로 케어매치에 로그인합니다' : '지문으로 케어매치에 로그인합니다',
        fallbackLabel: '비밀번호로 로그인',
        disableDeviceFallback: false,
      });
      setAuthenticated(result.success);
    } catch { setAuthenticated(true); }
    setBiometricChecked(true);
  };

  // 푸시 알림 등록
  useEffect(() => {
    registerPushNotifications();
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
          name: '케어매치 알림', importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250], sound: 'default',
        });
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: 'carematch-fc707' });
      await patientApi?.registerFcmToken(tokenData.data);
    } catch (e) { console.log('Push setup skipped:', e); }
  };

  // 알림 수신 리스너
  useEffect(() => {
    if (!Notifications) return;
    try {
      const sub1 = Notifications.addNotificationReceivedListener(() => {});
      const sub2 = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.url && webViewRef.current) {
          webViewRef.current.injectJavaScript(`window.location.href = '${data.url}'; true;`);
        }
      });
      return () => { sub1.remove(); sub2.remove(); };
    } catch {}
  }, []);

  // Android 뒤로가기
  useEffect(() => {
    if (Platform.OS === 'android') {
      const handler = BackHandler.addEventListener('hardwareBackPress', () => {
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
      return () => handler.remove();
    }
  }, [canGoBack]);

  // 탭 클릭 → 웹뷰 URL 변경
  const handleTabPress = useCallback((tab: Tab) => {
    setActiveTab(tab.key);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.location.href = '${tab.path}'; true;`
      );
    }
  }, []);

  // 웹뷰 URL 변경 시 탭 상태 동기화
  const onNavigationChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    const url = navState.url || '';
    if (url.includes('/care-request')) setActiveTab('request');
    else if (url.includes('/dashboard')) setActiveTab('status');
    else if (url.endsWith('/') || url.endsWith('.kr')) setActiveTab('home');
  };

  // 웹 → 앱 메시지
  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'CALL') {
        // 전화 걸기
      }
    } catch {}
  };

  const injectedJS = `
    window.IS_CAREMATCH_APP = true;
    window.APP_TYPE = 'PATIENT';
    window.APP_PLATFORM = '${Platform.OS}';

    // 하단 탭바 높이만큼 웹 padding 추가
    document.body.style.paddingBottom = '70px';

    // 앱에서는 웹 푸터만 숨기기 (네이티브 탭바 사용, 헤더는 유지)
    var style = document.createElement('style');
    style.textContent = 'footer { display: none !important; }';
    document.head.appendChild(style);

    // 간병인 전용 메뉴 숨기기
    document.querySelectorAll('[href*="find-work"], [href*="caregiver"]').forEach(function(el) {
      if(el.closest('nav')) el.style.display = 'none';
    });

    true;
  `;

  // 생체인증 대기 화면
  if (!biometricChecked) {
    return (
      <View style={styles.authScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#FF922E" />
      </View>
    );
  }

  // 생체인증 실패 화면
  if (!authenticated) {
    return (
      <View style={styles.authScreen}>
        <StatusBar style="dark" />
        <Ionicons name="finger-print" size={64} color="#FF922E" />
        <Text style={styles.authTitle}>인증이 필요합니다</Text>
        <Text style={styles.authDesc}>생체 인증으로 안전하게 로그인하세요</Text>
        <TouchableOpacity style={styles.authButton} onPress={checkBiometric}>
          <Text style={styles.authButtonText}>다시 시도</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.authSkip}
          onPress={() => setAuthenticated(true)}
        >
          <Text style={styles.authSkipText}>비밀번호로 로그인</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#ffffff" />

      {/* 로딩 오버레이 */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingLogo}>
            <Ionicons name="heart" size={48} color="#FF922E" />
          </View>
          <Text style={styles.loadingTitle}>케어매치</Text>
          <Text style={styles.loadingDesc}>간병 매칭 서비스</Text>
          <ActivityIndicator size="small" color="#FF922E" style={{ marginTop: 20 }} />
        </View>
      )}

      {/* 웹뷰 */}
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onNavigationStateChange={onNavigationChange}
        onLoadEnd={() => setLoading(false)}
        onMessage={onMessage}
        injectedJavaScript={injectedJS}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        sharedCookiesEnabled
        pullToRefreshEnabled
        geolocationEnabled
        userAgent={`CareMatch-Patient/${Platform.OS}`}
      />

      {/* 네이티브 하단 탭바 */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const focused = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(focused ? tab.iconFocused : tab.icon) as any}
                size={22}
                color={focused ? '#FF922E' : '#999'}
              />
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },

  // 로딩
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  loadingLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FFF5EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingTitle: { fontSize: 24, fontWeight: 'bold', color: '#FF922E' },
  loadingDesc: { fontSize: 14, color: '#999', marginTop: 4 },

  // 탭바
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#FF922E',
    fontWeight: '700',
  },

  // 생체인증
  authScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 40,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  authDesc: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  authButton: {
    marginTop: 30,
    backgroundColor: '#FF922E',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  authSkip: { marginTop: 16 },
  authSkipText: { color: '#999', fontSize: 14 },
});

registerRootComponent(App);
