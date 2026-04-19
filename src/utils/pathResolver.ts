/**
 * pathResolver.ts — 跨平台路徑解析
 * 將 %USERPROFILE% 佔位符展開為實際家目錄；反斜線統一轉正斜線
 * （Tauri FS plugin 在 Windows 也接受正斜線）
 *
 * Module-scope 快取 home 目錄：homeDir() 是 Tauri IPC 呼叫，
 * 重複呼叫成本不低，且 home 目錄在程式執行期間不會變動
 */
import { homeDir } from '@tauri-apps/api/path';

/** 快取 homeDir() 的結果（lazy init；home 目錄在執行期間固定不變） */
let cachedHomeDir: string | null = null;

/** 懶載入家目錄並快取 */
const getHomeDir = async (): Promise<string> => {
  if (cachedHomeDir === null) {
    cachedHomeDir = await homeDir();
  }
  return cachedHomeDir;
};

/**
 * 解析路徑：%USERPROFILE% → 實際家目錄，統一轉正斜線
 * @param path 原始路徑（可能含 %USERPROFILE% 佔位符或反斜線）
 * @returns 絕對路徑（正斜線）
 */
export const resolvePath = async (path: string): Promise<string> => {
  let resolved = path;
  if (resolved.includes('%USERPROFILE%')) {
    const home = await getHomeDir();
    resolved = resolved.replace('%USERPROFILE%', home);
  }
  return resolved.replace(/\\/g, '/');
};
