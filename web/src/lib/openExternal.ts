/**
 * PDF·영수증처럼 새 창으로 열던 링크를 앱에서도 열리게 한다.
 *
 * 앱은 WebView 라 window.open 이 막히거나(간병인 앱: 핸들러 없음)
 * 같은 화면에서 PDF URL 로 이동해도 Android WebView 가 PDF 를 렌더링하지 못한다.
 *  → 앱 안에서는 네이티브로 넘겨 기기 브라우저/뷰어로 열게 하고,
 *    일반 브라우저에서는 기존처럼 새 탭으로 연다.
 */
export function isInApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /CareMatch-(Patient|Caregiver)/i.test(navigator.userAgent);
}

export function openExternal(url: string): void {
  if (typeof window === 'undefined') return;
  const abs = url.startsWith('http') ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
  if (isInApp() && rn) {
    rn.postMessage(JSON.stringify({ type: 'OPEN_EXTERNAL', url: abs }));
    return;
  }
  window.open(abs, '_blank');
}
