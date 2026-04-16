# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開發指令

```powershell
npm run tauri dev      # 啟動完整 Tauri 視窗（Rust + React，日常開發用）
npm run dev            # 僅啟動前端 Vite Dev Server（port 1420）
npm run build          # TypeScript 編譯 + Vite 打包
npm run tauri build    # 打包成 Windows .exe 安裝程式
```

沒有測試指令（專案目前未配置測試框架）。

## 架構概覽

**Tauri v2 桌面應用程式**，前端為 React 19 + TypeScript，後端為 Rust（幾乎不含自訂 Rust 邏輯，主要使用 Tauri 原生 plugin）。

### 四層設定系統

這是整個應用的核心概念。Claude Code 的設定分四層，優先級由高至低：

```
managed (1) > local (2) > project (3) > user (4)
```

- `managed` — `C:\Program Files\ClaudeCode\managed-settings.json`（唯讀企業管控）
- `local` — `<project>\.claude\settings.local.json`（個人本地覆蓋）
- `project` — `<project>\.claude\settings.json`（專案共用）
- `user` — `%USERPROFILE%\.claude\settings.json`（全局個人）

合并規則在 `src/utils/merge.ts`：純量欄位高優先覆蓋低優先；陣列欄位（`permissions.allow/deny/ask`）各層合并去重；`env` 物件高優先同 key 覆蓋。

### 資料流

```
Tauri FS (readTextFile/writeTextFile)
    ↓ useFileManager (src/hooks/useFileManager.ts)
    ↓ Zustand store (src/store/settingsStore.ts)
    ↓ Tab 元件 (src/components/tabs/)
```

所有檔案 I/O 必須透過 `useFileManager`，不直接呼叫 Tauri API。路徑解析在 `resolvePath()` 函式中處理（`%USERPROFILE%` → 實際路徑，反斜線 → 正斜線），因為 Tauri FS 在 Windows 不支援 `~` 展開。

### Tab 路由

無 React Router。`App.tsx` 的 `TAB_COMPONENTS` Record 做靜態對照，`activeTab` 狀態決定渲染哪個元件。新增 Tab 只需在此 Record 加一行，並在 `TabBar.tsx` 加對應按鈕。

### 關鍵檔案

| 檔案 | 職責 |
|------|------|
| `src/types/settings.ts` | 所有 TypeScript 型別定義（50+ 欄位），新增設定欄位從這裡開始 |
| `src/store/settingsStore.ts` | Zustand 全局狀態，包含四層設定檔、CLAUDE.md 內容、activeTab |
| `src/hooks/useFileManager.ts` | 封裝所有 Tauri FS 讀寫，是唯一接觸檔案系統的層 |
| `src/hooks/useManagedField.ts` | 判斷某欄位是否被 managed 層鎖定（唯讀 badge 顯示用） |
| `src/utils/merge.ts` | 四層合并演算法 |
| `src/utils/schemaValidator.ts` | AJV v8 JSON Schema 驗證，用於 JSON 編輯器的即時錯誤提示 |
| `src/schemas/claude-code-settings.schema.json` | 官方 settings.json 的完整 JSON Schema |

## 開發注意事項

### 新增設定欄位

1. 在 `src/types/settings.ts` 的 `ClaudeSettings` 介面加欄位（附中文註解）
2. 在 `src/schemas/claude-code-settings.schema.json` 加對應 schema 定義
3. 在對應 Tab 元件加 UI，呼叫 `saveFile` 儲存

### Managed 層唯讀 UI

使用 `useManagedField('fieldName')` 取得 `isManaged` 布林值，鎖定時在欄位旁顯示 `<ManagedBadge />` 並停用輸入。`fieldName` 支援點號路徑（如 `'permissions.defaultMode'`）。

### Windows 路徑處理

- 永遠使用 `%USERPROFILE%` 而非 `~`（Tauri FS 不展開 `~`）
- `useFileManager` 中的 `resolvePath()` 負責轉換，Tab 元件不需自己處理路徑
- Vite dev server 固定在 port 1420，不可更改（`tauri.conf.json` 硬編碼）

### Python hooks（hookify 插件）

Windows 系統上 `python3` 指向 Microsoft Store stub，必須使用 `py` 呼叫 Python。插件路徑：`%USERPROFILE%\.claude\plugins\cache\claude-plugins-official\hookify\unknown\hooks\hooks.json`。
