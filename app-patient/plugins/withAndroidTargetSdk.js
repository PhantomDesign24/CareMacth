/**
 * Expo Config Plugin: Android target/compile SDK 강제 설정
 * Google Play 요구사항(2026-08-31까지 targetSdk 35+) 대응 — 36으로 고정.
 * prebuild 시 android/gradle.properties 에 기록되어 build.gradle 의
 * findProperty('android.targetSdkVersion') ?: '34' 폴백을 덮어씀.
 */
const { withGradleProperties } = require('@expo/config-plugins');

const PROPS = [
  { key: 'android.compileSdkVersion', value: '36' },
  { key: 'android.targetSdkVersion', value: '36' },
  { key: 'android.buildToolsVersion', value: '36.0.0' },
];

module.exports = function withAndroidTargetSdk(config) {
  return withGradleProperties(config, (cfg) => {
    for (const { key, value } of PROPS) {
      const existing = cfg.modResults.find(
        (item) => item.type === 'property' && item.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: 'property', key, value });
      }
    }
    return cfg;
  });
};
