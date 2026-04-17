/**
 * 全局狀態管理（Zustand）—— v3.0 Draft Mode
 * 所有檔案編輯都以 draft 方式暫存於 store，透過 commitAll() 才會真正寫入磁碟
 * 支援單步 undo（restore previousData/previousContent snapshot）
 */
import { create } from 'zustand';
import type {
  AppState,
  ClaudeSettings,
  GlobalSettings,
  SettingsLayer,
  TabId,
  FileStatus,
  SettingsFile,
  AgentFile,
  CommandFile,
  OutputStyleFile,
  SkillFile,
  RuleFile,
  MemoryFile,
  ClaudeMdEntry,
} from '../types/settings';
import {
  DEFAULT_USER_PATH,
  DEFAULT_GLOBAL_PATH,
  DEFAULT_USER_CLAUDE_MD,
  getDefaultManagedPath,
} from '../utils/defaultPaths';

// 建立空白的設定檔物件
const emptyFile = (layer: SettingsLayer, path: string): SettingsFile => ({
  layer,
  path,
  status: 'missing',
  data: null,
  raw: '',
  dirty: false,
  previousData: undefined,
});

// ─── Store Actions 型別 ────────────────────────────────────
interface AppActions {
  /** 設定目前選取的 Tab */
  setActiveTab: (tab: TabId) => void;

  /** 設定專案目錄路徑 */
  setProjectDir: (dir: string | null) => void;

  // ── 載入（從磁碟同步資料，不標記 dirty）────────────────
  /** 載入單一設定層（從磁碟讀入後呼叫） */
  loadFileFromDisk: (
    layer: SettingsLayer,
    data: ClaudeSettings | null,
    raw: string,
    status: FileStatus,
    path?: string
  ) => void;

  /** 載入全域設定（從磁碟讀入後呼叫） */
  loadGlobalFromDisk: (
    data: GlobalSettings | null,
    raw: string,
    status: FileStatus,
    path?: string
  ) => void;

  /** 載入 CLAUDE.md（從磁碟讀入後呼叫） */
  loadClaudeMdFromDisk: (
    scope: 'global' | 'project',
    content: string,
    path: string,
    status: FileStatus
  ) => void;

  // ── Draft 編輯（UI 呼叫，只更新 store 不寫檔）──────────
  /** 更新單一設定層的 draft 資料（UI 編輯時呼叫） */
  updateFileDraft: (layer: SettingsLayer, data: ClaudeSettings) => void;

  /** 更新全域設定的 draft */
  updateGlobalDraft: (data: GlobalSettings) => void;

  /** 更新 CLAUDE.md 的 draft 內容 */
  updateClaudeMdDraft: (scope: 'global' | 'project', content: string) => void;

  // ── Commit（寫檔成功後呼叫，清除 dirty）────────────────
  /** 標記某層已成功寫檔，清除 dirty 並更新 raw */
  markFileCommitted: (layer: SettingsLayer, raw: string) => void;

  /** 標記全域設定已成功寫檔 */
  markGlobalCommitted: (raw: string) => void;

  /** 標記 CLAUDE.md 已成功寫檔 */
  markClaudeMdCommitted: (scope: 'global' | 'project') => void;

  // ── Undo（單步復原） ─────────────────────────────────
  /** 復原某層到上一步（previousData） */
  undoFile: (layer: SettingsLayer) => void;
  /** 復原全域設定 */
  undoGlobal: () => void;
  /** 復原 CLAUDE.md */
  undoClaudeMd: (scope: 'global' | 'project') => void;

  // ── 衍生資源 ──
  setAgents: (agents: AgentFile[]) => void;
  setCommands: (commands: CommandFile[]) => void;
  setOutputStyles: (outputStyles: OutputStyleFile[]) => void;
  setSkills: (skills: SkillFile[]) => void;
  setRules: (rules: RuleFile[]) => void;
  setMemory: (memoryFiles: MemoryFile[], memoryDir: string | null) => void;

  /** 重設整個 store（開啟新專案時使用） */
  reset: () => void;
}

// ─── 初始狀態 ──────────────────────────────────────────────
const emptyClaudeMd = (path: string): ClaudeMdEntry => ({
  content: '',
  committedContent: '',
  path,
  status: 'missing',
  dirty: false,
  previousContent: undefined,
});

const initialState: AppState = {
  files: {
    user:    emptyFile('user',    DEFAULT_USER_PATH),
    project: emptyFile('project', ''),
    local:   emptyFile('local',   ''),
    managed: emptyFile('managed', getDefaultManagedPath()),
  },
  globalFile: {
    path: DEFAULT_GLOBAL_PATH,
    status: 'missing',
    data: null,
    raw: '',
    dirty: false,
    previousData: undefined,
  },
  projectDir: null,
  activeTab: 'basic',
  claudeMd: {
    global:  emptyClaudeMd(DEFAULT_USER_CLAUDE_MD),
    project: emptyClaudeMd(''),
  },
  isDirty: false,  // 向下相容；實際檢查看各 file.dirty
  agents: [],
  commands: [],
  outputStyles: [],
  skills: [],
  rules: [],
  memoryFiles: [],
  memoryDir: null,
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
        project: {
          ...emptyFile('project', dir ? `${dir}/.claude/settings.json` : ''),
        },
        local: {
          ...emptyFile('local', dir ? `${dir}/.claude/settings.local.json` : ''),
        },
      },
    })),

  // ── 載入動作：清 dirty、寫入 data + raw ─────────────────
  loadFileFromDisk: (layer, data, raw, status, path) =>
    set((state) => ({
      files: {
        ...state.files,
        [layer]: {
          ...state.files[layer],
          ...(path ? { path } : {}),
          data,
          raw,
          status,
          dirty: false,
          previousData: undefined,
        },
      },
    })),

  loadGlobalFromDisk: (data, raw, status, path) =>
    set((state) => ({
      globalFile: {
        ...state.globalFile,
        ...(path ? { path } : {}),
        data,
        raw,
        status,
        dirty: false,
        previousData: undefined,
      },
    })),

  loadClaudeMdFromDisk: (scope, content, path, status) =>
    set((state) => ({
      claudeMd: {
        ...state.claudeMd,
        [scope]: {
          content,
          committedContent: content,
          path,
          status,
          dirty: false,
          previousContent: undefined,
        },
      },
    })),

  // ── Draft 編輯：push snapshot、set data、dirty=true ────
  updateFileDraft: (layer, data) =>
    set((state) => ({
      files: {
        ...state.files,
        [layer]: {
          ...state.files[layer],
          previousData: state.files[layer].data,
          data,
          dirty: true,
        },
      },
    })),

  updateGlobalDraft: (data) =>
    set((state) => ({
      globalFile: {
        ...state.globalFile,
        previousData: state.globalFile.data,
        data,
        dirty: true,
      },
    })),

  updateClaudeMdDraft: (scope, content) =>
    set((state) => ({
      claudeMd: {
        ...state.claudeMd,
        [scope]: {
          ...state.claudeMd[scope],
          previousContent: state.claudeMd[scope].content,
          content,
          dirty: true,
        },
      },
    })),

  // ── Commit：清 dirty、更新 raw、保留 previousData 供 undo ─
  markFileCommitted: (layer, raw) =>
    set((state) => ({
      files: {
        ...state.files,
        [layer]: {
          ...state.files[layer],
          raw,
          dirty: false,
          status: 'ok',
        },
      },
    })),

  markGlobalCommitted: (raw) =>
    set((state) => ({
      globalFile: {
        ...state.globalFile,
        raw,
        dirty: false,
        status: 'ok',
      },
    })),

  markClaudeMdCommitted: (scope) =>
    set((state) => ({
      claudeMd: {
        ...state.claudeMd,
        [scope]: {
          ...state.claudeMd[scope],
          committedContent: state.claudeMd[scope].content,
          dirty: false,
          status: 'ok',
        },
      },
    })),

  // ── Undo：data = previousData，並 dirty 視是否仍與 raw 相同而定
  undoFile: (layer) =>
    set((state) => {
      const file = state.files[layer];
      if (file.previousData === undefined) return {};
      const restored = file.previousData;
      // 比較 restored 與 raw 決定 dirty
      const restoredStr = JSON.stringify(restored, null, 2);
      return {
        files: {
          ...state.files,
          [layer]: {
            ...file,
            data: restored,
            previousData: undefined,
            dirty: restoredStr !== file.raw,
          },
        },
      };
    }),

  undoGlobal: () =>
    set((state) => {
      const gf = state.globalFile;
      if (gf.previousData === undefined) return {};
      const restored = gf.previousData;
      const restoredStr = JSON.stringify(restored, null, 2);
      return {
        globalFile: {
          ...gf,
          data: restored,
          previousData: undefined,
          dirty: restoredStr !== gf.raw,
        },
      };
    }),

  undoClaudeMd: (scope) =>
    set((state) => {
      const entry = state.claudeMd[scope];
      if (entry.previousContent === undefined) return {};
      const restored = entry.previousContent;
      return {
        claudeMd: {
          ...state.claudeMd,
          [scope]: {
            ...entry,
            content: restored,
            previousContent: undefined,
            dirty: restored !== entry.committedContent,
          },
        },
      };
    }),

  setAgents: (agents) => set({ agents }),
  setCommands: (commands) => set({ commands }),
  setOutputStyles: (outputStyles) => set({ outputStyles }),
  setSkills: (skills) => set({ skills }),
  setRules: (rules) => set({ rules }),
  setMemory: (memoryFiles, memoryDir) => set({ memoryFiles, memoryDir }),

  reset: () => set(initialState),
}));

// ─── 全局輔助 selector ─────────────────────────────────────
/**
 * 計算所有 dirty 的檔案數量（settings.json 4 層 + global + CLAUDE.md 2 份）
 * 用於 header 的未儲存徽章
 */
export const getTotalDirtyCount = (state: AppState): number => {
  let count = 0;
  for (const layer of ['user', 'project', 'local', 'managed'] as SettingsLayer[]) {
    if (state.files[layer].dirty) count++;
  }
  if (state.globalFile.dirty) count++;
  if (state.claudeMd.global.dirty) count++;
  if (state.claudeMd.project.dirty) count++;
  return count;
};
