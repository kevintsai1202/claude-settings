/**
 * Claude Code settings.json 相關型別定義
 * 所有 Tab 元件、store、hooks 共用此檔案
 */

// ─── 設定檔來源層級 ───────────────────────────────────────
/** 各層設定來源的標識符 */
export type SettingsLayer = 'user' | 'project' | 'local' | 'managed';

/** 設定值的來源標記（用於合并預覽顯示） */
export interface LayeredValue<T> {
  value: T;
  source: SettingsLayer;
}

// ─── 權限規則 ─────────────────────────────────────────────
/** 單一權限規則 */
export interface PermissionRule {
  tool: string;       // 工具名稱，例如 "Bash"
  pattern?: string;   // 可選的 glob 指定，例如 "npm run *"
}

/** 預設模式選項 */
export type DefaultMode = 'default' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions';

/** 完整的 permissions 設定物件 */
export interface Permissions {
  allow: string[];   // 允許的規則字串陣列
  ask: string[];     // 需確認的規則字串陣列
  deny: string[];    // 拒絕的規則字串陣列
  defaultMode?: DefaultMode;
}

// ─── Hooks 設定 ────────────────────────────────────────────
/** Hook 類型 */
export type HookType = 'command' | 'http';

/** 單一 Hook 設定 */
export interface HookEntry {
  id: string;           // 前端管理用的唯一 ID（非 Claude 設定欄位）
  matcher?: string;     // 工具匹配條件，例如 "Bash"
  type: HookType;       // 執行類型
  command?: string;     // type = command 時的命令字串
  url?: string;         // type = http 時的 URL
  timeout?: number;     // 超時毫秒數
}

/** 五種 Hook 事件類型 */
export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop' | 'SubagentStop';

/** Hooks 設定物件（索引簽名對應各事件） */
export type HooksConfig = Partial<Record<HookEvent, HookEntry[]>>;

// ─── 環境變數 ──────────────────────────────────────────────
/** 環境變數鍵值對 */
export interface EnvEntry {
  id: string;    // 前端管理用的唯一 ID
  key: string;
  value: string;
}

// ─── 基本設定 ──────────────────────────────────────────────
/** 努力等級 */
export type EffortLevel = 'low' | 'medium' | 'high';

/** 更新通道 */
export type UpdateChannel = 'stable' | 'beta' | 'alpha';

/** 基本設定欄位 */
export interface BasicSettings {
  model?: string;
  effortLevel?: EffortLevel;
  language?: string;
  outputStyle?: string;
  alwaysThinkingEnabled?: boolean;
  autoUpdates?: UpdateChannel | boolean;
  includeCoAuthoredBy?: boolean;
  spinnerTips?: boolean;
  cleanupPeriodDays?: number;
}

// ─── 完整 Claude Settings JSON 結構 ───────────────────────
/** settings.json 的完整結構 */
export interface ClaudeSettings extends BasicSettings {
  permissions?: Permissions;
  hooks?: HooksConfig;
  env?: Record<string, string>;
}

// ─── 檔案狀態 ──────────────────────────────────────────────
/** 設定檔的讀取狀態 */
export type FileStatus = 'ok' | 'missing' | 'invalid' | 'readonly';

/** 單一設定檔的完整資訊 */
export interface SettingsFile {
  layer: SettingsLayer;
  path: string;
  status: FileStatus;
  data: ClaudeSettings | null;   // null 表示檔案不存在或解析失敗
  raw: string;                   // 原始 JSON 字串（用於 JSON 編輯器）
}

// ─── Store 全局狀態 ────────────────────────────────────────
/** 當前選擇的 Tab */
export type TabId =
  | 'basic'
  | 'permissions'
  | 'hooks'
  | 'env'
  | 'claudemd'
  | 'merge'
  | 'json';

/** CLAUDE.md 多標籤內容 */
export interface ClaudeMdFiles {
  global: string;   // ~/.claude/CLAUDE.md
  project: string;  // <project>/CLAUDE.md
}

/** 整個 App 的全局狀態介面 */
export interface AppState {
  // 各層設定檔
  files: Record<SettingsLayer, SettingsFile>;
  // 目前選取的專案目錄
  projectDir: string | null;
  // 目前選取的 Tab
  activeTab: TabId;
  // CLAUDE.md 內容
  claudeMd: ClaudeMdFiles;
  // 是否有未儲存的變更
  isDirty: boolean;
}
