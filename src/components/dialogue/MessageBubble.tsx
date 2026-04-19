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
