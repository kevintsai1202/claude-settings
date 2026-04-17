/**
 * 平台偵測工具 — 在 Tauri webview 中偵測當前作業系統
 * 使用 navigator.userAgent 作為跨平台資料來源，無需額外 plugin 依賴
 * 結果在 module 層快取，第一次呼叫後 O(1)
 */

export type Platform = 'windows' | 'macos' | 'linux' | 'unknown';

let cachedPlatform: Platform | null = null;

/**
 * 偵測當前平台；結果會被 module 層快取
 * 由於 navigator.userAgent 在 Tauri webview 啟動後不會改變，可以安全快取
 */
export function detectPlatform(): Platform {
  if (cachedPlatform !== null) return cachedPlatform;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Mac|iPhone|iPad/.test(ua)) {
    cachedPlatform = 'macos';
  } else if (/Windows/.test(ua)) {
    cachedPlatform = 'windows';
  } else if (/Linux/.test(ua)) {
    cachedPlatform = 'linux';
  } else {
    cachedPlatform = 'unknown';
  }
  return cachedPlatform;
}

/** 同步取得平台；若尚未快取則會先偵測 */
export function getPlatform(): Platform {
  return cachedPlatform ?? detectPlatform();
}

export const isWindows = (): boolean => getPlatform() === 'windows';
export const isMacOS = (): boolean => getPlatform() === 'macos';
export const isLinux = (): boolean => getPlatform() === 'linux';
export const isUnix = (): boolean => {
  const p = getPlatform();
  return p === 'macos' || p === 'linux';
};

/** 人類可讀的平台名稱（UI 顯示用） */
export function getPlatformLabel(p: Platform = getPlatform()): string {
  switch (p) {
    case 'windows': return 'Windows';
    case 'macos':   return 'macOS';
    case 'linux':   return 'Linux';
    default:        return '未知';
  }
}
