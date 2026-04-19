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
      if (b.type === 'tool_use') {
        const block = b as unknown as { name?: string; input?: { subagent_type?: string } };
        if (block.name === 'Task' && typeof block.input?.subagent_type === 'string') {
          return block.input.subagent_type;
        }
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
