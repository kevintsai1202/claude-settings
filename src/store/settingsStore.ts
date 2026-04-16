/**
 * 全局狀態管理（Zustand）
 * 統一管理各層設定檔、專案目錄、當前 Tab、CLAUDE.md 內容
 */
import { create } from 'zustand';
import type {
  AppState,
  ClaudeSettings,
  GlobalSettings,
  GlobalSettingsFile,
  SettingsLayer,
  TabId,
  FileStatus,
  SettingsFile,
} from '../types/settings';

// 建立空白的設定檔物件
const emptyFile = (layer: SettingsLayer, path: string): SettingsFile => ({
  layer,
  path,
  status: 'missing',
  data: null,
  raw: '',
});

// 各層設定檔的預設路徑（Windows，使用者目錄）
const DEFAULT_USER_PATH = '%USERPROFILE%\\.claude\\settings.json';
const DEFAULT_MANAGED_PATH = 'C:\\Program Files\\ClaudeCode\\managed-settings.json';

// ─── Store Actions 型別 ────────────────────────────────────
interface AppActions {
  /** 設定目前選取的 Tab */
  setActiveTab: (tab: TabId) => void;

  /** 更新全域設定檔（~/.claude.json）資料 */
  updateGlobalFile: (
    data: GlobalSettings | null,
    raw: string,
    status: GlobalSettingsFile['status'],
    path?: string
  ) => void;

  /** 設定專案目錄路徑 */
  setProjectDir: (dir: string | null) => void;

  /** 更新單一設定層的資料 */
  updateFile: (
    layer: SettingsLayer,
    data: ClaudeSettings | null,
    raw: string,
    status: FileStatus,
    path?: string
  ) => void;

  /** 更新 CLAUDE.md 內容 */
  setClaudeMd: (scope: 'global' | 'project', content: string) => void;

  /** 標記有未儲存的變更 */
  setDirty: (dirty: boolean) => void;

  /** 重設整個 store（開啟新專案時使用） */
  reset: () => void;
}

// ─── 初始狀態 ──────────────────────────────────────────────
const initialState: AppState = {
  files: {
    user:    emptyFile('user',    DEFAULT_USER_PATH),
    project: emptyFile('project', ''),
    local:   emptyFile('local',   ''),
    managed: emptyFile('managed', DEFAULT_MANAGED_PATH),
  },
  // 全域設定檔初始狀態（~/.claude.json）
  globalFile: {
    path: '%USERPROFILE%/.claude.json',
    status: 'missing',
    data: null,
    raw: '',
  },
  projectDir: null,
  activeTab: 'basic',
  claudeMd: { global: '', project: '' },
  isDirty: false,
};

// ─── Zustand Store ──────────────────────────────────────────
export const useAppStore = create<AppState & AppActions>((set) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setProjectDir: (dir) =>
    set((state) => ({
      projectDir: dir,
      files: {
        ...state.files,
        // 更新專案層路徑
        project: {
          ...state.files.project,
          path: dir ? `${dir}\\.claude\\settings.json` : '',
          status: 'missing',
          data: null,
          raw: '',
        },
        local: {
          ...state.files.local,
          path: dir ? `${dir}\\.claude\\settings.local.json` : '',
          status: 'missing',
          data: null,
          raw: '',
        },
      },
    })),

  updateFile: (layer, data, raw, status, path) =>
    set((state) => ({
      files: {
        ...state.files,
        [layer]: {
          ...state.files[layer],
          ...(path ? { path } : {}),
          data,
          raw,
          status,
        },
      },
    })),

  setClaudeMd: (scope, content) =>
    set((state) => ({
      claudeMd: { ...state.claudeMd, [scope]: content },
      isDirty: true,
    })),

  updateGlobalFile: (data, raw, status, path) =>
    set((state) => ({
      globalFile: {
        ...state.globalFile,
        ...(path ? { path } : {}),
        data,
        raw,
        status,
      },
    })),

  setDirty: (dirty) => set({ isDirty: dirty }),

  reset: () => set(initialState),
}));
