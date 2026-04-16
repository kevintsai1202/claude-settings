/**
 * Hooks Tab — Hook 事件設定
 * 五種事件類型的折疊面板，支援 command / http 兩種 Hook 類型
 */
import React, { useState } from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import type { HookEvent, HookEntry, HooksConfig } from '../../types/settings';
import './TabContent.css';

const HOOK_EVENTS: { event: HookEvent; label: string; desc: string }[] = [
  { event: 'PreToolUse',   label: 'PreToolUse',   desc: '工具執行前觸發' },
  { event: 'PostToolUse',  label: 'PostToolUse',  desc: '工具執行後觸發' },
  { event: 'Notification', label: 'Notification', desc: '通知事件' },
  { event: 'Stop',         label: 'Stop',         desc: '回應結束時觸發' },
  { event: 'SubagentStop', label: 'SubagentStop', desc: '子代理結束時觸發' },
];

/** 建立新的空白 HookEntry */
const newEntry = (): HookEntry => ({
  id: crypto.randomUUID(),
  matcher: '',
  type: 'command',
  command: '',
  timeout: 60000,
});

const HookPanel: React.FC<{
  event: HookEvent;
  label: string;
  desc: string;
  hooks: HooksConfig;
  onChange: (hooks: HooksConfig) => void;
}> = ({ event, label, desc, hooks, onChange }) => {
  const [open, setOpen] = useState(false);
  const entries = hooks[event] ?? [];

  const updateEntries = (updated: HookEntry[]) =>
    onChange({ ...hooks, [event]: updated });

  const addEntry = () => updateEntries([...entries, newEntry()]);

  const removeEntry = (id: string) =>
    updateEntries(entries.filter((e) => e.id !== id));

  const updateEntry = (id: string, patch: Partial<HookEntry>) =>
    updateEntries(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return (
    <div className="hook-panel">
      <div className="hook-panel__header" onClick={() => setOpen((o) => !o)}>
        <div>
          <span className="hook-panel__title">{label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{desc}</span>
          {entries.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-cyan)' }}>
              ({entries.length})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-primary"
            style={{ padding: '3px 10px', fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); addEntry(); setOpen(true); }}
          >
            + 新增
          </button>
          <span className={`hook-panel__arrow${open ? ' hook-panel__arrow--open' : ''}`}>▶</span>
        </div>
      </div>

      {open && (
        <div className="hook-panel__body">
          {entries.length === 0
            ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>尚無 Hook，點擊「+ 新增」加入</span>
            : entries.map((entry) => (
              <div key={entry.id} className="hook-entry">
                <div className="hook-entry__row">
                  <span className="hook-entry__label">Matcher</span>
                  <input
                    type="text"
                    placeholder="例如：Bash（留空表示全部）"
                    value={entry.matcher ?? ''}
                    onChange={(e) => updateEntry(entry.id, { matcher: e.target.value })}
                  />
                </div>
                <div className="hook-entry__row">
                  <span className="hook-entry__label">Type</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" checked={entry.type === 'command'} onChange={() => updateEntry(entry.id, { type: 'command' })} />
                    command
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" checked={entry.type === 'http'} onChange={() => updateEntry(entry.id, { type: 'http' })} />
                    http
                  </label>
                </div>
                {entry.type === 'command' ? (
                  <div className="hook-entry__row">
                    <span className="hook-entry__label">Command</span>
                    <input
                      type="text"
                      placeholder="例如：~/.claude/hooks/pre-bash.sh"
                      value={entry.command ?? ''}
                      onChange={(e) => updateEntry(entry.id, { command: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="hook-entry__row">
                    <span className="hook-entry__label">URL</span>
                    <input
                      type="text"
                      placeholder="http://localhost:3000/hook"
                      value={entry.url ?? ''}
                      onChange={(e) => updateEntry(entry.id, { url: e.target.value })}
                    />
                  </div>
                )}
                <div className="hook-entry__row">
                  <span className="hook-entry__label">Timeout</span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={entry.timeout ?? 60000}
                    onChange={(e) => updateEntry(entry.id, { timeout: Number(e.target.value) })}
                    style={{ width: 100 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ms</span>
                  <button className="btn-danger" onClick={() => removeEntry(entry.id)} style={{ marginLeft: 'auto' }}>
                    刪除 ✕
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

const Hooks: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  const userSettings = files.user.data ?? {};
  const hooks: HooksConfig = userSettings.hooks ?? {};

  const saveHooks = async (updated: HooksConfig) => {
    await saveFile('user', files.user.path, { ...userSettings, hooks: updated });
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🪝 Hooks</h2>
      <p className="tab-desc">設定各事件的 Hook 命令（User 層）</p>

      {HOOK_EVENTS.map(({ event, label, desc }) => (
        <HookPanel
          key={event}
          event={event}
          label={label}
          desc={desc}
          hooks={hooks}
          onChange={saveHooks}
        />
      ))}
    </div>
  );
};

export default Hooks;
