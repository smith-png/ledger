export interface AndroidApkConfigMetadata {
  appName: string;
  shortName: string;
  packageId: string;
  versionName: string;
  versionCode: number;
  hostUrl: string;
  themeColor: string;
  backgroundColor: string;
  startUrl: string;
  iconUrl: string;
  maskableIconUrl: string;
}

export const DEFAULT_ANDROID_APK_METADATA: AndroidApkConfigMetadata = {
  appName: 'ArthaLedger — BOI Statement & UPI Analyzer',
  shortName: 'ArthaLedger',
  packageId: 'com.arthaledger.boianalyzer',
  versionName: '1.2.0',
  versionCode: 12,
  hostUrl:
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-svjaydfcd433bqpwvr75y2-967070040423.asia-east1.run.app',
  themeColor: '#0B192C',
  backgroundColor: '#F8FAFC',
  startUrl: '/',
  iconUrl: '/pwa-512x512.png',
  maskableIconUrl: '/pwa-maskable-512x512.png',
};

/**
 * Builds a Google Bubblewrap / Android Trusted Web Activity (TWA) manifest JSON
 * compatible with `@bubblewrap/cli` and PWABuilder Android APK packaging.
 */
export function buildBubblewrapTwaManifest(
  meta: AndroidApkConfigMetadata = DEFAULT_ANDROID_APK_METADATA
): string {
  const cleanOrigin = meta.hostUrl.replace(/\/+$/, '');
  const hostname = cleanOrigin.replace(/^https?:\/\//, '');

  const twaManifest = {
    packageId: meta.packageId,
    host: hostname,
    name: meta.appName,
    launcherName: meta.shortName.slice(0, 12),
    display: 'standalone',
    themeColor: meta.themeColor,
    navigationColor: meta.themeColor,
    navigationColorDark: '#020617',
    navigationDividerColor: '#1E293B',
    navigationDividerColorDark: '#1E293B',
    backgroundColor: meta.backgroundColor,
    enableNotifications: true,
    startUrl: meta.startUrl,
    iconUrl: `${cleanOrigin}${meta.iconUrl}`,
    maskableIconUrl: `${cleanOrigin}${meta.maskableIconUrl}`,
    splashScreenFadeOutDuration: 300,
    signingKey: {
      path: './android-keystore.jks',
      alias: 'arthaledger-key',
    },
    appVersionName: meta.versionName,
    appVersionCode: meta.versionCode,
    shortcuts: [
      {
        name: 'Import BOI Statement',
        shortName: 'Import PDF',
        url: `${cleanOrigin}/?tab=statements`,
        chosenIconUrl: `${cleanOrigin}/pwa-192x192.png`,
      },
      {
        name: 'Overview Dashboard',
        shortName: 'Dashboard',
        url: `${cleanOrigin}/`,
        chosenIconUrl: `${cleanOrigin}/pwa-192x192.png`,
      },
    ],
    generatorApp: 'bubblewrap-cli',
    webManifestUrl: `${cleanOrigin}/manifest.webmanifest`,
    fallbackType: 'customtabs',
    features: {},
    alphaDependencies: {
      enabled: false,
    },
    enableSiteSettingsShortcut: true,
    isChromeOSOnly: false,
    isMetaQuest: false,
    fullScopeUrl: `${cleanOrigin}/`,
    minSdkVersion: 24,
    orientation: 'portrait',
    fingerprints: [],
  };

  return JSON.stringify(twaManifest, null, 2);
}

/**
 * Builds a Capacitor Android configuration JSON (`capacitor.config.json`)
 * for compiling a self-contained offline hybrid Android `.apk` bundle.
 */
export function buildCapacitorAndroidConfig(
  meta: AndroidApkConfigMetadata = DEFAULT_ANDROID_APK_METADATA
): string {
  const capConfig = {
    appId: meta.packageId,
    appName: meta.shortName,
    webDir: 'dist',
    bundledWebRuntime: false,
    server: {
      androidScheme: 'https',
    },
    android: {
      buildOptions: {
        keystorePath: 'android-keystore.jks',
        keystoreAlias: 'arthaledger-key',
        releaseType: 'APK',
      },
      allowMixedContent: false,
      captureInput: true,
      webContentsDebuggingEnabled: false,
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 1200,
        backgroundColor: meta.themeColor,
        showSpinner: false,
        androidScaleType: 'CENTER_CROP',
      },
    },
  };

  return JSON.stringify(capConfig, null, 2);
}

/**
 * Builds an automated shell script (`build-arthaledger-apk.sh`) that compiles
 * either a standalone offline Capacitor APK or a signed TWA APK.
 */
export function buildAndroidApkShellScript(
  meta: AndroidApkConfigMetadata = DEFAULT_ANDROID_APK_METADATA
): string {
  return `#!/usr/bin/env bash
# ==============================================================================
# ArthaLedger — Automated Android APK Builder Script
# Package ID : ${meta.packageId}
# Version    : ${meta.versionName} (${meta.versionCode})
# Target URL : ${meta.hostUrl}
# ==============================================================================
set -euo pipefail

echo "============================================================"
echo "  Building ArthaLedger Android APK (${meta.packageId})"
echo "============================================================"

MODE="\${1:-capacitor}"

if [ "\$MODE" = "twa" ]; then
  echo "[1/3] Checking @bubblewrap/cli..."
  npx --yes @bubblewrap/cli --version
  echo "[2/3] Initializing Android TWA project from twa-manifest.json..."
  npx --yes @bubblewrap/cli update --manifest="./twa-manifest.json" || npx --yes @bubblewrap/cli init --manifest="${meta.hostUrl}/manifest.webmanifest"
  echo "[3/3] Building signed APK..."
  npx --yes @bubblewrap/cli build
  echo "Done! Signed APK generated at: ./app-release-signed.apk"
else
  echo "[1/4] Building production web bundle (dist/)..."
  npm run build
  echo "[2/4] Installing Capacitor Android platform..."
  npm install @capacitor/core @capacitor/cli @capacitor/android
  echo "[3/4] Syncing web assets into Android native project..."
  npx cap add android || npx cap sync android
  echo "[4/4] Compiling debug & release APK via Gradle..."
  cd android && ./gradlew assembleDebug
  echo "Done! Standalone offline APK ready at:"
  echo "  android/app/build/outputs/apk/debug/app-debug.apk"
fi
`;
}
