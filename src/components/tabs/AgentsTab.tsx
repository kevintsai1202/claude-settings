/**
 * AgentsTab — Subagents（子代理）顯示
 * 讀取 ~/.claude/agents/ 與 <project>/.claude/agents/ 中的 .md 檔
 * 以左側列表、右側詳情的配置呈現
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCw, FolderOpen } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import type { AgentFile } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

type ScopeFilter = 'all' | 'user' | 'project';

const AgentsTab: React.FC = () => {
  const { agents, projectDir } = useAppStore();
  const { loadAgents } = useResourceLoader();

  /** 搜尋關鍵字 */
  const [search, setSearch] = useState('');
  /** 來源範圍過濾 */
  const [scope, setScope] = useState<ScopeFilter>('all');
  /** 目前選取的 agent id */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 首次掛載時載入 agents
  useEffect(() => {
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  /** 套用過濾與排序後的 agents */
  const filtered = useMemo(() => {
    return agents
      .filter((a) => (scope === 'all' ? true : a.scope === scope))
      .filter((a) =>
        search
          ? (a.name + (a.description ?? '')).toLowerCase().includes(search.toLowerCase())
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agents, scope, search]);

  /** 目前選取的 agent */
  const selected: AgentFile | undefined = useMemo(
    () => filtered.find((a) => a.id === selectedId) ?? filtered[0],
    [filtered, selectedId]
  );

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🤖 Subagents</h2>
      <p className="tab-desc">
        子代理定義於 <span className="mono">~/.claude/agents/</span> 與{' '}
        <span className="mono">&lt;project&gt;/.claude/agents/</span>，以獨立的 context 處理特定任務。
      </p>

      {/* 工具列 */}
      <div className="resource-toolbar">
        <input
          type="text"
          className="resource-toolbar__search"
          placeholder="🔍 搜尋 agent 名稱或描述"
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
        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => loadAgents()}>
          <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          重新載入
        </button>
      </div>

      <div className="resource-layout">
        {/* 左側：Agent 清單 */}
        {filtered.length === 0 ? (
          <div className="resource-empty">
            <Bot size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>尚未偵測到任何 agent 檔</div>
            <div style={{ fontSize: 11, marginTop: 6 }}>
              請新增 <code>~/.claude/agents/xxx.md</code>
            </div>
          </div>
        ) : (
          <ul className="resource-list">
            {filtered.map((a) => (
              <li
                key={a.id}
                className={`resource-list__item${selected?.id === a.id ? ' resource-list__item--selected' : ''}`}
                onClick={() => setSelectedId(a.id)}
              >
                <div className="resource-list__name">
                  <Bot size={12} />
                  <span>{a.name}</span>
                  <span className={`resource-scope-tag resource-scope-tag--${a.scope}`}>{a.scope}</span>
                </div>
                {a.description && <div className="resource-list__desc">{a.description}</div>}
              </li>
            ))}
          </ul>
        )}

        {/* 右側：詳情 */}
        {selected ? (
          <div className="resource-detail">
            <div className="resource-detail__header">
              <span className="resource-detail__title">{selected.name}</span>
              <span className={`resource-scope-tag resource-scope-tag--${selected.scope}`}>{selected.scope}</span>
            </div>

            <div className="resource-detail__meta">
              <span className="resource-detail__meta-key">Description</span>
              <span className="resource-detail__meta-val">{selected.description ?? '—'}</span>

              <span className="resource-detail__meta-key">Model</span>
              <span className="resource-detail__meta-val mono">{selected.model ?? '（繼承）'}</span>

              <span className="resource-detail__meta-key">Tools</span>
              <span className="resource-detail__meta-val mono">
                {selected.tools && selected.tools.length > 0 ? selected.tools.join(', ') : '（全部）'}
              </span>

              <span className="resource-detail__meta-key">
                <FolderOpen size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Path
              </span>
              <span className="resource-detail__meta-val mono">{selected.path}</span>
            </div>

            <div className="section-title" style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}>
              System Prompt
            </div>
            <pre className="resource-detail__body">{selected.body.trim() || '（空白）'}</pre>
          </div>
        ) : (
          <div className="resource-detail resource-empty">
            選擇左側 agent 以查看詳情
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentsTab;
