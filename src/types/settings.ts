/**
 * Claude Code settings.json 相關型別定義
 * 所有 Tab 元件、store、hooks 共用此檔案
 * v2.0 — 涵蓋官方 50+ 設定欄位
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

/** 預設模式選項（含完整 6 個官方值） */
export type DefaultMode =
  | 'default'
  | 'acceptEdits'
  | 'dontAsk'
  | 'bypassPermissions'
  | 'plan'
  | 'auto';

/** 完整的 permissions 設定物件 */
export interface Permissions {
  allow: string[];                      // 允許的規則字串陣列
  ask: string[];                        // 需確認的規則字串陣列
  deny: string[];                       // 拒絕的規則字串陣列
  defaultMode?: DefaultMode;            // 預設互動模式
  additionalDirectories?: string[];     // 額外允許存取的目錄
  disableBypassPermissionsMode?: boolean;  // 停用 bypass 模式
  skipDangerousModePermissionPrompt?: boolean; // 略過危險模式確認
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
export type UpdateChannel = 'stable' | 'latest';

// ─── Sandbox 設定 ──────────────────────────────────────────
/** Sandbox 檔案系統存取規則 */
export interface SandboxFilesystem {
  allowWrite?: string[];               // 允許寫入的路徑
  denyWrite?: string[];                // 拒絕寫入的路徑
  denyRead?: string[];                 // 拒絕讀取的路徑
  allowRead?: string[];                // 允許讀取的路徑
  allowManagedReadPathsOnly?: boolean; // 僅允許 managed 定義的讀取路徑
}

/** Sandbox 網路存取規則 */
export interface SandboxNetwork {
  allowUnixSockets?: boolean;          // 允許 Unix socket
  allowAllUnixSockets?: boolean;       // 允許所有 Unix socket
  allowLocalBinding?: boolean;         // 允許本機端口綁定
  allowedDomains?: string[];           // 允許的網域清單
  allowManagedDomainsOnly?: boolean;   // 僅允許 managed 定義的網域
  httpProxyPort?: number;              // HTTP proxy 端口
  socksProxyPort?: number;             // SOCKS proxy 端口
}

/** 完整 Sandbox 設定 */
export interface SandboxSettings {
  enabled?: boolean;                    // 啟用沙箱
  failIfUnavailable?: boolean;          // 沙箱不可用時報錯
  autoAllowBashIfSandboxed?: boolean;   // 沙箱環境下自動允許 Bash
  excludedCommands?: string[];          // 排除的命令清單
  allowUnsandboxedCommands?: string[];  // 允許不沙箱化的命令
  filesystem?: SandboxFilesystem;      // 檔案系統規則
  network?: SandboxNetwork;            // 網路規則
  enableWeakerNestedSandbox?: boolean;  // 啟用較寬鬆的嵌套沙箱
  enableWeakerNetworkIsolation?: boolean; // 啟用較寬鬆的網路隔離
}

// ─── Worktree 設定 ─────────────────────────────────────────
/** Git Worktree 相關設定 */
export interface WorktreeSettings {
  symlinkDirectories?: string[];  // 要建立 symlink 的目錄清單
  sparsePaths?: string[];         // sparse checkout 路徑
}

// ─── 自訂提示詞覆蓋 ────────────────────────────────────────
/** Spinner Tips 覆蓋設定 */
export interface SpinnerTipsOverride {
  excludeDefault?: boolean;  // 排除預設 tips
  tips: string[];            // 自訂 tips 清單
}

/** Spinner 動詞設定 */
export interface SpinnerVerbs {
  mode: 'replace' | 'append';  // 取代或追加模式
  verbs: string[];              // 動詞清單
}

// ─── 歸因設定 ──────────────────────────────────────────────
/** Commit/PR 歸因訊息模板 */
export interface AttributionSettings {
  commit?: string;  // Commit 訊息模板
  pr?: string;      // PR 描述模板
}

// ─── Auto Mode 設定 ────────────────────────────────────────
/** Auto 模式環境設定 */
export interface AutoModeSettings {
  environment?: string[];  // 觸發環境清單
  allow?: string[];        // 允許的操作清單
  soft_deny?: string[];    // 軟拒絕的操作清單
}

// ─── MCP 設定 ──────────────────────────────────────────────
/** MCP Server 設定項目 */
export interface McpServerEntry {
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
}

// ─── 完整 Claude Settings JSON 結構 ───────────────────────
/** settings.json 的完整結構（v2.0，含官方所有欄位） */
export interface ClaudeSettings {
  // ── 模型設定 ──
  model?: string;                          // 使用的 Claude 模型
  effortLevel?: EffortLevel;              // 推理努力等級
  availableModels?: string[];             // 可選模型清單（managed 限制用）
  modelOverrides?: Record<string, string>; // 模型別名覆蓋
  agent?: string;                          // 使用的 agent 名稱

  // ── 語言與輸出 ──
  language?: string;                       // 回應語言
  outputStyle?: string;                    // 輸出風格

  // ── 思考設定 ──
  alwaysThinkingEnabled?: boolean;         // 始終使用延伸思考
  showThinkingSummaries?: boolean;         // 顯示思考摘要

  // ── 更新設定 ──
  autoUpdatesChannel?: UpdateChannel;      // 自動更新通道
  autoUpdates?: boolean;                   // 是否啟用自動更新

  // ── UI 設定 ──
  prefersReducedMotion?: boolean;          // 減少動畫
  spinnerTipsEnabled?: boolean;            // 啟用 spinner tips
  spinnerTipsOverride?: SpinnerTipsOverride; // 自訂 spinner tips
  spinnerVerbs?: SpinnerVerbs;             // 自訂 spinner 動詞
  voiceEnabled?: boolean;                  // 啟用語音功能

  // ── Git 設定 ──
  includeCoAuthoredBy?: boolean;           // Commit 加入共同作者（已棄用，用 attribution）
  includeGitInstructions?: boolean;        // 包含 git 操作指引
  attribution?: AttributionSettings;       // Commit/PR 歸因模板
  respectGitignore?: boolean;              // 遵守 .gitignore 規則

  // ── Shell 設定 ──
  defaultShell?: string;                   // 預設 shell（如 /bin/bash）

  // ── Auto Mode ──
  disableAutoMode?: boolean;               // 停用 auto 模式
  useAutoModeDuringPlan?: boolean;         // plan 模式中使用 auto
  fastModePerSessionOptIn?: boolean;       // 每次 session 選擇 fast mode
  autoMode?: AutoModeSettings;             // auto 模式環境設定

  // ── 資料管理 ──
  cleanupPeriodDays?: number;              // 記錄清理週期（天）
  autoMemoryDirectory?: string;            // 自動記憶檔案目錄
  plansDirectory?: string;                 // Plan 檔案目錄

  // ── MCP 設定 ──
  enableAllProjectMcpServers?: boolean;    // 啟用所有專案 MCP servers
  enabledMcpjsonServers?: string[];        // 啟用的 MCP.json servers
  disabledMcpjsonServers?: string[];       // 停用的 MCP.json servers
  allowedMcpServers?: string[];            // 白名單 MCP servers
  deniedMcpServers?: string[];             // 黑名單 MCP servers
  allowManagedMcpServersOnly?: boolean;    // 僅允許 managed MCP servers
  mcpServers?: Record<string, McpServerEntry>; // MCP server 設定

  // ── 插件/Channel 設定 ──
  enabledPlugins?: Record<string, boolean>; // 啟用的插件
  channelsEnabled?: boolean;               // 啟用 channels
  allowedChannelPlugins?: string[];        // 允許的 channel 插件
  blockedMarketplaces?: string[];          // 黑名單 marketplace
  strictKnownMarketplaces?: boolean;       // 僅允許已知 marketplace
  extraKnownMarketplaces?: unknown[];      // 額外已知 marketplace

  // ── Hooks 設定 ──
  hooks?: HooksConfig;                     // Hook 事件設定
  disableAllHooks?: boolean;               // 停用所有 hooks
  allowedHttpHookUrls?: string[];          // 允許的 HTTP hook URL
  httpHookAllowedEnvVars?: string[];       // HTTP hook 可讀取的環境變數
  allowManagedHooksOnly?: boolean;         // 僅允許 managed hooks

  // ── 環境變數 ──
  env?: Record<string, string>;            // 環境變數鍵值對

  // ── 權限設定 ──
  permissions?: Permissions;              // 完整權限設定

  // ── Sandbox 設定 ──
  sandbox?: SandboxSettings;              // 沙箱設定

  // ── Worktree 設定 ──
  worktree?: WorktreeSettings;            // Git Worktree 設定

  // ── 認證與 API ──
  apiKeyHelper?: string;                   // API 金鑰輔助指令
  awsAuthRefresh?: string;                 // AWS 認證刷新指令
  awsCredentialExport?: string;            // AWS 憑證匯出指令
  forceLoginMethod?: string;               // 強制登入方式
  forceLoginOrgUUID?: string;              // 強制登入組織 UUID
  otelHeadersHelper?: string;              // OpenTelemetry headers 輔助指令

  // ── 企業設定 ──
  companyAnnouncements?: string[];         // 公司公告清單
  pluginTrustMessage?: string;             // 插件信任訊息
  feedbackSurveyRate?: number;             // 意見調查頻率
  disableDeepLinkRegistration?: boolean;   // 停用 deep link 註冊
}

// ─── 全域設定（~/.claude.json） ────────────────────────────
/** ~/.claude.json 的設定結構（與 settings.json 分離） */
export interface GlobalSettings {
  autoConnectIde?: boolean;               // 自動連線 IDE
  autoInstallIdeExtension?: boolean;      // 自動安裝 IDE 擴充
  editorMode?: 'normal' | 'vim';          // 編輯器模式
  showTurnDuration?: boolean;             // 顯示對話輪次時長
  terminalProgressBarEnabled?: boolean;   // 啟用終端進度列
  teammateMode?: 'auto' | 'in-process' | 'tmux'; // 協作模式
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

/** 全域設定檔資訊 */
export interface GlobalSettingsFile {
  path: string;
  status: FileStatus;
  data: GlobalSettings | null;
  raw: string;
}

// ─── Store 全局狀態 ────────────────────────────────────────
/** 當前選擇的 Tab（擴充為 11 個） */
export type TabId =
  | 'basic'
  | 'permissions'
  | 'hooks'
  | 'env'
  | 'sandbox'
  | 'mcp'
  | 'advanced'
  | 'global'
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
  // 全域設定檔（~/.claude.json）
  globalFile: GlobalSettingsFile;
  // 目前選取的專案目錄
  projectDir: string | null;
  // 目前選取的 Tab
  activeTab: TabId;
  // CLAUDE.md 內容
  claudeMd: ClaudeMdFiles;
  // 是否有未儲存的變更
  isDirty: boolean;
}
