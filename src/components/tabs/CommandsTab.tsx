/**
 * CommandsTab — Slash Commands 顯示
 * 讀取 ~/.claude/commands/ 與 <project>/.claude/commands/ 中的 .md 檔
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Terminal, RefreshCw, FolderOpen } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import type { CommandFile } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

type ScopeFilter = 'all' | 'user' | 'project';

const CommandsTab: React.FC = () => {
  const { commands, projectDir } = useAppStore();
  const { loadCommands } = useResourceLoader();

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadCommands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  const filtered = useMemo(() => {
    return commands
      .filter((c) => (scope === 'all' ? true : c.scope === scope))
      .filter((c) =>
        search
          ? (c.name + (c.description ?? '')).toLowerCase().includes(search.toLowerCase())
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [commands, scope, search]);

  const selected: CommandFile | undefined = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? filtered[0],
    [filtered, selectedId]
  );

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">⚡ Slash Commands</h2>
      <p className="tab-desc">
        自訂 Slash Commands 位於 <span className="mono">~/.claude/commands/</span> 與{' '}
        <span className="mono">&lt;project&gt;/.claude/commands/</span>，透過{' '}
        <code>/&lt;name&gt;</code> 呼叫。
      </p>

      <div className="resource-toolbar">
        <input
          type="text"
          className="resource-toolbar__search"
          placeholder="🔍 搜尋 command 名稱"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="resource-toolbar__filter">
          {(['all', 'user', 'project'] as ScopeFilter[]).map((s) => (
            <button
              key={s}
              className={`resource-chip${scope === s ? ' resource-chip--active' : ''}`}
              onClick={() => setScope(s)}
            >
              {s === 'all' ? '全部' : s === 'user' ? 'User' : 'Project'}
            </button>
          ))}
        </div>
        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => loadCommands()}>
          <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          重新載入
        </button>
      </div>

      <div className="resource-layout">
        {filtered.length === 0 ? (
          <div className="resource-empty">
            <Terminal size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>尚未偵測到任何自訂 command</div>
          </div>
        ) : (
          <ul className="resource-list">
            {filtered.map((c) => (
              <li
                key={c.id}
                className={`resource-list__item${selected?.id === c.id ? ' resource-list__item--selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="resource-list__name">
                  <Terminal size={12} />
                  <span className="mono">/{c.name}</span>
                  <span className={`resource-scope-tag resource-scope-tag--${c.scope}`}>{c.scope}</span>
                </div>
                {c.description && <div className="resource-list__desc">{c.description}</div>}
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="resource-detail">
            <div className="resource-detail__header">
              <span className="resource-detail__title mono">/{selected.name}</span>
              <span className={`resource-scope-tag resource-scope-tag--${selected.scope}`}>{selected.scope}</span>
            </div>

            <div className="resource-detail__meta">
              <span className="resource-detail__meta-key">Description</span>
              <span className="resource-detail__meta-val">{selected.description ?? '—'}</span>

              <span className="resource-detail__meta-key">Argument Hint</span>
              <span className="resource-detail__meta-val mono">{selected.argumentHint ?? '（無）'}</span>

              <span className="resource-detail__meta-key">Allowed Tools</span>
              <span className="resource-detail__meta-val mono">
                {selected.allowedTools && selected.allowedTools.length > 0
                  ? selected.allowedTools.join(', ')
                  : '（全部）'}
              </span>

              <span className="resource-detail__meta-key">Model</span>
              <span className="resource-detail__meta-val mono">{selected.model ?? '（繼承）'}</span>

              <span className="resource-detail__meta-key">
                <FolderOpen size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Path
              </span>
              <span className="resource-detail__meta-val mono">{selected.path}</span>
            </div>

            <div className="section-title" style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}>
              Command Prompt
            </div>
            <pre className="resource-detail__body">{selected.body.trim() || '（空白）'}</pre>
          </div>
        ) : (
          <div className="resource-detail resource-empty">
            選擇左側 command 以查看詳情
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandsTab;
