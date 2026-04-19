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

/** 首則 prompt 預覽最大長度（超過會在尾端加上 …） */
const PROMPT_PREVIEW_MAX = 60;

/** 將字串 trim 後截斷為 PROMPT_PREVIEW_MAX 長度，超過則尾端附 … */
const truncateForPreview = (s: string): string => {
  const trimmed = s.trim();
  return trimmed.length > PROMPT_PREVIEW_MAX
    ? trimmed.slice(0, PROMPT_PREVIEW_MAX - 1) + '…'
    : trimmed;
};

/** Session 摘要結果（供 SessionList 使用） */
export interface SessionSummary {
  meta: Omit<SessionMeta, 'filePath' | 'fileSize' | 'sessionId'>;
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
      return truncateForPreview(content);
    }
    // 陣列 content：取第一個 text block 且不是 tool_result
    if (Array.isArray(content)) {
      const textBlock = content.find(
        (b): b is ContentBlock & { type: 'text'; text: string } =>
          (b as ContentBlock).type === 'text' &&
          typeof (b as { text?: unknown }).text === 'string',
      );
      if (textBlock) return truncateForPreview(textBlock.text);
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
