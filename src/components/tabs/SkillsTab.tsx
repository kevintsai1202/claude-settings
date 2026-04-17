/**
 * SkillsTab — Skills 顯示與管理
 * 讀取 ~/.claude/skills/[name]/SKILL.md 與 <project>/.claude/skills/[name]/SKILL.md
 * 每個 skill 是一個資料夾，其下 SKILL.md 為主文件，可能還有 references/scripts 等子資源
 * 支援新建(ensureDir + createResourceFile)、編輯、刪除(遞迴刪除資料夾)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, FolderOpen, Folder, Plus, Trash2, Pencil } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import { useFileManager } from '../../hooks/useFileManager';
import { stringifyFrontmatter } from '../../utils/frontmatter';
import ResourceEditor, { type FieldDef } from './editors/ResourceEditor';
import type { SkillFile } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

/** Skill 表單欄位定義 */
const SKILL_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: '名稱(name)',
    kind: 'text',
    required: true,
    placeholder: '與資料夾同名,例如:pdf-processing',
    helpText: '必須與資料夾名相同,第一版不支援改名',
  },
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
    helpText: '用來觸發 skill 的語意描述,Claude 據此判斷何時載入',
  },
  {
    key: 'allowed-tools',
    label: '允許工具(allowed-tools)',
    kind: 'tags',
    placeholder: '例如:Read, Edit, Bash',
  },
];

type ScopeFilter = 'all' | 'user' | 'project';

/** 編輯器模式：閒置 / 新建 / 編輯 */
type SkillEditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; skillId: string };

const SkillsTab: React.FC = () => {
  const { skills, projectDir } = useAppStore();
  const { loadSkills } = useResourceLoader();
  const { ensureDir, createResourceFile, updateResourceFile, deleteResourceDir } = useFileManager();

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 右側面板目前模式 */
  const [mode, setMode] = useState<SkillEditorMode>({ kind: 'idle' });

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

  /**
   * 解析 skill 資料夾路徑
   * @param scope - user 或 project 範圍
   * @param name - skill 名稱（即資料夾名）
   */
  const resolveSkillDir = (skillScope: 'user' | 'project', name: string): string => {
    if (skillScope === 'project') {
      if (!projectDir) throw new Error('尚未選擇專案目錄');
      return `${projectDir}/.claude/skills/${name}`;
    }
    return `%USERPROFILE%/.claude/skills/${name}`;
  };

  /**
   * 儲存 skill（新建或更新）
   * @param data - frontmatter 欄位資料
   * @param body - SKILL.md 主體內容
   */
  const handleSaveSkill = async (
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
      const dir = resolveSkillDir(mode.scope, name);
      await ensureDir(dir);
      await createResourceFile(`${dir}/SKILL.md`, content);
    } else {
      // 編輯模式：禁止改名（資料夾與名稱綁定）
      const target = skills.find((s) => s.id === mode.skillId);
      if (!target) throw new Error('找不到目標 Skill');
      if (name !== target.name) {
        throw new Error(
          'Skill 名稱與資料夾綁定,若要改名請於檔案系統手動搬移資料夾後再重新載入。',
        );
      }
      await updateResourceFile(target.path, content);
    }
    await loadSkills();
    setMode({ kind: 'idle' });
  };

  /**
   * 刪除 skill 資料夾（遞迴）
   * @param skillId - 要刪除的 skill id
   */
  const handleDeleteSkill = async (skillId: string) => {
    const target = skills.find((s) => s.id === skillId);
    if (!target) return;
    const ok = window.confirm(
      `確定要刪除 Skill「${target.name}」嗎?\n\n` +
      `此操作會遞迴刪除整個資料夾:\n${target.dir}\n\n` +
      `若資料夾內含 references/ 或 scripts/ 子資料夾將一併刪除。\n此操作不可復原。`,
    );
    if (!ok) return;
    await deleteResourceDir(target.dir);
    await loadSkills();
    if (selectedId === skillId) setSelectedId(null);
  };

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
        {/* 新建按鈕 */}
        <button
          className="btn-primary"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={() => setMode({ kind: 'create', scope: scope === 'project' ? 'project' : 'user' })}
          title="新建 Skill"
        >
          <Plus size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          新建
        </button>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => loadSkills()}>
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
                onClick={() => { setSelectedId(s.id); setMode({ kind: 'idle' }); }}
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

        {/* 右側面板：依模式渲染 */}
        {mode.kind === 'idle' && selected && (
          <div className="resource-detail">
            {/* 操作工具列 */}
            <div className="resource-detail__toolbar">
              <button
                className="btn-secondary"
                onClick={() => setMode({ kind: 'edit', skillId: selected.id })}
              >
                <Pencil size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                編輯 SKILL.md
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDeleteSkill(selected.id)}
              >
                <Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                刪除資料夾
              </button>
            </div>

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
                  : '(繼承)'}
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
            <pre className="resource-detail__body">{selected.body.trim() || '(空白)'}</pre>
          </div>
        )}

        {mode.kind === 'idle' && !selected && (
          <div className="resource-detail resource-empty">
            選擇左側 skill 以查看詳情
          </div>
        )}

        {/* 新建模式 */}
        {mode.kind === 'create' && (
          <div className="resource-detail">
            <ResourceEditor
              title={`新建 Skill(${mode.scope === 'user' ? 'User' : 'Project'} 範圍)`}
              fields={SKILL_FIELDS}
              initialData={{ name: '', description: '', 'allowed-tools': [] }}
              initialBody={"# Skill 說明\n\n在此撰寫 Skill 的主體內容(instructions / examples)..."}
              onSave={handleSaveSkill}
              onCancel={() => setMode({ kind: 'idle' })}
            />
          </div>
        )}

        {/* 編輯模式 */}
        {mode.kind === 'edit' && (() => {
          const target = skills.find((s) => s.id === mode.skillId);
          if (!target) return null;
          return (
            <div className="resource-detail">
              <ResourceEditor
                title={`編輯 Skill:${target.name}`}
                fields={SKILL_FIELDS}
                initialData={{
                  name: target.name,
                  description: target.description ?? '',
                  'allowed-tools': target.allowedTools ?? [],
                }}
                initialBody={target.body}
                onSave={handleSaveSkill}
                onCancel={() => setMode({ kind: 'idle' })}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default SkillsTab;
