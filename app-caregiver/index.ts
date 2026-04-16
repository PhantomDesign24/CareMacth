import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent는 AppRegistry.registerComponent('main', () => App)와
// Expo Go 및 기본 네이티브 환경 모두에서 올바른 앱 엔트리 등록을 처리합니다.
registerRootComponent(App);
