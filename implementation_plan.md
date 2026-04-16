# 🛠️ Claude Settings Manager — 完整企畫書 v2

> 目標：打造一個 **Tauri 桌面應用程式**，能一覽並維護所有 Claude Code 相關設定檔案，可離線使用

---

## 📋 需求確認

| 需求 | 狀態 |
|------|------|
| Permissions / Hooks / 合并預覽 — 全部實作 | ✅ |
| File System Access — 直接讀寫文件 | ✅ |
| CLAUDE.md 編輯支援 | ✅ |
| 可離線使用 | ✅ |
| Tauri 封裝（原生桌面 App） | ✅ |

---

## 🏗️ 技術架構

### 技術選型

| 層面 | 選擇 | 版本 | 理由 |
|------|------|------|------|
| 桌面框架 | **Tauri v2** | 2.x | 小包體、Rust 安全性、原生文件存取 |
| 前端框架 | **React 19 + Vite** | React 19 / Vite 6.x | 官方支援、元件化開發、生態豐富 |
| 程式語言（後端） | **Rust** | 1.80+ | Tauri 必要 |
| 程式語言（前端） | **TypeScript** | 5.x | 型別安全，配合 React 最佳實踐 |
| 文件存取 | **Tauri FS Plugin v2** | @tauri-apps/plugin-fs | 直接讀寫系統文件 |
| 對話選擇 | **Tauri Dialog Plugin** | @tauri-apps/plugin-dialog | 原生文件/資料夾選擇對話框 |
| 樣式 | **Vanilla CSS + CSS Modules** | - | Glassmorphism 深色主題，元件隔離 |
| 字體 | JetBrains Mono + Inter | 內嵌 woff2 | 離線可用，無 CDN 依賴 |

### 應用程式架構圖

```
Claude Settings Manager (Tauri App)
├── src-tauri/                         ← Rust 後端
│   ├── src/
│   │   ├── main.rs                   ← App 入口
│   │   └── lib.rs                    ← Tauri 命令（自定義 invoke）
│   ├── Cargo.toml                    ← Rust 依賴
│   └── tauri.conf.json               ← Tauri 設定（視窗、權限）
│
└── src/                              ← 前端 (React + Vite + TS)
    ├── main.tsx                      ← React 入口
    ├── App.tsx                       ← 根元件（Layout）
    ├── index.css                     ← 全局樣式
    ├── components/
    │   ├── Sidebar/                  ← 左側文件管理側邊欄
    │   ├── TabBar/                   ← 頂部 Tab 導航
    │   ├── tabs/
    │   │   ├── BasicSettings.tsx     ← 基本設定 Tab
    │   │   ├── Permissions.tsx       ← 權限管理 Tab
    │   │   ├── Hooks.tsx             ← Hooks 配置 Tab
    │   │   ├── EnvVars.tsx           ← 環境變數 Tab
    │   │   ├── ClaudeMd.tsx          ← CLAUDE.md 編輯 Tab
    │   │   ├── MergePreview.tsx      ← 合并預覽 Tab
    │   │   └── JsonEditor.tsx        ← JSON 原始編輯 Tab
    │   └── ui/                       ← 共用 UI 元件
    │       ├── Toggle.tsx            ← 開關元件
    │       ├── Select.tsx            ← 下拉選單
    │       ├── RuleTag.tsx           ← 規則標籤
    │       └── StatusBadge.tsx       ← 文件狀態徽章
    ├── hooks/
    │   ├── useSettings.ts            ← 設定讀寫 Hook
    │   └── useFileManager.ts         ← Tauri FS 封裝 Hook
    ├── store/
    │   └── settingsStore.ts          ← 全局狀態（React Context / Zustand）
    ├── types/
    │   └── settings.ts               ← TypeScript 型別定義
    └── utils/
        ├── merge.ts                  ← 多層設定合并演算法
        └── validate.ts              ← JSON Schema 驗證
```

---

## 📁 管理的文件清單

### Settings JSON 文件（可讀寫）

| 標識 | 路徑（Windows） | 優先級 | 說明 |
|------|----------------|--------|------|
| User | `%USERPROFILE%\.claude\settings.json` | 5（最低） | 全局個人設定 |
| Project | `<project>\.claude\settings.json` | 4 | 專案共用設定 |
| Local | `<project>\.claude\settings.local.json` | 3 | 個人本地覆蓋 |
| Managed | `C:\Program Files\ClaudeCode\managed-settings.json` | 1（最高） | 企業管控（唯讀） |

### 關聯文件（可讀寫）

| 文件 | 路徑 | 格式 |
|------|------|------|
| Global CLAUDE.md | `%USERPROFILE%\.claude\CLAUDE.md` | Markdown |
| Project CLAUDE.md | `<project>\CLAUDE.md` | Markdown |
| MCP Config | `%USERPROFILE%\.claude.json` | JSON |
| Project MCP | `<project>\.mcp.json` | JSON |

---

## 🎨 UI/UX 設計規劃

### 整體佈局（三欄式）

```
┌─────────────────────────────────────────────────────────────────────┐
│  🤖 Claude Settings Manager    v1.0.0              [?] 說明          │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                       │
│  📂 文件管理  │ 📑 [基本設定] [⚠️ Permissions] [🪝 Hooks] [🔧 Env]  │
│  ──────────  │ [📝 CLAUDE.md] [📊 合并預覽] [{ } JSON 原始]         │
│              │ ────────────────────────────────────────────────────  │
│  ✅ User     │                                                       │
│  ✅ Project  │  🔧 基本設定                                          │
│  ✅ Local    │                                                       │
│  🔒 Managed  │  Model          [claude-sonnet-4-6       ▼]          │
│  ──────────  │  Effort Level   [○ low  ● medium  ○ high]            │
│              │  Language       [日本語                  ▼]          │
│  [+ 開啟專案] │  Output Style   [Explanatory             ▼]          │
│              │                                                       │
│             │  ─── 開關設定 ───────────────────────────             │
│              │  Always Thinking    [●────────────] ON               │
│              │  Auto Updates       [────────────●] stable           │
│              │  Include CoAuthor   [●────────────] ON               │
│              │  Spinner Tips       [●────────────] ON               │
│              │                                                       │
│              │  Cleanup Period     [30    ] 天                       │
│              │                                                       │
│              │  ────────────────────────────────────────────        │
│              │  [💾 儲存到 User] [💾 儲存到 Project] [🔄 重設]     │
└──────────────┴──────────────────────────────────────────────────────┘
```

### 設計主題規格

- **背景漸層**：`#070711` → `#0f0f23` → `#16162e`
- **主色**：紫羅蘭 `#7c3aed`（Anthropic 品牌色）
- **次色**：青藍 `#06b6d4`
- **玻璃卡片**：`rgba(255,255,255,0.03)` + `blur(20px)`
- **邊框**：`rgba(255,255,255,0.08)`
- **文字主色**：`#e2e8f0`
- **文字次色**：`#94a3b8`
- **成功**：`#10b981`、**警告**：`#f59e0b`、**危險**：`#ef4444`

---

## 📐 各功能模組詳細設計

### Tab 1：基本設定

表單式編輯最常用設定（見上方佈局）

### Tab 2：Permissions

```
🔴 Deny 規則（最高優先）
─────────────────────────────────────────────────────────
  [Bash(curl *)]     危險命令          [編輯] [✕]
  [Read(./.env*)]    環境變數保護      [編輯] [✕]
  [WebFetch]         網路存取封鎖      [編輯] [✕]
  + 新增 Deny 規則 →  工具:[Bash ▼] 指定:[            ] [確認]

🟡 Ask 規則（需確認）
─────────────────────────────────────────────────────────
  [Bash(git push *)] 推送前確認        [編輯] [✕]
  + 新增 Ask 規則

🟢 Allow 規則（自動允許）
─────────────────────────────────────────────────────────
  [Bash(npm run *)]  npm 腳本          [編輯] [✕]
  [Read(./src/**)]   源碼讀取          [編輯] [✕]
  + 新增 Allow 規則

Default Mode: [acceptEdits ▼]   (default / acceptEdits / dontAsk / bypassPermissions)
                                  ⚠️ bypassPermissions 跳過所有權限確認，請謹慎使用
```

### Tab 3：Hooks

```
Hooks 事件配置
─────────────────────────────────────────────────────────

▼ PreToolUse（工具執行前）                        [+ 新增]
  ┌─────────────────────────────────────────────┐
  │ Matcher: [Bash                    ]         │
  │ Type:    [● command  ○ http       ]         │
  │ Command: [~/.claude/hooks/pre-bash.sh]      │
  │ Timeout: [60000] ms                         │
  │                                    [刪除] ✕ │
  └─────────────────────────────────────────────┘

▼ PostToolUse（工具執行後）                       [+ 新增]
  ┌─────────────────────────────────────────────┐
  │ Matcher: [Edit                    ]         │
  │ Type:    [● command  ○ http       ]         │
  │ Command: [~/.claude/hooks/auto-lint.sh]     │
  │                                    [刪除] ✕ │
  └─────────────────────────────────────────────┘

▶ Notification（通知事件）                        [+ 新增]
▶ Stop（回應結束）                               [+ 新增]
▶ SubagentStop（子代理結束）                      [+ 新增]
```

### Tab 4：環境變數 (env)

```
環境變數設定
─────────────────────────────────────────────────────────
KEY                          VALUE
────────────────────────     ─────────────────
NODE_ENV               │     development              [✕]
CLAUDE_CODE_ENABLE_    │     1                        [✕]
  TELEMETRY            │
OTEL_METRICS_EXPORTER  │     otlp                     [✕]

KEY: [                 ]  VALUE: [                    ]  [+ 新增]
```

### Tab 5：CLAUDE.md 編輯器

```
📝 CLAUDE.md 編輯器
[Global (~/.claude/CLAUDE.md)] [Project (./CLAUDE.md)] [Project Inner (.claude/CLAUDE.md)]

┌─────────────────────────────────────────────────────────────────────┐
│ # My Project Rules                                                   │
│                                                                       │
│ ## 開發規範                                                          │
│ - 使用 TypeScript                                                    │
│ - 遵循 ESLint 規則                                                   │
│                                                                       │
│ ## 常用命令                                                          │
│ - npm run dev                                                        │
│ - npm run test                                                       │
│                                    字數: 245 / 行數: 12             │
└─────────────────────────────────────────────────────────────────────┘
[💾 儲存] [🔄 重設] [📋 複製]
```

### Tab 6：合并預覽

```
📊 最終有效設定（所有層合并後）
─────────────────────────────────────────────────────────────────
設定項                          有效值              來源
────────────────────────────────────────────────────────────────
model                           claude-sonnet-4-6   [User]  ●
language                        japanese            [Project] ●
effortLevel                     high                [Local]  ●
alwaysThinkingEnabled           true                [User]  ●
cleanupPeriodDays               30                  [User]  ●
outputStyle                     Explanatory         (預設)
────────────────────────────────────────────────────────────────
permissions.allow               (合并: User + Project)
  Bash(git:*)                                       [User]  ●
  Bash(npm run:*)                                   [Project] ●
permissions.deny
  Bash(curl *)                                      [Project] ●
────────────────────────────────────────────────────────────────

● User  ● Project  ● Local  ● Managed  ○ 預設值
```

### Tab 7：JSON 原始編輯器

```
{ } JSON 原始檢視/編輯
[User Settings  ▼]                     ✅ 有效 JSON

  1  {
  2    "$schema": "https://json.schemastore.org/...",
  3    "model": "claude-sonnet-4-6",
  4    "language": "japanese",
  5    "effortLevel": "high",
  6    "permissions": {
  7      "allow": [
  8        "Bash(npm run *)",
  9        "Read(./src/**)"
 10      ]
 11    }
 12  }

[💾 儲存] [🔄 從文件重新載入] [📋 複製] [驗證 JSON]
```

---

## 📦 前置準備（安裝步驟）

> [!IMPORTANT]
> **系統目前缺少 Rust 工具鏈** (`rustc` / `cargo` 未安裝)
> 必須先安裝 Rust，才能使用 Tauri

### 步驟 1：安裝 Rust（必要）

```powershell
# 下載並執行 rustup 安裝程式
winget install Rustlang.Rustup
# 或手動下載 https://rustup.rs/
```

安裝後重開終端，確認：
```powershell
rustc --version   # 預期 >= 1.80
cargo --version
```

### 步驟 2：安裝 Visual Studio C++ Build Tools（Windows 必要）

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
# 需要選擇「Desktop development with C++」工作負載
```

### 步驟 3：安裝 WebView2（Windows 11 通常已內建）

Windows 11 已預裝 WebView2，通常不需要手動安裝。

---

## 🚀 實作計畫（分階段）

### Phase 0：環境準備

- [ ] 安裝 Rust (rustup)
- [ ] 安裝 VS2022 Build Tools（C++ 工作負載）
- [ ] 驗證 `cargo --version`

### Phase 1：Tauri 專案初始化

- [ ] 執行 `npm create tauri-app@latest` 建立專案
- [ ] 選擇：**React + TypeScript**（官方模板）
- [ ] 安裝 `@tauri-apps/plugin-fs` 和 `@tauri-apps/plugin-dialog`
- [ ] 安裝狀態管理：`zustand`（輕量，適合此規模）
- [ ] 設定 `tauri.conf.json`（視窗大小 1280×800、標題、圖示）
- [ ] 確認 `npm run tauri dev` 可以啟動 React App

### Phase 2：核心 UI 框架

- [ ] 設計全局 CSS（深色主題、Glassmorphism）
- [ ] 建立主頁面 HTML 結構（三欄佈局）
- [ ] 左側文件管理側邊欄
- [ ] 頂部 Tab 導航列
- [ ] 響應式佈局基礎

### Phase 3：文件管理功能

- [ ] 自動偵測 `~/.claude/settings.json`（User 設定）
- [ ] 選擇專案目錄（Tauri 對話框）
- [ ] 讀取各層設定文件
- [ ] 解析 JSON 並顯示狀態（存在/有效/錯誤）
- [ ] 儲存修改回文件

### Phase 4：基本設定 Tab

- [ ] model 下拉選單（含主流模型清單）
- [ ] effortLevel 單選按鈕
- [ ] language / outputStyle 下拉選單
- [ ] 布爾值開關（toggle switch）
- [ ] 數字輸入（cleanupPeriodDays 等）

### Phase 5：Permissions Tab（最重要）

- [ ] Allow / Ask / Deny 三區塊顯示
- [ ] 工具規則列表（可刪除）
- [ ] 新增規則表單（工具選擇 + 指定輸入）
- [ ] Glob 語法提示
- [ ] defaultMode 選擇器
- [ ] 優先級說明提示

### Phase 6：Hooks Tab

- [ ] 五種事件展開/折疊面板
- [ ] 每個 Hook 的 matcher / type / command / timeout 輸入
- [ ] command / http 類型切換
- [ ] 新增/刪除 Hook

### Phase 7：環境變數與 CLAUDE.md

- [ ] 環境變數鍵值對編輯器
- [ ] CLAUDE.md 多標籤 textarea 編輯器（Global / Project）
- [ ] 字數統計與即時儲存按鈕

### Phase 8：合并預覽與 JSON 編輯器

- [ ] 合并演算法（單值覆蓋 + 陣列合并去重）
- [ ] 來源標色顯示
- [ ] JSON 語法高亮（Prism.js 或自製）
- [ ] 即時 JSON 驗證

### Phase 9：打包與發佈

- [ ] 設定 App 圖示
- [ ] `npm run tauri build` 產生 .exe 安裝程式
- [ ] 測試離線使用

---

## 📁 交付物

| 文件 | 說明 |
|------|------|
| `d:\GitHub\claude-settings\` | Tauri 專案根目錄 |
| `d:\GitHub\claude-settings\src\` | 前端源碼 |
| `d:\GitHub\claude-settings\src-tauri\` | Rust 後端源碼 |
| `d:\GitHub\claude-settings\src-tauri\target\release\bundle\` | 打包後的安裝程式 |

---

## ✅ 驗收標準

1. **桌面應用啟動**：`npm run tauri dev` 可以開啟視窗
2. **讀取 User 設定**：自動找到 `~/.claude/settings.json` 並顯示
3. **選擇專案**：可以選擇任意專案目錄並讀取其 `.claude/` 設定
4. **Permissions 管理**：可新增、刪除、修改 allow/deny/ask 規則並儲存
5. **CLAUDE.md 編輯**：可讀取並儲存 CLAUDE.md 文件
6. **JSON 驗證**：儲存時防止輸出無效 JSON
7. **合并預覽**：正確顯示多層疊加的最終有效值與來源
8. **離線可用**：無網路環境也能正常運作
9. **打包成功**：`tauri build` 產生可安裝的 .exe 文件

