/**
 * SkillsTab — Skills 顯示
 * 讀取 ~/.claude/skills/[name]/SKILL.md 與 <project>/.claude/skills/[name]/SKILL.md
 * 每個 skill 是一個資料夾，其下 SKILL.md 為主文件，可能還有 references/scripts 等子資源
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, FolderOpen, Folder } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import type { SkillFile } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

type ScopeFilter = 'all' | 'user' | 'project';

const SkillsTab: React.FC = () => {
  const { skills, projectDir } = useAppStore();
  const { loadSkills } = useResourceLoader();

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  const filtered = useMemo(() => {
    return skills
      .filter((s) => (scope === 'all' ? true : s.scope === scope))
      .filter((s) =>
        search
          ? (s.name + (s.description ?? '') + (s.displayName ?? '')).toLowerCase().includes(search.toLowerCase())
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skills, scope, search]);

  const selected: SkillFile | undefined = useMemo(
    () => filtered.find((s) => s.id === selectedId) ?? filtered[0],
    [filtered, selectedId]
  );

  /** 統計 */
  const userCount = skills.filter((s) => s.scope === 'user').length;
  const projectCount = skills.filter((s) => s.scope === 'project').length;

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">📚 Skills</h2>
      <p className="tab-desc">
        Skills 位於 <span className="mono">~/.claude/skills/</span> 與{' '}
        <span className="mono">&lt;project&gt;/.claude/skills/</span>，
        每個 skill 是一個資料夾，包含 <code>SKILL.md</code> 主文件與選用的 references / scripts / assets 子目錄。
      </p>

      {/* 統計 */}
      <div
        style={{
          marginBottom: 14,
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <span>共 <strong>{skills.length}</strong> 個 skill</span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span>User <strong style={{ color: '#818cf8' }}>{userCount}</strong></span>
        <span>Project <strong style={{ color: 'var(--color-success)' }}>{projectCount}</strong></span>
      </div>

      <div className="resource-toolbar">
        <input
          type="text"
          className="resource-toolbar__search"
          placeholder="🔍 搜尋 skill 名稱或描述"
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
        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => loadSkills()}>
          <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          重新載入
        </button>
      </div>

      <div className="resource-layout">
        {filtered.length === 0 ? (
          <div className="resource-empty">
            <BookOpen size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>尚未偵測到任何 skill</div>
            <div style={{ fontSize: 11, marginTop: 6 }}>
              請新增 <code>~/.claude/skills/&lt;name&gt;/SKILL.md</code>
            </div>
          </div>
        ) : (
          <ul className="resource-list">
            {filtered.map((s) => (
              <li
                key={s.id}
                className={`resource-list__item${selected?.id === s.id ? ' resource-list__item--selected' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <div className="resource-list__name">
                  <BookOpen size={12} />
                  <span>{s.name}</span>
                  <span className={`resource-scope-tag resource-scope-tag--${s.scope}`}>{s.scope}</span>
                </div>
                {s.description && <div className="resource-list__desc">{s.description}</div>}
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="resource-detail">
            <div className="resource-detail__header">
              <span className="resource-detail__title">
                {selected.displayName ?? selected.name}
              </span>
              <span className={`resource-scope-tag resource-scope-tag--${selected.scope}`}>{selected.scope}</span>
            </div>

            <div className="resource-detail__meta">
              <span className="resource-detail__meta-key">Skill ID</span>
              <span className="resource-detail__meta-val mono">{selected.name}</span>

              <span className="resource-detail__meta-key">Description</span>
              <span className="resource-detail__meta-val">{selected.description ?? '—'}</span>

              <span className="resource-detail__meta-key">Allowed Tools</span>
              <span className="resource-detail__meta-val mono">
                {selected.allowedTools && selected.allowedTools.length > 0
                  ? selected.allowedTools.join(', ')
                  : '（繼承）'}
              </span>

              <span className="resource-detail__meta-key">
                <Folder size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Skill Dir
              </span>
              <span className="resource-detail__meta-val mono">{selected.dir}</span>

              <span className="resource-detail__meta-key">
                <FolderOpen size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                SKILL.md
              </span>
              <span className="resource-detail__meta-val mono">{selected.path}</span>
            </div>

            {/* 子資料夾標示 */}
            {selected.subdirs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="section-title" style={{ fontSize: 12, marginBottom: 6 }}>
                  附加資源目錄
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.subdirs.map((sub) => (
                    <span
                      key={sub}
                      style={{
                        padding: '3px 10px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Folder size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {sub}/
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="section-title" style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}>
              SKILL.md Content
            </div>
            <pre className="resource-detail__body">{selected.body.trim() || '（空白）'}</pre>
          </div>
        ) : (
          <div className="resource-detail resource-empty">
            選擇左側 skill 以查看詳情
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillsTab;
