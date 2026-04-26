import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Platform,
  BackHandler,
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Linking,
  Modal,
  NativeModules,
} from 'react-native';

// Android 전용 네이티브 모듈: finishAndRemoveTask + Process.killProcess
// 네이티브 모듈이 없거나 iOS 인 경우 BackHandler.exitApp() 으로 fallback
function killApp() {
  if (Platform.OS === 'android' && NativeModules.AppExit?.killApp) {
    NativeModules.AppExit.killApp();
    return;
  }
  // fallback: 안드로이드 BackHandler 또는 무동작 (iOS는 Apple 정책상 종료 API 없음)
  try {
    BackHandler.exitApp();
  } catch {
    // iOS: 종료 불가 — 사용자에게 홈 버튼 안내
  }
}
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { APP_CONFIG } from './src/config';

const DOMAIN = APP_CONFIG.domain;
const WEB_URL = `${APP_CONFIG.webUrl}/find-work`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type TabKey = 'work' | 'jobs' | 'mypage';

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
  iconFocused: string;
  path: string;
}

const TABS: Tab[] = [
  { key: 'jobs', label: '일감찾기', icon: 'search-outline', iconFocused: 'search', path: '/find-work' },
  { key: 'work', label: '내간병', icon: 'briefcase-outline', iconFocused: 'briefcase', path: '/dashboard/caregiver' },
  { key: 'mypage', label: '마이페이지', icon: 'person-outline', iconFocused: 'person', path: '' },
];

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('jobs');
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userToken, setUserToken] = useState('');
  const [biometricReady, setBiometricReady] = useState(false);
  const [showBiometricLogin, setShowBiometricLogin] = useState(false);
  const [pendingTokenInjection, setPendingTokenInjection] = useState<string | null>(null);

  // 커스텀 모달
  const [modal, setModal] = useState<{
    visible: boolean;
    icon?: string;
    iconColor?: string;
    title: string;
    message: string;
    buttons: { text: string; style?: 'primary' | 'danger' | 'cancel'; onPress?: () => void }[];
  }>({ visible: false, title: '', message: '', buttons: [] });

  const showModal = (config: Omit<typeof modal, 'visible'>) => setModal({ ...config, visible: true });
  const hideModal = () => setModal(prev => ({ ...prev, visible: false }));

  // 생체인증 저장 토큰 확인
  useEffect(() => {
    (async () => {
      try {
        const enabled = await SecureStore.getItemAsync('biometric_enabled');
        const savedToken = await SecureStore.getItemAsync('saved_token');
        if (enabled === 'true' && savedToken) {
          setBiometricEnabled(true);
          setShowBiometricLogin(true);
        }
      } catch {}
      setBiometricReady(true);
    })();
  }, []);

  // 생체인증 로그인 시도
  const tryBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: '생체인증으로 로그인',
        fallbackLabel: '비밀번호로 로그인',
        disableDeviceFallback: false,
      });
      if (result.success) {
        const savedToken = await SecureStore.getItemAsync('saved_token');
        if (savedToken) {
          // JWT 형식 검증 (XSS 방어)
          if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(savedToken)) {
            await SecureStore.deleteItemAsync('saved_token');
            return;
          }
          setUserToken(savedToken);
          setShowBiometricLogin(false);
          setPendingTokenInjection(savedToken);
        }
      }
    } catch {}
  };

  // 푸시 알림 등록
  useEffect(() => { registerPushNotifications(); }, []);

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

      const tokenData = await Notifications.getDevicePushTokenAsync();
      const fcmToken = tokenData.data;
      try {
        await fetch(`${APP_CONFIG.apiUrl}/notifications/device-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: fcmToken, platform: Platform.OS }),
        });
      } catch {}
    } catch {}
  };

  // 알림 수신 리스너
  useEffect(() => {
    const sub1 = Notifications.addNotificationReceivedListener(() => {});
    const sub2 = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.url && webViewRef.current) {
        webViewRef.current.injectJavaScript(`window.location.href = '${data.url}'; true;`);
      }
    });
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  // Android 뒤로가기
  useEffect(() => {
    if (Platform.OS === 'android') {
      const handler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        showModal({
          icon: 'exit-outline',
          iconColor: '#2ECC71',
          title: '앱 종료',
          message: '케어매치를 종료하시겠습니까?',
          buttons: [
            { text: '취소', style: 'cancel', onPress: hideModal },
            { text: '종료', style: 'danger', onPress: () => killApp() },
          ],
        });
        return true;
      });
      return () => handler.remove();
    }
  }, [canGoBack]);

  // 탭 클릭
  const handleTabPress = useCallback((tab: Tab) => {
    if (tab.key === 'mypage' && !userToken) {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript("window.location.href = '/auth/login'; true;");
      }
      setActiveTab('jobs');
      return;
    }
    setActiveTab(tab.key);
    if (tab.key !== 'mypage' && tab.path && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.location.href = '${tab.path}'; true;`);
    }
  }, [userToken]);

  // URL 변경 시 탭 동기화
  const onNavigationChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    const url = navState.url || '';
    if (url.includes('/find-work')) setActiveTab('jobs');
    else if (url.includes('/dashboard/caregiver')) setActiveTab('work');
  };

  // 웹 → 앱 메시지
  const onMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'USER_INFO') {
        if (data.name) setUserName(data.name);
        if (data.email) setUserEmail(data.email);
        if (data.token) {
          setUserToken(data.token);
          const bioEnabled = await SecureStore.getItemAsync('biometric_enabled');
          if (bioEnabled === 'true') {
            await SecureStore.setItemAsync('saved_token', data.token);
          }
        }
      }
      if (data.type === 'USER_LOGIN' && data.userId) {
        // 역할 체크: 간병인 앱은 CAREGIVER만 허용
        if (data.role && data.role !== 'CAREGIVER') {
          // 강제 로그아웃
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              localStorage.removeItem('cm_access_token');
              localStorage.removeItem('cm_refresh_token');
              true;
            `);
          }
          setUserName('');
          setUserEmail('');
          setUserToken('');
          await SecureStore.deleteItemAsync('saved_token').catch(() => {});
          await SecureStore.deleteItemAsync('biometric_enabled').catch(() => {});
          showModal({
            icon: 'alert-circle-outline',
            iconColor: '#E74C3C',
            title: '간병인 전용 앱',
            message: '이 앱은 간병인만 이용할 수 있습니다.\n보호자는 별도의 케어매치 앱을 설치해주세요.',
            buttons: [{ text: '확인', style: 'primary', onPress: () => {
              hideModal();
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(`window.location.href = '/auth/login'; true;`);
              }
            }}],
          });
          return;
        }
        try {
          const tokenData = await Notifications.getDevicePushTokenAsync();
          await fetch(`${APP_CONFIG.apiUrl}/notifications/device-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenData.data, platform: Platform.OS, userId: data.userId }),
          });
        } catch {}
      }
      if (data.type === 'USER_LOGOUT') {
        setUserName('');
        setUserEmail('');
        try {
          const tokenData = await Notifications.getDevicePushTokenAsync();
          await fetch(`${APP_CONFIG.apiUrl}/notifications/device-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenData.data, platform: Platform.OS, userId: null }),
          });
        } catch {}
      }
    } catch {}
  };

  const injectedJS = `
    window.IS_CAREMATCH_APP = true;
    window.APP_TYPE = 'CAREGIVER';
    window.APP_PLATFORM = '${Platform.OS}';

    // 하단 탭바 padding
    document.body.style.paddingBottom = '70px';

    var style = document.createElement('style');
    style.textContent = 'footer { display: none !important; }';
    document.head.appendChild(style);

    // 보호자 전용 메뉴 숨기기
    document.querySelectorAll('[href*="care-request"], [href*="dashboard/guardian"]').forEach(function(el) {
      if(el.closest('nav')) el.style.display = 'none';
    });

    (function() {
      var origSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        origSetItem.apply(this, arguments);
        if (key === 'cm_access_token' && value) sendUserInfo(value);
      };
      var origRemoveItem = localStorage.removeItem;
      localStorage.removeItem = function(key) {
        origRemoveItem.apply(this, arguments);
        if (key === 'cm_access_token' && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_LOGOUT' }));
        }
      };

      function sendUserInfo(token) {
        try {
          var p = JSON.parse(atob(token.split('.')[1]));
          if (p.id && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_LOGIN', userId: p.id, role: p.role }));
            // 역할이 CAREGIVER가 아니면 API 호출하지 않음 (403 방지)
            if (p.role !== 'CAREGIVER') return;
            fetch('/api/caregiver/profile', { headers: { 'Authorization': 'Bearer ' + token } })
              .then(function(r) { return r.json(); })
              .then(function(res) {
                var cg = (res.data) || {};
                var user = cg.user || {};
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'USER_INFO',
                  name: user.name || p.email || '',
                  email: user.email || p.email || '',
                  token: token,
                }));
              }).catch(function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_INFO', name: p.email || '', email: p.email || '', token: token }));
              });
          }
        } catch(e) {}
      }
      var existing = localStorage.getItem('cm_access_token');
      if (existing && window.ReactNativeWebView) sendUserInfo(existing);
    })();

    true;
  `;

  // 생체인증 로그인 화면
  if (showBiometricLogin && biometricReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.bioLoginScreen}>
          <StatusBar style="dark" />
          <View style={styles.bioLoginLogo}>
            <Ionicons name="briefcase" size={48} color="#2ECC71" />
          </View>
          <Text style={styles.bioLoginTitle}>케어매치 간병인</Text>
          <Text style={styles.bioLoginDesc}>생체인증으로 로그인하세요</Text>
          <TouchableOpacity style={styles.bioLoginButton} onPress={tryBiometricLogin}>
            <Ionicons name="finger-print" size={24} color="#fff" />
            <Text style={styles.bioLoginButtonText}>생체인증 로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bioLoginSkip} onPress={() => setShowBiometricLogin(false)}>
            <Text style={styles.bioLoginSkipText}>아이디/비밀번호로 로그인</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!biometricReady) {
    return (
      <View style={styles.bioLoginScreen}>
        <ActivityIndicator size="large" color="#2ECC71" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" backgroundColor="#ffffff" />

        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingLogo}>
              <Ionicons name="briefcase" size={48} color="#2ECC71" />
            </View>
            <Text style={styles.loadingTitle}>케어매치 간병인</Text>
            <Text style={styles.loadingDesc}>간병 일감 찾기</Text>
            <ActivityIndicator size="small" color="#2ECC71" style={{ marginTop: 20 }} />
          </View>
        )}

        {/* 마이페이지 (네이티브) */}
        {activeTab === 'mypage' ? (
          <ScrollView style={styles.mypageContainer}>
            <View style={styles.mypageProfile}>
              <View style={styles.mypageAvatar}>
                <Ionicons name="person" size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mypageName}>{userName || '로그인이 필요합니다'}</Text>
                {userEmail ? <Text style={styles.mypageEmail}>{userEmail}</Text> : null}
              </View>
            </View>

            {/* 설정 */}
            <View style={styles.mypageSection}>
              <Text style={styles.mypageSectionTitle}>설정</Text>
              <View style={styles.mypageRow}>
                <View style={styles.mypageRowLeft}>
                  <Ionicons name="notifications-outline" size={20} color="#2ECC71" />
                  <Text style={styles.mypageRowText}>푸시 알림</Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={async (val) => {
                    setPushEnabled(val);
                    if (userToken) {
                      try {
                        await fetch(`${APP_CONFIG.apiUrl}/notifications/push-setting`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                          body: JSON.stringify({ enabled: val }),
                        });
                      } catch {}
                    } else {
                      showModal({ icon: 'lock-closed-outline', iconColor: '#2ECC71', title: '로그인 필요', message: '푸시 설정을 변경하려면 로그인이 필요합니다.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] });
                      setPushEnabled(!val);
                    }
                  }}
                  trackColor={{ false: '#ddd', true: '#B6E9CA' }}
                  thumbColor={pushEnabled ? '#2ECC71' : '#f4f3f4'}
                />
              </View>
              <View style={styles.mypageRow}>
                <View style={styles.mypageRowLeft}>
                  <Ionicons name="finger-print" size={20} color="#2ECC71" />
                  <Text style={styles.mypageRowText}>생체인증 로그인</Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={async (val) => {
                    if (!userToken) {
                      showModal({ icon: 'lock-closed-outline', iconColor: '#2ECC71', title: '로그인 필요', message: '생체인증을 설정하려면 먼저 로그인해주세요.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] });
                      return;
                    }
                    if (val) {
                      try {
                        const compatible = await LocalAuthentication.hasHardwareAsync();
                        if (!compatible) { showModal({ icon: 'warning-outline', iconColor: '#F5A623', title: '지원 안 됨', message: '이 기기는 생체인증을 지원하지 않습니다.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] }); return; }
                        const enrolled = await LocalAuthentication.isEnrolledAsync();
                        if (!enrolled) { showModal({ icon: 'finger-print', iconColor: '#F5A623', title: '등록 필요', message: '기기 설정에서 지문 또는 Face ID를 등록해주세요.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] }); return; }
                        const result = await LocalAuthentication.authenticateAsync({ promptMessage: '생체인증을 등록합니다' });
                        if (result.success) {
                          await SecureStore.setItemAsync('biometric_enabled', 'true');
                          await SecureStore.setItemAsync('saved_token', userToken);
                          setBiometricEnabled(true);
                          showModal({ icon: 'checkmark-circle', iconColor: '#2ECC71', title: '설정 완료', message: '다음부터 생체인증으로 바로 로그인됩니다.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] });
                        }
                      } catch { showModal({ icon: 'close-circle', iconColor: '#E74C3C', title: '오류', message: '생체인증 설정에 실패했습니다.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] }); }
                    } else {
                      await SecureStore.deleteItemAsync('biometric_enabled');
                      await SecureStore.deleteItemAsync('saved_token');
                      setBiometricEnabled(false);
                      showModal({ icon: 'finger-print', iconColor: '#999', title: '비활성화', message: '생체인증이 비활성화되었습니다.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] });
                    }
                  }}
                  trackColor={{ false: '#ddd', true: '#B6E9CA' }}
                  thumbColor={biometricEnabled ? '#2ECC71' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* 서비스 */}
            <View style={styles.mypageSection}>
              <Text style={styles.mypageSectionTitle}>서비스</Text>
              <TouchableOpacity style={styles.mypageRow} onPress={() => {
                setActiveTab('work');
                setTimeout(() => { if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/dashboard/caregiver'; true;"); }, 100);
              }}>
                <View style={styles.mypageRowLeft}>
                  <Ionicons name="briefcase-outline" size={20} color="#2ECC71" />
                  <Text style={styles.mypageRowText}>내 간병 관리</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.mypageRow} onPress={() => {
                setActiveTab('jobs');
                setTimeout(() => { if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/find-work'; true;"); }, 100);
              }}>
                <View style={styles.mypageRowLeft}>
                  <Ionicons name="search-outline" size={20} color="#2ECC71" />
                  <Text style={styles.mypageRowText}>일감 찾기</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.mypageRow} onPress={() => {
                setActiveTab('work');
                setTimeout(() => { if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/dashboard/caregiver/documents'; true;"); }, 100);
              }}>
                <View style={styles.mypageRowLeft}>
                  <Ionicons name="document-text-outline" size={20} color="#2ECC71" />
                  <Text style={styles.mypageRowText}>서류 관리</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
            </View>

            {/* 정보 */}
            <View style={styles.mypageSection}>
              <Text style={styles.mypageSectionTitle}>정보</Text>
              <TouchableOpacity style={styles.mypageRow} onPress={() => {
                setActiveTab('jobs');
                setTimeout(() => { if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/terms'; true;"); }, 100);
              }}>
                <View style={styles.mypageRowLeft}>
                  <Ionicons name="document-text-outline" size={20} color="#999" />
                  <Text style={styles.mypageRowText}>이용약관</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.mypageRow} onPress={() => {
                setActiveTab('jobs');
                setTimeout(() => { if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/privacy'; true;"); }, 100);
              }}>
                <View style={styles.mypageRowLeft}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#999" />
                  <Text style={styles.mypageRowText}>개인정보처리방침</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.mypageRow} onPress={() => Linking.openURL(`tel:${APP_CONFIG.phone}`)}>
                <View style={styles.mypageRowLeft}>
                  <Ionicons name="call-outline" size={20} color="#999" />
                  <Text style={styles.mypageRowText}>고객센터 ({APP_CONFIG.phone})</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
            </View>

            {/* 로그아웃 */}
            <TouchableOpacity style={styles.mypageLogout} onPress={() => {
              showModal({
                icon: 'log-out-outline', iconColor: '#E74C3C', title: '로그아웃', message: '로그아웃 하시겠습니까?',
                buttons: [
                  { text: '취소', style: 'cancel', onPress: hideModal },
                  { text: '로그아웃', style: 'danger', onPress: async () => {
                    hideModal();
                    setUserName(''); setUserEmail(''); setUserToken('');
                    setActiveTab('jobs');
                    const bioEnabled = await SecureStore.getItemAsync('biometric_enabled');
                    const savedToken = await SecureStore.getItemAsync('saved_token');
                    setTimeout(() => {
                      if (webViewRef.current) {
                        webViewRef.current.injectJavaScript("localStorage.removeItem('cm_access_token'); localStorage.removeItem('cm_refresh_token'); window.location.href = '/auth/login'; true;");
                      }
                      if (bioEnabled === 'true' && savedToken) setShowBiometricLogin(true);
                    }, 200);
                  }},
                ],
              });
            }}>
              <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
              <Text style={styles.mypageLogoutText}>로그아웃</Text>
            </TouchableOpacity>

            <Text style={styles.mypageVersion}>케어매치 간병인 v1.0.0</Text>
          </ScrollView>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: WEB_URL }}
            style={styles.webview}
            onNavigationStateChange={onNavigationChange}
            onLoadEnd={() => {
              setLoading(false);
              if (pendingTokenInjection && webViewRef.current) {
                webViewRef.current.injectJavaScript(`
                  localStorage.setItem('cm_access_token', '${pendingTokenInjection}');
                  window.location.href = '/dashboard/caregiver';
                  true;
                `);
                setPendingTokenInjection(null);
              }
            }}
            onMessage={onMessage}
            injectedJavaScript={injectedJS}
            javaScriptEnabled
            domStorageEnabled
            allowsBackForwardNavigationGestures
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            sharedCookiesEnabled
            pullToRefreshEnabled
            geolocationEnabled
            userAgent={`CareMatch-Caregiver/${Platform.OS}`}
          />
        )}

        {/* 하단 탭바 */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const focused = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => handleTabPress(tab)} activeOpacity={0.7}>
                <Ionicons
                  name={(focused ? tab.iconFocused : tab.icon) as any}
                  size={22}
                  color={focused ? '#2ECC71' : '#999'}
                />
                <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 커스텀 모달 */}
        <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={hideModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              {modal.icon && (
                <View style={[styles.modalIconWrap, { backgroundColor: (modal.iconColor || '#2ECC71') + '15' }]}>
                  <Ionicons name={modal.icon as any} size={32} color={modal.iconColor || '#2ECC71'} />
                </View>
              )}
              <Text style={styles.modalTitle}>{modal.title}</Text>
              <Text style={styles.modalMessage}>{modal.message}</Text>
              <View style={styles.modalButtons}>
                {modal.buttons.map((btn, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.modalButton,
                      btn.style === 'primary' && styles.modalButtonPrimary,
                      btn.style === 'danger' && styles.modalButtonDanger,
                      btn.style === 'cancel' && styles.modalButtonCancel,
                      modal.buttons.length === 1 && { flex: 1 },
                    ]}
                    onPress={btn.onPress || hideModal}
                  >
                    <Text style={[
                      styles.modalButtonText,
                      btn.style === 'primary' && { color: '#fff' },
                      btn.style === 'danger' && { color: '#fff' },
                      btn.style === 'cancel' && { color: '#666' },
                    ]}>{btn.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', zIndex: 10,
  },
  loadingLogo: {
    width: 80, height: 80, borderRadius: 20, backgroundColor: '#E6F9EE',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  loadingTitle: { fontSize: 24, fontWeight: 'bold', color: '#2ECC71' },
  loadingDesc: { fontSize: 14, color: '#999', marginTop: 4 },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8, paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, color: '#999', marginTop: 2, fontWeight: '500' },
  tabLabelActive: { color: '#2ECC71', fontWeight: '700' },

  bioLoginScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 40,
  },
  bioLoginLogo: {
    width: 80, height: 80, borderRadius: 20, backgroundColor: '#E6F9EE',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  bioLoginTitle: { fontSize: 24, fontWeight: 'bold', color: '#2ECC71' },
  bioLoginDesc: { fontSize: 14, color: '#999', marginTop: 8 },
  bioLoginButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 40, backgroundColor: '#2ECC71',
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12,
  },
  bioLoginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bioLoginSkip: { marginTop: 20 },
  bioLoginSkipText: { color: '#999', fontSize: 14 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28,
    width: '100%', maxWidth: 320, alignItems: 'center',
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  modalMessage: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  modalButton: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalButtonPrimary: { backgroundColor: '#2ECC71' },
  modalButtonDanger: { backgroundColor: '#E74C3C' },
  modalButtonCancel: { backgroundColor: '#F5F5F5' },
  modalButtonText: { fontSize: 15, fontWeight: '600' },

  mypageContainer: { flex: 1, backgroundColor: '#F5F6F8' },
  mypageProfile: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2ECC71',
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

