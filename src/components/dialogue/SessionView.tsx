/**
 * SessionView — 右欄：session header + 訊息流
 * subagent 的群組化處理暫在 Task 10 補上；本 task 先平鋪渲染
 */
import React, { useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useDialogueStore } from '../../store/dialogueStore';
import { useDialogue } from '../../hooks/useDialogue';
import MessageBubble from './MessageBubble';
import { groupBySidechain } from '../../utils/jsonlParser';
import SubagentGroup from './SubagentGroup';
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
    </>
  );
};

export default SessionView;
