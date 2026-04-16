# Claude Code 設定 - 官方文件參考

> 來源：https://code.claude.com/docs/zh-TW/settings
> 擷取日期：2026-04-16

---

## 設定範圍

Claude Code 使用**範圍系統**來決定設定的適用位置和共享對象。

### 可用的範圍

| 範圍          | 位置                                               | 影響對象       | 與團隊共享？        |
| :---------- | :----------------------------------------------- | :--------- | :------------ |
| **Managed** | 伺服器管理的設定、plist / 登錄或系統層級 `managed-settings.json` | 機器上的所有使用者  | 是（由 IT 部署）    |
| **User**    | `~/.claude/` 目錄                                  | 您，跨所有專案    | 否             |
| **Project** | 儲存庫中的 `.claude/`                                 | 此儲存庫的所有協作者 | 是（提交到 git）    |
| **Local**   | `.claude/settings.local.json`                    | 您，僅在此儲存庫中  | 否（gitignored） |

### 範圍優先順序

1. **Managed**（最高）- 無法被任何東西覆蓋
2. **命令列引數** - 臨時工作階段覆蓋
3. **Local** - 覆蓋專案和使用者設定
4. **Project** - 覆蓋使用者設定
5. **User**（最低）- 當沒有其他東西指定設定時適用

### 功能對應範圍

| 功能              | 使用者位置                     | 專案位置                              | 本機位置                          |
| :-------------- | :------------------------ | :-------------------------------- | :---------------------------- |
| **Settings**    | `~/.claude/settings.json` | `.claude/settings.json`           | `.claude/settings.local.json` |
| **Subagents**   | `~/.claude/agents/`       | `.claude/agents/`                 | 無                             |
| **MCP servers** | `~/.claude.json`          | `.mcp.json`                       | `~/.claude.json`（每個專案）        |
| **Plugins**     | `~/.claude/settings.json` | `.claude/settings.json`           | `.claude/settings.local.json` |
| **CLAUDE.md**   | `~/.claude/CLAUDE.md`     | `CLAUDE.md` 或 `.claude/CLAUDE.md` | 無                             |

---

## 設定檔案

### Managed 設定部署位置

- **macOS**：`/Library/Application Support/ClaudeCode/`
- **Linux 和 WSL**：`/etc/claude-code/`
- **Windows**：`C:\Program Files\ClaudeCode\`

### Windows MDM/OS 層級政策

- `HKLM\SOFTWARE\Policies\ClaudeCode` 登錄機碼（`Settings` 值，REG_SZ 或 REG_EXPAND_SZ 包含 JSON）
- `HKCU\SOFTWARE\Policies\ClaudeCode`（使用者層級，最低政策優先順序）

---

## 可用的設定（settings.json）

| 金鑰 | 說明 | 範例 |
| :--- | :--- | :--- |
| `agent` | 將主執行緒作為命名 subagent 執行 | `"code-reviewer"` |
| `allowedChannelPlugins` | （Managed）可推送訊息的頻道 plugins 白名單 | `[{ "marketplace": "claude-plugins-official", "plugin": "telegram" }]` |
| `allowedHttpHookUrls` | HTTP hooks URL 模式白名單 | `["https://hooks.example.com/*"]` |
| `allowedMcpServers` | MCP servers 白名單 | `[{ "serverName": "github" }]` |
| `allowManagedHooksOnly` | （Managed）僅允許 managed hooks | `true` |
| `allowManagedMcpServersOnly` | （Managed）僅尊重 managed MCP servers 白名單 | `true` |
| `allowManagedPermissionRulesOnly` | （Managed）僅用 managed 權限規則 | `true` |
| `alwaysThinkingEnabled` | 預設啟用擴展思考 | `true` |
| `apiKeyHelper` | 自訂 API key 產生指令碼 | `/bin/generate_temp_api_key.sh` |
| `attribution` | 自訂 git 提交和 PR 歸屬 | `{"commit": "...", "pr": ""}` |
| `autoMemoryDirectory` | 自動記憶儲存目錄 | `"~/my-memory-dir"` |
| `autoMode` | 自訂自動模式分類器 | `{"environment": ["Trusted repo: ..."]}` |
| `autoUpdatesChannel` | 更新頻道 `"stable"` 或 `"latest"` | `"stable"` |
| `availableModels` | 限制可選模型 | `["sonnet", "haiku"]` |
| `awsAuthRefresh` | AWS 認證重新整理指令碼 | `aws sso login --profile myprofile` |
| `awsCredentialExport` | AWS 認證匯出指令碼 | `/bin/generate_aws_grant.sh` |
| `blockedMarketplaces` | （Managed）marketplace 黑名單 | `[{ "source": "github", "repo": "untrusted/plugins" }]` |
| `channelsEnabled` | （Managed）啟用頻道 | `true` |
| `cleanupPeriodDays` | 工作階段清理天數（預設30） | `20` |
| `companyAnnouncements` | 啟動時公告 | `["Welcome to Acme Corp!"]` |
| `defaultShell` | 預設 shell（`"bash"` 或 `"powershell"`） | `"powershell"` |
| `deniedMcpServers` | MCP servers 拒絕清單 | `[{ "serverName": "filesystem" }]` |
| `disableAllHooks` | 停用所有 hooks 和狀態行 | `true` |
| `disableAutoMode` | 防止啟用自動模式 | `"disable"` |
| `disableDeepLinkRegistration` | 防止 claude-cli:// 協議註冊 | `"disable"` |
| `disabledMcpjsonServers` | 拒絕的 .mcp.json servers | `["filesystem"]` |
| `effortLevel` | 努力等級 `"low"` / `"medium"` / `"high"` | `"medium"` |
| `enableAllProjectMcpServers` | 自動批准專案 MCP servers | `true` |
| `enabledMcpjsonServers` | 批准的 .mcp.json servers | `["memory", "github"]` |
| `env` | 環境變數 | `{"FOO": "bar"}` |
| `fastModePerSessionOptIn` | 快速模式需每工作階段啟用 | `true` |
| `feedbackSurveyRate` | 品質調查機率（0–1） | `0.05` |
| `fileSuggestion` | 自訂 @ 檔案建議 | `{"type": "command", "command": "..."}` |
| `forceLoginMethod` | 限制登入方式 | `"claudeai"` |
| `forceLoginOrgUUID` | 要求特定組織登入 | `"uuid..."` |
| `hooks` | 生命週期事件 hooks | 參見 hooks 文件 |
| `httpHookAllowedEnvVars` | HTTP hooks 環境變數白名單 | `["MY_TOKEN", "HOOK_SECRET"]` |
| `includeCoAuthoredBy` | （已棄用）git co-authored-by 署名 | `false` |
| `includeGitInstructions` | 包含內建 git 指示 | `false` |
| `language` | 回應語言 | `"japanese"` |
| `model` | 預設模型 | `"claude-sonnet-4-6"` |
| `modelOverrides` | 模型 ID 對應 | `{"claude-opus-4-6": "arn:aws:bedrock:..."}` |
| `otelHeadersHelper` | OTEL 標頭產生指令碼 | `/bin/generate_otel_headers.sh` |
| `outputStyle` | 輸出樣式 | `"Explanatory"` |
| `permissions` | 權限設定 | 見權限設定表 |
| `plansDirectory` | 計畫檔案目錄 | `"./plans"` |
| `pluginTrustMessage` | （Managed）plugin 信任自訂訊息 | `"All plugins from our marketplace are approved by IT"` |
| `prefersReducedMotion` | 減少 UI 動畫 | `true` |
| `respectGitignore` | @ 選擇器尊重 .gitignore | `false` |
| `showClearContextOnPlanAccept` | 計畫接受時顯示清除選項 | `true` |
| `showThinkingSummaries` | 顯示思考摘要 | `true` |
| `spinnerTipsEnabled` | 微調器提示 | `false` |
| `spinnerTipsOverride` | 自訂微調器提示 | `{ "excludeDefault": true, "tips": ["..."] }` |
| `spinnerVerbs` | 自訂微調器動詞 | `{"mode": "append", "verbs": ["Pondering"]}` |
| `statusLine` | 自訂狀態行 | `{"type": "command", "command": "..."}` |
| `strictKnownMarketplaces` | （Managed）marketplace 白名單 | 見文件 |
| `useAutoModeDuringPlan` | Plan Mode 使用自動模式語義 | `false` |
| `voiceEnabled` | 語音聽寫 | `true` |

---

## 全域設定（~/.claude.json）

| 金鑰 | 說明 | 範例 |
| :--- | :--- | :--- |
| `autoConnectIde` | 自動連線 IDE | `true` |
| `autoInstallIdeExtension` | 自動安裝 IDE 擴充功能 | `false` |
| `editorMode` | 快捷鍵模式 `"normal"` / `"vim"` | `"vim"` |
| `showTurnDuration` | 顯示輪次持續時間 | `false` |
| `terminalProgressBarEnabled` | 終端機進度條 | `false` |
| `teammateMode` | agent team 顯示模式 | `"in-process"` |

---

## Worktree 設定

| 金鑰 | 說明 | 範例 |
| :--- | :--- | :--- |
| `worktree.symlinkDirectories` | 要符號連結的目錄 | `["node_modules", ".cache"]` |
| `worktree.sparsePaths` | sparse-checkout 路徑 | `["packages/my-app", "shared/utils"]` |

---

## 權限設定

| 金鑰 | 說明 | 範例 |
| :--- | :--- | :--- |
| `allow` | 允許的權限規則 | `[ "Bash(git diff *)" ]` |
| `ask` | 需確認的權限規則 | `[ "Bash(git push *)" ]` |
| `deny` | 拒絕的權限規則 | `[ "WebFetch", "Read(./.env)" ]` |
| `additionalDirectories` | 額外工作目錄 | `[ "../docs/" ]` |
| `defaultMode` | 預設權限模式 | `"acceptEdits"` |
| `disableBypassPermissionsMode` | 停用 bypass 模式 | `"disable"` |
| `skipDangerousModePermissionPrompt` | 跳過 bypass 確認 | `true` |

### 權限規則語法

| 規則 | 效果 |
| :--- | :--- |
| `Bash` | 所有 Bash 命令 |
| `Bash(npm run *)` | 以 `npm run` 開頭的命令 |
| `Read(./.env)` | 讀取 `.env` 檔案 |
| `WebFetch(domain:example.com)` | 對 example.com 的請求 |

---

## Sandbox 設定

| 金鑰 | 說明 | 預設 |
| :--- | :--- | :--- |
| `enabled` | 啟用 bash sandboxing | `false` |
| `failIfUnavailable` | sandbox 無法啟動時報錯 | `false` |
| `autoAllowBashIfSandboxed` | sandboxed 時自動批准 bash | `true` |
| `excludedCommands` | sandbox 外執行的命令 | - |
| `allowUnsandboxedCommands` | 允許 dangerouslyDisableSandbox | `true` |
| `filesystem.allowWrite` | 額外允許寫入路徑 | - |
| `filesystem.denyWrite` | 拒絕寫入路徑 | - |
| `filesystem.denyRead` | 拒絕讀取路徑 | - |
| `filesystem.allowRead` | 在 denyRead 中重新允許讀取 | - |
| `filesystem.allowManagedReadPathsOnly` | （Managed）僅用 managed 允許讀取路徑 | `false` |
| `network.allowUnixSockets` | 允許的 Unix socket 路徑 | - |
| `network.allowAllUnixSockets` | 允許所有 Unix sockets | `false` |
| `network.allowLocalBinding` | 允許 localhost 繫結 | `false` |
| `network.allowedDomains` | 允許的出站網域 | - |
| `network.allowManagedDomainsOnly` | （Managed）僅用 managed 網域 | `false` |
| `network.httpProxyPort` | HTTP 代理連接埠 | - |
| `network.socksProxyPort` | SOCKS5 代理連接埠 | - |
| `enableWeakerNestedSandbox` | 弱 sandbox（Docker） | `false` |
| `enableWeakerNetworkIsolation` | 弱網路隔離（macOS） | `false` |

### Sandbox 路徑前綴

| 前綴 | 含義 |
| :--- | :--- |
| `/` | 絕對路徑 |
| `~/` | 主目錄 |
| `./` 或無前綴 | 專案相對 |

---

## 歸屬設定

| 金鑰 | 說明 |
| :--- | :--- |
| `commit` | git 提交歸屬（含 trailers），空字串隱藏 |
| `pr` | PR 歸屬，空字串隱藏 |

---

## 檔案建議設定

```json
{
  "fileSuggestion": {
    "type": "command",
    "command": "~/.claude/file-suggestion.sh"
  }
}
```

命令透過 stdin 接收 `{"query": "src/comp"}`，輸出換行分隔的檔案路徑。

---

## Hook 設定

- `allowManagedHooksOnly`（Managed）：僅允許 managed 和 SDK hooks
- `allowedHttpHookUrls`：HTTP hooks URL 白名單，支援 `*` 萬用字元
- `httpHookAllowedEnvVars`：HTTP hooks 環境變數白名單

---

## Plugin 設定

### enabledPlugins

格式：`"plugin-name@marketplace-name": true/false`

### extraKnownMarketplaces

Marketplace 來源類型：
- `github`：GitHub 儲存庫（`repo`）
- `git`：任何 git URL（`url`）
- `directory`：本機路徑（`path`，開發用）
- `hostPattern`：正規表達式（`hostPattern`）
- `settings`：內嵌 marketplace（`name`, `plugins`）
- `url`：URL-based marketplace（`url`, `headers`）
- `npm`：NPM 套件（`package`）
- `file`：檔案路徑（`path`）

### strictKnownMarketplaces（Managed 僅限）

- `undefined`：無限制
- `[]`：完全鎖定
- 來源清單：僅允許匹配的 marketplaces

---

## 設定優先順序

1. **Managed 設定**（伺服器管理 > MDM/OS > 檔案型 > HKCU 登錄）
2. **命令列引數**
3. **本機專案設定**（`.claude/settings.local.json`）
4. **共享專案設定**（`.claude/settings.json`）
5. **使用者設定**（`~/.claude/settings.json`）

> 陣列設定跨範圍**合併**（連接和去重），非替換。

---

## 設定系統要點

- **CLAUDE.md**：啟動時載入的指示
- **settings.json**：權限、環境變數和工具行為
- **Skills**：自訂提示，`/skill-name` 叫用
- **MCP servers**：擴展工具和整合
- **Subagents**：`~/.claude/agents/` 或 `.claude/agents/`
- **Plugins**：透過 marketplaces 分發的擴展

---

## 驗證設定

在 Claude Code 內執行 `/status` 查看設定來源和狀態。
