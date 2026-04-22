/**
 * Expo Config Plugin: Android 전용 AppExit 네이티브 모듈 주입
 * - JS에서 NativeModules.AppExit.killApp() 호출 시
 *   Activity.finishAndRemoveTask() + Process.killProcess(myPid()) 실행
 * - BackHandler.exitApp()이 process를 남기는 문제 해결
 * - iOS는 영향 없음 (plugin 자체가 Android만 모디파이)
 */
const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PKG_PATH_TEMPLATE = (pkgName) => pkgName.replace(/\./g, '/');

const MODULE_JAVA = (pkg) => `package ${pkg};

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class AppExitModule extends ReactContextBaseJavaModule {
  AppExitModule(ReactApplicationContext context) { super(context); }

  @Override
  public String getName() { return "AppExit"; }

  @ReactMethod
  public void killApp() {
    final android.app.Activity activity = getCurrentActivity();
    if (activity != null) {
      activity.runOnUiThread(new Runnable() {
        @Override
        public void run() {
          activity.finishAndRemoveTask();
          android.os.Process.killProcess(android.os.Process.myPid());
          System.exit(0);
        }
      });
    } else {
      android.os.Process.killProcess(android.os.Process.myPid());
      System.exit(0);
    }
  }
}
`;

const PACKAGE_JAVA = (pkg) => `package ${pkg};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class AppExitPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new AppExitModule(reactContext));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`;

function withAndroidFinishAndRemoveTask(config) {
  // 1. Java 파일 생성 (dangerous mod — 파일 시스템 직접 수정)
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package || cfg.ios?.bundleIdentifier || 'com.anonymous.app';
      const javaDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        PKG_PATH_TEMPLATE(pkg),
      );
      if (!fs.existsSync(javaDir)) {
        fs.mkdirSync(javaDir, { recursive: true });
      }
      fs.writeFileSync(path.join(javaDir, 'AppExitModule.java'), MODULE_JAVA(pkg));
      fs.writeFileSync(path.join(javaDir, 'AppExitPackage.java'), PACKAGE_JAVA(pkg));
      return cfg;
    },
  ]);

  // 2. MainApplication 에 AppExitPackage() 등록
  config = withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    const isKotlin = cfg.modResults.language === 'kt';

    if (isKotlin) {
      // Kotlin: packages.add(AppExitPackage())
      if (!src.includes('AppExitPackage()')) {
        src = src.replace(
          /(packages\.addAll\(PackageList\(this\)\.packages\))/,
          `$1\n                        packages.add(AppExitPackage())`,
        );
      }
    } else {
      // Java: packages.add(new AppExitPackage());
      if (!src.includes('new AppExitPackage()')) {
        src = src.replace(
          /(packages\.add\(new MainReactPackage\(\)\);)/,
          `$1\n        packages.add(new AppExitPackage());`,
        );
        // fallback: PackageList 사용하는 최신 템플릿
        if (!src.includes('new AppExitPackage()')) {
          src = src.replace(
            /(return packages;)/,
            `packages.add(new AppExitPackage());\n        $1`,
          );
        }
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withAndroidFinishAndRemoveTask;
