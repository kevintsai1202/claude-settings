/**
 * AgentsTab — Subagents（子代理）顯示與管理
 * 讀取 ~/.claude/agents/ 與 <project>/.claude/agents/ 中的 .md 檔
 * 以左側列表、右側詳情/編輯器的配置呈現
 * 支援新建、編輯、刪除 Agent
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCw, FolderOpen, Plus, Trash2, Pencil } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import { useFileManager } from '../../hooks/useFileManager';
import { stringifyFrontmatter } from '../../utils/frontmatter';
import ResourceEditor, { type FieldDef } from './editors/ResourceEditor';
import type { AgentFile } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

/** Agent 欄位定義，供 ResourceEditor 使用 */
const AGENT_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: '名稱(name)',
    kind: 'text',
    required: true,
    placeholder: '例如:code-reviewer',
    helpText: '此值會同時作為檔名(小寫連字號)使用',
  },
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
    placeholder: '何時應啟用此 Agent 的說明',
  },
  {
    key: 'tools',
    label: '工具(tools)',
    kind: 'tags',
    placeholder: '例如:Read, Edit, Bash, Grep',
    helpText: '留空代表繼承所有工具',
  },
  {
    key: 'model',
    label: '模型(model)',
    kind: 'select',
    options: ['opus', 'sonnet', 'haiku', 'inherit'],
    helpText: '留空代表繼承主 session 模型',
  },
];

/** 編輯器模式：idle / create / edit */
type EditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; agentId: string };

type ScopeFilter = 'all' | 'user' | 'project';

const AgentsTab: React.FC = () => {
  const { agents, projectDir } = useAppStore();
  const { loadAgents } = useResourceLoader();
  const { createResourceFile, updateResourceFile, deleteResourceFile } = useFileManager();

  /** 搜尋關鍵字 */
  const [search, setSearch] = useState('');
  /** 來源範圍過濾 */
  const [scope, setScope] = useState<ScopeFilter>('all');
  /** 目前選取的 agent id */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 編輯器模式 */
  const [mode, setMode] = useState<EditorMode>({ kind: 'idle' });

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

  /** 解析 agents 目錄路徑(user 範圍使用 %USERPROFILE% placeholder) */
  const resolveAgentDir = (agentScope: 'user' | 'project'): string => {
    if (agentScope === 'project') {
      if (!projectDir) throw new Error('尚未選擇專案目錄');
      return `${projectDir}/.claude/agents`;
    }
    return '%USERPROFILE%/.claude/agents';
  };

  /**
   * 儲存 Agent（新建或更新）
   * @param data 表單欄位資料
   * @param body Markdown 內文
   */
  const handleSaveAgent = async (
    data: Record<string, string | string[]>,
    body: string,
  ) => {
    if (mode.kind === 'idle') return;
    const name = (data.name as string).trim();
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error('name 僅允許小寫英文、數字與連字號(-)');
    }
    const content = stringifyFrontmatter(data, body);
    if (mode.kind === 'create') {
      const dir = resolveAgentDir(mode.scope);
      await createResourceFile(`${dir}/${name}.md`, content);
    } else {
      const target = agents.find((a) => a.id === mode.agentId);
      if (!target) throw new Error('找不到目標 Agent');
      const dir = target.path.replace(/\/[^/]+$/, '');
      const newPath = `${dir}/${name}.md`;
      if (newPath !== target.path) {
        await createResourceFile(newPath, content);
        await deleteResourceFile(target.path);
      } else {
        await updateResourceFile(target.path, content);
      }
    }
    await loadAgents();
    setMode({ kind: 'idle' });
  };

  /**
   * 刪除指定 Agent
   * @param agentId 要刪除的 agent id
   */
  const handleDeleteAgent = async (agentId: string) => {
    const target = agents.find((a) => a.id === agentId);
    if (!target) return;
    const ok = window.confirm(
      `確定要刪除 Agent「${target.name}」嗎?\n路徑:${target.path}\n此操作不可復原。`,
    );
    if (!ok) return;
    await deleteResourceFile(target.path);
    await loadAgents();
    if (selectedId === agentId) setSelectedId(null);
  };

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
        <button
          className="btn-primary"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={() => setMode({ kind: 'create', scope: scope === 'project' ? 'project' : 'user' })}
          title="新建 Agent"
        >
          <Plus size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          新建
        </button>
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
                onClick={() => { setSelectedId(a.id); setMode({ kind: 'idle' }); }}
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

        {/* 右側：詳情 / 編輯器 */}
        {mode.kind === 'idle' && selected && (
          <div className="resource-detail">
            <div className="resource-detail__toolbar">
              <button
                className="btn-secondary"
                onClick={() => setMode({ kind: 'edit', agentId: selected.id })}
              >
                <Pencil size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                編輯
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDeleteAgent(selected.id)}
              >
                <Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                刪除
              </button>
            </div>
            <div className="resource-detail__header">
              <span className="resource-detail__title">{selected.name}</span>
              <span className={`resource-scope-tag resource-scope-tag--${selected.scope}`}>{selected.scope}</span>
            </div>

            <div className="resource-detail__meta">
              <span className="resource-detail__meta-key">Description</span>
              <span className="resource-detail__meta-val">{selected.description ?? '—'}</span>

              <span className="resource-detail__meta-key">Model</span>
              <span className="resource-detail__meta-val mono">{selected.model ?? '(繼承)'}</span>

              <span className="resource-detail__meta-key">Tools</span>
              <span className="resource-detail__meta-val mono">
                {selected.tools && selected.tools.length > 0 ? selected.tools.join(', ') : '(全部)'}
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
            <pre className="resource-detail__body">{selected.body.trim() || '(空白)'}</pre>
          </div>
        )}

        {mode.kind === 'idle' && !selected && (
          <div className="resource-detail resource-empty">
            選擇左側 agent 以查看詳情
          </div>
        )}

        {mode.kind === 'create' && (
          <div className="resource-detail">
            <ResourceEditor
              title={`新建 Agent(${mode.scope === 'user' ? 'User' : 'Project'} 範圍)`}
              fields={AGENT_FIELDS}
              initialData={{ name: '', description: '', tools: [], model: '' }}
              initialBody=""
              onSave={handleSaveAgent}
              onCancel={() => setMode({ kind: 'idle' })}
            />
          </div>
        )}

        {mode.kind === 'edit' && (() => {
          const target = agents.find((a) => a.id === mode.agentId);
          if (!target) return null;
          return (
            <div className="resource-detail">
              <ResourceEditor
                title={`編輯 Agent:${target.name}`}
                fields={AGENT_FIELDS}
                initialData={{
                  name: target.name,
                  description: target.description ?? '',
                  tools: target.tools ?? [],
                  model: target.model ?? '',
                }}
                initialBody={target.body}
                onSave={handleSaveAgent}
                onCancel={() => setMode({ kind: 'idle' })}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default AgentsTab;
