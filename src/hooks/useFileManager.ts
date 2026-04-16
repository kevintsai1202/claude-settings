/**
 * Tauri FS 封裝 Hook
 * 提供設定檔的讀取、寫入、路徑解析功能
 * 所有 I/O 操作都透過此 hook，不直接呼叫 Tauri API
 */
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import { useAppStore } from '../store/settingsStore';
import type { SettingsLayer, ClaudeSettings, GlobalSettings } from '../types/settings';

// 快取家目錄，避免每次都呼叫 Tauri API
let cachedHomeDir: string | null = null;

/** 取得使用者家目錄（有快取） */
const getHomeDir = async (): Promise<string> => {
  if (!cachedHomeDir) {
    cachedHomeDir = await homeDir();
  }
  return cachedHomeDir;
};

/**
 * 解析路徑：將 %USERPROFILE% 替換為實際家目錄絕對路徑
 * Windows 的 Tauri FS 不支援 ~ 展開，必須使用 homeDir() API 取得真實路徑
 */
const resolvePath = async (path: string): Promise<string> => {
  let resolved = path;
  if (resolved.includes('%USERPROFILE%')) {
    const home = await getHomeDir();
    resolved = resolved.replace('%USERPROFILE%', home);
  }
  // 統一轉為正斜線（Tauri FS 在 Windows 也接受）
  return resolved.replace(/\\/g, '/');
};

/** 使用 Tauri FS 讀取並解析 JSON 設定檔 */
export const useFileManager = () => {
  const { updateFile, setProjectDir, setClaudeMd, updateGlobalFile } = useAppStore();

  /**
   * 載入單一設定層的檔案
   * @param layer 設定層識別符
   * @param rawPath 原始路徑（可含 %USERPROFILE%）
   */
  const loadFile = async (layer: SettingsLayer, rawPath: string) => {
    const path = await resolvePath(rawPath);
    try {
      const fileExists = await exists(path);
      if (!fileExists) {
        updateFile(layer, null, '', 'missing', rawPath);
        return;
      }

      const raw = await readTextFile(path);
      const data: ClaudeSettings = JSON.parse(raw);
      updateFile(layer, data, raw, 'ok', rawPath);
    } catch (err) {
      // 判斷是解析錯誤還是讀取錯誤
      const status = String(err).includes('JSON') ? 'invalid' : 'missing';
      updateFile(layer, null, '', status, rawPath);
    }
  };

  /**
   * 將修改後的設定儲存到指定層的檔案
   * @param layer 設定層識別符
   * @param path 目標路徑
   * @param data 設定資料
   */
  const saveFile = async (layer: SettingsLayer, path: string, data: ClaudeSettings) => {
    const resolvedPath = await resolvePath(path);
    const raw = JSON.stringify(data, null, 2);
    await writeTextFile(resolvedPath, raw);
    updateFile(layer, data, raw, 'ok', path);
    useAppStore.getState().setDirty(false);
  };

  /**
   * 開啟資料夾選擇對話框並載入專案設定
   */
  const openProject = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: '選擇 Claude 專案目錄',
    });

    if (!selected || typeof selected !== 'string') return;

    setProjectDir(selected);

    // 載入專案層設定檔
    const projectPath = `${selected}\\.claude\\settings.json`;
    const localPath   = `${selected}\\.claude\\settings.local.json`;
    const projectMd   = `${selected}\\CLAUDE.md`;

    await Promise.all([
      loadFile('project', projectPath),
      loadFile('local', localPath),
      loadClaudeMd('project', projectMd),
    ]);
  };

  /**
   * 載入全域設定檔（~/.claude.json）
   * 讀取並解析後更新 store 的 globalFile；
   * 若檔案不存在設 status='missing'，JSON 無效設 status='invalid'
   */
  const loadGlobalSettings = async () => {
    const rawPath = '%USERPROFILE%/.claude.json';
    const path = await resolvePath(rawPath);
    try {
      const fileExists = await exists(path);
      if (!fileExists) {
        updateGlobalFile(null, '', 'missing', rawPath);
        return;
      }
      const raw = await readTextFile(path);
      const data: GlobalSettings = JSON.parse(raw);
      updateGlobalFile(data, raw, 'ok', rawPath);
    } catch (err) {
      const status = String(err).includes('JSON') ? 'invalid' : 'missing';
      updateGlobalFile(null, '', status, rawPath);
    }
  };

  /**
   * 儲存全域設定檔（~/.claude.json）
   * 將 data 格式化為 JSON（2 空格縮排）寫入後更新 store
   * @param data 全域設定資料
   */
  const saveGlobalFile = async (data: GlobalSettings): Promise<void> => {
    const rawPath = '%USERPROFILE%/.claude.json';
    const path = await resolvePath(rawPath);
    const raw = JSON.stringify(data, null, 2);
    await writeTextFile(path, raw);
    updateGlobalFile(data, raw, 'ok', rawPath);
    useAppStore.getState().setDirty(false);
  };

  /**
   * 載入 User 層設定（應用程式啟動時自動呼叫）
   * 包含 settings.json、CLAUDE.md 以及全域設定 ~/.claude.json
   */
  const loadUserSettings = async () => {
    await loadFile('user', '%USERPROFILE%\\.claude\\settings.json');
    await loadClaudeMd('global', '%USERPROFILE%\\.claude\\CLAUDE.md');
    await loadGlobalSettings();
  };

  /**
   * 讀取 CLAUDE.md 並更新 store
   */
  const loadClaudeMd = async (scope: 'global' | 'project', rawPath: string) => {
    const path = await resolvePath(rawPath);
    try {
      const fileExists = await exists(path);
      if (!fileExists) {
        setClaudeMd(scope, '');
        return;
      }
      const content = await readTextFile(path);
      setClaudeMd(scope, content);
    } catch {
      setClaudeMd(scope, '');
    }
  };

  /**
   * 儲存 CLAUDE.md
   */
  const saveClaudeMd = async (scope: 'global' | 'project', content: string, rawPath: string) => {
    const path = await resolvePath(rawPath);
    await writeTextFile(path, content);
    setClaudeMd(scope, content);
    useAppStore.getState().setDirty(false);
  };

  return {
    loadUserSettings,
    loadFile,
    saveFile,
    openProject,
    loadClaudeMd,
    saveClaudeMd,
    loadGlobalSettings,
    saveGlobalFile,
  };
};
