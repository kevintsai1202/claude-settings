/**
 * OutputStylesTab — Output Styles 顯示與選取
 * 列出 builtin、user、project 三種來源的 output style
 * 點擊「套用」可將 ClaudeSettings.outputStyle 設定為該 style
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Palette, RefreshCw, FolderOpen, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import { useFileManager } from '../../hooks/useFileManager';
import type { OutputStyleFile, ClaudeSettings } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

type ScopeFilter = 'all' | 'user' | 'project' | 'builtin';

const OutputStylesTab: React.FC = () => {
  const { outputStyles, projectDir, files } = useAppStore();
  const { loadOutputStyles } = useResourceLoader();
  const { saveFile } = useFileManager();

  const userSettings: ClaudeSettings = files.user.data ?? {};
  /** 目前使用者層已套用的 output style */
  const appliedStyle = userSettings.outputStyle ?? 'default';

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
                onClick={() => setSelectedId(o.id)}
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

        {selected ? (
          <div className="resource-detail">
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
                <pre className="resource-detail__body">{selected.body.trim() || '（空白）'}</pre>
              </>
            )}
          </div>
        ) : (
          <div className="resource-detail resource-empty">
            選擇左側 style 以查看詳情
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputStylesTab;
