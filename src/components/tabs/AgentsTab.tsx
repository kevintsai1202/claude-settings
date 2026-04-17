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
import { AGENT_TEMPLATES, type AgentTemplate } from './agentTemplates';
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

/** 編輯器模式：idle / create / edit；create 支援同時寫入 user+project */
type AgentScope = 'user' | 'project';
type EditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scopes: AgentScope[] }
  | { kind: 'edit'; agentId: string };

type ScopeFilter = 'all' | AgentScope;

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
  /** 最近套用的範本鍵值 `${templateId}:${scope}`，用於顯示 2 秒確認動畫 */
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  /** 範本來源過濾：all / official / community */
  const [templateFilter, setTemplateFilter] = useState<'all' | 'official' | 'community'>('all');

  // 首次掛載時載入 agents
  useEffect(() => {
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  // selectedId 失效時自動清空,避免右側殘留已不存在的資源
  useEffect(() => {
    if (selectedId && !agents.find((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }, [agents, selectedId]);

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
  const resolveAgentDir = (agentScope: AgentScope): string => {
    if (agentScope === 'project') {
      if (!projectDir) throw new Error('尚未選擇專案目錄');
      return `${projectDir}/.claude/agents`;
    }
    return '%USERPROFILE%/.claude/agents';
  };

  /** 切換 create 模式下某個 scope 的勾選狀態（至少保留一個） */
  const toggleCreateScope = (target: AgentScope) => {
    if (mode.kind !== 'create') return;
    const has = mode.scopes.includes(target);
    const next = has
      ? mode.scopes.filter((s) => s !== target)
      : [...mode.scopes, target];
    if (next.length === 0) return; // 禁止全部取消
    setMode({ kind: 'create', scopes: next });
  };

  /**
   * 儲存 Agent（新建或更新）
   * create 模式下可同時寫入多個 scope（user/project），其一失敗時回報失敗清單
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
      if (mode.scopes.length === 0) {
        throw new Error('請至少勾選一個範圍（User / Project）');
      }
      // 逐一寫入各勾選的 scope，收集錯誤後一起回報
      const failures: string[] = [];
      for (const s of mode.scopes) {
        try {
          const dir = resolveAgentDir(s);
          await createResourceFile(`${dir}/${name}.md`, content);
        } catch (err) {
          failures.push(`${s}: ${String(err).replace(/^Error:\s*/, '')}`);
        }
      }
      if (failures.length > 0 && failures.length === mode.scopes.length) {
        throw new Error(`全部範圍皆建立失敗：\n${failures.join('\n')}`);
      }
      if (failures.length > 0) {
        window.alert(`部分範圍建立失敗：\n${failures.join('\n')}`);
      }
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
   * 嘗試建立檔案；若檔名已存在，依序嘗試 name-1.md / name-2.md ... 最多 100 次
   * @returns 最終寫入的 basename（不含副檔名），供後續提示用
   */
  const createWithSuffix = async (
    dir: string,
    baseName: string,
    content: string,
  ): Promise<string> => {
    for (let i = 0; i < 100; i++) {
      const finalName = i === 0 ? baseName : `${baseName}-${i}`;
      try {
        await createResourceFile(`${dir}/${finalName}.md`, content);
        return finalName;
      } catch (err) {
        if (!String(err).includes('檔案已存在')) throw err;
      }
    }
    throw new Error(`無法建立 Agent：已存在太多同名檔（${baseName}-1 到 ${baseName}-99）`);
  };

  /**
   * 套用範本：把 AgentTemplate 轉成 .md 檔寫入指定 scope 目錄
   * @param tpl 要套用的範本
   * @param target 寫入範圍：user 或 project
   */
  const applyTemplate = async (tpl: AgentTemplate, target: AgentScope) => {
    if (target === 'project' && !projectDir) {
      window.alert('尚未開啟專案目錄，請先於左下「開啟專案」。');
      return;
    }
    const content = stringifyFrontmatter(
      {
        name: tpl.name,
        description: tpl.description,
        ...(tpl.tools && tpl.tools.length > 0 ? { tools: tpl.tools } : {}),
        ...(tpl.model ? { model: tpl.model } : {}),
      },
      tpl.body,
    );
    try {
      const dir = resolveAgentDir(target);
      const finalName = await createWithSuffix(dir, tpl.name, content);
      await loadAgents();
      const key = `${tpl.id}:${target}`;
      setAppliedKey(key);
      setTimeout(() => setAppliedKey((k) => (k === key ? null : k)), 2000);
      if (finalName !== tpl.name) {
        window.alert(`偵測到同名 agent，已改以「${finalName}.md」建立於 ${target}。`);
      }
    } catch (err) {
      window.alert(`套用到 ${target} 失敗：${String(err).replace(/^Error:\s*/, '')}`);
    }
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
          onClick={() =>
            setMode({
              kind: 'create',
              scopes:
                scope === 'project'
                  ? (projectDir ? ['project'] : ['user'])
                  : scope === 'user'
                    ? ['user']
                    : ['user'],
            })
          }
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

      {/* ── Agent 範本卡片庫（沿用 hook-templates CSS） ── */}
      <div className="hook-templates">
        <div
          className="hook-templates__header"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p className="section-title" style={{ margin: 0 }}>💡 範本庫</p>
            <span className="form-hint" style={{ marginTop: 0 }}>
              每張卡片可獨立套用到 User（~/.claude/agents/）或 Project（&lt;project&gt;/.claude/agents/）；同名時自動加後綴
            </span>
          </div>
          <div className="resource-toolbar__filter">
            {(['all', 'official', 'community'] as const).map((s) => {
              const count =
                s === 'all' ? AGENT_TEMPLATES.length : AGENT_TEMPLATES.filter((t) => t.source === s).length;
              return (
                <button
                  key={s}
                  className={`resource-chip${templateFilter === s ? ' resource-chip--active' : ''}`}
                  onClick={() => setTemplateFilter(s)}
                >
                  {s === 'all' ? `全部 (${count})` : s === 'official' ? `🏢 官方 (${count})` : `🌐 社群 (${count})`}
                </button>
              );
            })}
          </div>
        </div>
        <div className="hook-templates__grid">
          {AGENT_TEMPLATES.filter((t) => templateFilter === 'all' || t.source === templateFilter).map((tpl) => {
            const userKey = `${tpl.id}:user`;
            const projectKey = `${tpl.id}:project`;
            const projectDisabled = !projectDir;
            return (
              <div key={tpl.id} className="hook-template-card">
                <div className="hook-template-card__header">
                  <span className="hook-template-card__emoji">{tpl.emoji}</span>
                  <span className="hook-template-card__name">{tpl.name}</span>
                </div>

                {/* 分類 / 來源 / model / tools 標籤 */}
                <div className="hook-template-card__tags">
                  <span className="hook-tag hook-tag--event">{tpl.category}</span>
                  <span className={`hook-tag hook-tag--source-${tpl.source}`}>
                    {tpl.source === 'official' ? '🏢 官方' : '🌐 社群'}
                  </span>
                  {tpl.model && <span className="hook-tag hook-tag--matcher">{tpl.model}</span>}
                  {tpl.tools && tpl.tools.length > 0 && (
                    <span
                      className="hook-tag hook-tag--platform-cross"
                      title={`限定工具：${tpl.tools.join(', ')}`}
                    >
                      🔧 {tpl.tools.length} tools
                    </span>
                  )}
                </div>

                <p className="hook-template-card__desc">{tpl.desc}</p>

                {/* 預覽效果 */}
                <div className="hook-template-card__preview">
                  <span className="hook-preview-label">效果</span>
                  <span className="hook-preview-text">{tpl.preview}</span>
                </div>

                {/* 並排兩個按鈕：User 永遠可用，Project 需已開啟專案 */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className={`btn-primary hook-template-card__apply${
                      appliedKey === userKey ? ' hook-template-card__apply--applied' : ''
                    }`}
                    style={{ flex: 1 }}
                    onClick={() => applyTemplate(tpl, 'user')}
                  >
                    {appliedKey === userKey ? '✓ User' : '＋ User'}
                  </button>
                  <button
                    className={`btn-primary hook-template-card__apply${
                      appliedKey === projectKey ? ' hook-template-card__apply--applied' : ''
                    }`}
                    style={{ flex: 1 }}
                    onClick={() => applyTemplate(tpl, 'project')}
                    disabled={projectDisabled}
                    title={projectDisabled ? '尚未開啟專案目錄' : undefined}
                  >
                    {appliedKey === projectKey ? '✓ Project' : '＋ Project'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="divider" style={{ margin: '20px 0' }} />

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
            {/* Scope 複選：user / project 可同時建立；project 需已開啟專案 */}
            <div
              className="form-row"
              style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <label className="form-label" style={{ margin: 0 }}>
                建立範圍
              </label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label
                  className="radio-label"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <input
                    type="checkbox"
                    checked={mode.scopes.includes('user')}
                    onChange={() => toggleCreateScope('user')}
                  />
                  User
                  <span className="form-hint" style={{ marginTop: 0 }}>
                    ~/.claude/agents/
                  </span>
                </label>
                <label
                  className="radio-label"
                  style={{
                    cursor: projectDir ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: projectDir ? 1 : 0.5,
                  }}
                  title={projectDir ? undefined : '尚未開啟專案目錄'}
                >
                  <input
                    type="checkbox"
                    disabled={!projectDir}
                    checked={mode.scopes.includes('project')}
                    onChange={() => toggleCreateScope('project')}
                  />
                  Project
                  <span className="form-hint" style={{ marginTop: 0 }}>
                    &lt;project&gt;/.claude/agents/
                  </span>
                </label>
              </div>
            </div>
            <ResourceEditor
              title={`新建 Agent（${mode.scopes.length === 2 ? 'User + Project' : mode.scopes[0] === 'user' ? 'User' : 'Project'} 範圍）`}
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
