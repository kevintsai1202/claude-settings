# Session History Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增「對話」Tab，讓使用者檢視當前專案（由 Sidebar 選取的 `projectDir`）的所有 Claude Code session 歷史，支援顆粒度切換、搜尋、刪除、壓縮摘要與 subagent 特殊呈現。

**Architecture:** 純前端解析方案。Tauri FS 直接讀 `~/.claude/projects/<encoded>/*.jsonl`，React 側逐行 JSON.parse，延遲載入（列表只抽 metadata、展開單一 session 才讀全文）。狀態獨立於既有 `settingsStore`，新增 `dialogueStore`。UI 雙欄（左 SessionList / 右 SessionView），沿用 Sidebar 的 `projectDir` 切換廣播機制。

**Tech Stack:** React 19 + TypeScript 5 + Zustand + Tauri v2 FS plugin + lucide-react + AJV（不涉入）。無 Rust 改動、無新增 Tauri capability。

**Spec 連結:** [docs/superpowers/specs/2026-04-19-session-history-viewer-design.md](../specs/2026-04-19-session-history-viewer-design.md)

---

## 執行前提

- 已在分支 `feat/session-history-viewer`（若不是，請先 `git checkout feat/session-history-viewer`）
- 此 repo **沒有測試框架**，「測試」以手動驗證取代（`npm run tauri dev` 實際操作 UI）
- 每個 task 結尾都有 commit 步驟，單一 branch 線性推進
- 程式碼註解一律中文（CLAUDE.md 規則）
- 所有檔案 I/O 路徑先經過 `resolvePath()` 展開 `%USERPROFILE%`

---

## 檔案結構（事前地圖）

### 新增

| 檔案 | 責任 |
|---|---|
| `src/types/dialogue.ts` | `DialogueEvent` / `ContentBlock` / `SessionMeta` / `ProjectDialogueIndex` / `DialogueViewMode` 型別 |
| `src/utils/pathResolver.ts` | 抽出 `useFileManager` 內的 `resolvePath`（讓 dialogue 也能用；同時用於現有 hook） |
| `src/utils/pathEncoder.ts` | `encodeProjectPath(projectDir)` — `[\\/:]` → `-` |
| `src/utils/jsonlParser.ts` | `parseJsonl(text)` 逐行安全解析、`summarizeSession(events)` 抽 metadata、`groupBySidechain(events)` |
| `src/store/dialogueStore.ts` | Zustand slice（`indexByProject` / `eventsBySession` / `selectedSessionId` / `viewMode` / `searchQuery` / `searchResults` / `loading*`） |
| `src/hooks/useDialogue.ts` | `loadProjectIndex()` / `loadSession(id)` / `searchInProject(query)` / `deleteSession(id)` |
| `src/components/tabs/DialogueTab.tsx` | 主 Tab：偵測 `projectDir` 並協調 list + view |
| `src/components/dialogue/SessionList.tsx` | 左欄：搜尋框 + 分組卡片 |
| `src/components/dialogue/SessionView.tsx` | 右欄：header（mode toggle + 刪除）+ 訊息流 |
| `src/components/dialogue/MessageBubble.tsx` | 訊息多變體 |
| `src/components/dialogue/SubagentGroup.tsx` | `isSidechain` 摺疊群組 |
| `src/components/dialogue/DialogueTab.css` | 統一樣式 |
| `src/components/ui/ConfirmDialog.tsx` | 通用確認視窗（刪除用；沿用 `UpdateDialog` 的樣式語言） |
| `src/components/ui/ConfirmDialog.css` | 對應樣式 |

### 修改

| 檔案 | 修改點 |
|---|---|
| `src/types/settings.ts` | `TabId` 聯合型別新增 `'dialogue'` |
| `src/App.tsx` | `TAB_COMPONENTS` 新增 `dialogue: DialogueTab` |
| `src/components/TabBar/TabBar.tsx` | `CATEGORIES.files.tabs` 於 `memory` 之後插入 `{ id: 'dialogue', ... }` |
| `src/hooks/useFileManager.ts` | `resolvePath` 改 import 自 `utils/pathResolver`（一行替換） |

### 完全不動

- `src-tauri/**`（權限已夠、不新增 command）
- `src/schemas/**`
- `src/store/settingsStore.ts`（dialogueStore 獨立）

---

## Task 1：型別定義

**Files:**
- Create: `src/types/dialogue.ts`
- Modify: `src/types/settings.ts`（TabId 聯合擴充）

- [ ] **Step 1: 新增 `src/types/dialogue.ts`**

```ts
/**
 * dialogue.ts — Session History Viewer 型別定義
 * 本檔案只放純型別（無執行期依賴），供 store / hook / 元件共用
 */

/** assistant content 陣列中單一 block（user/assistant message 的 content 可能是字串或陣列） */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[]; is_error?: boolean }
  | { type: string; [k: string]: unknown }; // 前向相容：未知 block 保留原始欄位

/** 單一事件（jsonl 的一行） */
export interface DialogueEvent {
  /** 事件 UUID（全域唯一，可當 React key） */
  uuid: string;
  /** ISO 8601 時間戳 */
  timestamp: string;
  /** 事件型別：user / assistant / attachment / queue-operation / ... */
  type: string;
  /** 所屬 session */
  sessionId: string;
  /** 父事件 UUID（用於重建事件鏈） */
  parentUuid?: string | null;
  /** 是否為 subagent 的 sidechain 事件 */
  isSidechain?: boolean;
  /** user/assistant 的訊息內容 */
  message?: {
    role?: 'user' | 'assistant';
    content: string | ContentBlock[];
  };
  /** 是否為 context compaction 產生的摘要訊息 */
  isCompactSummary?: boolean;
  /** 是否僅顯示於 transcript（不送給 model） */
  isVisibleInTranscriptOnly?: boolean;
  /** hook attachment 事件的資料 */
  attachment?: {
    type: string;
    filename?: string;
    displayPath?: string;
    [k: string]: unknown;
  };
  /** 原始 JSON（raw 模式完整呈現用） */
  raw: Record<string, unknown>;
}

/** Session 列表用的輕量 metadata */
export interface SessionMeta {
  sessionId: string;
  /** jsonl 絕對路徑（正斜線，已 resolvePath） */
  filePath: string;
  /** 首筆事件時間戳 */
  startTime: string;
  /** 末筆事件時間戳 */
  lastTime: string;
  /** user + assistant 訊息計數 */
  messageCount: number;
  /** 首則 user prompt 前 60 字（無則空字串） */
  firstPromptPreview: string;
  /** 是否含 compaction 摘要 */
  hasCompaction: boolean;
  /** 是否含 subagent (isSidechain) 事件 */
  hasSubagent: boolean;
  /** 檔案大小（byte） */
  fileSize: number;
}

/** 單一專案的 session 索引 */
export interface ProjectDialogueIndex {
  /** 原始 projectDir（如 d:\GitHub\claude-settings） */
  projectDir: string;
  /** 編碼後的資料夾名（如 d--GitHub-claude-settings） */
  encodedDir: string;
  /** 完整資料夾路徑（正斜線，已 resolvePath） */
  folderPath: string;
  /** 依 lastTime 降冪排列 */
  sessions: SessionMeta[];
}

/** 顆粒度切換 */
export type DialogueViewMode = 'chat' | 'chat+tools' | 'raw';
```

- [ ] **Step 2: 擴充 `src/types/settings.ts` 的 TabId**

找到 `export type TabId =` 區塊（約 line 414），在聯合型別中插入 `| 'dialogue'`（建議放在 `'memory'` 之後）：

```ts
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
```

- [ ] **Step 3: TypeScript 編譯驗證**

Run: `npm run build`
Expected: 通過（此時只新增型別、未引用新 TabId，build 必過）

- [ ] **Step 4: Commit**

```bash
git add src/types/dialogue.ts src/types/settings.ts
git commit -m "feat(dialogue): add type definitions for session history viewer"
```

---

## Task 2：路徑工具（pathResolver + pathEncoder）

**Files:**
- Create: `src/utils/pathResolver.ts`
- Create: `src/utils/pathEncoder.ts`
- Modify: `src/hooks/useFileManager.ts`（一行 import 改造）

- [ ] **Step 1: 新增 `src/utils/pathResolver.ts`**

```ts
/**
 * pathResolver.ts — 跨平台路徑解析
 * 將 %USERPROFILE% 佔位符展開為實際家目錄；反斜線統一轉正斜線
 * （Tauri FS plugin 在 Windows 也接受正斜線）
 */
import { homeDir } from '@tauri-apps/api/path';

/**
 * 解析路徑：%USERPROFILE% → 實際家目錄，統一轉正斜線
 * @param path 原始路徑（可能含 %USERPROFILE% 佔位符或反斜線）
 * @returns 絕對路徑（正斜線）
 */
export const resolvePath = async (path: string): Promise<string> => {
  let resolved = path;
  if (resolved.includes('%USERPROFILE%')) {
    const home = await homeDir();
    resolved = resolved.replace('%USERPROFILE%', home);
  }
  return resolved.replace(/\\/g, '/');
};
```

- [ ] **Step 2: 新增 `src/utils/pathEncoder.ts`**

```ts
/**
 * pathEncoder.ts — Claude Code projects 路徑 ↔ 資料夾名 編碼
 *
 * Claude Code 將專案對話歷史存於 ~/.claude/projects/<encoded>/，其中
 * encoded 是把原始路徑的 `:`、`\`、`/` 都替換成 `-`。
 *
 * 例：d:\GitHub\claude-settings → d--GitHub-claude-settings
 *     /Users/kevin/Repo/app    → -Users-kevin-Repo-app
 */

/**
 * 將原始 projectDir 編碼為 Claude Code 使用的資料夾名稱
 * @param projectDir 原始專案路徑（含磁碟機代號或根斜線）
 * @returns 編碼後字串（不含結尾 -）
 */
export const encodeProjectPath = (projectDir: string): string => {
  return projectDir
    .replace(/[\\/:]/g, '-')
    .replace(/-+$/, ''); // 去掉結尾連續的 -
};
```

- [ ] **Step 3: 改造 `src/hooks/useFileManager.ts` 使用共用 resolvePath**

找到檔案開頭附近的：

```ts
import { homeDir as getHomeDir } from '@tauri-apps/api/path';
```

以及其下方的 `resolvePath` 區塊（約 line 24-33）：

```ts
/**
 * 解析路徑：%USERPROFILE% → 實際家目錄，統一轉正斜線
 */
const resolvePath = async (path: string): Promise<string> => {
  let resolved = path;
  if (resolved.includes('%USERPROFILE%')) {
    const home = await getHomeDir();
    resolved = resolved.replace('%USERPROFILE%', home);
  }
  return resolved.replace(/\\/g, '/');
};
```

**替換為**（移除 homeDir import 與本地 resolvePath 定義，改為 import util）：

```ts
import { resolvePath } from '../utils/pathResolver';
```

注意：保留檔案原本所有其他 import 行；僅移除 `homeDir as getHomeDir` 這一行與 `resolvePath` 局部定義區塊。

- [ ] **Step 4: 建置驗證（確保重構未破壞現有功能）**

Run: `npm run build`
Expected: 通過，0 TypeScript 錯誤

- [ ] **Step 5: 啟動驗證（確認既有功能正常）**

Run: `npm run tauri dev`
Expected: App 正常開啟；Sidebar 能載入 User 層 settings.json（代表 resolvePath 遷移成功）。
驗證後 `Ctrl+C` 終止。

- [ ] **Step 6: Commit**

```bash
git add src/utils/pathResolver.ts src/utils/pathEncoder.ts src/hooks/useFileManager.ts
git commit -m "refactor(utils): extract resolvePath & add pathEncoder for dialogue module"
```

---

## Task 3：JSONL 解析器

**Files:**
- Create: `src/utils/jsonlParser.ts`

- [ ] **Step 1: 新增 `src/utils/jsonlParser.ts`**

```ts
/**
 * jsonlParser.ts — 解析 Claude Code 的 session jsonl 檔
 *
 * 每個 session jsonl 是一行一個 JSON 事件的流式格式。
 * 本模組提供：
 *  - parseJsonl: 安全逐行解析（壞行跳過）
 *  - summarizeSession: 從事件陣列抽出 SessionMeta
 *  - groupBySidechain: 將連續 isSidechain 事件歸為群組（供 UI 摺疊用）
 */
import type {
  ContentBlock,
  DialogueEvent,
  SessionMeta,
} from '../types/dialogue';

/** Session 摘要結果（供 SessionList 使用） */
export interface SessionSummary {
  meta: Omit<SessionMeta, 'filePath' | 'fileSize' | 'sessionId'>;
  /** 解析失敗行數（>0 時於 raw 模式提示） */
  parseErrors: number;
}

/**
 * 將 jsonl 文字解析為事件陣列
 * @param text 整個 jsonl 檔案內容
 * @returns { events, parseErrors } — 成功解析的事件與失敗行數
 */
export const parseJsonl = (
  text: string,
): { events: DialogueEvent[]; parseErrors: number } => {
  const events: DialogueEvent[] = [];
  let parseErrors = 0;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      // 最小必要欄位防禦：缺 uuid 或 timestamp 的事件仍收錄（raw 模式有用）
      events.push({
        uuid:
          typeof obj.uuid === 'string'
            ? obj.uuid
            : `__no_uuid_${events.length}`,
        timestamp:
          typeof obj.timestamp === 'string'
            ? obj.timestamp
            : '',
        type: typeof obj.type === 'string' ? obj.type : 'unknown',
        sessionId:
          typeof obj.sessionId === 'string' ? obj.sessionId : '',
        parentUuid:
          typeof obj.parentUuid === 'string' ? obj.parentUuid : null,
        isSidechain:
          typeof obj.isSidechain === 'boolean'
            ? obj.isSidechain
            : undefined,
        message:
          (obj.message as DialogueEvent['message']) ?? undefined,
        isCompactSummary:
          typeof obj.isCompactSummary === 'boolean'
            ? obj.isCompactSummary
            : undefined,
        isVisibleInTranscriptOnly:
          typeof obj.isVisibleInTranscriptOnly === 'boolean'
            ? obj.isVisibleInTranscriptOnly
            : undefined,
        attachment:
          (obj.attachment as DialogueEvent['attachment']) ?? undefined,
        raw: obj,
      });
    } catch {
      parseErrors += 1;
    }
  }
  return { events, parseErrors };
};

/**
 * 抽取首則 user message 的文字前綴
 * assistant 訊息或 tool_result 不算
 */
const extractFirstUserPrompt = (events: DialogueEvent[]): string => {
  for (const ev of events) {
    if (ev.type !== 'user' || !ev.message) continue;
    const content = ev.message.content;
    // 純字串
    if (typeof content === 'string') {
      // 若整段是 tool_result 的序列化（極少見），跳過
      return content.trim().slice(0, 60);
    }
    // 陣列 content：取第一個 text block 且不是 tool_result
    if (Array.isArray(content)) {
      const textBlock = content.find(
        (b): b is ContentBlock & { type: 'text'; text: string } =>
          (b as ContentBlock).type === 'text' &&
          typeof (b as { text?: unknown }).text === 'string',
      );
      if (textBlock) return textBlock.text.trim().slice(0, 60);
      // 若首個 user 訊息只含 tool_result，繼續找下一筆 user
    }
  }
  return '';
};

/**
 * 計算 user + assistant 訊息數（不計 attachment / queue / sidechain 額外事件）
 * sidechain 事件亦計入（subagent 也是對話），但 attachment/queue 排除
 */
const countMessages = (events: DialogueEvent[]): number => {
  let count = 0;
  for (const ev of events) {
    if (ev.type === 'user' || ev.type === 'assistant') count += 1;
  }
  return count;
};

/**
 * 由事件陣列抽出 session 摘要（startTime / lastTime / 旗標等）
 */
export const summarizeSession = (events: DialogueEvent[]): SessionSummary => {
  const withTs = events.filter((e) => e.timestamp);
  const startTime = withTs.length > 0 ? withTs[0].timestamp : '';
  const lastTime =
    withTs.length > 0 ? withTs[withTs.length - 1].timestamp : '';
  const hasCompaction = events.some((e) => e.isCompactSummary === true);
  const hasSubagent = events.some((e) => e.isSidechain === true);
  const messageCount = countMessages(events);
  const firstPromptPreview = extractFirstUserPrompt(events);
  return {
    meta: {
      startTime,
      lastTime,
      messageCount,
      firstPromptPreview,
      hasCompaction,
      hasSubagent,
    },
    parseErrors: 0,
  };
};

/** 事件群組（供 SessionView 渲染） */
export type EventGroup =
  | { kind: 'single'; event: DialogueEvent }
  | { kind: 'sidechain'; events: DialogueEvent[] };

/**
 * 將連續 isSidechain 事件聚合為一個 group（主對話事件以 single 呈現）
 * 用於 chat / chat+tools 模式；raw 模式應直接平鋪、不呼叫本函式
 */
export const groupBySidechain = (events: DialogueEvent[]): EventGroup[] => {
  const groups: EventGroup[] = [];
  let buffer: DialogueEvent[] = [];
  for (const ev of events) {
    if (ev.isSidechain) {
      buffer.push(ev);
    } else {
      if (buffer.length > 0) {
        groups.push({ kind: 'sidechain', events: buffer });
        buffer = [];
      }
      groups.push({ kind: 'single', event: ev });
    }
  }
  if (buffer.length > 0) {
    groups.push({ kind: 'sidechain', events: buffer });
  }
  return groups;
};
```

- [ ] **Step 2: 建置驗證**

Run: `npm run build`
Expected: 通過

- [ ] **Step 3: 手動煙霧測試（用瀏覽器 console 或 Node 快速驗）**

在 dev server 開啟後 DevTools console 執行（改天實作 UI 前可跳過此步，但強烈建議）：

```js
// 可用現有專案的第一個 jsonl 檔貼 text 進來試
// const { parseJsonl, summarizeSession } = await import('/src/utils/jsonlParser.ts');
// const r = parseJsonl(`{"uuid":"x","timestamp":"2026-04-19T00:00:00Z","type":"user","sessionId":"s","message":{"role":"user","content":"hello"},"parentUuid":null}\n`);
// console.log(r); // { events: [...], parseErrors: 0 }
```

若不方便跑，至少確認 `npm run build` 過。

- [ ] **Step 4: Commit**

```bash
git add src/utils/jsonlParser.ts
git commit -m "feat(dialogue): add jsonl parser and session summarizer"
```

---

## Task 4：dialogueStore（Zustand）

**Files:**
- Create: `src/store/dialogueStore.ts`

- [ ] **Step 1: 新增 `src/store/dialogueStore.ts`**

```ts
/**
 * dialogueStore.ts — Session History Viewer 的全局狀態
 * 獨立於 settingsStore，避免混入既有設定編輯邏輯
 */
import { create } from 'zustand';
import type {
  DialogueEvent,
  DialogueViewMode,
  ProjectDialogueIndex,
} from '../types/dialogue';

/** 搜尋結果 */
export interface DialogueSearchResults {
  /** 命中的 sessionId 集合（依 lastTime 降冪） */
  sessionIds: string[];
  /** 命中訊息總數（含重複；僅供提示） */
  hitCount: number;
  /** 是否被 500 筆截斷 */
  truncated: boolean;
}

interface DialogueState {
  /** 依 projectDir 快取索引 */
  indexByProject: Record<string, ProjectDialogueIndex>;
  /** 依 sessionId 快取完整事件陣列 */
  eventsBySession: Record<string, DialogueEvent[]>;
  /** 目前選中的 sessionId（null = 未選） */
  selectedSessionId: string | null;
  /** 當前顆粒度 */
  viewMode: DialogueViewMode;
  /** 搜尋字串（原樣保留；展示用；實際搜尋由 hook 處理 debounce） */
  searchQuery: string;
  /** 搜尋結果；null = 無搜尋進行中 */
  searchResults: DialogueSearchResults | null;
  /** 索引載入中 */
  loadingIndex: boolean;
  /** 單一 session 載入中 */
  loadingSession: boolean;

  // ── actions ───────────────────────────────
  setSelected: (id: string | null) => void;
  setViewMode: (mode: DialogueViewMode) => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (r: DialogueSearchResults | null) => void;
  setProjectIndex: (projectDir: string, index: ProjectDialogueIndex) => void;
  setEvents: (sessionId: string, events: DialogueEvent[]) => void;
  removeSession: (projectDir: string, sessionId: string) => void;
  clearSelection: () => void;
  clearSearch: () => void;
  setLoadingIndex: (b: boolean) => void;
  setLoadingSession: (b: boolean) => void;
}

export const useDialogueStore = create<DialogueState>((set) => ({
  indexByProject: {},
  eventsBySession: {},
  selectedSessionId: null,
  viewMode: 'chat',
  searchQuery: '',
  searchResults: null,
  loadingIndex: false,
  loadingSession: false,

  setSelected: (id) => set({ selectedSessionId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
  setProjectIndex: (projectDir, index) =>
    set((state) => ({
      indexByProject: { ...state.indexByProject, [projectDir]: index },
    })),
  setEvents: (sessionId, events) =>
    set((state) => ({
      eventsBySession: { ...state.eventsBySession, [sessionId]: events },
    })),
  removeSession: (projectDir, sessionId) =>
    set((state) => {
      // 1. 從索引移除
      const idx = state.indexByProject[projectDir];
      const nextIndex = idx
        ? {
            ...idx,
            sessions: idx.sessions.filter((s) => s.sessionId !== sessionId),
          }
        : idx;
      // 2. 從 events cache 移除
      const nextEvents = { ...state.eventsBySession };
      delete nextEvents[sessionId];
      // 3. 若刪除的是當前選取 → 清空
      const nextSelected =
        state.selectedSessionId === sessionId ? null : state.selectedSessionId;
      return {
        indexByProject: nextIndex
          ? { ...state.indexByProject, [projectDir]: nextIndex }
          : state.indexByProject,
        eventsBySession: nextEvents,
        selectedSessionId: nextSelected,
      };
    }),
  clearSelection: () => set({ selectedSessionId: null }),
  clearSearch: () => set({ searchQuery: '', searchResults: null }),
  setLoadingIndex: (b) => set({ loadingIndex: b }),
  setLoadingSession: (b) => set({ loadingSession: b }),
}));
```

- [ ] **Step 2: 建置驗證**

Run: `npm run build`
Expected: 通過

- [ ] **Step 3: Commit**

```bash
git add src/store/dialogueStore.ts
git commit -m "feat(dialogue): add dialogueStore (Zustand slice)"
```

---

## Task 5：useDialogue hook（核心資料流）

**Files:**
- Create: `src/hooks/useDialogue.ts`

- [ ] **Step 1: 新增 `src/hooks/useDialogue.ts`**

```ts
/**
 * useDialogue.ts — Session History Viewer 的核心資料操作
 *
 * 提供四個動作：
 *  - loadProjectIndex(): 掃描當前 projectDir 的 jsonl，建構 metadata 索引
 *  - loadSession(sessionId): 讀取並快取單一 session 完整事件
 *  - searchInProject(query): 跨當前專案的 session 做關鍵字搜尋
 *  - deleteSession(sessionId): 刪除 jsonl 檔（已含 path traversal 防護）
 */
import { useCallback, useRef } from 'react';
import {
  exists,
  readDir,
  readTextFile,
  remove,
  stat,
} from '@tauri-apps/plugin-fs';
import { useAppStore } from '../store/settingsStore';
import { useDialogueStore } from '../store/dialogueStore';
import { resolvePath } from '../utils/pathResolver';
import { encodeProjectPath } from '../utils/pathEncoder';
import { parseJsonl, summarizeSession } from '../utils/jsonlParser';
import type {
  ProjectDialogueIndex,
  SessionMeta,
} from '../types/dialogue';

/** 並行 I/O 池上限（避免 Windows file handle 爆量） */
const IO_POOL_LIMIT = 8;

/** 搜尋結果截斷上限 */
const SEARCH_TRUNCATE_AT = 500;

/** 最小可搜尋字串長度 */
const MIN_SEARCH_LEN = 2;

/**
 * 手寫並行池：依序跑 tasks，同時執行數量不超過 limit
 */
const runPool = async <T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> => {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const i = cursor++;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
};

export const useDialogue = () => {
  const projectDir = useAppStore((s) => s.projectDir);
  const store = useDialogueStore;
  /** 搜尋用的 abort 版本號（新搜尋啟動 → 舊的忽略） */
  const searchVersionRef = useRef(0);

  /** 載入當前專案的 session 索引 */
  const loadProjectIndex = useCallback(async (): Promise<void> => {
    if (!projectDir) return;
    store.getState().setLoadingIndex(true);
    try {
      const encoded = encodeProjectPath(projectDir);
      const folderPath = await resolvePath(`%USERPROFILE%/.claude/projects/${encoded}`);
      const folderExists = await exists(folderPath);
      if (!folderExists) {
        const empty: ProjectDialogueIndex = {
          projectDir,
          encodedDir: encoded,
          folderPath,
          sessions: [],
        };
        store.getState().setProjectIndex(projectDir, empty);
        return;
      }
      const entries = await readDir(folderPath);
      const jsonlEntries = entries.filter(
        (e) => e.isFile && e.name.toLowerCase().endsWith('.jsonl'),
      );

      // 並行讀取 + 摘要
      const tasks = jsonlEntries.map((e) => async (): Promise<SessionMeta | null> => {
        const filePath = `${folderPath}/${e.name}`;
        try {
          const text = await readTextFile(filePath);
          const { events } = parseJsonl(text);
          const { meta } = summarizeSession(events);
          const st = await stat(filePath);
          return {
            sessionId: e.name.replace(/\.jsonl$/i, ''),
            filePath,
            fileSize: Number(st.size ?? 0),
            ...meta,
          };
        } catch {
          // 檔案被鎖或破損，靜默跳過
          return null;
        }
      });
      const results = await runPool(tasks, IO_POOL_LIMIT);
      const sessions = results
        .filter((r): r is SessionMeta => r !== null)
        .sort((a, b) => (b.lastTime ?? '').localeCompare(a.lastTime ?? ''));

      const index: ProjectDialogueIndex = {
        projectDir,
        encodedDir: encoded,
        folderPath,
        sessions,
      };
      store.getState().setProjectIndex(projectDir, index);
    } finally {
      store.getState().setLoadingIndex(false);
    }
  }, [projectDir, store]);

  /** 讀取並快取單一 session 的完整事件 */
  const loadSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!projectDir) return;
      // 已快取 → skip
      if (store.getState().eventsBySession[sessionId]) return;
      const idx = store.getState().indexByProject[projectDir];
      const meta = idx?.sessions.find((s) => s.sessionId === sessionId);
      if (!meta) return;
      store.getState().setLoadingSession(true);
      try {
        const text = await readTextFile(meta.filePath);
        const { events } = parseJsonl(text);
        // 依 timestamp 升冪排（jsonl 多半本就順序，保險起見）
        events.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
        store.getState().setEvents(sessionId, events);
      } finally {
        store.getState().setLoadingSession(false);
      }
    },
    [projectDir, store],
  );

  /** 跨當前專案搜尋（>= 2 字、AbortController 版本化） */
  const searchInProject = useCallback(
    async (query: string): Promise<void> => {
      const q = query.trim();
      if (q.length < MIN_SEARCH_LEN) {
        store.getState().setSearchResults(null);
        return;
      }
      const version = ++searchVersionRef.current;
      if (!projectDir) return;
      const idx = store.getState().indexByProject[projectDir];
      if (!idx) return;
      const lower = q.toLowerCase();
      const matched: string[] = [];
      let hitCount = 0;
      let truncated = false;
      for (const s of idx.sessions) {
        if (version !== searchVersionRef.current) return; // 被新搜尋取代，中止
        // 命中 metadata：firstPromptPreview
        let hits = 0;
        if (s.firstPromptPreview.toLowerCase().includes(lower)) hits += 1;
        // 命中內文：已快取用 cache；否則讀檔以 indexOf 粗掃
        const cached = store.getState().eventsBySession[s.sessionId];
        if (cached) {
          for (const ev of cached) {
            const body =
              typeof ev.message?.content === 'string'
                ? ev.message.content
                : JSON.stringify(ev.message?.content ?? '');
            if (body.toLowerCase().includes(lower)) hits += 1;
          }
        } else {
          try {
            const text = await readTextFile(s.filePath);
            if (version !== searchVersionRef.current) return;
            // 粗估命中次數（逐字數量可能偏高但足以排序提示）
            let i = 0;
            let fromIdx = 0;
            const lowerText = text.toLowerCase();
            while ((fromIdx = lowerText.indexOf(lower, fromIdx)) !== -1) {
              i += 1;
              fromIdx += lower.length;
              if (i > 100) break; // 單檔上限
            }
            hits += i;
          } catch {
            // 檔案讀取失敗（例如被鎖）→ 視為 0 命中
          }
        }
        if (hits > 0) {
          matched.push(s.sessionId);
          hitCount += hits;
          if (matched.length >= SEARCH_TRUNCATE_AT) {
            truncated = true;
            break;
          }
        }
      }
      if (version !== searchVersionRef.current) return;
      store.getState().setSearchResults({
        sessionIds: matched,
        hitCount,
        truncated,
      });
    },
    [projectDir, store],
  );

  /**
   * 刪除 session（呼叫端負責先彈 ConfirmDialog）
   * 路徑若不在 ~/.claude/projects/ 底下直接 throw，防 path traversal
   */
  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!projectDir) return;
      const idx = store.getState().indexByProject[projectDir];
      const meta = idx?.sessions.find((s) => s.sessionId === sessionId);
      if (!meta) throw new Error('找不到 session');
      // 安全檢查：filePath 必須是 resolvePath 過、且起始於預期根目錄
      const root = await resolvePath('%USERPROFILE%/.claude/projects/');
      if (!meta.filePath.startsWith(root)) {
        throw new Error(
          `拒絕刪除非 projects/ 底下的檔案：${meta.filePath}`,
        );
      }
      await remove(meta.filePath);
      store.getState().removeSession(projectDir, sessionId);
    },
    [projectDir, store],
  );

  return {
    loadProjectIndex,
    loadSession,
    searchInProject,
    deleteSession,
  };
};
```

- [ ] **Step 2: 建置驗證**

Run: `npm run build`
Expected: 通過（若 `stat` 的 `size` 欄位在 Tauri v2 plugin-fs 型別上叫不同名，build 會跳錯 → 改讀對應欄位）

> **若 Step 2 遇到型別錯誤**，通常是 `@tauri-apps/plugin-fs` 的 `stat()` 回傳欄位差異。檢視 `src/hooks/useFileManager.ts` 是否有類似用法可參考；若無，可以降級為讀 `text.length` 當 fileSize 的近似值（改 `parseSessionMeta` 時把 `stat` 拿掉，用 `fileSize: text.length`）。

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDialogue.ts
git commit -m "feat(dialogue): add useDialogue hook (load/search/delete actions)"
```

---

## Task 6：ConfirmDialog 通用元件

**Files:**
- Create: `src/components/ui/ConfirmDialog.tsx`
- Create: `src/components/ui/ConfirmDialog.css`

- [ ] **Step 1: 先看一下 UpdateDialog 取樣式慣例**

Read: `src/components/ui/UpdateDialog.tsx` 的頂 30 行與 `UpdateDialog.css` 的 `.update-dialog__overlay`、`.update-dialog__card` 區塊，沿用同一套變數名（如 `--color-surface`、`--color-border-subtle`）。

- [ ] **Step 2: 新增 `src/components/ui/ConfirmDialog.tsx`**

```tsx
/**
 * ConfirmDialog — 通用二次確認視窗
 * 用於破壞性操作前的使用者確認（如刪除 session）
 */
import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** 主要說明（支援多行；渲染為純文字，不解析 HTML） */
  message: string;
  /** 額外強警告（紅底）；可選 */
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  warning,
  confirmLabel = '確認',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // 開啟時聚焦到「取消」按鈕（安全預設）
  useEffect(() => {
    if (isOpen) cancelBtnRef.current?.focus();
  }, [isOpen]);

  // ESC 關閉
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-dialog__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="confirm-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="confirm-dialog__header">
          <AlertTriangle size={18} className="confirm-dialog__icon" />
          <h2 id="confirm-dialog-title" className="confirm-dialog__title">
            {title}
          </h2>
        </div>
        <div className="confirm-dialog__body">
          <p className="confirm-dialog__message">{message}</p>
          {warning && (
            <p className="confirm-dialog__warning">{warning}</p>
          )}
        </div>
        <div className="confirm-dialog__footer">
          <button
            ref={cancelBtnRef}
            className="confirm-dialog__btn confirm-dialog__btn--secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="confirm-dialog__btn confirm-dialog__btn--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
```

- [ ] **Step 3: 新增 `src/components/ui/ConfirmDialog.css`**

```css
/* ConfirmDialog — 沿用 UpdateDialog 的覆蓋層與卡片節奏 */

.confirm-dialog__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.48);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.confirm-dialog__card {
  background: var(--color-surface, #fff);
  color: var(--color-text, #111);
  border: 1px solid var(--color-border-subtle, #e2e2e2);
  border-radius: 10px;
  width: min(420px, 92vw);
  padding: 18px 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.24);
}

.confirm-dialog__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.confirm-dialog__icon {
  color: var(--color-danger, #dc2626);
  flex: none;
}

.confirm-dialog__title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.confirm-dialog__body {
  margin-bottom: 16px;
}

.confirm-dialog__message {
  font-size: 13px;
  line-height: 1.55;
  margin: 0 0 10px;
  white-space: pre-wrap;
  word-break: break-word;
}

.confirm-dialog__warning {
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  padding: 8px 10px;
  background: rgba(220, 38, 38, 0.08);
  border-left: 3px solid var(--color-danger, #dc2626);
  border-radius: 4px;
  color: var(--color-danger, #991b1b);
}

.confirm-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.confirm-dialog__btn {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--color-border-subtle, #d1d5db);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.12s, border-color 0.12s;
}

.confirm-dialog__btn--secondary:hover {
  background: var(--color-hover, #f3f4f6);
}

.confirm-dialog__btn--danger {
  background: var(--color-danger, #dc2626);
  color: #fff;
  border-color: transparent;
}

.confirm-dialog__btn--danger:hover {
  background: var(--color-danger-hover, #b91c1c);
}
```

- [ ] **Step 4: 建置驗證**

Run: `npm run build`
Expected: 通過

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx src/components/ui/ConfirmDialog.css
git commit -m "feat(ui): add generic ConfirmDialog for destructive actions"
```

---

## Task 7：DialogueTab + 整合到 App/TabBar（骨架）

**Files:**
- Create: `src/components/tabs/DialogueTab.tsx`
- Create: `src/components/dialogue/DialogueTab.css`
- Modify: `src/components/TabBar/TabBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 新增 `src/components/dialogue/DialogueTab.css`（骨架樣式）**

```css
/* DialogueTab —— 雙欄佈局 */
.dialogue-tab {
  display: flex;
  height: 100%;
  min-height: 0;
  gap: 0;
}

.dialogue-tab__list {
  width: 340px;
  min-width: 280px;
  max-width: 420px;
  border-right: 1px solid var(--color-border-subtle, #e5e7eb);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.dialogue-tab__view {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.dialogue-tab__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #6b7280);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}

.dialogue-tab__empty-icon {
  display: block;
  margin: 0 auto 10px;
  color: var(--color-text-muted, #9ca3af);
}
```

- [ ] **Step 2: 新增 `src/components/tabs/DialogueTab.tsx`（暫以 placeholder 顯示）**

> 本 task 只放骨架與載入觸發，實際 SessionList / SessionView 於後續 task 補上。

```tsx
/**
 * DialogueTab — 檢視當前專案的 Claude Code session 歷史
 * 主 Tab 元件：協調 SessionList + SessionView，並依 projectDir 觸發載入
 */
import React, { useEffect, useState } from 'react';
import { MessageSquareOff } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useDialogue } from '../../hooks/useDialogue';
import { useDialogueStore } from '../../store/dialogueStore';
import '../dialogue/DialogueTab.css';

const DialogueTab: React.FC = () => {
  const projectDir = useAppStore((s) => s.projectDir);
  const { loadProjectIndex } = useDialogue();
  const { loadingIndex, indexByProject } = useDialogueStore();

  // 進入此 Tab 或 projectDir 變動 → 載入索引
  useEffect(() => {
    useDialogueStore.getState().clearSelection();
    useDialogueStore.getState().clearSearch();
    if (projectDir) void loadProjectIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  if (!projectDir) {
    return (
      <div className="dialogue-tab">
        <div className="dialogue-tab__empty">
          <div>
            <MessageSquareOff
              size={28}
              className="dialogue-tab__empty-icon"
            />
            請從左側 Sidebar 選擇專案，才能檢視對話歷史
          </div>
        </div>
      </div>
    );
  }

  const idx = indexByProject[projectDir];
  const sessionCount = idx?.sessions.length ?? 0;

  return (
    <div className="dialogue-tab">
      <div className="dialogue-tab__list">
        {/* 後續 task 放 SessionList */}
        <div style={{ padding: 12, fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
          {loadingIndex ? '載入中…' : `共 ${sessionCount} 個 session`}
        </div>
      </div>
      <div className="dialogue-tab__view">
        <div className="dialogue-tab__empty">
          尚未選擇 session
        </div>
      </div>
    </div>
  );
};

export default DialogueTab;
```

- [ ] **Step 3: 修改 `src/components/TabBar/TabBar.tsx`**

在 `import` 區塊新增圖示：

```tsx
import {
  // ...既有 icon
  MessageSquare,
  // ...
} from 'lucide-react';
```

在 `CATEGORIES` 裡的 `files` 類別（`id: 'files'`）的 `tabs` 陣列中，**於 `memory` 之後、`merge` 之前**插入：

```tsx
{ id: 'dialogue', label: '對話', icon: <MessageSquare size={14} /> },
```

插入後 `files` 類別的 `tabs` 應為：

```tsx
tabs: [
  { id: 'claudemd', label: 'CLAUDE.md', icon: <FileText size={14} /> },
  { id: 'memory',   label: 'Memory',    icon: <Brain size={14} /> },
  { id: 'dialogue', label: '對話',      icon: <MessageSquare size={14} /> },
  { id: 'merge',    label: 'Merge',     icon: <GitMerge size={14} /> },
  { id: 'json',     label: 'JSON',      icon: <Braces size={14} /> },
],
```

- [ ] **Step 4: 修改 `src/App.tsx`**

在 tab imports 附近新增：

```tsx
import DialogueTab from './components/tabs/DialogueTab';
```

在 `TAB_COMPONENTS` 物件中加入 `dialogue`（建議放在 `memory` 之後）：

```tsx
const TAB_COMPONENTS: Record<string, React.FC> = {
  basic:        BasicSettings,
  permissions:  Permissions,
  hooks:        Hooks,
  env:          EnvVars,
  sandbox:      SandboxTab,
  mcp:          McpPluginsTab,
  agents:       AgentsTab,
  commands:     CommandsTab,
  outputstyles: OutputStylesTab,
  skills:       SkillsTab,
  rules:        RulesTab,
  memory:       MemoryTab,
  dialogue:     DialogueTab,
  statusline:   StatusLineTab,
  advanced:     AdvancedTab,
  global:       GlobalTab,
  claudemd:     ClaudeMd,
  merge:        MergePreview,
  json:         JsonEditor,
};
```

- [ ] **Step 5: 建置驗證**

Run: `npm run build`
Expected: 通過

- [ ] **Step 6: 啟動驗證**

Run: `npm run tauri dev`

驗證步驟：
1. App 開啟後，頂部導航 → 「文件」類別應可見 Tab「對話」，位置在 Memory 與 Merge 之間
2. 點擊「對話」Tab
3. 若未選專案 → 應顯示「請從左側 Sidebar 選擇專案…」
4. 點 Sidebar 的專案選擇按鈕，選擇 `d:\GitHub\claude-settings`
5. 對話 Tab 內容應變成「共 N 個 session」（N > 0）
6. 切換至其他 Tab（如 Basic）再切回對話 Tab → 不應重新讀檔（store 有快取）
7. 重新選擇不同專案 → 左欄數字應更新

`Ctrl+C` 終止 dev server。

- [ ] **Step 7: Commit**

```bash
git add src/components/tabs/DialogueTab.tsx src/components/dialogue/DialogueTab.css \
        src/components/TabBar/TabBar.tsx src/App.tsx
git commit -m "feat(dialogue): add DialogueTab skeleton and wire into TabBar"
```

---

## Task 8：SessionList 元件

**Files:**
- Create: `src/components/dialogue/SessionList.tsx`
- Modify: `src/components/tabs/DialogueTab.tsx`（以真正的 SessionList 取代 placeholder）
- Modify: `src/components/dialogue/DialogueTab.css`（新增 SessionList 樣式）

- [ ] **Step 1: 新增 `src/components/dialogue/SessionList.tsx`**

```tsx
/**
 * SessionList — 左欄：搜尋框 + 依日期分組的 session 卡片清單
 */
import React, { useMemo } from 'react';
import { Search, X, Layers, Bot, Trash2 } from 'lucide-react';
import { useDialogueStore } from '../../store/dialogueStore';
import type { SessionMeta } from '../../types/dialogue';

interface Props {
  sessions: SessionMeta[];
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
  onRequestDelete: (sessionId: string) => void;
  /** 搜尋命中的 sessionId 集合（null = 無搜尋進行） */
  filteredIds: string[] | null;
  /** 是否被 500 筆截斷 */
  searchTruncated: boolean;
  query: string;
  onQueryChange: (q: string) => void;
}

/** 時間分組鍵 */
type BucketKey = '今天' | '昨天' | '本週' | '更早';

const BUCKET_ORDER: BucketKey[] = ['今天', '昨天', '本週', '更早'];

/** 計算某 ISO 時間屬於哪個 bucket */
const bucketOf = (iso: string): BucketKey => {
  if (!iso) return '更早';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '更早';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfToday.getDay()); // 週日為起
  if (t >= startOfToday) return '今天';
  if (t >= startOfYesterday) return '昨天';
  if (t >= startOfWeek) return '本週';
  return '更早';
};

/** 顯示時間：今天 HH:mm / 其他 MM-DD HH:mm */
const formatTime = (iso: string): string => {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const now = new Date();
  const isToday =
    t.getFullYear() === now.getFullYear() &&
    t.getMonth() === now.getMonth() &&
    t.getDate() === now.getDate();
  if (isToday) return `${hh}:${mm}`;
  const MM = String(t.getMonth() + 1).padStart(2, '0');
  const DD = String(t.getDate()).padStart(2, '0');
  return `${MM}-${DD} ${hh}:${mm}`;
};

const SessionList: React.FC<Props> = ({
  sessions,
  selectedId,
  onSelect,
  onRequestDelete,
  filteredIds,
  searchTruncated,
  query,
  onQueryChange,
}) => {
  const loadingIndex = useDialogueStore((s) => s.loadingIndex);

  /** 套用搜尋過濾 */
  const visibleSessions = useMemo(() => {
    if (!filteredIds) return sessions;
    const set = new Set(filteredIds);
    return sessions.filter((s) => set.has(s.sessionId));
  }, [sessions, filteredIds]);

  /** 依日期 bucket 分組 */
  const grouped = useMemo(() => {
    const map: Record<BucketKey, SessionMeta[]> = {
      今天: [],
      昨天: [],
      本週: [],
      更早: [],
    };
    for (const s of visibleSessions) {
      map[bucketOf(s.lastTime)].push(s);
    }
    return map;
  }, [visibleSessions]);

  return (
    <>
      {/* 搜尋框 */}
      <div className="session-list__search">
        <Search size={14} className="session-list__search-icon" />
        <input
          type="text"
          className="session-list__search-input"
          placeholder="搜尋對話…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {query && (
          <button
            className="session-list__search-clear"
            onClick={() => onQueryChange('')}
            title="清除搜尋"
            aria-label="清除搜尋"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* 搜尋截斷提示 */}
      {searchTruncated && (
        <div className="session-list__notice">
          僅顯示前 500 筆，請縮小搜尋範圍
        </div>
      )}

      {/* 空狀態 */}
      {loadingIndex && (
        <div className="session-list__empty">載入中…</div>
      )}
      {!loadingIndex && visibleSessions.length === 0 && !query && (
        <div className="session-list__empty">
          此專案尚無對話紀錄。
          <br />
          當你在此目錄啟動 <code>claude</code> 後會自動出現。
        </div>
      )}
      {!loadingIndex && visibleSessions.length === 0 && query && (
        <div className="session-list__empty">無符合搜尋的結果</div>
      )}

      {/* 分組清單 */}
      {!loadingIndex && visibleSessions.length > 0 && (
        <div className="session-list__scroll">
          {BUCKET_ORDER.map((bucket) => {
            const items = grouped[bucket];
            if (items.length === 0) return null;
            return (
              <div key={bucket} className="session-list__group">
                <div className="session-list__group-title">
                  {bucket}
                  <span className="session-list__group-count">
                    {items.length}
                  </span>
                </div>
                {items.map((s) => {
                  const active = s.sessionId === selectedId;
                  return (
                    <button
                      key={s.sessionId}
                      className={`session-list__card${active ? ' session-list__card--active' : ''}`}
                      onClick={() => onSelect(s.sessionId)}
                    >
                      <div className="session-list__card-row1">
                        <span className="session-list__card-time">
                          {formatTime(s.lastTime)}
                        </span>
                        <span className="session-list__card-count">
                          · {s.messageCount} 則
                        </span>
                        {s.hasCompaction && (
                          <span
                            className="session-list__badge"
                            title="此 session 含 context 壓縮摘要"
                          >
                            <Layers size={10} />
                          </span>
                        )}
                        {s.hasSubagent && (
                          <span
                            className="session-list__badge"
                            title="此 session 含 subagent 對話"
                          >
                            <Bot size={10} />
                          </span>
                        )}
                        <span
                          className="session-list__card-del"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestDelete(s.sessionId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              onRequestDelete(s.sessionId);
                            }
                          }}
                          title="刪除此對話"
                        >
                          <Trash2 size={12} />
                        </span>
                      </div>
                      <div className="session-list__card-preview">
                        {s.firstPromptPreview || <em>（無使用者訊息）</em>}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default React.memo(SessionList);
```

- [ ] **Step 2: 擴充 `src/components/dialogue/DialogueTab.css`**

將以下樣式 append 到檔案末尾：

```css
/* SessionList */
.session-list__search {
  position: relative;
  padding: 8px 10px 6px;
  border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
  display: flex;
  align-items: center;
}

.session-list__search-icon {
  position: absolute;
  left: 18px;
  color: var(--color-text-muted, #9ca3af);
}

.session-list__search-input {
  flex: 1;
  padding: 6px 26px 6px 28px;
  font-size: 12px;
  border: 1px solid var(--color-border-subtle, #d1d5db);
  border-radius: 6px;
  background: var(--color-surface-alt, #fafafa);
  outline: none;
}

.session-list__search-input:focus {
  border-color: var(--color-accent, #3b82f6);
  background: var(--color-surface, #fff);
}

.session-list__search-clear {
  position: absolute;
  right: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-muted, #9ca3af);
  padding: 2px;
}

.session-list__notice {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--color-warning, #b45309);
  background: rgba(180, 83, 9, 0.08);
  border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
}

.session-list__empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.6;
}

.session-list__scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.session-list__group {
  padding: 2px 0 6px;
}

.session-list__group-title {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted, #6b7280);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
}

.session-list__group-count {
  background: var(--color-surface-alt, #f3f4f6);
  color: var(--color-text-muted, #6b7280);
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
}

.session-list__card {
  width: calc(100% - 16px);
  margin: 2px 8px;
  padding: 8px 10px;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  display: block;
  font: inherit;
  color: inherit;
  transition: background-color 0.12s, border-color 0.12s;
}

.session-list__card:hover {
  background: var(--color-hover, #f3f4f6);
}

.session-list__card--active {
  background: var(--color-accent-soft, rgba(59, 130, 246, 0.1));
  border-color: var(--color-accent, #3b82f6);
}

.session-list__card-row1 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text, #111);
}

.session-list__card-time {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.session-list__card-count {
  color: var(--color-text-muted, #6b7280);
}

.session-list__badge {
  display: inline-flex;
  align-items: center;
  color: var(--color-text-muted, #9ca3af);
}

.session-list__card-del {
  margin-left: auto;
  opacity: 0;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  color: var(--color-text-muted, #9ca3af);
  display: inline-flex;
}

.session-list__card:hover .session-list__card-del,
.session-list__card-del:focus-visible {
  opacity: 1;
}

.session-list__card-del:hover {
  color: var(--color-danger, #dc2626);
  background: rgba(220, 38, 38, 0.08);
}

.session-list__card-preview {
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: 修改 `src/components/tabs/DialogueTab.tsx`（接上 SessionList）**

完整替換檔案內容為：

```tsx
/**
 * DialogueTab — 檢視當前專案的 Claude Code session 歷史
 */
import React, { useEffect, useState } from 'react';
import { MessageSquareOff } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useDialogue } from '../../hooks/useDialogue';
import { useDialogueStore } from '../../store/dialogueStore';
import SessionList from '../dialogue/SessionList';
import '../dialogue/DialogueTab.css';

/** 搜尋輸入 debounce 毫秒 */
const SEARCH_DEBOUNCE_MS = 200;

const DialogueTab: React.FC = () => {
  const projectDir = useAppStore((s) => s.projectDir);
  const { loadProjectIndex, searchInProject } = useDialogue();
  const {
    indexByProject,
    selectedSessionId,
    searchQuery,
    searchResults,
    loadingIndex,
  } = useDialogueStore();
  const setSelected = useDialogueStore((s) => s.setSelected);
  const setSearchQuery = useDialogueStore((s) => s.setSearchQuery);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 進入此 Tab 或 projectDir 變動 → 載入索引
  useEffect(() => {
    useDialogueStore.getState().clearSelection();
    useDialogueStore.getState().clearSearch();
    if (projectDir) void loadProjectIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  // 搜尋 debounce
  useEffect(() => {
    if (!projectDir) return;
    const handler = setTimeout(() => {
      void searchInProject(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, projectDir]);

  if (!projectDir) {
    return (
      <div className="dialogue-tab">
        <div className="dialogue-tab__empty">
          <div>
            <MessageSquareOff
              size={28}
              className="dialogue-tab__empty-icon"
            />
            請從左側 Sidebar 選擇專案，才能檢視對話歷史
          </div>
        </div>
      </div>
    );
  }

  const idx = indexByProject[projectDir];
  const sessions = idx?.sessions ?? [];

  return (
    <div className="dialogue-tab">
      <div className="dialogue-tab__list">
        <SessionList
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={(id) => setSelected(id)}
          onRequestDelete={(id) => setPendingDeleteId(id)}
          filteredIds={searchResults?.sessionIds ?? null}
          searchTruncated={searchResults?.truncated ?? false}
          query={searchQuery}
          onQueryChange={(q) => setSearchQuery(q)}
        />
      </div>
      <div className="dialogue-tab__view">
        <div className="dialogue-tab__empty">
          {loadingIndex
            ? '載入中…'
            : selectedSessionId
            ? '（SessionView 待下一個 task 實作）'
            : '← 從左側選擇一個對話'}
        </div>
      </div>
      {/* 刪除確認視窗於後續 task（Task 10）接上；暫存 state 先留著 */}
      {pendingDeleteId && (
        <div
          onClick={() => setPendingDeleteId(null)}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};

export default DialogueTab;
```

- [ ] **Step 4: 建置驗證**

Run: `npm run build`
Expected: 通過

- [ ] **Step 5: 啟動驗證**

Run: `npm run tauri dev`

驗證：
1. 進入「對話」Tab，選擇 `d:\GitHub\claude-settings`
2. 左欄應顯示 session 卡片，依「今天 / 昨天 / 本週 / 更早」分組
3. 每張卡片應顯示：時間、訊息數、首 prompt 前綴
4. hover 卡片 → 右側出現垃圾桶 icon
5. 有 compaction 的 session 卡片應顯示 Layers 小徽章
6. 有 subagent 的 session 卡片應顯示 Bot 小徽章
7. 輸入搜尋字串（如 `brainstorm`）→ debounce 後清單縮小
8. 清空搜尋 → 清單恢復

`Ctrl+C` 終止。

- [ ] **Step 6: Commit**

```bash
git add src/components/dialogue/SessionList.tsx \
        src/components/dialogue/DialogueTab.css \
        src/components/tabs/DialogueTab.tsx
git commit -m "feat(dialogue): add SessionList with grouping and search UI"
```

---

## Task 9：SessionView + MessageBubble（基本變體）

**Files:**
- Create: `src/components/dialogue/MessageBubble.tsx`
- Create: `src/components/dialogue/SessionView.tsx`
- Modify: `src/components/tabs/DialogueTab.tsx`（接上 SessionView）
- Modify: `src/components/dialogue/DialogueTab.css`（新增 view/bubble 樣式）

- [ ] **Step 1: 新增 `src/components/dialogue/MessageBubble.tsx`**

```tsx
/**
 * MessageBubble — 單一事件的視覺呈現
 *
 * 依事件屬性選擇變體：
 *  - compaction (isCompactSummary)
 *  - user / assistant-text / assistant-thinking
 *  - tool-use / tool-result
 *  - attachment
 *  - unknown (fallback，顯示 raw JSON)
 */
import React, { useState } from 'react';
import { ChevronRight, Wrench, Layers, Paperclip } from 'lucide-react';
import type { ContentBlock, DialogueEvent } from '../../types/dialogue';

interface Props {
  event: DialogueEvent;
  /** 是否高亮顯示（搜尋命中） */
  highlight?: string | null;
  /** 是否以 raw 模式渲染（顯示原始 JSON） */
  rawMode?: boolean;
  /** 是否顯示工具呼叫（chat+tools 模式為 true） */
  showTools?: boolean;
}

/** 將字串依 query 插入 <mark> */
const highlightText = (text: string, query: string | null | undefined): React.ReactNode => {
  if (!query || query.length < 2) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let fromIdx = 0;
  let match: number;
  while ((match = lower.indexOf(q, fromIdx)) !== -1) {
    if (match > fromIdx) parts.push(text.slice(fromIdx, match));
    parts.push(
      <mark key={`m-${i++}`} className="dialogue-msg__mark">
        {text.slice(match, match + q.length)}
      </mark>,
    );
    fromIdx = match + q.length;
  }
  if (fromIdx < text.length) parts.push(text.slice(fromIdx));
  return <>{parts}</>;
};

/** 取 user/assistant message 的文字 content（跨 string / array 形態） */
const extractTexts = (content: string | ContentBlock[]): string[] => {
  if (typeof content === 'string') return [content];
  const out: string[] = [];
  for (const b of content) {
    if (b.type === 'text' && typeof (b as { text?: string }).text === 'string') {
      out.push((b as { text: string }).text);
    }
  }
  return out;
};

/** 取 assistant content 中的 thinking blocks */
const extractThinking = (content: string | ContentBlock[]): string[] => {
  if (typeof content === 'string') return [];
  return content
    .filter((b): b is { type: 'thinking'; thinking: string } => b.type === 'thinking')
    .map((b) => b.thinking);
};

/** 取 assistant content 中的 tool_use blocks */
const extractToolUses = (
  content: string | ContentBlock[],
): Array<{ id: string; name: string; input: Record<string, unknown> }> => {
  if (typeof content === 'string') return [];
  return content
    .filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
      b.type === 'tool_use',
    )
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));
};

/** 取 user content 中的 tool_result blocks */
const extractToolResults = (
  content: string | ContentBlock[],
): Array<{ tool_use_id: string; text: string; is_error?: boolean }> => {
  if (typeof content === 'string') return [];
  return content
    .filter((b): b is { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[]; is_error?: boolean } =>
      b.type === 'tool_result',
    )
    .map((b) => ({
      tool_use_id: b.tool_use_id,
      is_error: b.is_error,
      text: typeof b.content === 'string'
        ? b.content
        : extractTexts(b.content).join('\n'),
    }));
};

const RAW_TRUNCATE_AT = 8 * 1024; // 8KB

const MessageBubble: React.FC<Props> = ({ event, highlight, rawMode, showTools }) => {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  if (rawMode) {
    const json = JSON.stringify(event.raw, null, 2);
    const truncated = json.length > RAW_TRUNCATE_AT;
    const shown = rawOpen || !truncated ? json : json.slice(0, RAW_TRUNCATE_AT);
    return (
      <div className="dialogue-msg dialogue-msg--raw">
        <div className="dialogue-msg__raw-header">
          <code>{event.type}</code>
          <span className="dialogue-msg__raw-time">{event.timestamp}</span>
        </div>
        <pre className="dialogue-msg__raw-body">{shown}</pre>
        {truncated && (
          <button
            className="dialogue-msg__expand"
            onClick={() => setRawOpen(!rawOpen)}
          >
            {rawOpen ? '收合' : `顯示完整（共 ${json.length} 字元）`}
          </button>
        )}
      </div>
    );
  }

  // Compaction 摘要
  if (event.isCompactSummary) {
    const text = typeof event.message?.content === 'string'
      ? event.message.content
      : extractTexts(event.message?.content ?? []).join('\n');
    return (
      <div className="dialogue-msg dialogue-msg--compaction">
        <button
          className="dialogue-msg__compact-header"
          onClick={() => setCompactOpen(!compactOpen)}
        >
          <ChevronRight
            size={14}
            style={{ transform: compactOpen ? 'rotate(90deg)' : 'none' }}
          />
          <Layers size={14} />
          <span>Compaction Summary</span>
          <span className="dialogue-msg__compact-hint">
            （{text.length} 字元）
          </span>
        </button>
        {compactOpen && (
          <pre className="dialogue-msg__compact-body">
            {highlightText(text, highlight ?? null)}
          </pre>
        )}
      </div>
    );
  }

  // Attachment（hook 結果等）
  if (event.type === 'attachment' && event.attachment) {
    return (
      <div className="dialogue-msg dialogue-msg--attachment">
        <Paperclip size={12} />
        <span>{event.attachment.type}</span>
        {event.attachment.filename && (
          <code>{event.attachment.displayPath ?? event.attachment.filename}</code>
        )}
      </div>
    );
  }

  // User / Assistant
  const role = event.message?.role ?? (event.type === 'user' ? 'user' : event.type === 'assistant' ? 'assistant' : null);
  if (!role || !event.message) {
    // fallback：非對話事件（queue-operation 等）在 chat/chat+tools 模式不顯示
    return null;
  }

  const content = event.message.content;

  // User 訊息：可能含 tool_result（此時另行處理）
  if (role === 'user') {
    const toolResults = extractToolResults(content);
    if (toolResults.length > 0 && showTools) {
      return (
        <div className="dialogue-msg dialogue-msg--tool-result">
          {toolResults.map((tr, i) => (
            <div key={`tr-${i}`} className="dialogue-msg__tool-result-box">
              <div className="dialogue-msg__tool-result-header">
                <Wrench size={11} />
                Tool Result {tr.is_error && <span className="dialogue-msg__err">(error)</span>}
              </div>
              <pre className="dialogue-msg__tool-result-body">
                {highlightText(
                  tr.text.length > RAW_TRUNCATE_AT
                    ? tr.text.slice(0, RAW_TRUNCATE_AT) + '…（截斷）'
                    : tr.text,
                  highlight ?? null,
                )}
              </pre>
            </div>
          ))}
        </div>
      );
    }
    if (toolResults.length > 0 && !showTools) {
      // chat 模式：隱藏 tool_result
      return null;
    }
    const texts = extractTexts(content);
    if (texts.length === 0) return null;
    return (
      <div className="dialogue-msg dialogue-msg--user">
        <div className="dialogue-msg__role">You</div>
        <div className="dialogue-msg__body">
          {texts.map((t, i) => (
            <p key={`u-${i}`}>{highlightText(t, highlight ?? null)}</p>
          ))}
        </div>
      </div>
    );
  }

  // Assistant 訊息
  const texts = extractTexts(content);
  const thinking = extractThinking(content);
  const toolUses = extractToolUses(content);

  return (
    <div className="dialogue-msg dialogue-msg--assistant">
      <div className="dialogue-msg__role">Assistant</div>
      <div className="dialogue-msg__body">
        {thinking.length > 0 && (
          <div className="dialogue-msg__thinking">
            <button
              className="dialogue-msg__thinking-toggle"
              onClick={() => setThinkingOpen(!thinkingOpen)}
            >
              <ChevronRight
                size={12}
                style={{ transform: thinkingOpen ? 'rotate(90deg)' : 'none' }}
              />
              Thinking（{thinking.reduce((n, t) => n + t.length, 0)} 字元）
            </button>
            {thinkingOpen && (
              <pre className="dialogue-msg__thinking-body">
                {thinking.map((t, i) => (
                  <div key={`th-${i}`}>{highlightText(t, highlight ?? null)}</div>
                ))}
              </pre>
            )}
          </div>
        )}
        {texts.map((t, i) => (
          <p key={`a-${i}`}>{highlightText(t, highlight ?? null)}</p>
        ))}
        {showTools && toolUses.length > 0 && (
          <div className="dialogue-msg__tools">
            {toolUses.map((tu, i) => (
              <div key={`tu-${i}`} className="dialogue-msg__tool-use">
                <div className="dialogue-msg__tool-use-header">
                  <Wrench size={11} />
                  <code>{tu.name}</code>
                </div>
                <pre className="dialogue-msg__tool-use-body">
                  {JSON.stringify(tu.input, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
```

- [ ] **Step 2: 新增 `src/components/dialogue/SessionView.tsx`**

```tsx
/**
 * SessionView — 右欄：session header + 訊息流
 * subagent 的群組化處理暫在 Task 10 補上；本 task 先平鋪渲染
 */
import React, { useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useDialogueStore } from '../../store/dialogueStore';
import { useDialogue } from '../../hooks/useDialogue';
import MessageBubble from './MessageBubble';
import type { DialogueEvent, DialogueViewMode } from '../../types/dialogue';

interface Props {
  sessionId: string;
  onRequestDelete: (sessionId: string) => void;
}

const MODE_LABEL: Record<DialogueViewMode, string> = {
  chat: '純對話',
  'chat+tools': '對話+工具',
  raw: '完整原始',
};

const SessionView: React.FC<Props> = ({ sessionId, onRequestDelete }) => {
  const { loadSession } = useDialogue();
  const events = useDialogueStore((s) => s.eventsBySession[sessionId]);
  const viewMode = useDialogueStore((s) => s.viewMode);
  const setViewMode = useDialogueStore((s) => s.setViewMode);
  const searchQuery = useDialogueStore((s) => s.searchQuery);
  const loadingSession = useDialogueStore((s) => s.loadingSession);

  useEffect(() => {
    void loadSession(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /** 依模式過濾 */
  const visible = useMemo<DialogueEvent[]>(() => {
    if (!events) return [];
    if (viewMode === 'raw') return events;
    // chat / chat+tools：只保留 user/assistant/attachment/compaction；略過 queue-operation
    return events.filter(
      (e) =>
        e.type === 'user' ||
        e.type === 'assistant' ||
        e.type === 'attachment' ||
        e.isCompactSummary,
    );
  }, [events, viewMode]);

  if (!events && loadingSession) {
    return <div className="dialogue-view__empty">載入 session…</div>;
  }
  if (!events) {
    return <div className="dialogue-view__empty">（無資料）</div>;
  }

  const firstTs = events.find((e) => e.timestamp)?.timestamp ?? '';
  const msgCount = events.filter(
    (e) => e.type === 'user' || e.type === 'assistant',
  ).length;

  const highlight = searchQuery.trim().length >= 2 ? searchQuery.trim() : null;

  return (
    <>
      <div className="dialogue-view__header">
        <div className="dialogue-view__header-info">
          <span className="dialogue-view__header-time">{firstTs}</span>
          <span className="dialogue-view__header-count">· {msgCount} 則</span>
        </div>
        <div className="dialogue-view__header-actions">
          <div
            className="dialogue-view__seg"
            role="tablist"
            aria-label="顯示顆粒度"
          >
            {(['chat', 'chat+tools', 'raw'] as DialogueViewMode[]).map((m) => (
              <button
                key={m}
                className={`dialogue-view__seg-btn${viewMode === m ? ' dialogue-view__seg-btn--active' : ''}`}
                onClick={() => setViewMode(m)}
                role="tab"
                aria-selected={viewMode === m}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <button
            className="dialogue-view__del-btn"
            onClick={() => onRequestDelete(sessionId)}
            title="刪除此對話"
          >
            <Trash2 size={13} />
            刪除
          </button>
        </div>
      </div>
      <div className="dialogue-view__scroll">
        {visible.length === 0 && (
          <div className="dialogue-view__empty">（此模式下無可顯示內容）</div>
        )}
        {visible.map((ev) => (
          <MessageBubble
            key={ev.uuid}
            event={ev}
            highlight={highlight}
            rawMode={viewMode === 'raw'}
            showTools={viewMode !== 'chat'}
          />
        ))}
      </div>
    </>
  );
};

export default SessionView;
```

- [ ] **Step 3: 擴充 `src/components/dialogue/DialogueTab.css`（view + bubble 樣式）**

將以下 CSS append 到檔案末尾：

```css
/* SessionView */
.dialogue-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
  gap: 10px;
}

.dialogue-view__header-info {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text, #111);
}

.dialogue-view__header-time {
  font-variant-numeric: tabular-nums;
}

.dialogue-view__header-count {
  color: var(--color-text-muted, #6b7280);
}

.dialogue-view__header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.dialogue-view__seg {
  display: inline-flex;
  border: 1px solid var(--color-border-subtle, #d1d5db);
  border-radius: 6px;
  overflow: hidden;
}

.dialogue-view__seg-btn {
  background: transparent;
  border: none;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  color: var(--color-text, #111);
  transition: background-color 0.12s;
}

.dialogue-view__seg-btn:not(:last-child) {
  border-right: 1px solid var(--color-border-subtle, #d1d5db);
}

.dialogue-view__seg-btn--active {
  background: var(--color-accent, #3b82f6);
  color: #fff;
}

.dialogue-view__del-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid var(--color-border-subtle, #d1d5db);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--color-text, #111);
  transition: background-color 0.12s, border-color 0.12s, color 0.12s;
}

.dialogue-view__del-btn:hover {
  color: var(--color-danger, #dc2626);
  border-color: var(--color-danger, #dc2626);
  background: rgba(220, 38, 38, 0.06);
}

.dialogue-view__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 20px;
  min-height: 0;
}

.dialogue-view__empty {
  padding: 30px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted, #6b7280);
}

/* MessageBubble */
.dialogue-msg {
  margin-bottom: 14px;
  font-size: 13px;
  line-height: 1.6;
}

.dialogue-msg__role {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted, #6b7280);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.dialogue-msg__body p {
  margin: 0 0 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.dialogue-msg--user .dialogue-msg__body {
  background: var(--color-accent-soft, rgba(59, 130, 246, 0.08));
  border-left: 3px solid var(--color-accent, #3b82f6);
  padding: 8px 12px;
  border-radius: 4px;
}

.dialogue-msg--assistant .dialogue-msg__body {
  background: var(--color-surface-alt, #f9fafb);
  padding: 8px 12px;
  border-radius: 4px;
}

/* Thinking */
.dialogue-msg__thinking {
  margin-bottom: 6px;
}

.dialogue-msg__thinking-toggle {
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-style: italic;
}

.dialogue-msg__thinking-body {
  background: var(--color-surface-alt, #f3f4f6);
  border-left: 3px solid var(--color-text-muted, #9ca3af);
  padding: 6px 10px;
  margin: 4px 0;
  font-family: inherit;
  font-size: 12px;
  white-space: pre-wrap;
  font-style: italic;
  color: var(--color-text-muted, #4b5563);
}

/* Tool use / result */
.dialogue-msg__tools {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dialogue-msg__tool-use,
.dialogue-msg__tool-result-box {
  border: 1px solid var(--color-border-subtle, #e5e7eb);
  border-radius: 4px;
  background: var(--color-surface-alt, #fafafa);
  padding: 6px 10px;
}

.dialogue-msg__tool-use-header,
.dialogue-msg__tool-result-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-muted, #6b7280);
  margin-bottom: 4px;
}

.dialogue-msg__tool-use-body,
.dialogue-msg__tool-result-body {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11.5px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
}

.dialogue-msg__err {
  color: var(--color-danger, #dc2626);
  margin-left: 6px;
}

/* Compaction */
.dialogue-msg--compaction {
  border: 1px dashed var(--color-border, #9ca3af);
  border-radius: 6px;
  padding: 8px 10px;
  background: rgba(156, 163, 175, 0.06);
}

.dialogue-msg__compact-header {
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text, #111);
  font-weight: 600;
}

.dialogue-msg__compact-hint {
  font-weight: normal;
  color: var(--color-text-muted, #6b7280);
}

.dialogue-msg__compact-body {
  margin: 8px 0 0;
  font-size: 12px;
  white-space: pre-wrap;
  max-height: 320px;
  overflow: auto;
  padding: 6px 8px;
  background: var(--color-surface, #fff);
  border-radius: 4px;
}

/* Attachment */
.dialogue-msg--attachment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-muted, #6b7280);
  background: var(--color-surface-alt, #f9fafb);
  padding: 4px 8px;
  border-radius: 3px;
  margin-bottom: 6px;
}

.dialogue-msg--attachment code {
  color: var(--color-text, #111);
}

/* Raw mode */
.dialogue-msg--raw {
  border: 1px solid var(--color-border-subtle, #e5e7eb);
  border-radius: 4px;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: var(--color-surface-alt, #fafafa);
}

.dialogue-msg__raw-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-text-muted, #6b7280);
  margin-bottom: 4px;
}

.dialogue-msg__raw-body {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 360px;
  overflow: auto;
}

.dialogue-msg__expand {
  background: transparent;
  border: none;
  color: var(--color-accent, #3b82f6);
  cursor: pointer;
  font-size: 11px;
  padding: 4px 0 0;
}

/* 搜尋命中高亮 */
.dialogue-msg__mark {
  background: var(--color-accent-soft, rgba(59, 130, 246, 0.25));
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}
```

- [ ] **Step 4: 修改 `src/components/tabs/DialogueTab.tsx` 接上 SessionView**

找到右側區塊 `<div className="dialogue-tab__view">...` 整段替換為：

```tsx
<div className="dialogue-tab__view">
  {selectedSessionId ? (
    <SessionView
      sessionId={selectedSessionId}
      onRequestDelete={(id) => setPendingDeleteId(id)}
    />
  ) : (
    <div className="dialogue-tab__empty">
      {loadingIndex ? '載入中…' : '← 從左側選擇一個對話'}
    </div>
  )}
</div>
```

並於檔案頂 import 區加入：

```tsx
import SessionView from '../dialogue/SessionView';
```

- [ ] **Step 5: 建置驗證**

Run: `npm run build`
Expected: 通過

- [ ] **Step 6: 啟動驗證**

Run: `npm run tauri dev`

驗證：
1. 進入「對話」Tab → 選擇專案 → 點任一 session
2. 右側應出現 header（時間、訊息數、顆粒度切換、刪除按鈕）
3. 切換「純對話 / 對話+工具 / 完整原始」三種模式 → 畫面對應變化
4. 含 compaction 的 session → 能看到虛線框 + 可展開的摘要
5. 有 thinking 的 assistant 訊息 → 顯示「Thinking」折疊按鈕
6. 搜尋字串 → 訊息中該字串被 `<mark>` 高亮
7. 切換不同 session → 內容隨之更新
8. `Ctrl+C` 終止

- [ ] **Step 7: Commit**

```bash
git add src/components/dialogue/MessageBubble.tsx \
        src/components/dialogue/SessionView.tsx \
        src/components/dialogue/DialogueTab.css \
        src/components/tabs/DialogueTab.tsx
git commit -m "feat(dialogue): add SessionView and MessageBubble variants"
```

---

## Task 10：SubagentGroup（isSidechain 摺疊呈現）

**Files:**
- Create: `src/components/dialogue/SubagentGroup.tsx`
- Modify: `src/components/dialogue/SessionView.tsx`（在 chat/chat+tools 模式改用 groupBySidechain）
- Modify: `src/components/dialogue/DialogueTab.css`（subagent 樣式）

- [ ] **Step 1: 新增 `src/components/dialogue/SubagentGroup.tsx`**

```tsx
/**
 * SubagentGroup — 將連續 isSidechain 事件摺疊為一個可展開群組
 * chat / chat+tools 模式使用；raw 模式應平鋪、不經此元件
 */
import React, { useMemo, useState } from 'react';
import { Bot, ChevronRight } from 'lucide-react';
import MessageBubble from './MessageBubble';
import type { DialogueEvent } from '../../types/dialogue';

interface Props {
  events: DialogueEvent[];
  highlight?: string | null;
  showTools?: boolean;
}

/** 從群組首事件的 raw.message.content 嘗試抽出 subagent 名稱（若無則回 'Subagent'） */
const guessSubagentLabel = (events: DialogueEvent[]): string => {
  // 嘗試在第一個 assistant 事件的 content 裡找 tool_use(name=Task) 的 subagent_type
  for (const ev of events) {
    if (ev.type !== 'assistant' || !ev.message) continue;
    const content = ev.message.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (
        b.type === 'tool_use' &&
        (b as { name?: string }).name === 'Task' &&
        typeof (b as { input?: { subagent_type?: string } }).input?.subagent_type === 'string'
      ) {
        return (b as { input: { subagent_type: string } }).input.subagent_type;
      }
    }
  }
  return 'Subagent';
};

/** 毫秒差 → "X 秒" / "X 分 Y 秒" 人類可讀 */
const formatDuration = (startIso: string, endIso: string): string => {
  if (!startIso || !endIso) return '';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs === 0 ? `${m} 分` : `${m} 分 ${rs} 秒`;
};

const SubagentGroup: React.FC<Props> = ({ events, highlight, showTools }) => {
  const [open, setOpen] = useState(false);
  const label = useMemo(() => guessSubagentLabel(events), [events]);
  const count = useMemo(
    () => events.filter((e) => e.type === 'user' || e.type === 'assistant').length,
    [events],
  );
  const first = events[0]?.timestamp ?? '';
  const last = events[events.length - 1]?.timestamp ?? '';
  const duration = formatDuration(first, last);

  return (
    <div className="dialogue-msg dialogue-msg--subagent">
      <button
        className="dialogue-msg__subagent-header"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          size={14}
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        />
        <Bot size={14} />
        <span>Subagent ({label})</span>
        <span className="dialogue-msg__subagent-hint">
          · {count} 則{duration && ` · ${duration}`}
        </span>
      </button>
      {open && (
        <div className="dialogue-msg__subagent-body">
          {events.map((ev) => (
            <MessageBubble
              key={ev.uuid}
              event={ev}
              highlight={highlight}
              rawMode={false}
              showTools={showTools}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SubagentGroup;
```

- [ ] **Step 2: 修改 `src/components/dialogue/SessionView.tsx` 改用 groupBySidechain**

在 import 區新增：

```tsx
import { groupBySidechain } from '../../utils/jsonlParser';
import SubagentGroup from './SubagentGroup';
```

將原本渲染 `visible.map(...)` 那段替換為（新增分組邏輯）：

```tsx
<div className="dialogue-view__scroll">
  {visible.length === 0 && (
    <div className="dialogue-view__empty">（此模式下無可顯示內容）</div>
  )}
  {viewMode === 'raw'
    ? visible.map((ev) => (
        <MessageBubble
          key={ev.uuid}
          event={ev}
          highlight={highlight}
          rawMode
          showTools
        />
      ))
    : groupBySidechain(visible).map((g, idx) =>
        g.kind === 'sidechain' ? (
          <SubagentGroup
            key={`sub-${idx}`}
            events={g.events}
            highlight={highlight}
            showTools={viewMode !== 'chat'}
          />
        ) : (
          <MessageBubble
            key={g.event.uuid}
            event={g.event}
            highlight={highlight}
            rawMode={false}
            showTools={viewMode !== 'chat'}
          />
        ),
      )}
</div>
```

- [ ] **Step 3: 擴充 `src/components/dialogue/DialogueTab.css`（subagent 樣式）**

append 到檔案末尾：

```css
/* SubagentGroup */
.dialogue-msg--subagent {
  border-left: 3px solid #8b5cf6; /* violet-500 */
  background: rgba(139, 92, 246, 0.05);
  padding: 6px 10px;
  border-radius: 0 6px 6px 0;
  margin-bottom: 12px;
}

.dialogue-msg__subagent-header {
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6d28d9; /* violet-700 */
  font-weight: 600;
}

.dialogue-msg__subagent-hint {
  font-weight: normal;
  color: var(--color-text-muted, #6b7280);
}

.dialogue-msg__subagent-body {
  margin-top: 8px;
  padding-left: 10px;
  border-left: 1px dashed rgba(139, 92, 246, 0.35);
}
```

- [ ] **Step 4: 建置驗證**

Run: `npm run build`
Expected: 通過

- [ ] **Step 5: 啟動驗證**

Run: `npm run tauri dev`

驗證：
1. 找一個包含 subagent 的 session（左欄卡片有 Bot 小徽章）
2. 展開後，subagent 那段應呈現為紫色左邊條 + 「Subagent (xxx) · N 則 · X 秒」摺疊 header
3. 點擊展開 → 內部事件以 MessageBubble 遞迴渲染
4. 切到 `完整原始` 模式 → subagent 事件應變為平鋪顯示（不再分組）
5. `Ctrl+C` 終止

- [ ] **Step 6: Commit**

```bash
git add src/components/dialogue/SubagentGroup.tsx \
        src/components/dialogue/SessionView.tsx \
        src/components/dialogue/DialogueTab.css
git commit -m "feat(dialogue): render subagent sidechains as collapsible groups"
```

---

## Task 11：刪除 session（串接 ConfirmDialog）

**Files:**
- Modify: `src/components/tabs/DialogueTab.tsx`（啟用 ConfirmDialog + 刪除流程）

- [ ] **Step 1: 修改 `src/components/tabs/DialogueTab.tsx`**

在 import 區加入：

```tsx
import ConfirmDialog from '../ui/ConfirmDialog';
```

在元件內解構新增 `deleteSession`：

```tsx
const { loadProjectIndex, searchInProject, deleteSession } = useDialogue();
```

於元件底部（return 前）加入刪除處理邏輯：

```tsx
const pendingMeta = useMemo(() => {
  if (!pendingDeleteId) return null;
  const sessions = indexByProject[projectDir ?? '']?.sessions ?? [];
  return sessions.find((s) => s.sessionId === pendingDeleteId) ?? null;
}, [pendingDeleteId, indexByProject, projectDir]);

const [deleting, setDeleting] = useState(false);
const [toast, setToast] = useState<string | null>(null);

const handleConfirmDelete = async () => {
  if (!pendingDeleteId) return;
  setDeleting(true);
  try {
    await deleteSession(pendingDeleteId);
    setToast('✓ 已刪除對話紀錄');
    setTimeout(() => setToast(null), 2000);
    setPendingDeleteId(null);
  } catch (err) {
    setToast(`✗ 刪除失敗：${err instanceof Error ? err.message : String(err)}`);
    setTimeout(() => setToast(null), 3500);
  } finally {
    setDeleting(false);
  }
};
```

並在檔案開頭 import 中補上 `useMemo` 與 `useState`（若尚未 import）：

```tsx
import React, { useEffect, useMemo, useState } from 'react';
```

將檔案底部原本隱藏的 `<div onClick={...} />` 替換為真正的 ConfirmDialog 與 toast：

```tsx
{pendingMeta && (
  <ConfirmDialog
    isOpen={!!pendingMeta && !deleting}
    title="刪除此對話紀錄？"
    message={
      `開始時間：${pendingMeta.startTime}\n` +
      `首則 prompt：${pendingMeta.firstPromptPreview || '（無）'}\n` +
      `檔案：${pendingMeta.filePath}`
    }
    warning="此操作不可復原。若此 session 正由 Claude Code 寫入中，刪除可能造成異常。"
    confirmLabel="刪除"
    cancelLabel="取消"
    onCancel={() => setPendingDeleteId(null)}
    onConfirm={() => {
      void handleConfirmDelete();
    }}
  />
)}
{toast && (
  <div className="dialogue-tab__toast">{toast}</div>
)}
```

- [ ] **Step 2: 補上 toast 樣式到 `src/components/dialogue/DialogueTab.css`**

append：

```css
.dialogue-tab__toast {
  position: absolute;
  bottom: 18px;
  right: 20px;
  padding: 8px 14px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-subtle, #e5e7eb);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  font-size: 12px;
  z-index: 900;
}
```

並確保 `.dialogue-tab` 有 `position: relative`（才能錨定 toast）— 打開檔案頂部：

```css
.dialogue-tab {
  position: relative;   /* 新增這行 */
  display: flex;
  ...
}
```

- [ ] **Step 3: 建置驗證**

Run: `npm run build`
Expected: 通過

- [ ] **Step 4: 啟動驗證（**慎選測試對象**：建議先在測試專案或隨手產的 session 試，避免刪掉重要紀錄）**

Run: `npm run tauri dev`

驗證：
1. 找一個可拋棄的 session → 點左欄卡片右側垃圾桶（或右欄 header 的刪除按鈕）
2. 應彈出 ConfirmDialog：顯示時間、首 prompt、檔案路徑、紅底警告
3. 預設聚焦「取消」按鈕；按 ESC 或點遮罩 → 關閉
4. 點「刪除」→ 檔案應真的消失（可到 `~/.claude/projects/<encoded>/` 驗證）
5. 右下角出現 toast「✓ 已刪除對話紀錄」
6. 左欄清單即時更新，被刪的 session 消失
7. 若被選取的 session 被刪 → 右欄回到「請選一個對話」
8. 嘗試刪一個**正被 Claude Code 寫入的 session**（如果剛好有）→ 應跳 toast 錯誤、UI 不中斷
9. `Ctrl+C` 終止

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/DialogueTab.tsx \
        src/components/dialogue/DialogueTab.css
git commit -m "feat(dialogue): wire ConfirmDialog for session deletion with toast feedback"
```

---

## Task 12：手動驗證總清單 + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`（若存在；否則新建）

- [ ] **Step 1: 完整手動驗證（對照 spec 測試策略）**

Run: `npm run tauri dev`

逐條驗證（在 dev server 中完成）：

1. [ ] 空專案（目錄下從未用過 `claude`）— 顯示「此專案尚無對話紀錄」
2. [ ] 有對話的專案 — session 列表正確分組（今天 / 昨天 / 本週 / 更早）、依 lastTime 降冪
3. [ ] 點卡片展開 — 完整對話出現
4. [ ] 切「純對話 / 對話+工具 / 完整原始」— 內容正確過濾
5. [ ] 搜尋「某字串」— 命中 session 保留、其他隱藏；訊息內 `<mark>` 高亮
6. [ ] 含 compaction 的 session — 虛線框 + 可摺疊
7. [ ] 含 subagent 的 session — 紫色群組摺疊、可展開、`完整原始` 模式下平鋪
8. [ ] 刪除 session — 二次確認後檔案消失、UI 同步
9. [ ] 切換專案 — 對話 Tab 內容立即替換、其他 Tab 正常
10. [ ] Sidebar 專案切換時 → dialogueStore 的 selection 與 search 都被清空
11. [ ] Thinking 可摺疊（預設收合）
12. [ ] tool_use / tool_result 只在 `chat+tools` 與 `raw` 模式可見
13. [ ] 大檔 raw JSON 被截斷 + 「顯示完整」按鈕可展開
14. [ ] 搜尋結果 >500 時頂部提示「僅顯示前 500 筆」
15. [ ] 切換 session 不觸發重讀（切回去 session 仍在 eventsBySession cache）

每項驗證通過打 `x`。若任何項目失敗 → 回到對應 task 修正、重 build。

- [ ] **Step 2: 更新 CHANGELOG.md**

若檔案已存在，在最上方新增一段：

```markdown
## [Unreleased]

### 新增
- 對話 Tab：檢視當前專案（由 Sidebar 選取）的 Claude Code session 歷史
  - 依日期分組（今天 / 昨天 / 本週 / 更早）、顯示首 prompt 摘要
  - 三種顆粒度切換：純對話 / 對話+工具 / 完整原始
  - 跨 session 關鍵字搜尋（debounce 200ms、命中 `<mark>` 高亮、上限 500 筆）
  - Context compaction 摘要以虛線框特殊呈現（可摺疊）
  - Subagent (sidechain) 對話以紫色摺疊群組呈現
  - 刪除 session（含二次確認視窗、path traversal 防護）

### 變更
- `resolvePath` 抽出為 `src/utils/pathResolver.ts`，供 dialogue 模組與 useFileManager 共用
```

若檔案不存在：

```bash
# 僅示意；Step 2 的寫法改用 Write tool
```

新建 `CHANGELOG.md` 內容：

```markdown
# Changelog

本專案重大變更紀錄。

## [Unreleased]

### 新增
- 對話 Tab：檢視當前專案（由 Sidebar 選取）的 Claude Code session 歷史
  - 依日期分組（今天 / 昨天 / 本週 / 更早）、顯示首 prompt 摘要
  - 三種顆粒度切換：純對話 / 對話+工具 / 完整原始
  - 跨 session 關鍵字搜尋（debounce 200ms、命中 `<mark>` 高亮、上限 500 筆）
  - Context compaction 摘要以虛線框特殊呈現（可摺疊）
  - Subagent (sidechain) 對話以紫色摺疊群組呈現
  - 刪除 session（含二次確認視窗、path traversal 防護）

### 變更
- `resolvePath` 抽出為 `src/utils/pathResolver.ts`，供 dialogue 模組與 useFileManager 共用
```

> **注意**：先前分支即存在的 `CHANGELOG.md` 可能有其他變更。修改時請**只新增** `[Unreleased]` 段落，不動現有內容。

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add session history viewer entry"
```

- [ ] **Step 4: 最終檢查**

```bash
npm run build
git log --oneline main..HEAD
git status
```

Expected:
- `npm run build` 通過
- `git log` 顯示 10+ commits（各 task 各自一 commit，加上最初的 design doc）
- `git status` 乾淨（working tree clean）

- [ ] **Step 5: （可選）推送分支**

```bash
git push -u origin feat/session-history-viewer
```

並在 GitHub 建立 Draft PR，邀請 code review。

---

## 風險與已知限制

- **搜尋效能**：500 session × 1MB = 500MB 文字全掃需數秒；若真遇到，之後可升級為 spec 中提到的「方案 C：本地 index cache」
- **被鎖檔案**：Windows 上正在被 Claude Code 寫入的 session 可能讀取失敗 → 已靜默跳過、UI 不中斷
- **前向相容性**：若 Claude Code 未來新增 jsonl 欄位，`raw` 模式仍可完整顯示；`chat`/`chat+tools` 模式若出現未知 `ContentBlock.type` 會被忽略（合理預設）
- **匯出功能**：本期未做，需要時再加（預期為一個 `exportToMarkdown(events, mode)` util + 下載連結）

## 範圍外（YAGNI）

- 匯出為 Markdown
- 跨專案全域搜尋
- 虛擬捲動（單 session >500 則訊息時再做）
- 本地 index cache（當下規模用不到）
- session rename / tag
- Markdown 渲染訊息內容（本期只純文字顯示）
