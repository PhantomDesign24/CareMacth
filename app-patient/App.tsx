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
  ScrollView,
  Switch,
  Linking,
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
  { key: 'mypage', label: '마이페이지', icon: 'person-outline', iconFocused: 'person', path: '' },
];

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

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
    if (!Device.isDevice) {
      console.log('Push: 에뮬레이터에서는 지원하지 않습니다.');
      return;
    }
    try {
      const { status } = await Notifications.getPermissionsAsync();
      let finalStatus = status;
      if (status !== 'granted') {
        const { status: s } = await Notifications.requestPermissionsAsync();
        finalStatus = s;
      }
      if (finalStatus !== 'granted') {
        console.log('Push: 알림 권한이 거부되었습니다.');
        return;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('carematch-default', {
          name: '케어매치 알림', importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250], sound: 'default',
        });
      }
      // FCM 네이티브 토큰 사용 (Firebase 직접 발송용)
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
      // 회원이면 유저에도 연결
      await patientApi?.registerFcmToken(fcmToken);
    } catch (e) { console.log('Push setup error:', e); }
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

  // 탭 클릭 → 웹뷰 URL 변경 (마이페이지는 네이티브)
  const handleTabPress = useCallback((tab: Tab) => {
    setActiveTab(tab.key);
    if (tab.key !== 'mypage' && tab.path && webViewRef.current) {
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
  const onMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'CALL') {
        // 전화 걸기
      }
      // 유저 정보 수신
      if (data.type === 'USER_INFO') {
        if (data.name) setUserName(data.name);
        if (data.email) setUserEmail(data.email);
      }
      // 로그인 시 FCM 토큰을 유저에 연결
      if (data.type === 'USER_LOGIN' && data.userId) {
        try {
          const tokenData = await Notifications.getDevicePushTokenAsync();
          await fetch(`https://${DOMAIN}/api/notifications/device-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenData.data, platform: Platform.OS, userId: data.userId }),
          });
          console.log('Push: 유저 FCM 토큰 연결 완료', data.userId);
        } catch (e) { console.log('Push: 유저 토큰 연결 실패', e); }
      }
      // 로그아웃 시 FCM 토큰에서 유저 연결 해제 + 유저 정보 초기화
      if (data.type === 'USER_LOGOUT') {
        setUserName('');
        setUserEmail('');
        try {
          const tokenData = await Notifications.getDevicePushTokenAsync();
          await fetch(`https://${DOMAIN}/api/notifications/device-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenData.data, platform: Platform.OS, userId: null }),
          });
          console.log('Push: 유저 FCM 토큰 연결 해제 완료');
        } catch (e) { console.log('Push: 유저 토큰 연결 해제 실패', e); }
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

    // 로그인 감지: localStorage에 토큰이 저장되면 앱에 userId 전달
    (function() {
      var origSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        origSetItem.apply(this, arguments);
        if (key === 'cm_access_token' && value) {
          try {
            var payload = JSON.parse(atob(value.split('.')[1]));
            if (payload.id && window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_LOGIN', userId: payload.id }));
            }
          } catch(e) {}
        }
      };
      // 로그아웃 감지: localStorage에서 토큰이 제거되면 앱에 전달
      var origRemoveItem = localStorage.removeItem;
      localStorage.removeItem = function(key) {
        origRemoveItem.apply(this, arguments);
        if (key === 'cm_access_token' && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_LOGOUT' }));
        }
      };

      // 이미 로그인된 상태면 바로 전달
      var existing = localStorage.getItem('cm_access_token');
      if (existing && window.ReactNativeWebView) {
        try {
          var p = JSON.parse(atob(existing.split('.')[1]));
          if (p.id) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_LOGIN', userId: p.id }));
          if (p.name || p.email) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_INFO', name: p.name || '', email: p.email || '' }));
        } catch(e) {}
      }
    })();

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

      {/* 마이페이지 (네이티브) */}
      {activeTab === 'mypage' ? (
        <ScrollView style={styles.mypageContainer}>
          {/* 프로필 */}
          <View style={styles.mypageProfile}>
            <View style={styles.mypageAvatar}>
              <Ionicons name="person" size={32} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mypageName}>{userName || '로그인이 필요합니다'}</Text>
              {userEmail ? <Text style={styles.mypageEmail}>{userEmail}</Text> : null}
            </View>
          </View>

          {/* 알림 설정 */}
          <View style={styles.mypageSection}>
            <Text style={styles.mypageSectionTitle}>알림 설정</Text>
            <View style={styles.mypageRow}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="notifications-outline" size={20} color="#FF922E" />
                <Text style={styles.mypageRowText}>푸시 알림</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={(val) => {
                  setPushEnabled(val);
                  if (!val) {
                    Alert.alert('알림 끄기', '앱 설정에서 알림을 비활성화할 수 있습니다.', [
                      { text: '취소', onPress: () => setPushEnabled(true) },
                      { text: '설정으로 이동', onPress: () => Linking.openSettings() },
                    ]);
                  }
                }}
                trackColor={{ false: '#ddd', true: '#FFD4A8' }}
                thumbColor={pushEnabled ? '#FF922E' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* 서비스 */}
          <View style={styles.mypageSection}>
            <Text style={styles.mypageSectionTitle}>서비스</Text>
            <TouchableOpacity style={styles.mypageRow} onPress={() => {
              setActiveTab('status');
              if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/dashboard/guardian'; true;");
            }}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="heart-outline" size={20} color="#FF922E" />
                <Text style={styles.mypageRowText}>내 간병 관리</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mypageRow} onPress={() => {
              setActiveTab('request');
              if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/care-request'; true;");
            }}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="add-circle-outline" size={20} color="#FF922E" />
                <Text style={styles.mypageRowText}>간병 요청하기</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
          </View>

          {/* 정보 */}
          <View style={styles.mypageSection}>
            <Text style={styles.mypageSectionTitle}>정보</Text>
            <TouchableOpacity style={styles.mypageRow} onPress={() => Linking.openURL(`https://${DOMAIN}/terms`)}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="document-text-outline" size={20} color="#999" />
                <Text style={styles.mypageRowText}>이용약관</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mypageRow} onPress={() => Linking.openURL(`https://${DOMAIN}/privacy`)}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#999" />
                <Text style={styles.mypageRowText}>개인정보처리방침</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mypageRow} onPress={() => Linking.openURL('tel:1588-0000')}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="call-outline" size={20} color="#999" />
                <Text style={styles.mypageRowText}>고객센터 (1588-0000)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
          </View>

          {/* 로그아웃 */}
          <TouchableOpacity
            style={styles.mypageLogout}
            onPress={() => {
              Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
                { text: '취소', style: 'cancel' },
                { text: '로그아웃', style: 'destructive', onPress: () => {
                  if (webViewRef.current) {
                    webViewRef.current.injectJavaScript("localStorage.removeItem('cm_access_token'); localStorage.removeItem('cm_refresh_token'); window.location.href = '/auth/login'; true;");
                  }
                  setActiveTab('home');
                }},
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
            <Text style={styles.mypageLogoutText}>로그아웃</Text>
          </TouchableOpacity>

          <Text style={styles.mypageVersion}>케어매치 v1.0.0</Text>
        </ScrollView>
      ) : (
        /* 웹뷰 */
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
      )}

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

  // 마이페이지
  mypageContainer: { flex: 1, backgroundColor: '#F5F6F8' },
  mypageProfile: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF922E',
    padding: 24, paddingTop: 16,
  },
  mypageAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  mypageName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  mypageEmail: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  mypageSection: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, overflow: 'hidden',
  },
  mypageSectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#999',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  mypageRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  mypageRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mypageRowText: { fontSize: 15, color: '#333', fontWeight: '500' },
  mypageLogout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 24, paddingVertical: 14,
    borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#FFE0E0',
  },
  mypageLogoutText: { fontSize: 15, color: '#E74C3C', fontWeight: '600' },
  mypageVersion: { textAlign: 'center', fontSize: 12, color: '#ccc', marginTop: 12, marginBottom: 32 },
});

registerRootComponent(App);
