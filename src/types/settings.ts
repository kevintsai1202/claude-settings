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

/** 九種 Hook 事件類型（含 v2.x 新增的 4 種） */
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'Stop'
  | 'SubagentStop'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCompact';

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
/** 努力等級（xhigh 為 Opus 4.7 預設；max 為 Claude 4.7 起新增的最高推理等級） */
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

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
/** MCP Server 類型 */
export type McpServerType = 'stdio' | 'sse' | 'http';

/** MCP Server 設定項目 */
export interface McpServerEntry {
  type: McpServerType;
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
}

// ─── StatusLine 設定 ───────────────────────────────────────
/**
 * StatusLine 類型
 * 注意：Claude Code 2.1.x 僅支援 'command'，static 已從 schema 移除
 */
export type StatusLineType = 'command';

/** StatusLine 設定 */
export interface StatusLineSettings {
  type: StatusLineType;         // 目前僅支援 'command'
  command?: string;             // 執行的 shell 命令，透過 stdin 接收 session JSON
  padding?: number;             // 左右內邊距
  refreshInterval?: number;     // 每 N 秒重新執行命令（最小值 1）
}

// ─── Agent / Command / Output Style 檔案 ───────────────────
/** Subagent 檔案（.md with frontmatter） */
export interface AgentFile {
  id: string;                   // 來源路徑當作唯一 ID
  scope: 'user' | 'project';    // 來源範圍
  name: string;                 // frontmatter.name 或檔名
  description?: string;         // frontmatter.description
  tools?: string[];             // frontmatter.tools（分號或逗號分隔）
  model?: string;               // frontmatter.model
  path: string;                 // 絕對路徑
  body: string;                 // frontmatter 之後的內容
}

/** Slash Command 檔案 */
export interface CommandFile {
  id: string;
  scope: 'user' | 'project';
  name: string;                 // 檔名（不含 .md）
  description?: string;
  argumentHint?: string;        // frontmatter.argument-hint
  allowedTools?: string[];      // frontmatter.allowed-tools
  model?: string;
  path: string;
  body: string;
}

/** Output Style 檔案 */
export interface OutputStyleFile {
  id: string;
  scope: 'user' | 'project' | 'builtin';
  name: string;
  description?: string;
  path: string;                 // builtin 時為虛擬路徑
  body: string;
}

/**
 * Auto Memory 檔案類型
 * 對應使用者 CLAUDE.md 指引中的四種類別（MEMORY.md 索引檔不使用此欄位）
 */
export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

/**
 * Auto Memory 檔案（~/.claude/projects/<slug>/memory/*.md）
 * 分為 MEMORY.md（索引，每次 session 前 200 行載入）與 topic files（按需讀取）
 */
export interface MemoryFile {
  id: string;                 // 檔名作為唯一 ID
  fileName: string;           // 檔名（含 .md，例如 "debugging.md"）
  isIndex: boolean;           // 是否為 MEMORY.md
  displayName?: string;       // frontmatter.name（非 index 檔案才有）
  description?: string;       // frontmatter.description
  memoryType?: MemoryType;    // frontmatter.type
  path: string;               // 檔案絕對路徑
  body: string;               // frontmatter 之後的主體
  raw: string;                // 原始完整檔案內容（for MEMORY.md 直接顯示與編輯）
}

/** Rule 檔案（.claude/rules/*.md，支援巢狀子資料夾） */
export interface RuleFile {
  id: string;                   // 以 scope + relPath 組成，唯一識別
  scope: 'user' | 'project';    // 來源範圍
  name: string;                 // 相對於 rules/ 的路徑（不含 .md，例如 "frontend/testing"）
  description?: string;         // frontmatter.description（可選）
  paths?: string[];             // frontmatter.paths glob 清單；空代表無條件載入
  path: string;                 // .md 檔案絕對路徑
  relPath: string;              // 相對於 rules/ 的完整路徑（含 .md，用於顯示與 id）
  body: string;                 // frontmatter 之後的內容
}

/** Skill 檔案（.../<skill>/SKILL.md） */
export interface SkillFile {
  id: string;
  scope: 'user' | 'project';
  name: string;                 // 資料夾名稱（skill id）
  displayName?: string;         // frontmatter.name（若有，通常同資料夾名）
  description?: string;
  allowedTools?: string[];      // frontmatter.allowed-tools
  dir: string;                  // skill 資料夾絕對路徑
  path: string;                 // SKILL.md 檔案絕對路徑
  body: string;                 // SKILL.md 的主體（去除 frontmatter）
  subdirs: string[];            // skill 資料夾下的子資料夾（references / scripts 等）
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
  autoMemoryEnabled?: boolean;             // 啟用自動記憶（預設 true）
  autoMemoryDirectory?: string;            // 自動記憶檔案目錄
  plansDirectory?: string;                 // Plan 檔案目錄
  claudeMdExcludes?: string[];             // 要排除的 CLAUDE.md / rules 路徑 glob 清單

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
  extraKnownMarketplaces?: Record<string, unknown>; // 額外已知 marketplace（物件格式：名稱 → 設定）

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

  // ── StatusLine 設定 ──
  statusLine?: StatusLineSettings;        // 狀態列自訂

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
  skipDangerousModePermissionPrompt?: boolean; // 略過危險模式確認提示（根層級）
  skipAutoPermissionPrompt?: boolean;          // 略過 auto 模式權限確認提示
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

/** 單一設定檔的完整資訊（支援 draft + 單步 undo） */
export interface SettingsFile {
  layer: SettingsLayer;
  path: string;
  status: FileStatus;
  data: ClaudeSettings | null;                // 目前編輯中（可能為 draft）
  raw: string;                                // 已寫入磁碟的原始 JSON 字串
  dirty: boolean;                             // 是否有未寫入磁碟的變更
  previousData?: ClaudeSettings | null;       // 上一步 snapshot（for undo）
}

/** 全域設定檔資訊（支援 draft + 單步 undo） */
export interface GlobalSettingsFile {
  path: string;
  status: FileStatus;
  data: GlobalSettings | null;
  raw: string;
  dirty: boolean;
  previousData?: GlobalSettings | null;
}

// ─── Store 全局狀態 ────────────────────────────────────────
/** 當前選擇的 Tab（v3.1 — 16 個） */
export type TabId =
  | 'basic'
  | 'permissions'
  | 'hooks'
  | 'env'
  | 'sandbox'
  | 'mcp'
  | 'agents'
  | 'commands'
  | 'outputstyles'
  | 'skills'
  | 'rules'
  | 'memory'
  | 'dialogue'
  | 'statusline'
  | 'advanced'
  | 'global'
  | 'claudemd'
  | 'merge'
  | 'json';

/** 單一 CLAUDE.md 檔案的資訊（支援 draft + 單步 undo） */
export interface ClaudeMdEntry {
  content: string;          // 目前編輯中的內容（可能為 draft）
  committedContent: string; // 已寫入磁碟的內容（dirty 比較基準）
  path: string;             // 檔案路徑（原始型式）
  status: FileStatus;       // 讀取狀態
  dirty: boolean;           // 是否有未儲存變更
  previousContent?: string; // 上一步 snapshot（for undo）
}

/** CLAUDE.md 多標籤 — 每筆含內容與檔案資訊 */
export interface ClaudeMdFiles {
  global: ClaudeMdEntry;   // ~/.claude/CLAUDE.md
  project: ClaudeMdEntry;  // <project>/CLAUDE.md
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
  // Subagents 清單（user + project）
  agents: AgentFile[];
  // Slash Commands 清單
  commands: CommandFile[];
  // Output Styles 清單（builtin + user + project）
  outputStyles: OutputStyleFile[];
  // Skills 清單（user + project）
  skills: SkillFile[];
  // Rules 清單（user + project）
  rules: RuleFile[];
  // Auto memory 檔案清單（當前專案）
  memoryFiles: MemoryFile[];
  // 計算出的 auto memory 資料夾絕對路徑（null 表示未選擇專案或無法解析）
  memoryDir: string | null;
}
