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
  Linking,
  Modal,
  AppState,
  NativeModules,
} from 'react-native';

// Android 전용 네이티브 모듈: finishAndRemoveTask + Process.killProcess
// iOS는 NativeModules.AppExit가 undefined → fallback으로 BackHandler.exitApp() 사용
function killApp() {
  if (Platform.OS === 'android' && NativeModules.AppExit?.killApp) {
    NativeModules.AppExit.killApp();
  } else {
    BackHandler.exitApp();
  }
}
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
// 앱 종료: React Native 내장 BackHandler.exitApp()만 사용 (Android 전용, iOS는 원래 종료 불가)
import { APP_CONFIG } from './src/config';

const DOMAIN = APP_CONFIG.domain;
const WEB_URL = APP_CONFIG.webUrl;

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
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userToken, setUserToken] = useState('');
  const [paymentActive, setPaymentActive] = useState(false);

  // 디버그 로그 오버레이 (결제 흐름 추적용)
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [debugVisible, setDebugVisible] = useState(false);
  const addLog = useCallback((tag: string, msg: string) => {
    // 릴리즈 빌드에서는 디버그 로그 완전 비활성화 (성능·보안)
    if (!__DEV__) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const line = `${time} [${tag}] ${msg}`;
    // logcat에도 출력 (adb logcat -s ReactNativeJS:V로 확인 가능)
    console.log(`[DBG ${tag}]`, msg);
    setDebugLogs((prev) => {
      const next = [...prev, line];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

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

  // 알림 채널은 권한과 별개로 앱 시작 즉시 1회 등록 (Android)
  // — 앱 이름 라벨이 알림 상단에 정상 표시되려면 채널이 시스템에 먼저 만들어져 있어야 함
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    Notifications.setNotificationChannelAsync('carematch-default', {
      name: '케어매치 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    }).catch(() => {});
  }, []);

  // 푸시 알림 등록
  useEffect(() => {
    registerPushNotifications();
  }, []);

  // iOS 푸시는 Apple Developer Program ($99/년) + APNs Auth Key 있어야 실제 작동
  // 없이 getDevicePushTokenAsync() 호출하면 에러 → 유료 계정 전까지 iOS 비활성화
  const PUSH_ENABLED = Platform.OS === 'android';

  const registerPushNotifications = async () => {
    if (!PUSH_ENABLED) {
      console.log('Push: iOS는 Apple Developer 등록 전까지 비활성화됨');
      return;
    }
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
    } catch (e) { console.log('Push setup error:', e); }
  };

  // 푸시 탭 시 적용할 URL 을 잠깐 보관 (WebView 가 onLoadEnd 후 적용)
  const [pendingPushUrl, setPendingPushUrl] = useState<string | null>(null);

  const handlePushResponse = useCallback(async (data: any) => {
    if (!data) return;
    // 1) 알림 자동 읽음 처리 — 네이티브 fetch (cold start 에서도 안전)
    const notifId = data.notificationId ? String(data.notificationId).replace(/[^A-Za-z0-9_-]/g, '') : '';
    if (notifId) {
      // userToken 있으면 즉시 호출, 없으면 WebView localStorage 에서 시도 (둘 다 fallback)
      let token = userToken;
      if (!token && webViewRef.current) {
        // WebView 의 localStorage 에서 토큰 꺼내서 호출하도록 inject — token 이 미적재면 실패해도 무해
        webViewRef.current.injectJavaScript(
          `(function(){try{var t=localStorage.getItem('cm_access_token');if(t){fetch('https://${DOMAIN}/api/notifications/${notifId}/read',{method:'PUT',headers:{'Authorization':'Bearer '+t}});}}catch(e){}})();true;`
        );
      }
      if (token) {
        try {
          await fetch(`https://${DOMAIN}/api/notifications/${notifId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        } catch {}
      }
    }
    // 2) URL 이동 — WebView 준비됐으면 즉시, 아니면 onLoadEnd 까지 대기
    if (data.url) {
      const url = String(data.url);
      if (loading || !webViewRef.current) {
        setPendingPushUrl(url);
      } else {
        webViewRef.current.injectJavaScript(`window.location.href = '${url}'; true;`);
      }
    }
  }, [userToken, loading]);

  // 알림 수신 리스너 (앱 실행 중 도착)
  useEffect(() => {
    if (!Notifications) return;
    try {
      const sub1 = Notifications.addNotificationReceivedListener(() => {});
      const sub2 = Notifications.addNotificationResponseReceivedListener((response: any) => {
        handlePushResponse(response?.notification?.request?.content?.data);
      });
      return () => { sub1.remove(); sub2.remove(); };
    } catch {}
  }, [handlePushResponse]);

  // Cold start — 앱이 꺼진 상태에서 푸시로 깨어난 경우
  useEffect(() => {
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) handlePushResponse(last?.notification?.request?.content?.data);
      } catch {}
    })();
  }, [handlePushResponse]);

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
            { text: '종료', style: 'danger', onPress: () => {
              hideModal();
              killApp();
            }},
          ],
        });
        return true;
      });
      return () => handler.remove();
    }
  }, [canGoBack]);

  // 앱이 백그라운드 → 포그라운드 복귀 시 떠있던 모달 닫기
  // (종료 모달이 exitApp 후에도 메모리에 남아 재진입 시 보이는 문제 방지)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setModal((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    });
    return () => sub.remove();
  }, []);

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
    // 토스·카카오페이 등 결제 도메인일 때는 탭바 숨김 (이탈 방지)
    const paymentHosts = [
      'pay.toss.im', 'checkout.tosspayments.com', 'm.tosspayments.com',
      'event.tosspayments.com', 'pg.tosspayments.com', 'kpg.tosspayments.com',
      'tosspayments.com', 'toss.im',
      'qr.kakaopay.com', 'app.kakaopay.com', 'mobile-pay.kakaopay.com', 'kakaopay.com',
      'mobile.pay.naver.com', 'pay.naver.com',
      'nicepay.co.kr', 'payapp.kr', 'kcp.co.kr',
    ];
    const isPayment = paymentHosts.some((h) => url.includes(h));
    setPaymentActive(isPayment);

    if (isPayment) return; // 결제 중에는 탭 상태 업데이트 안 함
    if (url.includes('/care-request')) setActiveTab('request');
    else if (url.includes('/dashboard')) setActiveTab('status');
    else if (url.endsWith('/') || url.endsWith('.kr')) setActiveTab('home');
  };

  // 웹 → 앱 메시지
  const onMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      // 디버그 로그 수신 (WebView 내부 JS에서 보낸 네트워크/콘솔)
      if (data.type === 'DEBUG_LOG') {
        addLog(data.tag || 'WEB', String(data.msg || ''));
        return;
      }
      if (data.type === 'CALL') {
        // 전화 걸기
      }
      // 유저 정보 수신
      if (data.type === 'USER_INFO') {
        if (data.name) setUserName(data.name);
        if (data.email) setUserEmail(data.email);
        if (data.token) setUserToken(data.token);
      }
      // 로그인 시 FCM 토큰을 유저에 연결
      if (data.type === 'USER_LOGIN' && data.userId) {
        // 역할 체크: 보호자 앱은 GUARDIAN만 허용
        if (data.role && data.role !== 'GUARDIAN') {
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
          showModal({
            icon: 'alert-circle-outline',
            iconColor: '#E74C3C',
            title: '보호자 전용 앱',
            message: '이 앱은 보호자만 이용할 수 있습니다.\n간병인은 별도의 케어매치 간병인 앱을 설치해주세요.',
            buttons: [{ text: '확인', style: 'primary', onPress: () => {
              hideModal();
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(`window.location.href = '/auth/login'; true;`);
              }
            }}],
          });
          return;
        }
        if (PUSH_ENABLED) {
          try {
            const tokenData = await Notifications.getDevicePushTokenAsync();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
            await fetch(`https://${DOMAIN}/api/notifications/device-token`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ token: tokenData.data, platform: Platform.OS, userId: data.userId }),
            });
            console.log('Push: 유저 FCM 토큰 연결 완료', data.userId);
          } catch (e) { console.log('Push: 유저 토큰 연결 실패', e); }
        }
      }
      // 로그아웃 시 FCM 토큰에서 유저 연결 해제 + 유저 정보 초기화
      if (data.type === 'USER_LOGOUT') {
        setUserName('');
        setUserEmail('');
        if (PUSH_ENABLED) {
          try {
            const tokenData = await Notifications.getDevicePushTokenAsync();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
            await fetch(`https://${DOMAIN}/api/notifications/device-token`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ token: tokenData.data, platform: Platform.OS, userId: null }),
            });
            console.log('Push: 유저 FCM 토큰 연결 해제 완료');
          } catch (e) { console.log('Push: 유저 토큰 연결 해제 실패', e); }
        }
      }
    } catch {}
  };

  const injectedJS = `
    window.IS_CAREMATCH_APP = true;
    window.APP_TYPE = 'PATIENT';
    window.APP_PLATFORM = '${Platform.OS}';

    // 디버그: console.log, window.open, error 가로채서 앱으로 전달
    (function() {
      function sendDbg(tag, msg) {
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_LOG', tag: tag, msg: String(msg).slice(0, 200) }));
          }
        } catch(e) {}
      }
      var origLog = console.log;
      console.log = function() {
        try { sendDbg('LOG', Array.from(arguments).join(' ')); } catch(e) {}
        origLog.apply(console, arguments);
      };
      var origErr = console.error;
      console.error = function() {
        try { sendDbg('ERR', Array.from(arguments).join(' ')); } catch(e) {}
        origErr.apply(console, arguments);
      };
      var origOpen = window.open;
      window.open = function(url, name, features) {
        sendDbg('WIN_OPEN', url + ' | ' + (features||''));
        return origOpen.apply(window, arguments);
      };
      window.addEventListener('error', function(e) {
        sendDbg('PAGE_ERR', (e.message||'') + ' @ ' + (e.filename||'') + ':' + (e.lineno||''));
      });
      window.addEventListener('unhandledrejection', function(e) {
        sendDbg('REJECT', String(e.reason));
      });

      // fetch 가로채기 (요청/응답 모두 로깅)
      var origFetch = window.fetch;
      window.fetch = function() {
        var args = arguments;
        var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
        var method = (args[1] && args[1].method) || 'GET';
        sendDbg('FETCH_REQ', method + ' ' + url.slice(0, 120));
        return origFetch.apply(this, args).then(function(res) {
          var cloned = res.clone();
          cloned.text().then(function(txt) {
            sendDbg('FETCH_RES', res.status + ' ' + url.slice(0, 80) + ' | ' + txt.slice(0, 300));
          }).catch(function(){});
          return res;
        }).catch(function(err) {
          sendDbg('FETCH_ERR', url.slice(0, 80) + ' | ' + (err && err.message || ''));
          throw err;
        });
      };

      // XMLHttpRequest 가로채기
      var XHR = window.XMLHttpRequest;
      var origOpen2 = XHR.prototype.open;
      var origSend = XHR.prototype.send;
      XHR.prototype.open = function(method, url) {
        this.__dbg_method = method;
        this.__dbg_url = url;
        return origOpen2.apply(this, arguments);
      };
      XHR.prototype.send = function(body) {
        var self = this;
        sendDbg('XHR_REQ', (self.__dbg_method||'') + ' ' + (self.__dbg_url||'').slice(0, 120));
        self.addEventListener('load', function() {
          var resp = '';
          try { resp = self.responseText ? self.responseText.slice(0, 300) : ''; } catch(e){}
          sendDbg('XHR_RES', self.status + ' ' + (self.__dbg_url||'').slice(0, 80) + ' | ' + resp);
        });
        self.addEventListener('error', function() {
          sendDbg('XHR_ERR', (self.__dbg_url||'').slice(0, 80));
        });
        return origSend.apply(this, arguments);
      };
    })();

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
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_LOGIN', userId: p.id, role: p.role }));
            // 역할이 GUARDIAN이 아니면 guardian API 호출하지 않음 (403 방지)
            if (p.role !== 'GUARDIAN') return;
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
            <TouchableOpacity style={styles.mypageRow} onPress={() => Linking.openURL(`tel:${APP_CONFIG.phone}`)}>
              <View style={styles.mypageRowLeft}>
                <Ionicons name="call-outline" size={20} color="#999" />
                <Text style={styles.mypageRowText}>고객센터 ({APP_CONFIG.phone})</Text>
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
                  { text: '로그아웃', style: 'danger', onPress: () => {
                    hideModal();
                    setUserName('');
                    setUserEmail('');
                    setUserToken('');
                    setActiveTab('home');
                    setTimeout(() => {
                      if (webViewRef.current) {
                        webViewRef.current.injectJavaScript("localStorage.removeItem('cm_access_token'); localStorage.removeItem('cm_refresh_token'); window.location.href = '/auth/login'; true;");
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
          onShouldStartLoadWithRequest={(req) => {
            const url = req.url || '';
            addLog('NAV', url.length > 80 ? url.slice(0, 80) + '...' : url);
            // http(s)는 WebView 안에서 그대로 (토스 결제창도 WebView에서 열림)
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('about:')) {
              return true;
            }
            // Android intent:// URL → 스킴 파싱 → 앱 직접 호출
            if (url.startsWith('intent://')) {
              addLog('INTENT', url.slice(0, 100));
              // intent://HOST/PATH?QUERY#Intent;scheme=XX;package=YY;...;end
              const intentBody = url.substring('intent://'.length);
              const hashIdx = intentBody.indexOf('#Intent;');
              const pathPart = hashIdx >= 0 ? intentBody.substring(0, hashIdx) : intentBody;
              const paramsPart = hashIdx >= 0 ? intentBody.substring(hashIdx + '#Intent;'.length) : '';
              const params: Record<string, string> = {};
              paramsPart.split(';').forEach((p) => {
                const eq = p.indexOf('=');
                if (eq > 0) params[p.substring(0, eq)] = p.substring(eq + 1);
              });
              const scheme = params.scheme || '';
              const packageName = params.package || '';
              const fallback = params['S.browser_fallback_url'];
              const appUrl = scheme ? `${scheme}://${pathPart}` : '';
              addLog('INTENT_PARSE', `scheme=${scheme} pkg=${packageName}`);
              // 1순위: scheme://path 로 앱 직접 호출
              if (appUrl) {
                Linking.openURL(appUrl).catch(() => {
                  addLog('INTENT_APP_FAIL', appUrl.slice(0, 60));
                  // 2순위: 앱 미설치 → Play Store 열기
                  if (packageName) {
                    Linking.openURL(`market://details?id=${packageName}`).catch(() => {
                      // 3순위: fallback URL
                      if (fallback) {
                        try { Linking.openURL(decodeURIComponent(fallback)).catch(() => {}); } catch {}
                      }
                    });
                  } else if (fallback) {
                    try { Linking.openURL(decodeURIComponent(fallback)).catch(() => {}); } catch {}
                  }
                });
              } else if (fallback) {
                try { Linking.openURL(decodeURIComponent(fallback)).catch(() => {}); } catch {}
              }
              return false;
            }
            // app:// 스킴 (카카오페이 WebView 내부 닫기 신호) → 이전 페이지로
            if (url.startsWith('app://')) {
              addLog('APP_SCHEME', url);
              if (url.includes('/close') && webViewRef.current) {
                webViewRef.current.goBack();
              }
              return false;
            }
            // 카드/은행 앱 스킴은 외부 앱으로 위임 (복귀 시 토스 WebView로 자동 복귀)
            const appSchemes = [
              'market://', 'tmap://', 'iamporttoss://', 'supertoss://', 'kftc-bankpay://',
              'ispmobile://', 'mpocket.online.ansimclick://', 'kb-acp://',
              'mpocket.online.ansimclick.kftcbankpay://', 'hdcardappcardansimclick://',
              'smshinhanansimclick://', 'shinhan-sr-ansimclick://', 'smshinhan://',
              'smlotteapp://', 'lottesmartpay://', 'lotteappcard://', 'cloudpay://',
              'nhappcardansimclick://', 'nhappvardansimclick://', 'citispay://',
              'citicardappkr://', 'citimobileapp://', 'payco://', 'kakaotalk://',
              'kakaopay://', 'samsungpay://', 'mpocket.online.ansimclick.appcard://',
            ];
            if (appSchemes.some((s) => url.startsWith(s))) {
              addLog('SCHEME', url.slice(0, 80));
              Linking.openURL(url).catch((err) => addLog('SCHEME_FAIL', err?.message || 'unknown'));
              return false;
            }
            // 그 외 알 수 없는 스킴도 기본적으로 외부로
            if (!url.startsWith('http') && !url.startsWith('file:') && !url.startsWith('blob:')) {
              addLog('UNKNOWN_SCHEME', url.slice(0, 80));
              Linking.openURL(url).catch((err) => addLog('UNKNOWN_FAIL', err?.message || 'unknown'));
              return false;
            }
            return true;
          }}
          onNavigationStateChange={(navState) => {
            addLog('NAV_STATE', `${navState.loading ? 'LOAD' : 'DONE'} ${(navState.url || '').slice(0, 80)}`);
            onNavigationChange(navState);
          }}
          onLoadStart={(e) => addLog('LOAD_START', (e.nativeEvent?.url || '').slice(0, 80))}
          onLoadEnd={() => {
            addLog('LOAD_END', 'ok');
            setLoading(false);
            // 푸시 탭으로 cold-started 된 경우 보관해둔 URL 적용
            if (pendingPushUrl && webViewRef.current) {
              const u = pendingPushUrl;
              setPendingPushUrl(null);
              setTimeout(() => {
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript(`window.location.href = '${u}'; true;`);
                }
              }, 300);
            }
          }}
          onMessage={onMessage}
          injectedJavaScript={injectedJS}
          injectedJavaScriptBeforeContentLoaded={`window.IS_CAREMATCH_APP=true;window.APP_TYPE='PATIENT';true;`}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          sharedCookiesEnabled
          pullToRefreshEnabled
          geolocationEnabled
          thirdPartyCookiesEnabled
          javaScriptCanOpenWindowsAutomatically
          setSupportMultipleWindows={true}
          mixedContentMode="always"
          originWhitelist={['*']}
          onOpenWindow={(event) => {
            const { targetUrl } = event.nativeEvent || {};
            addLog('OPEN_WIN', targetUrl ? targetUrl.slice(0, 80) : '(no url)');
            if (!targetUrl) return;
            if (!targetUrl.startsWith('http')) {
              Linking.openURL(targetUrl).catch((err) => addLog('OPEN_WIN_FAIL', err?.message || 'err'));
              return;
            }
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(
                `window.location.href='${targetUrl.replace(/'/g, "\\'")}'; true;`
              );
            }
          }}
          onError={(e) => addLog('ERROR', e.nativeEvent?.description || 'error')}
          onHttpError={(e) => addLog('HTTP_ERR', `${e.nativeEvent?.statusCode} ${e.nativeEvent?.url?.slice(0, 60)}`)}
          userAgent={
            Platform.OS === 'android'
              ? 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 CareMatch-Patient/android'
              : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 CareMatch-Patient/ios'
          }
        />
      )}

      {/* 결제 진행 중 안내 배너 */}
      {paymentActive && (
        <View style={styles.paymentBanner}>
          <Ionicons name="lock-closed" size={14} color="#FF922E" />
          <Text style={styles.paymentBannerText}>결제 진행 중</Text>
          <TouchableOpacity
            onPress={() => {
              showModal({
                icon: 'alert-circle-outline',
                iconColor: '#E74C3C',
                title: '결제를 취소하시겠어요?',
                message: '결제를 중단하고 대시보드로 이동합니다.',
                buttons: [
                  { text: '계속 결제', style: 'cancel', onPress: hideModal },
                  {
                    text: '결제 취소',
                    style: 'danger',
                    onPress: () => {
                      hideModal();
                      setPaymentActive(false);
                      if (webViewRef.current) {
                        // 결제 중엔 WebView가 토스 도메인에 있으므로 절대 URL로 이동해야 함
                        webViewRef.current.injectJavaScript(`
                          window.location.href = '${WEB_URL}/dashboard/guardian?tab=history';
                          true;
                        `);
                      }
                    },
                  },
                ],
              });
            }}
            style={styles.paymentBannerCancel}
          >
            <Text style={styles.paymentBannerCancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 네이티브 하단 탭바 (결제 중 숨김) */}
      {!paymentActive && (
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
      )}

      {/* 디버그 로그 오버레이 토글 버튼 (개발 빌드에서만) */}
      {__DEV__ && (
        <TouchableOpacity
          style={styles.debugFab}
          onPress={() => setDebugVisible((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.debugFabText}>🐞{debugLogs.length}</Text>
        </TouchableOpacity>
      )}

      {/* 디버그 로그 오버레이 */}
      {__DEV__ && debugVisible && (
        <View style={styles.debugPanel}>
          <View style={styles.debugHeader}>
            <Text style={styles.debugHeaderText}>
              실시간 로그 ({debugLogs.length})
            </Text>
            <TouchableOpacity onPress={() => setDebugLogs([])} style={styles.debugBtn}>
              <Text style={styles.debugBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDebugVisible(false)} style={styles.debugBtn}>
              <Text style={styles.debugBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.debugList} ref={(r) => { if (r) r.scrollToEnd({ animated: false }); }}>
            {debugLogs.map((line, i) => (
              <Text key={i} style={styles.debugLine} selectable>{line}</Text>
            ))}
          </ScrollView>
        </View>
      )}

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

  // 디버그 오버레이
  debugFab: {
    position: 'absolute',
    top: 60,
    right: 10,
    width: 60,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  debugFabText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  debugPanel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.92)',
    zIndex: 9998,
    elevation: 9,
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    gap: 8,
  },
  debugHeaderText: { color: '#0f0', fontSize: 12, fontWeight: '700', flex: 1 },
  debugBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  debugBtnText: { color: '#fff', fontSize: 11 },
  debugList: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
  debugLine: { color: '#0f0', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 3 },

  // 결제 진행 중 배너
  paymentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    gap: 6,
  },
  paymentBannerText: {
    fontSize: 13,
    color: '#C2410C',
    fontWeight: '600',
    flex: 1,
    marginLeft: 4,
  },
  paymentBannerCancel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  paymentBannerCancelText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

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

