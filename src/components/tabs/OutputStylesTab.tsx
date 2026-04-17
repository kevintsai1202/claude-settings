/**
 * OutputStylesTab — Output Styles 顯示、新建、編輯、刪除
 * 列出 builtin、user、project 三種來源的 output style
 * builtin 範圍受保護，不可編輯或刪除
 * 點擊「套用」可將 ClaudeSettings.outputStyle 設定為該 style
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Palette, RefreshCw, FolderOpen, CheckCircle2, Plus, Trash2, Pencil } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import { useFileManager } from '../../hooks/useFileManager';
import { stringifyFrontmatter } from '../../utils/frontmatter';
import ResourceEditor, { type FieldDef } from './editors/ResourceEditor';
import type { OutputStyleFile, ClaudeSettings } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

/** Output Style 表單欄位定義 */
const OUTPUT_STYLE_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: '名稱(name)',
    kind: 'text',
    required: true,
    placeholder: '例如:concise-mode',
    helpText: '此值會同時作為檔名使用(小寫連字號)',
  },
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
    placeholder: 'Output Style 的行為說明',
  },
];

/** Style 編輯器模式：閒置 / 新建 / 編輯 */
type StyleEditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; styleId: string };

type ScopeFilter = 'all' | 'user' | 'project' | 'builtin';

const OutputStylesTab: React.FC = () => {
  const { outputStyles, projectDir, files } = useAppStore();
  const { loadOutputStyles } = useResourceLoader();
  const { saveFile, createResourceFile, updateResourceFile, deleteResourceFile } = useFileManager();

  /** 目前使用者層設定 */
  const userSettings: ClaudeSettings = files.user.data ?? {};
  /** 目前使用者層已套用的 output style */
  const appliedStyle = userSettings.outputStyle ?? 'default';

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 編輯器模式狀態 */
  const [mode, setMode] = useState<StyleEditorMode>({ kind: 'idle' });

  useEffect(() => {
    loadOutputStyles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  const filtered = useMemo(() => {
    return outputStyles
      .filter((o) => (scope === 'all' ? true : o.scope === scope))
      .filter((o) =>
        search
          ? (o.name + (o.description ?? '')).toLowerCase().includes(search.toLowerCase())
          : true
      )
      .sort((a, b) => {
        // builtin 優先，user 次之，project 最後
        const order: Record<string, number> = { builtin: 0, user: 1, project: 2 };
        const diff = (order[a.scope] ?? 9) - (order[b.scope] ?? 9);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
  }, [outputStyles, scope, search]);

  const selected: OutputStyleFile | undefined = useMemo(
    () => filtered.find((o) => o.id === selectedId) ?? filtered[0],
    [filtered, selectedId]
  );

  /** 套用 output style 到 user settings */
  const applyStyle = async (name: string) => {
    await saveFile('user', files.user.path, {
      ...userSettings,
      outputStyle: name === 'default' ? undefined : name,
    });
  };

  /** 解析 output-styles 目錄(user 範圍使用 %USERPROFILE%) */
  const resolveStyleDir = (targetScope: 'user' | 'project'): string => {
    if (targetScope === 'project') {
      if (!projectDir) throw new Error('尚未選擇專案目錄');
      return `${projectDir}/.claude/output-styles`;
    }
    return '%USERPROFILE%/.claude/output-styles';
  };

  /** 儲存 Output Style（新建或編輯） */
  const handleSaveStyle = async (
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
      const dir = resolveStyleDir(mode.scope);
      await createResourceFile(`${dir}/${name}.md`, content);
    } else {
      const target = outputStyles.find((s) => s.id === mode.styleId);
      if (!target) throw new Error('找不到目標 OutputStyle');
      if (target.scope === 'builtin') throw new Error('內建 OutputStyle 不可編輯');
      const dir = target.path.replace(/\/[^/]+$/, '');
      const newPath = `${dir}/${name}.md`;
      if (newPath !== target.path) {
        await createResourceFile(newPath, content);
        await deleteResourceFile(target.path);
      } else {
        await updateResourceFile(target.path, content);
      }
    }
    await loadOutputStyles();
    setMode({ kind: 'idle' });
  };

  /** 刪除 Output Style（builtin 受保護） */
  const handleDeleteStyle = async (styleId: string) => {
    const target = outputStyles.find((s) => s.id === styleId);
    if (!target) return;
    if (target.scope === 'builtin') {
      window.alert('內建 OutputStyle 不可刪除');
      return;
    }
    const ok = window.confirm(
      `確定要刪除 Output Style「${target.name}」嗎?\n路徑:${target.path}\n此操作不可復原。`,
    );
    if (!ok) return;
    await deleteResourceFile(target.path);
    await loadOutputStyles();
    if (selectedId === styleId) setSelectedId(null);
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🎨 Output Styles</h2>
      <p className="tab-desc">
        Output Style 決定 Claude 回應的風格，可為內建（default / explanatory / learning）或位於{' '}
        <span className="mono">~/.claude/output-styles/</span> 的自訂檔。
      </p>

      {/* 目前套用狀態 */}
      <div
        style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: 12,
        }}
      >
        目前套用：<strong className="mono">{appliedStyle}</strong>
      </div>

      <div className="resource-toolbar">
        <input
          type="text"
          className="resource-toolbar__search"
          placeholder="🔍 搜尋 style 名稱"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="resource-toolbar__filter">
          {(['all', 'builtin', 'user', 'project'] as ScopeFilter[]).map((s) => (
            <button
              key={s}
              className={`resource-chip${scope === s ? ' resource-chip--active' : ''}`}
              onClick={() => setScope(s)}
            >
              {s === 'all' ? '全部' : s}
            </button>
          ))}
        </div>
        {/* 新建按鈕：建立時預設 user 範圍，若目前選 project 過濾則用 project */}
        <button
          className="btn-primary"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={() => {
            const targetScope: 'user' | 'project' = scope === 'project' ? 'project' : 'user';
            setMode({ kind: 'create', scope: targetScope });
          }}
          title="新建 Output Style"
        >
          <Plus size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          新建
        </button>
        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => loadOutputStyles()}>
          <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          重新載入
        </button>
      </div>

      <div className="resource-layout">
        {filtered.length === 0 ? (
          <div className="resource-empty">
            <Palette size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>尚未偵測到 output style</div>
          </div>
        ) : (
          <ul className="resource-list">
            {filtered.map((o) => (
              <li
                key={o.id}
                className={`resource-list__item${selected?.id === o.id ? ' resource-list__item--selected' : ''}`}
                onClick={() => { setSelectedId(o.id); setMode({ kind: 'idle' }); }}
              >
                <div className="resource-list__name">
                  <Palette size={12} />
                  <span>{o.name}</span>
                  {appliedStyle === o.name && <CheckCircle2 size={12} color="var(--color-success)" />}
                  <span className={`resource-scope-tag resource-scope-tag--${o.scope}`}>{o.scope}</span>
                </div>
                {o.description && <div className="resource-list__desc">{o.description}</div>}
              </li>
            ))}
          </ul>
        )}

        {mode.kind === 'idle' && selected && (
          <div className="resource-detail">
            {selected.scope !== 'builtin' && (
              <div className="resource-detail__toolbar">
                <button
                  className="btn-secondary"
                  onClick={() => setMode({ kind: 'edit', styleId: selected.id })}
                >
                  <Pencil size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  編輯
                </button>
                <button
                  className="btn-danger"
                  onClick={() => handleDeleteStyle(selected.id)}
                >
                  <Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  刪除
                </button>
              </div>
            )}
            {selected.scope === 'builtin' && (
              <div
                className="resource-detail__toolbar"
                style={{ opacity: 0.7, fontStyle: 'italic', fontSize: 12 }}
              >
                🔒 內建 Output Style 不可編輯。如需自訂請點「新建」。
              </div>
            )}
            <div className="resource-detail__header">
              <span className="resource-detail__title">{selected.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`resource-scope-tag resource-scope-tag--${selected.scope}`}>{selected.scope}</span>
                {appliedStyle === selected.name ? (
                  <span style={{ fontSize: 11, color: 'var(--color-success)' }}>
                    <CheckCircle2 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    已套用
                  </span>
                ) : (
                  <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => applyStyle(selected.name)}>
                    套用此 Style
                  </button>
                )}
              </div>
            </div>

            <div className="resource-detail__meta">
              <span className="resource-detail__meta-key">Description</span>
              <span className="resource-detail__meta-val">{selected.description ?? '—'}</span>

              <span className="resource-detail__meta-key">
                <FolderOpen size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Path
              </span>
              <span className="resource-detail__meta-val mono">{selected.path}</span>
            </div>

            {selected.scope !== 'builtin' && (
              <>
                <div className="section-title" style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}>
                  Style Prompt
                </div>
                <pre className="resource-detail__body">{selected.body.trim() || '(空白)'}</pre>
              </>
            )}
          </div>
        )}

        {mode.kind === 'idle' && !selected && (
          <div className="resource-detail resource-empty">
            選擇左側 style 以查看詳情
          </div>
        )}

        {mode.kind === 'create' && (
          <div className="resource-detail">
            <ResourceEditor
              title={`新建 Output Style(${mode.scope === 'user' ? 'User' : 'Project'} 範圍)`}
              fields={OUTPUT_STYLE_FIELDS}
              initialData={{ name: '', description: '' }}
              initialBody=""
              onSave={handleSaveStyle}
              onCancel={() => setMode({ kind: 'idle' })}
            />
          </div>
        )}

        {mode.kind === 'edit' && (() => {
          const target = outputStyles.find((s) => s.id === mode.styleId);
          if (!target) return null;
          return (
            <div className="resource-detail">
              <ResourceEditor
                title={`編輯 Output Style:${target.name}`}
                fields={OUTPUT_STYLE_FIELDS}
                initialData={{
                  name: target.name,
                  description: target.description ?? '',
                }}
                initialBody={target.body}
                onSave={handleSaveStyle}
                onCancel={() => setMode({ kind: 'idle' })}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default OutputStylesTab;
