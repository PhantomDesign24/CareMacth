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
  Modal,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

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
  const [pushEnabled, setPushEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userToken, setUserToken] = useState('');
  const [biometricReady, setBiometricReady] = useState(false);
  const [showBiometricLogin, setShowBiometricLogin] = useState(false);

  // 커스텀 모달 상태
  const [modal, setModal] = useState<{
    visible: boolean;
    icon?: string;
    iconColor?: string;
    title: string;
    message: string;
    buttons: { text: string; style?: 'primary' | 'danger' | 'cancel'; onPress?: () => void }[];
  }>({ visible: false, title: '', message: '', buttons: [] });

  const showModal = (config: Omit<typeof modal, 'visible'>) => {
    setModal({ ...config, visible: true });
  };
  const hideModal = () => setModal(prev => ({ ...prev, visible: false }));

  // 앱 시작 시 저장된 생체인증 토큰 확인
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
          setUserToken(savedToken);
          setShowBiometricLogin(false);
          // WebView에 토큰 주입
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                localStorage.setItem('cm_access_token', '${savedToken}');
                window.location.href = '/dashboard/guardian';
                true;
              `);
            }
          }, 300);
        }
      }
    } catch {}
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
      // 유저 연결은 WebView 로그인 시 onMessage에서 처리
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
        showModal({
          icon: 'exit-outline',
          iconColor: '#FF922E',
          title: '앱 종료',
          message: '케어매치를 종료하시겠습니까?',
          buttons: [
            { text: '취소', style: 'cancel', onPress: hideModal },
            { text: '종료', style: 'danger', onPress: () => BackHandler.exitApp() },
          ],
        });
        return true;
      });
      return () => handler.remove();
    }
  }, [canGoBack]);

  // 탭 클릭 → 웹뷰 URL 변경 (마이페이지는 네이티브)
  const handleTabPress = useCallback((tab: Tab) => {
    if (tab.key === 'mypage' && !userToken) {
      // 비로그인 시 로그인 페이지로 이동
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript("window.location.href = '/auth/login'; true;");
      }
      setActiveTab('home');
      return;
    }
    setActiveTab(tab.key);
    if (tab.key !== 'mypage' && tab.path && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.location.href = '${tab.path}'; true;`
      );
    }
  }, [userToken]);

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
        if (data.token) {
          setUserToken(data.token);
          // 생체인증 활성화 상태면 토큰 저장
          const bioEnabled = await SecureStore.getItemAsync('biometric_enabled');
          if (bioEnabled === 'true') {
            await SecureStore.setItemAsync('saved_token', data.token);
          }
        }
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
          sendUserInfo(value);
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

      // 로그인 시 유저 정보도 가져오기
      function sendUserInfo(token) {
        try {
          var p = JSON.parse(atob(token.split('.')[1]));
          if (p.id && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_LOGIN', userId: p.id }));
            // API로 이름 가져오기
            fetch('/api/guardian', { headers: { 'Authorization': 'Bearer ' + token } })
              .then(function(r) { return r.json(); })
              .then(function(res) {
                var user = (res.data && res.data.user) || {};
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'USER_INFO',
                  name: user.name || p.email || '',
                  email: p.email || '',
                  token: token,
                }));
              }).catch(function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_INFO', name: p.email || '', email: p.email || '', token: token }));
              });
          }
        } catch(e) {}
      }
      // 이미 로그인된 상태면 바로 전달
      var existing = localStorage.getItem('cm_access_token');
      if (existing && window.ReactNativeWebView) {
        sendUserInfo(existing);
      }
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
          <Ionicons name="heart" size={48} color="#FF922E" />
        </View>
        <Text style={styles.bioLoginTitle}>케어매치</Text>
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

  // 생체인증 확인 중
  if (!biometricReady) {
    return (
      <View style={styles.bioLoginScreen}>
        <ActivityIndicator size="large" color="#FF922E" />
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

          {/* 설정 */}
          <View style={styles.mypageSection}>
            <Text style={styles.mypageSectionTitle}>설정</Text>
            <View style={styles.mypageRow}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="notifications-outline" size={20} color="#FF922E" />
                <Text style={styles.mypageRowText}>푸시 알림</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={async (val) => {
                  setPushEnabled(val);
                  if (userToken) {
                    try {
                      await fetch(`https://${DOMAIN}/api/notifications/push-setting`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                        body: JSON.stringify({ enabled: val }),
                      });
                    } catch {}
                  } else {
                    showModal({ icon: 'lock-closed-outline', iconColor: '#FF922E', title: '로그인 필요', message: '푸시 설정을 변경하려면 로그인이 필요합니다.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] });
                    setPushEnabled(!val);
                  }
                }}
                trackColor={{ false: '#ddd', true: '#FFD4A8' }}
                thumbColor={pushEnabled ? '#FF922E' : '#f4f3f4'}
              />
            </View>
            <View style={styles.mypageRow}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="finger-print" size={20} color="#FF922E" />
                <Text style={styles.mypageRowText}>생체인증 로그인</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={async (val) => {
                  if (!userToken) {
                    showModal({ icon: 'lock-closed-outline', iconColor: '#FF922E', title: '로그인 필요', message: '생체인증을 설정하려면 먼저 로그인해주세요.', buttons: [{ text: '확인', style: 'primary', onPress: hideModal }] });
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
                trackColor={{ false: '#ddd', true: '#FFD4A8' }}
                thumbColor={biometricEnabled ? '#FF922E' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* 서비스 */}
          <View style={styles.mypageSection}>
            <Text style={styles.mypageSectionTitle}>서비스</Text>
            <TouchableOpacity style={styles.mypageRow} onPress={() => {
              setActiveTab('status');
              setTimeout(() => {
                if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/dashboard/guardian'; true;");
              }, 100);
            }}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="heart-outline" size={20} color="#FF922E" />
                <Text style={styles.mypageRowText}>내 간병 관리</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mypageRow} onPress={() => {
              setActiveTab('request');
              setTimeout(() => {
                if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/care-request'; true;");
              }, 100);
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
            <TouchableOpacity style={styles.mypageRow} onPress={() => {
              setActiveTab('home');
              setTimeout(() => {
                if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/terms'; true;");
              }, 100);
            }}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="document-text-outline" size={20} color="#999" />
                <Text style={styles.mypageRowText}>이용약관</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mypageRow} onPress={() => {
              setActiveTab('home');
              setTimeout(() => {
                if (webViewRef.current) webViewRef.current.injectJavaScript("window.location.href = '/privacy'; true;");
              }, 100);
            }}>
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
              showModal({
                icon: 'log-out-outline',
                iconColor: '#E74C3C',
                title: '로그아웃',
                message: '로그아웃 하시겠습니까?',
                buttons: [
                  { text: '취소', style: 'cancel', onPress: hideModal },
                  { text: '로그아웃', style: 'danger', onPress: async () => {
                    hideModal();
                    setUserName('');
                    setUserEmail('');
                    setUserToken('');
                    setActiveTab('home');
                    // 생체인증 설정되어 있으면 로그아웃 후 생체인증 화면 표시
                    const bioEnabled = await SecureStore.getItemAsync('biometric_enabled');
                    const savedToken = await SecureStore.getItemAsync('saved_token');
                    setTimeout(() => {
                      if (webViewRef.current) {
                        webViewRef.current.injectJavaScript("localStorage.removeItem('cm_access_token'); localStorage.removeItem('cm_refresh_token'); window.location.href = '/auth/login'; true;");
                      }
                      if (bioEnabled === 'true' && savedToken) {
                        setShowBiometricLogin(true);
                      }
                    }, 200);
                  }},
                ],
              });
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
          mediaPlaybackRequiresUserAction={false}
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

      {/* 커스텀 모달 */}
      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={hideModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {modal.icon && (
              <View style={[styles.modalIconWrap, { backgroundColor: (modal.iconColor || '#FF922E') + '15' }]}>
                <Ionicons name={modal.icon as any} size={32} color={modal.iconColor || '#FF922E'} />
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
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
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

  // 생체인증 로그인
  bioLoginScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff', padding: 40,
  },
  bioLoginLogo: {
    width: 80, height: 80, borderRadius: 20, backgroundColor: '#FFF5EB',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  bioLoginTitle: { fontSize: 24, fontWeight: 'bold', color: '#FF922E' },
  bioLoginDesc: { fontSize: 14, color: '#999', marginTop: 8 },
  bioLoginButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 40, backgroundColor: '#FF922E',
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12,
  },
  bioLoginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bioLoginSkip: { marginTop: 20 },
  bioLoginSkipText: { color: '#999', fontSize: 14 },

  // 커스텀 모달
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
  modalButtonPrimary: { backgroundColor: '#FF922E' },
  modalButtonDanger: { backgroundColor: '#E74C3C' },
  modalButtonCancel: { backgroundColor: '#F5F5F5' },
  modalButtonText: { fontSize: 15, fontWeight: '600' },

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
