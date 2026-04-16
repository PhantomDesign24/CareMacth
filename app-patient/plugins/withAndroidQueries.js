/**
 * Expo Config Plugin: AndroidManifest에 <queries> 추가
 * Android 11+에서 다른 앱(카카오톡, 카카오페이 등) 호출을 위한 패키지 가시성 선언
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const PACKAGES = [
  'com.kakao.talk',          // 카카오톡
  'com.kakaopay.app',        // 카카오페이
  'viva.republica.toss',     // 토스
  'com.nhn.android.search',  // 네이버
  'com.nhnent.payapp',       // 네이버페이
  'com.samsung.android.spay', // 삼성페이
  'com.ispmobile.pay',       // ISP
  'kvp.jjy.MispAndroid320',  // 국민앱
  'com.kbstar.liivbank',     // 리브
  'com.shinhan.sbanking',    // 신한S뱅크
  'com.wooribank.pib.smart', // 우리WON뱅킹
];

const SCHEMES = [
  'kakaotalk', 'kakaopay', 'supertoss', 'payco',
  'ispmobile', 'kftc-bankpay', 'kb-acp', 'mpocket.online.ansimclick',
  'hdcardappcardansimclick', 'smshinhanansimclick', 'shinhan-sr-ansimclick',
  'smlotteapp', 'lottesmartpay', 'lotteappcard', 'cloudpay',
  'nhappcardansimclick', 'citispay', 'citicardappkr',
  'samsungpay', 'tmap',
];

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!manifest.queries) manifest.queries = [{}];
    const queries = manifest.queries[0];
    // package 태그
    queries.package = PACKAGES.map((p) => ({ $: { 'android:name': p } }));
    // intent (scheme) 태그
    queries.intent = SCHEMES.map((s) => ({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      data: [{ $: { 'android:scheme': s } }],
    }));
    return cfg;
  });
};
