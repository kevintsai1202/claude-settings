/**
 * pathResolver.ts — 跨平台路徑解析
 * 將 %USERPROFILE% 佔位符展開為實際家目錄；反斜線統一轉正斜線
 * （Tauri FS plugin 在 Windows 也接受正斜線）
 */
import { homeDir } from '@tauri-apps/api/path';

/**
 * 解析路徑：%USERPROFILE% → 實際家目錄，統一轉正斜線
 * @param path 原始路徑（可能含 %USERPROFILE% 佔位符或反斜線）
 * @returns 絕對路徑（正斜線）
 */
export const resolvePath = async (path: string): Promise<string> => {
  let resolved = path;
  if (resolved.includes('%USERPROFILE%')) {
    const home = await homeDir();
    resolved = resolved.replace('%USERPROFILE%', home);
  }
  return resolved.replace(/\\/g, '/');
};
