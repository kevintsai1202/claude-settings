/**
 * CommandsTab — Slash Commands 顯示與管理
 * 讀取 ~/.claude/commands/ 與 <project>/.claude/commands/ 中的 .md 檔
 * 以左側列表、右側詳情/編輯器的配置呈現
 * 支援新建、編輯、刪除 Command
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Terminal, RefreshCw, FolderOpen, Plus, Trash2, Pencil } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import { useFileManager } from '../../hooks/useFileManager';
import { stringifyFrontmatter } from '../../utils/frontmatter';
import ResourceEditor, { type FieldDef } from './editors/ResourceEditor';
import type { CommandFile } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

/** Command 欄位定義，供 ResourceEditor 使用（frontmatter 使用 kebab-case） */
const COMMAND_FIELDS: FieldDef[] = [
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
    placeholder: '此 slash command 的用途說明',
  },
  {
    key: 'argument-hint',
    label: '參數提示(argument-hint)',
    kind: 'text',
    placeholder: '例如:<file-path> [--verbose]',
    helpText: 'Claude Code 自動補完時顯示的參數格式',
  },
  {
    key: 'allowed-tools',
    label: '允許工具(allowed-tools)',
    kind: 'tags',
    placeholder: '例如:Read, Grep, Bash',
  },
  {
    key: 'model',
    label: '模型(model)',
    kind: 'select',
    options: ['opus', 'sonnet', 'haiku', 'inherit'],
  },
];

/** 編輯器模式：idle / create / edit */
type CmdEditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; commandId: string };

type ScopeFilter = 'all' | 'user' | 'project';

const CommandsTab: React.FC = () => {
  const { commands, projectDir } = useAppStore();
  const { loadCommands } = useResourceLoader();

  /** 搜尋關鍵字 */
  const [search, setSearch] = useState('');
  /** 來源範圍過濾 */
  const [scope, setScope] = useState<ScopeFilter>('all');
  /** 目前選取的 command id */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 編輯器模式 */
  const [mode, setMode] = useState<CmdEditorMode>({ kind: 'idle' });
  /** 新建 command 時的檔名輸入 */
  const [newCommandName, setNewCommandName] = useState('');
  const { createResourceFile, updateResourceFile, deleteResourceFile } = useFileManager();

  // 首次掛載時載入 commands
  useEffect(() => {
    loadCommands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  /** 套用過濾與排序後的 commands */
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

  /** 目前選取的 command */
  const selected: CommandFile | undefined = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? filtered[0],
    [filtered, selectedId]
  );

  /** 解析 commands 目錄(user 範圍使用 %USERPROFILE%) */
  const resolveCommandDir = (cmdScope: 'user' | 'project'): string => {
    if (cmdScope === 'project') {
      if (!projectDir) throw new Error('尚未選擇專案目錄');
      return `${projectDir}/.claude/commands`;
    }
    return '%USERPROFILE%/.claude/commands';
  };

  /**
   * 儲存 Command（新建或更新）
   * @param data 表單欄位資料（frontmatter kebab-case）
   * @param body Markdown 內文
   */
  const handleSaveCommand = async (
    data: Record<string, string | string[]>,
    body: string,
  ) => {
    if (mode.kind === 'idle') return;
    const content = stringifyFrontmatter(data, body);
    if (mode.kind === 'create') {
      const name = newCommandName.trim();
      if (!/^[a-z0-9-]+$/.test(name)) {
        throw new Error('Command 名稱僅允許小寫英文、數字與連字號(-)');
      }
      const dir = resolveCommandDir(mode.scope);
      await createResourceFile(`${dir}/${name}.md`, content);
    } else {
      const target = commands.find((c) => c.id === mode.commandId);
      if (!target) throw new Error('找不到目標 Command');
      await updateResourceFile(target.path, content);
    }
    await loadCommands();
    setMode({ kind: 'idle' });
    setNewCommandName('');
  };

  /**
   * 刪除指定 Command
   * @param commandId 要刪除的 command id
   */
  const handleDeleteCommand = async (commandId: string) => {
    const target = commands.find((c) => c.id === commandId);
    if (!target) return;
    const ok = window.confirm(
      `確定要刪除 Command「/${target.name}」嗎?\n路徑:${target.path}\n此操作不可復原。`,
    );
    if (!ok) return;
    await deleteResourceFile(target.path);
    await loadCommands();
    if (selectedId === commandId) setSelectedId(null);
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">⚡ Slash Commands</h2>
      <p className="tab-desc">
        自訂 Slash Commands 位於 <span className="mono">~/.claude/commands/</span> 與{' '}
        <span className="mono">&lt;project&gt;/.claude/commands/</span>，透過{' '}
        <code>/&lt;name&gt;</code> 呼叫。
      </p>

      {/* 工具列 */}
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
        <button
          className="btn-primary"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={() => setMode({ kind: 'create', scope: scope === 'project' ? 'project' : 'user' })}
          title="新建 Command"
        >
          <Plus size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          新建
        </button>
        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => loadCommands()}>
          <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          重新載入
        </button>
      </div>

      <div className="resource-layout">
        {/* 左側：Command 清單 */}
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
                onClick={() => { setSelectedId(c.id); setMode({ kind: 'idle' }); }}
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

        {/* 右側：詳情 / 編輯器 */}
        {mode.kind === 'idle' && selected && (
          <div className="resource-detail">
            <div className="resource-detail__toolbar">
              <button
                className="btn-secondary"
                onClick={() => setMode({ kind: 'edit', commandId: selected.id })}
              >
                <Pencil size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                編輯
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDeleteCommand(selected.id)}
              >
                <Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                刪除
              </button>
            </div>
            <div className="resource-detail__header">
              <span className="resource-detail__title mono">/{selected.name}</span>
              <span className={`resource-scope-tag resource-scope-tag--${selected.scope}`}>{selected.scope}</span>
            </div>

            <div className="resource-detail__meta">
              <span className="resource-detail__meta-key">Description</span>
              <span className="resource-detail__meta-val">{selected.description ?? '—'}</span>

              <span className="resource-detail__meta-key">Argument Hint</span>
              <span className="resource-detail__meta-val mono">{selected.argumentHint ?? '(無)'}</span>

              <span className="resource-detail__meta-key">Allowed Tools</span>
              <span className="resource-detail__meta-val mono">
                {selected.allowedTools && selected.allowedTools.length > 0
                  ? selected.allowedTools.join(', ')
                  : '(全部)'}
              </span>

              <span className="resource-detail__meta-key">Model</span>
              <span className="resource-detail__meta-val mono">{selected.model ?? '(繼承)'}</span>

              <span className="resource-detail__meta-key">
                <FolderOpen size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Path
              </span>
              <span className="resource-detail__meta-val mono">{selected.path}</span>
            </div>

            <div className="section-title" style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}>
              Command Prompt
            </div>
            <pre className="resource-detail__body">{selected.body.trim() || '(空白)'}</pre>
          </div>
        )}

        {mode.kind === 'idle' && !selected && (
          <div className="resource-detail resource-empty">
            選擇左側 command 以查看詳情
          </div>
        )}

        {mode.kind === 'create' && (
          <div className="resource-detail">
            <ResourceEditor
              title={`新建 Command(${mode.scope === 'user' ? 'User' : 'Project'} 範圍)`}
              fields={COMMAND_FIELDS}
              initialData={{ description: '', 'argument-hint': '', 'allowed-tools': [], model: '' }}
              initialBody=""
              onSave={handleSaveCommand}
              onCancel={() => { setMode({ kind: 'idle' }); setNewCommandName(''); }}
              extraHeader={
                <div className="field-row">
                  <label className="field-row__label">
                    指令名稱(檔名)<span className="field-row__required">*</span>
                  </label>
                  <input
                    className="field-row__input"
                    type="text"
                    value={newCommandName}
                    placeholder="例如:commit-push-pr"
                    onChange={(e) => setNewCommandName(e.target.value)}
                  />
                  <div className="field-row__help">
                    儲存後可透過 /{newCommandName || 'xxx'} 呼叫
                  </div>
                </div>
              }
            />
          </div>
        )}

        {mode.kind === 'edit' && (() => {
          const target = commands.find((c) => c.id === mode.commandId);
          if (!target) return null;
          return (
            <div className="resource-detail">
              <ResourceEditor
                title={`編輯 Command:/${target.name}`}
                fields={COMMAND_FIELDS}
                initialData={{
                  description: target.description ?? '',
                  'argument-hint': target.argumentHint ?? '',
                  'allowed-tools': target.allowedTools ?? [],
                  model: target.model ?? '',
                }}
                initialBody={target.body}
                onSave={handleSaveCommand}
                onCancel={() => setMode({ kind: 'idle' })}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default CommandsTab;
