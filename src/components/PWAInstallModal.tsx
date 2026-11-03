import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  ShieldCheck,
  Smartphone,
  Terminal,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import {
  DEFAULT_ANDROID_APK_METADATA,
  buildAndroidApkShellScript,
  buildBubblewrapTwaManifest,
  buildCapacitorAndroidConfig,
} from '../utils/apkPackageGenerator';

interface PWAInstallButtonProps {
  onOpenApkModal: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenApkModal,
}) => {
  const { isInstallable, isInstalled } = usePWAInstall();

  // Already running as an installed app / APK: nothing to install
  if (isInstalled) return null;

  return (
    <button
      type="button"
      data-testid="header-apk-install-btn"
      onClick={onOpenApkModal}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
      title={
        isInstalled
          ? 'App Installed — View Android APK & Package Options'
          : 'Install Mobile App or Download Android APK Builder Config'
      }
    >
      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
      <span>{isInstallable ? 'Install App / APK' : 'Get APK'}</span>
      {isInstallable && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      )}
    </button>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-500/40"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Local IndexedDB ledger is active.</span>
    </div>
  );
};

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadFile: (content: string, filename: string, mimeType: string) => void;
  onShowToast: (message: string) => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
  onDownloadFile,
  onShowToast,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'instant' | 'apk-builder'>('instant');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const liveUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : DEFAULT_ANDROID_APK_METADATA.hostUrl;

  const meta = {
    ...DEFAULT_ANDROID_APK_METADATA,
    hostUrl: liveUrl,
  };

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2500);
    } catch {
      onShowToast('Copied to clipboard');
    }
  };

  const handleDirectInstall = async () => {
    const accepted = await install();
    if (accepted) {
      onShowToast('ArthaLedger installed to your device home screen.');
      onClose();
    }
  };

  const handleDownloadTwaManifest = () => {
    const content = buildBubblewrapTwaManifest(meta);
    onDownloadFile(content, 'twa-manifest.json', 'application/json;charset=utf-8');
    onShowToast('Downloaded Android TWA Manifest (twa-manifest.json).');
  };

  const handleDownloadCapacitorConfig = () => {
    const content = buildCapacitorAndroidConfig(meta);
    onDownloadFile(content, 'capacitor.config.json', 'application/json;charset=utf-8');
    onShowToast('Downloaded Capacitor Android Config (capacitor.config.json).');
  };

  const handleDownloadBuildScript = () => {
    const content = buildAndroidApkShellScript(meta);
    onDownloadFile(
      content,
      'build-arthaledger-apk.sh',
      'text/x-shellscript;charset=utf-8'
    );
    onShowToast('Downloaded automated APK build script (build-arthaledger-apk.sh).');
  };

  const bubblewrapCliSnippet = `npx @bubblewrap/cli init --manifest="${liveUrl}/manifest.webmanifest"\nnpx @bubblewrap/cli build`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
      data-testid="apk-install-modal"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0B192C] text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 id="apk-modal-title" className="text-base font-bold tracking-tight">
                ArthaLedger Android APK & Mobile Install
              </h2>
              <p className="text-xs text-slate-300">
                Package ID:{' '}
                <span className="font-mono text-blue-300">{meta.packageId}</span> · v
                {meta.versionName}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close APK Modal"
            data-testid="close-apk-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-6 pt-3 gap-3">
          <button
            type="button"
            data-testid="apk-tab-instant"
            onClick={() => setActiveTab('instant')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'instant'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. Instant Android Install (WebAPK)</span>
          </button>
          <button
            type="button"
            data-testid="apk-tab-builder"
            onClick={() => setActiveTab('apk-builder')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'apk-builder'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>2. Build Standalone .APK File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {activeTab === 'instant' ? (
            <>
              {/* Status Callout */}
              <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 p-4 flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Native Android WebAPK & Offline Service Worker Ready
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    ArthaLedger is configured with a verified Web App Manifest, maskable
                    adaptive icons, and offline Workbox caching. Android Chrome
                    automatically compiles and signs a native{' '}
                    <strong className="font-semibold">WebAPK</strong> when you install
                    it—keeping 100% of your BOI statements in private on-device storage.
                  </p>
                </div>
              </div>

              {/* Direct Native Install Prompt (When Supported by Chromium) */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {isInstalled
                        ? 'Installed on This Device'
                        : 'One-Click Device Installation'}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      v{meta.versionName} Standalone
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isInstallable
                      ? 'Browser install prompt is ready. Click to install ArthaLedger as a standalone app.'
                      : isInstalled
                      ? 'You are currently running or have installed the standalone app.'
                      : 'Open the live app link in Chrome on Android or desktop to trigger one-click WebAPK install.'}
                  </p>
                </div>

                {isInstallable ? (
                  <button
                    type="button"
                    data-testid="trigger-native-pwa-install-btn"
                    onClick={handleDirectInstall}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App Now</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('apk-builder')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    <FileCode2 className="w-4 h-4" />
                    <span>Get .APK Builder Files</span>
                  </button>
                )}
              </div>

              {/* Platform Step-by-Step Instructions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Android (Chrome / Edge / Brave)
                    </span>
                    {isAndroid && (
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        Detected
                      </span>
                    )}
                  </div>
                  <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside">
                    <li>Open the ArthaLedger URL in Chrome on your Android phone.</li>
                    <li>
                      Tap the <strong>⋮ Menu</strong> (top-right) and select{' '}
                      <strong>Install app</strong>.
                    </li>
                    <li>
                      Android compiles and installs the signed{' '}
                      <strong>ArthaLedger WebAPK</strong> to your app drawer.
                    </li>
                  </ol>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      iPhone & iPad (Safari)
                    </span>
                    {isIOS && (
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        Detected
                      </span>
                    )}
                  </div>
                  <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside">
                    <li>Open ArthaLedger in Safari on iOS.</li>
                    <li>
                      Tap the <strong>Share</strong> button in the bottom toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong> for full
                      standalone mode.
                    </li>
                  </ol>
                </div>
              </div>

              {/* Copyable App URL */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    App Manifest & Install Endpoint
                  </div>
                  <div className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                    {liveUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(liveUrl, 'url')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                >
                  {copiedKey === 'url' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Standalone APK Package Builder Tab */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Download Pre-Configured Android .APK Build Files
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  To sideload a standalone <code className="font-mono">.apk</code> file
                  directly onto Android devices or publish to Google Play, download the
                  pre-configured Bubblewrap Trusted Web Activity (TWA) or Capacitor
                  Android configuration files below.
                </p>
              </div>

              {/* Download Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Google TWA / PWABuilder
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      twa-manifest.json
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pre-filled with package ID, adaptive icons, and shortcuts for
                      Bubblewrap CLI.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="download-twa-manifest-btn"
                    onClick={handleDownloadTwaManifest}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON</span>
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Offline Hybrid APK
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      capacitor.config.json
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Capacitor Android config for bundling the <code className="font-mono">dist/</code>{' '}
                      folder into an offline APK.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="download-capacitor-config-btn"
                    onClick={handleDownloadCapacitorConfig}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Config</span>
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      1-Command Script
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      build-arthaledger-apk.sh
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Automated shell script to compile <code className="font-mono">app-debug.apk</code> or
                      signed release APK.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="download-apk-script-btn"
                    onClick={handleDownloadBuildScript}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Download Script</span>
                  </button>
                </div>
              </div>

              {/* CLI Quick-Build Snippet */}
              <div className="rounded-xl bg-slate-950 text-slate-100 p-4 space-y-2.5 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    Compile Signed .APK via Google Bubblewrap CLI
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(bubblewrapCliSnippet, 'cli')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    {copiedKey === 'cli' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Commands</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                  {bubblewrapCliSnippet}
                </pre>
              </div>

              {/* PWABuilder Cloud APK Generator Note */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-800/30 flex items-center justify-between gap-4">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    No Android SDK installed locally?
                  </strong>{' '}
                  Paste your app URL into{' '}
                  <span className="font-mono font-semibold">pwabuilder.com</span> and
                  click <strong>Package for Store → Android → Download APK</strong>.
                </div>
                <a
                  href={`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(
                    liveUrl
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-slate-50 shrink-0"
                >
                  <span>PWABuilder</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Manifest: /manifest.webmanifest · Icons: 192px, 512px, Maskable</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300/80 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
