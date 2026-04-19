# Changelog

本檔案記錄 Claude Settings Manager 各版本的重要變更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)；版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

同步來源：[`src/data/changelog.ts`](src/data/changelog.ts) — 應用程式內「更新紀錄」對話框讀取該檔。

---

## [v3.3.0] — 2026-04-18

### 新增
- **effort level**：`effortLevel` 新增 `xhigh` 選項，對應 Opus 4.7 官方預設值（`low / medium / high / xhigh / max`）
- **Agent 範本雙範圍**：每張範本卡片直接提供「+ User」「+ Project」兩個按鈕，可獨立套用到個人或專案目錄；Project 按鈕在無專案時自動停用
- **Agent 新建雙寫**：建立自訂 Agent 時可同時勾選 User + Project，一次寫入兩份
- **Rules 分頁**：新增 Rules 資源管理介面，遞迴掃描 `~/.claude/rules/**/*.md` 與 `<project>/.claude/rules/**/*.md`
- **Memory 分頁**：新增 auto memory 檔案索引介面，顯示 `MEMORY.md` 與各 topic 檔的 name / description / type
- **更新紀錄對話框**：點擊頂部版本號可查看歷代版本變更摘要（本版新增）

## [v3.2.0] — 2026-04-17

### 新增
- **自動更新**：透過 GitHub Releases 發佈更新，使用 Ed25519 簽章驗證檔案完整性
- 啟動後 5 秒於背景靜默檢查；有新版且未被跳過時彈出對話框
- 支援「跳過此版本」與手動檢查入口

## [v3.1.0] — 2026-04-17

### 新增
- **資源 CRUD**：Agents / Commands / Skills / Output Styles 皆支援建立、編輯、刪除
- **Agent 範本庫**：內建官方 + 社群範本卡片，一鍵套用
- **CLAUDE.md 強化**：
  - `@path` 引用偵測與預覽面板
  - 字元數 / 行數 / token 估算與大小警告
- **共用元件**：`ResourceEditor` 處理 frontmatter + body 編輯
- **檔案 API 擴充**：`useFileManager` 新增 `createResource` / `updateResource` / `deleteResource`

### 修復
- 資源被刪除時自動清空 `selectedId`，避免右側殘留

## [v3.0.2] — 2026-04-17

### 新增
- **macOS 正式支援**：跨平台路徑解析、平台感知 UI、CI matrix 打包 .dmg

## [v3.0.1] — 2026-04-17

### 修復
- 例行修復與小幅調整

## [v3.0.0] — 2026-04-16

### 新增
- 初始公開發佈
- 四層設定系統（managed / local / project / user）
- Permissions / Hooks / EnvVars / Sandbox / MCP 等基礎分頁
