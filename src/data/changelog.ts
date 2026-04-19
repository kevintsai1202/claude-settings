/**
 * changelog.ts — 應用程式內「更新紀錄」對話框的資料來源
 *
 * 維護規則：
 *   1. 每次發布新版本時，在最上方新增一筆記錄（版本號降冪）
 *   2. 同步更新 repo 根目錄的 CHANGELOG.md（人類閱讀版）
 *   3. type 對應視覺分類（added / changed / fixed / security）
 */

/** 變更條目類型，對應 UI 標籤顏色 */
export type ChangeKind = 'added' | 'changed' | 'fixed' | 'security';

/** 單一條目 */
export interface ChangeItem {
  /** 分類 */
  kind: ChangeKind;
  /** 說明文字（支援短段落） */
  text: string;
}

/** 單一版本紀錄 */
export interface ChangelogEntry {
  /** 語意化版本號（不含前綴 v） */
  version: string;
  /** 發布日期（YYYY-MM-DD） */
  date: string;
  /** 一句話版本主題，出現在標題下方 */
  summary?: string;
  /** 變更條目清單 */
  changes: ChangeItem[];
}

/** 完整變更歷程（新版在前） */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.4.0',
    date: '2026-04-19',
    summary: '對話分頁：檢視專案 session 歷史、搜尋、subagent 摺疊、刪除',
    changes: [
      { kind: 'added', text: '對話分頁（Dialogue）：檢視當前專案的 Claude Code session 歷史' },
      { kind: 'added', text: 'Session 依日期分組（今天 / 昨天 / 本週 / 更早）、顯示首 prompt 摘要' },
      { kind: 'added', text: '三種顆粒度切換：純對話 / 對話+工具 / 完整原始' },
      { kind: 'added', text: '跨 session 關鍵字搜尋（debounce 200ms、命中高亮、上限 500 筆）' },
      { kind: 'added', text: 'Context compaction 摘要以虛線框特殊呈現、可摺疊' },
      { kind: 'added', text: 'Subagent (sidechain) 對話以紫色摺疊群組呈現、自動抽取 subagent_type' },
      { kind: 'added', text: '刪除 session：二次確認視窗 + path traversal 防護 + toast 回饋' },
      { kind: 'added', text: '通用 ConfirmDialog 元件（破壞性操作的二次確認）' },
      { kind: 'changed', text: 'resolvePath 抽出為獨立 util（保留 homeDir 快取），供 dialogue 模組共用' },
    ],
  },
  {
    version: '3.3.0',
    date: '2026-04-18',
    summary: 'Rules / Memory 分頁、Agent 雙範圍套用、effort xhigh',
    changes: [
      { kind: 'added', text: '基本設定：effortLevel 新增 xhigh 選項（Opus 4.7 官方預設值）' },
      { kind: 'added', text: 'Agent 範本卡片：每張卡片直接提供「+ User」「+ Project」兩個按鈕，可獨立套用' },
      { kind: 'added', text: 'Agent 新建：支援 User + Project 複選，一次寫入兩份' },
      { kind: 'added', text: '新增 Rules 分頁，遞迴掃描 .claude/rules/**/*.md' },
      { kind: 'added', text: '新增 Memory 分頁，顯示 auto memory 索引與 topic 檔案' },
      { kind: 'added', text: '頂部版本號可點擊開啟「更新紀錄」對話框（本版新增）' },
    ],
  },
  {
    version: '3.2.0',
    date: '2026-04-17',
    summary: '自動更新：GitHub Releases + Ed25519 簽章驗證',
    changes: [
      { kind: 'added', text: '透過 GitHub Releases 發佈與下載更新' },
      { kind: 'added', text: '啟動後 5 秒於背景靜默檢查新版；可「跳過此版本」或手動檢查' },
      { kind: 'security', text: '使用 Ed25519 簽章驗證安裝檔完整性' },
    ],
  },
  {
    version: '3.1.0',
    date: '2026-04-17',
    summary: '資源編輯 CRUD、Agent 範本庫、CLAUDE.md 強化',
    changes: [
      { kind: 'added', text: 'Agents / Commands / Skills / Output Styles 支援建立、編輯、刪除' },
      { kind: 'added', text: '內建 Agent 官方 + 社群範本庫，一鍵套用' },
      { kind: 'added', text: 'CLAUDE.md：@path 引用偵測與預覽面板' },
      { kind: 'added', text: 'CLAUDE.md：字元 / 行數 / token 估算與大小警告' },
      { kind: 'changed', text: '抽出 ResourceEditor 共用元件處理 frontmatter + body 編輯' },
      { kind: 'fixed', text: '資源被刪除時自動清空 selectedId，避免殘留' },
    ],
  },
  {
    version: '3.0.2',
    date: '2026-04-17',
    summary: 'macOS 完整支援納入正式版',
    changes: [
      { kind: 'added', text: 'macOS 跨平台路徑解析與平台感知 UI' },
      { kind: 'added', text: 'CI matrix 同時打包 Windows .msi/.exe 與 macOS .dmg' },
    ],
  },
  {
    version: '3.0.1',
    date: '2026-04-17',
    summary: '例行修復',
    changes: [
      { kind: 'fixed', text: '小幅調整與相容性修補' },
    ],
  },
  {
    version: '3.0.0',
    date: '2026-04-16',
    summary: '初始公開發佈',
    changes: [
      { kind: 'added', text: '四層設定系統（managed / local / project / user）' },
      { kind: 'added', text: 'Permissions / Hooks / EnvVars / Sandbox / MCP 等基礎分頁' },
      { kind: 'added', text: 'JSON 編輯器與 Merge 預覽（AJV Schema 驗證）' },
    ],
  },
];
