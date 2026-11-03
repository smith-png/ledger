import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ANDROID_APK_METADATA,
  buildAndroidApkShellScript,
  buildBubblewrapTwaManifest,
  buildCapacitorAndroidConfig,
} from '../apkPackageGenerator';

test('buildBubblewrapTwaManifest creates compliant TWA manifest with <= 12 char launcherName', () => {
  const raw = buildBubblewrapTwaManifest({
    ...DEFAULT_ANDROID_APK_METADATA,
    hostUrl: 'https://arthaledger.example.com/',
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.packageId, 'com.arthaledger.boianalyzer');
  assert.equal(parsed.host, 'arthaledger.example.com');
  assert.equal(parsed.launcherName, 'ArthaLedger');
  assert.ok(parsed.launcherName.length <= 12);
  assert.equal(parsed.display, 'standalone');
  assert.equal(parsed.webManifestUrl, 'https://arthaledger.example.com/manifest.webmanifest');
  assert.equal(parsed.iconUrl, 'https://arthaledger.example.com/pwa-512x512.png');
  assert.equal(parsed.maskableIconUrl, 'https://arthaledger.example.com/pwa-maskable-512x512.png');
});

test('buildCapacitorAndroidConfig sets APK release type and correct packageId', () => {
  const raw = buildCapacitorAndroidConfig(DEFAULT_ANDROID_APK_METADATA);
  const parsed = JSON.parse(raw);

  assert.equal(parsed.appId, 'com.arthaledger.boianalyzer');
  assert.equal(parsed.appName, 'ArthaLedger');
  assert.equal(parsed.webDir, 'dist');
  assert.equal(parsed.android.buildOptions.releaseType, 'APK');
});

test('buildAndroidApkShellScript outputs executable bash workflow for Capacitor and TWA', () => {
  const script = buildAndroidApkShellScript(DEFAULT_ANDROID_APK_METADATA);
  assert.ok(script.startsWith('#!/usr/bin/env bash'));
  assert.ok(script.includes('com.arthaledger.boianalyzer'));
  assert.ok(script.includes('./gradlew assembleDebug'));
  assert.ok(script.includes('@bubblewrap/cli build'));
});
