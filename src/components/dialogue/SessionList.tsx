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
                    <div
                      key={s.sessionId}
                      role="button"
                      tabIndex={0}
                      className={`session-list__card${active ? ' session-list__card--active' : ''}`}
                      onClick={() => onSelect(s.sessionId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(s.sessionId);
                        }
                      }}
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
                          <button
                            type="button"
                            className="session-list__card-del"
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
                            aria-label="刪除此對話"
                          >
                            <Trash2 size={12} />
                          </button>
                      </div>
                      <div className="session-list__card-preview">
                        {s.firstPromptPreview || <em>（無使用者訊息）</em>}
                      </div>
                    </div>
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
