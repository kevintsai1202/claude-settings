# Claude Settings Manager

> 一站式管理 Claude Code 全部設定的 Tauri 桌面應用程式 — 多層設定合并、資源瀏覽、Hooks / StatusLine 社群範本、Draft Mode 統一儲存。

![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?logo=tauri)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-0078D4?logo=apple)
![Version](https://img.shields.io/badge/Version-v3.1.0-7c3aed)

---

## 下載

| 平台 | 類型 | 檔案 | 說明 |
|------|------|------|------|
| Windows | NSIS 安裝程式 | `Claude Settings Manager_3.1.0_x64-setup.exe` | 推薦使用；體積小，支援自訂安裝路徑 |
| Windows | MSI 安裝程式 | `Claude Settings Manager_3.1.0_x64_en-US.msi` | 企業派送／Group Policy 適用 |
| macOS | DMG 磁碟映像 | `Claude Settings Manager_3.1.0_aarch64.dmg` | Apple Silicon（M1/M2/M3）適用 |
| macOS | DMG 磁碟映像 | `Claude Settings Manager_3.1.0_x64.dmg` | Intel Mac 適用 |

> 至 [GitHub Releases](https://github.com/kevintsai1202/claude-settings/releases/latest) 下載最新版本。
>
> **macOS 首次開啟提示：** 若被 Gatekeeper 阻擋，請在 Finder 中**右鍵 → 開啟**一次；或執行 `xattr -cr "/Applications/Claude Settings Manager.app"` 解除隔離屬性。

---

## 功能概覽

Claude Code 的設定散落在多個 JSON、CLAUDE.md、MCP 設定、Agents、Commands、Skills、Output Styles、Hooks、StatusLine 指令中，手動管理極易出錯。Claude Settings Manager 提供單一 GUI 介面，讓你：

- 同時檢視並編輯 **User / Project / Local / Managed** 四層設定
- 即時預覽多層合并後的最終有效值與來源（色彩標記）
- 以視覺化表單管理 Permissions、Hooks、環境變數、Sandbox 沙箱
- 直接編輯 **CLAUDE.md**（Global + Project）
- 瀏覽 `~/.claude/{agents, commands, skills, output-styles}` 自訂資源
- 管理 **MCP Server** 設定與插件清單
- 設定 **StatusLine**（自訂狀態列指令，內建 13 個範本）
- 設計 **Hooks**（內建 14 個範本，含社群貢獻）
- **Draft Mode** — 所有改動先存草稿，統一儲存／單步還原
- **JSON 行內錯誤高亮** — 錯誤字元以紅色顯示，滑鼠懸停顯示原因

---

## 介面說明

三欄式佈局 + 兩層導航（類別 → Tab）：

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙ Claude Settings Manager  v3.1.0       [⟲ 還原][💾 儲存][🌙]  │
├────────────────┬────────────────────────────────────────────────┤
│ [📁 myproject▼]│ [⚙ 設定(7)] [📚 資源(6)] [📂 文件(3)]          │
│ ─────────────  │ [基本設定][Permissions][Hooks][Env][Sandbox]... │
│ 📋 Settings    │ ──────────────────────────────────────────────  │
│   User      ✅ │                                                 │
│   Project   ✅ │                                                 │
│   Local     ⚫  │        （選取的 Tab 內容）                     │
│   Managed   🔒 │                                                 │
│ ─────────────  │                                                 │
│ 📝 CLAUDE.md   │                                                 │
│   Global    ✅ │                                                 │
│   Project   ✅ │                                                 │
└────────────────┴────────────────────────────────────────────────┘
```

- **左側 Sidebar**（純顯示，不可點擊）：頂部為專案選擇器，底下列出 Settings.json 四層與 CLAUDE.md 兩份的檔案狀態徽章。
- **頂部 Header**：右側顯示「未儲存數量」徽章、⟲ 還原（單步）、💾 儲存（脈動提醒），並綁 `Ctrl+S` / `Ctrl+Z` 快捷鍵。
- **兩層 TabBar**：上層 3 個類別、下層顯示該類別底下的 Tab 清單。

---

## 16 個功能 Tab，分 3 類別

### 設定（7）

| Tab | 說明 |
|-----|------|
| **基本設定** | model、effortLevel、language、outputStyle、alwaysThinking、autoUpdates 等布爾開關 |
| **Permissions** | Allow / Ask / Deny 三區塊規則管理；Glob 語法；`defaultMode` 6 選項下拉 |
| **Hooks** | 9 種事件（PreToolUse、PostToolUse、Stop…）；內建 14 個範本（8 官方 + 6 社群） |
| **Env Vars** | 環境變數鍵值對編輯器 |
| **Sandbox** | 沙箱檔案系統與網路存取規則 |
| **進階設定** | worktree、attribution、apiKeyHelper 等 |
| **全域設定** | `~/.claude.json` 的 editorMode、teammateMode 等 |

### 資源（6）

| Tab | 說明 |
|-----|------|
| **Agents** | 瀏覽 `~/.claude/agents/*.md`（User / Project 雙 scope） |
| **Commands** | 瀏覽 `~/.claude/commands/*.md` |
| **Output Styles** | 瀏覽 `~/.claude/output-styles/*.md` |
| **Skills** | 瀏覽 `~/.claude/skills/[name]/SKILL.md`；列出 references / scripts 子目錄 |
| **MCP / Plugins** | MCP Server 設定、插件啟用/停用清單 |
| **Status Line** | 自訂狀態列指令；內建 13 個範本（7 官方 + 6 社群） |

### 文件（3）

| Tab | 說明 |
|-----|------|
| **CLAUDE.md** | Global 和 Project 兩個 CLAUDE.md 的 Markdown 編輯器 |
| **Merge** | 四層合并預覽，顯示最終值與來源色彩標籤 |
| **JSON** | 各層設定的原始 JSON 編輯器；AJV 即時驗證；行內錯誤紅色高亮 + Hover 原因提示 |

---

## v3.0 新功能焦點

### Draft Mode（統一儲存 + 單步還原）

所有改動先進入記憶體草稿，不立即寫盤：

- Header 顯示當前未儲存檔案數量
- `Ctrl+S` 或點擊「💾 儲存」寫入所有 dirty 檔案
- `Ctrl+Z` 或點擊「⟲ 還原」回到最後一次儲存狀態（單步）
- 關閉視窗或重新整理時有確認對話框，避免誤失改動

### 社群範本庫

**Hooks**（14 個）：阻擋危險 bash、保護敏感檔、prettier 自動格式化、ruff format、bash 日誌、git branch 注入、Session Start git status、完成嗶聲、TTS 語音、自動放行安全讀取、Discord webhook、MCP 稽核、自動執行測試、離線模式。

**StatusLine**（13 個）：官方簡約、emoji dashboard、色彩化 context、5h block bar、worktree dirty、session duration、wttr.in 即時天氣…

每個範本標記來源（official / community）、平台（win / unix / cross）、是否需網路、是否需額外安裝。

### JSON 行內錯誤高亮

JSON 編輯器使用 **透明 textarea + 可視 pre backdrop** 疊加技術：

- 解析錯誤字元以紅色背景高亮
- 滑鼠停留該字元顯示錯誤原因
- 點擊錯誤字元自動定位游標

---

## 管理的檔案

| 識別 | 路徑 (Windows) | 優先級 | 說明 |
|------|----------------|--------|------|
| Managed | `C:\Program Files\ClaudeCode\managed-settings.json` | 1（最高，唯讀） | 企業管控層 |
| Local | `<project>\.claude\settings.local.json` | 2 | 個人本地覆蓋 |
| Project | `<project>\.claude\settings.json` | 3 | 專案共用 |
| User | `%USERPROFILE%\.claude\settings.json` | 4（最低） | 全局個人設定 |

附加管理：

- `%USERPROFILE%\.claude\CLAUDE.md` — Global 指令文件
- `<project>\CLAUDE.md` — 專案指令文件
- `%USERPROFILE%\.claude.json` — 全域設定（editorMode 等）
- `%USERPROFILE%\.claude\agents/`、`commands/`、`skills/`、`output-styles/` — 自訂資源（唯讀瀏覽）

---

## 合并規則

多層設定優先級（由高至低）：

```
Managed（唯讀）> Local > Project > User
```

- **純量值**（model、language 等）：高優先層直接覆蓋低優先層
- **陣列值**（permissions.allow 等）：各層陣列合并後去重
- **物件值**（env 等）：高優先同 key 覆蓋低優先
- **Managed 層**在 UI 中標示為 🔒 唯讀，無法透過應用程式修改

---

## 技術架構

| 層面 | 技術 |
|------|------|
| 桌面框架 | Tauri v2 |
| 前端 | React 19 + Vite 7 + TypeScript 5 |
| 狀態管理 | Zustand v5 |
| 檔案存取 | `@tauri-apps/plugin-fs` v2 |
| 對話框 | `@tauri-apps/plugin-dialog` v2 |
| JSON 驗證 | AJV v8 + ajv-formats |
| 圖示庫 | lucide-react |
| 樣式 | Vanilla CSS（深色／亮色主題，WCAG AA 對比度） |

---

## 平台支援

| 平台 | 狀態 | 備註 |
|------|------|------|
| Windows 11 / 10 | ✅ 完整支援 | 所有功能可用；Windows 10 需手動安裝 WebView2 |
| macOS 12+ (Apple Silicon / Intel) | ✅ 完整支援 | v3.0.2 起支援；CI 自動打包 DMG；Managed 層路徑與 Python launcher (`python3`) 已平台感知 |
| Linux | ⚠ 實驗性 | 尚未測試；資源路徑需驗證 |

### 平台差異一覽

| 項目 | Windows | macOS |
|------|---------|-------|
| Managed 層路徑 | `C:\Program Files\ClaudeCode\managed-settings.json` | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| User 層路徑 | `%USERPROFILE%\.claude\settings.json` | `$HOME/.claude/settings.json` |
| Python launcher（Hook/StatusLine 範本） | `py`（Python Launcher for Windows） | `python3` |
| 打包產物 | `.msi` / `.exe`（NSIS） | `.dmg` / `.app` |
| Shell 偏好（進階設定） | PowerShell / cmd 優先 | zsh / bash 優先 |

> UI 會依執行平台自動挑選對應的預設值，但仍保留跨平台選項，讓你可在 macOS 上為 Windows 機器編輯設定（反之亦然）。

---

## 環境需求與安裝

### 必要軟體

#### Windows

| 軟體 | 版本需求 | 用途 |
|------|----------|------|
| [Node.js](https://nodejs.org/) | 18+ | 前端建置與 npm 指令 |
| [Rust (rustup)](https://rustup.rs/) | 1.80+ | Tauri 後端編譯 |
| [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) | 2022+ | Rust 在 Windows 上的 C++ 連結器 |
| [Git](https://git-scm.com/) | 任意版本 | 版本控制（Status Line Git 範本需要） |
| [Python](https://www.python.org/downloads/) | 3.8+（建議透過官方安裝） | Status Line Command 範本使用 `py` launcher |
| WebView2 Runtime | 自動 | Windows 11 已預裝；Windows 10 需手動安裝 |

#### macOS

| 軟體 | 版本需求 | 用途 |
|------|----------|------|
| Xcode Command Line Tools | 任意版本 | C/C++ 工具鏈；`xcode-select --install` |
| [Node.js](https://nodejs.org/) | 18+ | 前端建置與 npm 指令 |
| [Rust (rustup)](https://rustup.rs/) | 1.80+ | Tauri 後端編譯 |
| Python 3 | 3.8+ | Hook / Status Line 範本透過 `python3` 呼叫 |
| Git | 任意版本 | macOS 安裝 Xcode CLT 時附帶 |

> **重要：Python 安裝注意事項**
> 請使用 **[python.org 官方安裝程式](https://www.python.org/downloads/)**，**不要** 使用 Microsoft Store 版本。
> Store 版本的 `python3.exe` 是 stub，呼叫時會開啟 Store 頁面而非執行 Python，導致 Status Line command 無聲地失敗。
> 官方安裝後，`py` 指令（Windows Python Launcher）即可正常使用。

---

### 步驟一：安裝 Rust

```powershell
winget install Rustlang.Rustup
```

安裝完成後**重新開啟終端**，確認：

```powershell
rustc --version   # 預期 >= 1.80
cargo --version
```

---

### 步驟二：安裝 Visual Studio C++ Build Tools

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

安裝程式開啟後，勾選 **「Desktop development with C++」** 工作負載（包含 MSVC 編譯器與 Windows SDK），然後點擊「安裝」。

---

### 步驟三：安裝 Node.js

前往 [nodejs.org](https://nodejs.org/) 下載 LTS 版本（18+），執行安裝程式即可。

```powershell
node --version   # v18.x 或更新
npm --version
```

---

### 步驟四：安裝 Python（Status Line 功能需要）

前往 [python.org/downloads](https://www.python.org/downloads/) 下載最新版（3.8+），執行安裝程式時勾選 **「Add Python to PATH」**。

```powershell
py --version   # Python 3.x.x
```

---

### 步驟五：WebView2 Runtime（Windows 10 需要）

Windows 11 已內建 WebView2。Windows 10 使用者至 [Microsoft WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) 下載 Evergreen 版本安裝。

---

### macOS 安裝步驟

```bash
# 1. Xcode Command Line Tools
xcode-select --install

# 2. Node.js（建議用 Homebrew 或 nvm）
brew install node         # 或: nvm install --lts

# 3. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 4. 驗證
node --version && cargo --version && python3 --version
```

---

### 克隆並啟動

```bash
git clone https://github.com/kevintsai1202/claude-settings.git
cd claude-settings
npm install
npm run tauri dev
```

### 打包安裝程式

**Windows**：

```powershell
npm run tauri build
# 輸出位置：
#   src-tauri\target\release\bundle\nsis\  （NSIS 安裝程式 .exe）
#   src-tauri\target\release\bundle\msi\   （MSI 安裝程式 .msi）
#   src-tauri\target\release\tauri-app.exe  （免安裝執行檔）
```

**macOS**：

```bash
npm run tauri build
# 輸出位置：
#   src-tauri/target/release/bundle/dmg/    （DMG 磁碟映像）
#   src-tauri/target/release/bundle/macos/  （.app bundle）
```

---

## 開發指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 僅啟動前端 Vite Dev Server（port 1420） |
| `npm run build` | TypeScript 編譯 + Vite 打包 |
| `npm run tauri dev` | 啟動完整 Tauri 開發視窗 |
| `npm run tauri build` | 打包成 Windows 安裝程式 |

---

## 專案結構

```
claude-settings/
├── src/                               # 前端（React + TypeScript）
│   ├── App.tsx                        # 根元件，三欄佈局與 Tab 路由
│   ├── components/
│   │   ├── Sidebar/                   # 左側 Sidebar（純顯示 + 頂部專案選擇器）
│   │   ├── TabBar/                    # 兩層 Tab 導航（類別 → Tab）
│   │   ├── tabs/                      # 各功能 Tab 元件（16 個）
│   │   │   ├── BasicSettings.tsx
│   │   │   ├── Hooks.tsx              # 含 14 個 Hook 範本
│   │   │   ├── StatusLineTab.tsx      # 含 13 個 StatusLine 範本
│   │   │   ├── AgentsTab.tsx
│   │   │   ├── CommandsTab.tsx
│   │   │   ├── SkillsTab.tsx
│   │   │   ├── OutputStylesTab.tsx
│   │   │   ├── JsonEditor.tsx         # 行內錯誤高亮 + Hover 提示
│   │   │   ├── hookTemplates.ts       # Hook 範本資料
│   │   │   └── ...
│   │   └── ui/
│   │       ├── ComboBox.tsx           # 下拉 + 自訂輸入混合元件
│   │       └── ...
│   ├── hooks/
│   │   ├── useFileManager.ts          # Tauri FS 讀寫封裝（Draft Mode）
│   │   ├── useResourceLoader.ts       # 讀取 agents/commands/skills/output-styles
│   │   ├── useManagedField.ts         # Managed 層唯讀鎖定邏輯
│   │   └── useTheme.ts                # 亮/暗主題切換
│   ├── schemas/
│   │   └── claude-code-settings.schema.json  # AJV 驗證用
│   ├── store/
│   │   └── settingsStore.ts           # Zustand（含 Draft Mode 狀態）
│   ├── types/settings.ts              # TypeScript 型別定義（50+ 欄位）
│   └── utils/
│       ├── merge.ts                   # 多層設定合并演算法
│       ├── schemaValidator.ts         # AJV Schema 驗證
│       └── frontmatter.ts             # Markdown frontmatter 解析
└── src-tauri/                         # Rust 後端（幾乎無自訂邏輯）
    ├── src/main.rs
    └── tauri.conf.json
```

---

## 授權

本專案目前尚未指定授權條款。聯絡作者討論使用範圍。

---

## 貢獻

歡迎回報 bug、建議新 Hook / StatusLine 範本，或提出 PR 改進 UI / 驗證邏輯。

---

## 版本日誌

### v3.1.0 — 2026-04-17

- ✨ **資源檔完整 CRUD**：Agents / Commands / Output Styles / Skills 四類資源支援建立、編輯、刪除；新增共用 `ResourceEditor` 元件統一處理 frontmatter + 內文編輯體驗。
- 🤖 **Subagent 範本庫**：內建多主題範本（core / quality / lang / devex / data / infra），一鍵套用並自動處理檔名衝突（`-1` / `-2` 後綴，最多 99）與範圍解析。
- 🔗 **CLAUDE.md `@path` 引用偵測**：自動解析檔案內 `@path` 形式的引用並於右側面板預覽目標內容。
- 📊 **CLAUDE.md 大小提示**：即時顯示字元數 / 行數 / 預估 token 數，超過門檻時顯示警告。
- 🛡️ **Output Styles 內建保護 / Skills 資料夾語意**：避免誤刪內建樣式；Skills 採資料夾結構管理（`<name>/SKILL.md`）。
- 🧩 **Frontmatter round-trip 序列化**：新增 `stringifyFrontmatter()` 工具，保留 body 與空白不失真。

### v3.0.2 — 2026-04-17

- ✨ **macOS 完整支援**：新增 macOS 打包產物（`.dmg` / `.app`），CI 以 `windows-latest` + `macos-latest` matrix 自動建置並建立 draft release。
- 🔧 **跨平台路徑感知**：`resolvePath()` 依平台展開 `%USERPROFILE%` / `$HOME`；Managed 層路徑依 OS 切換（`/Library/Application Support/ClaudeCode/…`）。
- 🐍 **Python launcher 平台適配**：Hook / StatusLine 範本的 `{{PYTHON}}` 佔位符依平台替換為 `py`（Windows）或 `python3`（macOS/Linux）。
- 🎨 **UI 平台感知預設**：StatusLine 語言過濾、進階設定 Shell 排序依執行平台挑選預設值。

### v3.0.1

- 🐛 修復 Tauri v2 視窗無法關閉的問題（徹底移除 `onCloseRequested`）。

### v3.0.0

- 🚀 16 Tab 雙層導航、Draft Mode、資源瀏覽器、社群範本庫。
