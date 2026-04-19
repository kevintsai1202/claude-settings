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
