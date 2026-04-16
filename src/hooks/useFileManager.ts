/**
 * Tauri FS 封裝 Hook —— v3.0 Draft Mode
 * saveFile/saveGlobalFile/saveClaudeMd 改為僅更新 draft（store），不寫磁碟
 * 需要寫磁碟時呼叫 commitLayer / commitGlobal / commitClaudeMd 或 commitAll
 */
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import { useAppStore } from '../store/settingsStore';
import type { SettingsLayer, ClaudeSettings, GlobalSettings } from '../types/settings';

let cachedHomeDir: string | null = null;
const getHomeDir = async (): Promise<string> => {
  if (!cachedHomeDir) cachedHomeDir = await homeDir();
  return cachedHomeDir;
};

/**
 * 解析路徑：%USERPROFILE% → 實際家目錄，統一轉正斜線
 */
const resolvePath = async (path: string): Promise<string> => {
  let resolved = path;
  if (resolved.includes('%USERPROFILE%')) {
    const home = await getHomeDir();
    resolved = resolved.replace('%USERPROFILE%', home);
  }
  return resolved.replace(/\\/g, '/');
};

export const useFileManager = () => {
  const store = useAppStore;

  // ─── 載入 ─────────────────────────────────────────────
  /**
   * 從磁碟載入單一設定層
   */
  const loadFile = async (layer: SettingsLayer, rawPath: string) => {
    const path = await resolvePath(rawPath);
    try {
      const fileExists = await exists(path);
      if (!fileExists) {
        store.getState().loadFileFromDisk(layer, null, '', 'missing', rawPath);
        return;
      }
      const raw = await readTextFile(path);
      const data: ClaudeSettings = JSON.parse(raw);
      store.getState().loadFileFromDisk(layer, data, raw, 'ok', rawPath);
    } catch (err) {
      const status = String(err).includes('JSON') ? 'invalid' : 'missing';
      store.getState().loadFileFromDisk(layer, null, '', status, rawPath);
    }
  };

  /**
   * 從磁碟載入全域設定（~/.claude.json）
   */
  const loadGlobalSettings = async () => {
    const rawPath = '%USERPROFILE%/.claude.json';
    const path = await resolvePath(rawPath);
    try {
      const fileExists = await exists(path);
      if (!fileExists) {
        store.getState().loadGlobalFromDisk(null, '', 'missing', rawPath);
        return;
      }
      const raw = await readTextFile(path);
      const data: GlobalSettings = JSON.parse(raw);
      store.getState().loadGlobalFromDisk(data, raw, 'ok', rawPath);
    } catch (err) {
      const status = String(err).includes('JSON') ? 'invalid' : 'missing';
      store.getState().loadGlobalFromDisk(null, '', status, rawPath);
    }
  };

  /**
   * 從磁碟載入 CLAUDE.md
   */
  const loadClaudeMd = async (scope: 'global' | 'project', rawPath: string) => {
    const path = await resolvePath(rawPath);
    try {
      const fileExists = await exists(path);
      if (!fileExists) {
        store.getState().loadClaudeMdFromDisk(scope, '', rawPath, 'missing');
        return;
      }
      const content = await readTextFile(path);
      store.getState().loadClaudeMdFromDisk(scope, content, rawPath, 'ok');
    } catch {
      store.getState().loadClaudeMdFromDisk(scope, '', rawPath, 'invalid');
    }
  };

  // ─── Draft 更新（不寫磁碟，只改 store）──────────────
  /**
   * 更新設定層的 draft —— 原本叫 saveFile 的相容包裝
   * @param layer 設定層
   * @param _path 保留參數（向下相容；實際 path 由 store 管理）
   * @param data 新的設定資料
   */
  const saveFile = async (layer: SettingsLayer, _path: string, data: ClaudeSettings) => {
    void _path;
    store.getState().updateFileDraft(layer, data);
  };

  /**
   * 更新全域設定 draft
   */
  const saveGlobalFile = async (data: GlobalSettings): Promise<void> => {
    store.getState().updateGlobalDraft(data);
  };

  /**
   * 更新 CLAUDE.md draft
   * @param scope global / project
   * @param content 新內容
   * @param _path 保留參數（向下相容）
   */
  const saveClaudeMd = async (scope: 'global' | 'project', content: string, _path?: string) => {
    void _path;
    store.getState().updateClaudeMdDraft(scope, content);
  };

  // ─── Commit（寫磁碟）─────────────────────────────────
  /**
   * 將某層 draft 寫入磁碟
   */
  const commitLayer = async (layer: SettingsLayer): Promise<void> => {
    const file = store.getState().files[layer];
    if (!file.dirty || !file.data) return;
    const path = await resolvePath(file.path);
    const raw = JSON.stringify(file.data, null, 2);
    await writeTextFile(path, raw);
    store.getState().markFileCommitted(layer, raw);
  };

  /**
   * 將全域設定 draft 寫入磁碟
   */
  const commitGlobal = async (): Promise<void> => {
    const gf = store.getState().globalFile;
    if (!gf.dirty || !gf.data) return;
    const path = await resolvePath(gf.path);
    const raw = JSON.stringify(gf.data, null, 2);
    await writeTextFile(path, raw);
    store.getState().markGlobalCommitted(raw);
  };

  /**
   * 將 CLAUDE.md draft 寫入磁碟
   */
  const commitClaudeMd = async (scope: 'global' | 'project'): Promise<void> => {
    const entry = store.getState().claudeMd[scope];
    if (!entry.dirty) return;
    if (!entry.path) return; // 沒開專案就沒路徑
    const path = await resolvePath(entry.path);
    await writeTextFile(path, entry.content);
    store.getState().markClaudeMdCommitted(scope);
  };

  /**
   * 把所有 dirty 的檔案一次寫入磁碟
   * @returns 實際寫入的檔案數
   */
  const commitAll = async (): Promise<number> => {
    const state = store.getState();
    let written = 0;
    const tasks: Promise<void>[] = [];

    for (const layer of ['user', 'project', 'local', 'managed'] as SettingsLayer[]) {
      if (state.files[layer].dirty && state.files[layer].data) {
        tasks.push(commitLayer(layer).then(() => { written++; }));
      }
    }
    if (state.globalFile.dirty && state.globalFile.data) {
      tasks.push(commitGlobal().then(() => { written++; }));
    }
    for (const scope of ['global', 'project'] as const) {
      if (state.claudeMd[scope].dirty && state.claudeMd[scope].path) {
        tasks.push(commitClaudeMd(scope).then(() => { written++; }));
      }
    }
    await Promise.all(tasks);
    return written;
  };

  // ─── Undo（復原單步）─────────────────────────────────
  const undoFile = (layer: SettingsLayer) => store.getState().undoFile(layer);
  const undoGlobal = () => store.getState().undoGlobal();
  const undoClaudeMd = (scope: 'global' | 'project') => store.getState().undoClaudeMd(scope);

  // ─── 專案管理 ────────────────────────────────────────
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

    store.getState().setProjectDir(selected);

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
   * 載入 User 層設定（App 啟動時呼叫）
   */
  const loadUserSettings = async () => {
    await loadFile('user', '%USERPROFILE%\\.claude\\settings.json');
    await loadClaudeMd('global', '%USERPROFILE%\\.claude\\CLAUDE.md');
    await loadGlobalSettings();
  };

  return {
    // 載入
    loadUserSettings,
    loadFile,
    loadClaudeMd,
    loadGlobalSettings,
    openProject,
    // Draft 更新（舊 API 相容）
    saveFile,
    saveGlobalFile,
    saveClaudeMd,
    // Commit
    commitLayer,
    commitGlobal,
    commitClaudeMd,
    commitAll,
    // Undo
    undoFile,
    undoGlobal,
    undoClaudeMd,
  };
};
