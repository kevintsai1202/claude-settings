/**
 * RulesTab — .claude/rules/*.md 檔案顯示與管理
 * 讀取 ~/.claude/rules/ 與 <project>/.claude/rules/ 下所有 .md（遞迴）
 * 每個檔案含 frontmatter（description / paths）與 markdown body
 * 支援新建、編輯、刪除（單一檔案），檔名允許含 '/' 建立子資料夾
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw, FolderOpen, Plus, Trash2, Pencil } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import { useFileManager } from '../../hooks/useFileManager';
import { stringifyFrontmatter } from '../../utils/frontmatter';
import ResourceEditor, { type FieldDef } from './editors/ResourceEditor';
import type { RuleFile } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

/** Rule 表單欄位定義 */
const RULE_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: '相對路徑(不含 .md)',
    kind: 'text',
    required: true,
    placeholder: '例如:frontend/testing 或 code-style',
    helpText: '可含 "/" 建立子資料夾(例如 frontend/api);第一版不支援改名',
  },
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: false,
    placeholder: '簡短描述規則用途(可選)',
  },
  {
    key: 'paths',
    label: 'Paths glob 清單',
    kind: 'tags',
    placeholder: '例如:src/**/*.ts, lib/**/*.ts',
    helpText: '留空 = 每次 session 無條件載入;填寫 = 僅開啟匹配檔案時載入',
  },
];

type ScopeFilter = 'all' | 'user' | 'project';

/** 編輯器模式:閒置 / 新建 / 編輯 */
type RuleEditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; ruleId: string };

const RulesTab: React.FC = () => {
  const { rules, projectDir } = useAppStore();
  const { loadRules } = useResourceLoader();
  const { ensureDir, createResourceFile, updateResourceFile, deleteResourceFile } = useFileManager();

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<RuleEditorMode>({ kind: 'idle' });

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  useEffect(() => {
    if (selectedId && !rules.find((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [rules, selectedId]);

  const filtered = useMemo(() => {
    return rules
      .filter((r) => (scope === 'all' ? true : r.scope === scope))
      .filter((r) =>
        search
          ? (r.name + (r.description ?? '') + (r.paths?.join(' ') ?? ''))
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rules, scope, search]);

  const selected: RuleFile | undefined = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0],
    [filtered, selectedId],
  );

  const userCount = rules.filter((r) => r.scope === 'user').length;
  const projectCount = rules.filter((r) => r.scope === 'project').length;
  const scopedCount = rules.filter((r) => r.paths && r.paths.length > 0).length;
  const globalCount = rules.length - scopedCount;

  /**
   * 解析 rule 檔案絕對路徑
   * @param ruleScope - user / project
   * @param relName - 相對於 rules/ 的路徑(不含 .md,例如 "frontend/testing")
   */
  const resolveRulePath = (ruleScope: 'user' | 'project', relName: string): string => {
    const fileName = `${relName}.md`;
    if (ruleScope === 'project') {
      if (!projectDir) throw new Error('尚未選擇專案目錄');
      return `${projectDir}/.claude/rules/${fileName}`;
    }
    return `%USERPROFILE%/.claude/rules/${fileName}`;
  };

  /**
   * 儲存 rule(新建或更新)
   * @param data frontmatter 資料(含 name / description / paths)
   * @param body markdown 主體
   */
  const handleSaveRule = async (
    data: Record<string, string | string[]>,
    body: string,
  ) => {
    if (mode.kind === 'idle') return;
    const name = (data.name as string).trim();
    if (!/^[a-z0-9][a-z0-9\-_/]*$/.test(name)) {
      throw new Error('路徑僅允許小寫英文、數字、連字號(-)、底線(_)、斜線(/),且不可以斜線開頭');
    }
    if (name.endsWith('/')) {
      throw new Error('路徑不可以斜線結尾');
    }
    // 組 frontmatter 只保留有內容的欄位(避免寫出 name: xxx 進 .md — name 只是 UI 欄位)
    const frontmatter: Record<string, string | string[] | undefined> = {
      description: data.description as string,
      paths: data.paths as string[],
    };
    const content = stringifyFrontmatter(frontmatter, body);

    if (mode.kind === 'create') {
      const absPath = resolveRulePath(mode.scope, name);
      // 確保父資料夾存在(支援 subdir/name 形式)
      const parent = absPath.replace(/\/[^/]+$/, '');
      await ensureDir(parent);
      await createResourceFile(absPath, content);
    } else {
      const target = rules.find((r) => r.id === mode.ruleId);
      if (!target) throw new Error('找不到目標 Rule');
      const currentName = target.relPath.replace(/\.md$/, '');
      if (name !== currentName) {
        throw new Error('Rule 路徑綁定檔案,若要改名請於檔案系統手動搬移後重新載入。');
      }
      await updateResourceFile(target.path, content);
    }
    await loadRules();
    setMode({ kind: 'idle' });
  };

  /** 刪除單一 rule 檔案 */
  const handleDeleteRule = async (ruleId: string) => {
    const target = rules.find((r) => r.id === ruleId);
    if (!target) return;
    const ok = window.confirm(
      `確定要刪除 Rule「${target.name}」嗎?\n\n` +
      `檔案路徑:\n${target.path}\n\n` +
      `此操作不可復原,但不會刪除父資料夾。`,
    );
    if (!ok) return;
    await deleteResourceFile(target.path);
    await loadRules();
    if (selectedId === ruleId) setSelectedId(null);
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">📐 Rules</h2>
      <p className="tab-desc">
        Rules 位於 <span className="mono">~/.claude/rules/</span> 與{' '}
        <span className="mono">&lt;project&gt;/.claude/rules/</span>，每個 <code>.md</code> 檔案是一條規則，支援巢狀子資料夾分類。
        frontmatter 可選 <code>paths</code> glob 陣列：<strong>有填</strong>→ 僅在 Claude 讀取匹配檔案時載入；<strong>留空</strong>→ 每次 session 無條件載入。
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
        <span>共 <strong>{rules.length}</strong> 條規則</span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span>User <strong style={{ color: '#818cf8' }}>{userCount}</strong></span>
        <span>Project <strong style={{ color: 'var(--color-success)' }}>{projectCount}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span>🌐 全域載入 <strong>{globalCount}</strong></span>
        <span>🎯 路徑條件 <strong>{scopedCount}</strong></span>
      </div>

      <div className="resource-toolbar">
        <input
          type="text"
          className="resource-toolbar__search"
          placeholder="🔍 搜尋規則名稱、描述或 glob"
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
          title="新建 Rule"
        >
          <Plus size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          新建
        </button>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => loadRules()}>
          <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          重新載入
        </button>
      </div>

      <div className="resource-layout">
        {filtered.length === 0 ? (
          <div className="resource-empty">
            <FileText size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>尚未偵測到任何 rule</div>
            <div style={{ fontSize: 11, marginTop: 6 }}>
              請新增 <code>~/.claude/rules/&lt;name&gt;.md</code>
            </div>
          </div>
        ) : (
          <ul className="resource-list">
            {filtered.map((r) => {
              const hasPaths = r.paths && r.paths.length > 0;
              return (
                <li
                  key={r.id}
                  className={`resource-list__item${selected?.id === r.id ? ' resource-list__item--selected' : ''}`}
                  onClick={() => { setSelectedId(r.id); setMode({ kind: 'idle' }); }}
                >
                  <div className="resource-list__name">
                    <FileText size={12} />
                    <span>{r.name}</span>
                    <span className={`resource-scope-tag resource-scope-tag--${r.scope}`}>{r.scope}</span>
                    <span
                      title={hasPaths ? '路徑條件載入' : '無條件全域載入'}
                      style={{
                        marginLeft: 4,
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: hasPaths ? 'rgba(99, 102, 241, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        color: hasPaths ? '#818cf8' : 'var(--color-success)',
                      }}
                    >
                      {hasPaths ? `🎯 ${r.paths!.length}` : '🌐'}
                    </span>
                  </div>
                  {r.description && <div className="resource-list__desc">{r.description}</div>}
                </li>
              );
            })}
          </ul>
        )}

        {/* 右側面板 */}
        {mode.kind === 'idle' && selected && (
          <div className="resource-detail">
            <div className="resource-detail__toolbar">
              <button
                className="btn-secondary"
                onClick={() => setMode({ kind: 'edit', ruleId: selected.id })}
              >
                <Pencil size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                編輯 Rule
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDeleteRule(selected.id)}
              >
                <Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                刪除檔案
              </button>
            </div>

            <div className="resource-detail__header">
              <span className="resource-detail__title">{selected.name}</span>
              <span className={`resource-scope-tag resource-scope-tag--${selected.scope}`}>{selected.scope}</span>
            </div>

            <div className="resource-detail__meta">
              <span className="resource-detail__meta-key">相對路徑</span>
              <span className="resource-detail__meta-val mono">{selected.relPath}</span>

              <span className="resource-detail__meta-key">Description</span>
              <span className="resource-detail__meta-val">{selected.description ?? '—'}</span>

              <span className="resource-detail__meta-key">載入條件</span>
              <span className="resource-detail__meta-val">
                {selected.paths && selected.paths.length > 0 ? (
                  <>
                    <span style={{ color: '#818cf8' }}>🎯 路徑匹配</span>
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {selected.paths.map((p) => (
                        <span
                          key={p}
                          style={{
                            padding: '2px 8px',
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <span style={{ color: 'var(--color-success)' }}>🌐 每次 session 無條件載入</span>
                )}
              </span>

              <span className="resource-detail__meta-key">
                <FolderOpen size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                檔案路徑
              </span>
              <span className="resource-detail__meta-val mono">{selected.path}</span>
            </div>

            <div className="section-title" style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}>
              Rule Body
            </div>
            <pre className="resource-detail__body">{selected.body.trim() || '(空白)'}</pre>
          </div>
        )}

        {mode.kind === 'idle' && !selected && (
          <div className="resource-detail resource-empty">
            選擇左側 rule 以查看詳情
          </div>
        )}

        {mode.kind === 'create' && (
          <div className="resource-detail">
            <ResourceEditor
              title={`新建 Rule(${mode.scope === 'user' ? 'User' : 'Project'} 範圍)`}
              fields={RULE_FIELDS}
              initialData={{ name: '', description: '', paths: [] }}
              initialBody={'# Rule 說明\n\n在此撰寫規則內容(指示、慣例、範例)...'}
              onSave={handleSaveRule}
              onCancel={() => setMode({ kind: 'idle' })}
            />
          </div>
        )}

        {mode.kind === 'edit' && (() => {
          const target = rules.find((r) => r.id === mode.ruleId);
          if (!target) return null;
          return (
            <div className="resource-detail">
              <ResourceEditor
                title={`編輯 Rule:${target.name}`}
                fields={RULE_FIELDS}
                initialData={{
                  name: target.relPath.replace(/\.md$/, ''),
                  description: target.description ?? '',
                  paths: target.paths ?? [],
                }}
                initialBody={target.body}
                onSave={handleSaveRule}
                onCancel={() => setMode({ kind: 'idle' })}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default RulesTab;
