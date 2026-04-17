/**
 * MemoryTab — Auto Memory 檔案顯示與管理
 * 目錄位置：~/.claude/projects/<slug>/memory/（或由 autoMemoryDirectory 覆蓋）
 * MEMORY.md 為索引檔（session 前 200 行載入），其他為 topic files（按需載入）
 *
 * 設計差異：與 Rules/Skills 不同，memory 檔案通常由 Claude 自己寫入/讀取
 * 本 Tab 提供「檢視 + 手動編輯 + 刪除」為主要定位，輔以新建 topic file
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Brain, RefreshCw, FolderOpen, Plus, Trash2, Pencil, FileText, Star } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useResourceLoader } from '../../hooks/useResourceLoader';
import { useFileManager } from '../../hooks/useFileManager';
import { stringifyFrontmatter } from '../../utils/frontmatter';
import ResourceEditor, { type FieldDef } from './editors/ResourceEditor';
import type { MemoryFile, MemoryType } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';

/** Memory type 對應的中文標籤與顏色 */
const MEMORY_TYPE_META: Record<MemoryType, { label: string; color: string }> = {
  user:      { label: '使用者',   color: '#818cf8' },
  feedback:  { label: '回饋',     color: '#f59e0b' },
  project:   { label: '專案',     color: 'var(--color-success)' },
  reference: { label: '外部參照', color: '#06b6d4' },
};

/** Topic file 表單欄位 */
const TOPIC_FIELDS: FieldDef[] = [
  {
    key: 'fileName',
    label: '檔名(含 .md)',
    kind: 'text',
    required: true,
    placeholder: '例如:debugging.md',
    helpText: '第一版不支援改名;檔名須以 .md 結尾',
  },
  {
    key: 'name',
    label: '記憶名稱(name)',
    kind: 'text',
    required: true,
    placeholder: '例如:Debugging patterns',
  },
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
    placeholder: '一句話描述這筆記憶的用途',
  },
  {
    key: 'type',
    label: '類型(type)',
    kind: 'select',
    required: true,
    options: ['user', 'feedback', 'project', 'reference'],
    helpText: 'user=使用者資訊 / feedback=修正指引 / project=專案狀態 / reference=外部系統指標',
  },
];

/** 編輯器模式 */
type MemoryEditorMode =
  | { kind: 'idle' }
  | { kind: 'create' }          // 新建 topic file
  | { kind: 'edit'; id: string }; // 編輯既有檔案（包含 MEMORY.md）

const MemoryTab: React.FC = () => {
  const { memoryFiles, memoryDir, projectDir } = useAppStore();
  const { loadMemory } = useResourceLoader();
  const { ensureDir, createResourceFile, updateResourceFile, deleteResourceFile } = useFileManager();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<MemoryEditorMode>({ kind: 'idle' });

  useEffect(() => {
    loadMemory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  useEffect(() => {
    if (selectedId && !memoryFiles.find((m) => m.id === selectedId)) {
      setSelectedId(null);
    }
  }, [memoryFiles, selectedId]);

  const filtered = useMemo(() => {
    if (!search) return memoryFiles;
    const q = search.toLowerCase();
    return memoryFiles.filter((m) =>
      (m.fileName + (m.displayName ?? '') + (m.description ?? '') + (m.memoryType ?? ''))
        .toLowerCase()
        .includes(q),
    );
  }, [memoryFiles, search]);

  const selected: MemoryFile | undefined = useMemo(
    () => filtered.find((m) => m.id === selectedId) ?? filtered[0],
    [filtered, selectedId],
  );

  /** 各類型計數 */
  const typeCounts = useMemo(() => {
    const counts: Record<MemoryType, number> = { user: 0, feedback: 0, project: 0, reference: 0 };
    for (const m of memoryFiles) {
      if (m.memoryType) counts[m.memoryType]++;
    }
    return counts;
  }, [memoryFiles]);

  const indexFile = memoryFiles.find((m) => m.isIndex);
  const topicCount = memoryFiles.length - (indexFile ? 1 : 0);

  /**
   * 儲存 topic file(新建或更新非 MEMORY.md 檔案)
   */
  const handleSaveTopic = async (
    data: Record<string, string | string[]>,
    body: string,
  ) => {
    if (mode.kind === 'idle' || !memoryDir) return;
    const fileName = (data.fileName as string).trim();
    if (!fileName.endsWith('.md')) {
      throw new Error('檔名必須以 .md 結尾');
    }
    if (fileName === 'MEMORY.md') {
      throw new Error('請直接編輯既有的 MEMORY.md,不可新建同名檔');
    }
    if (!/^[a-zA-Z0-9_\-.]+$/.test(fileName)) {
      throw new Error('檔名僅允許英文、數字、連字號(-)、底線(_)、點(.)');
    }
    const frontmatter: Record<string, string | string[] | undefined> = {
      name: data.name as string,
      description: data.description as string,
      type: data.type as string,
    };
    const content = stringifyFrontmatter(frontmatter, body);

    if (mode.kind === 'create') {
      await ensureDir(memoryDir);
      await createResourceFile(`${memoryDir}/${fileName}`, content);
    } else {
      const target = memoryFiles.find((m) => m.id === mode.id);
      if (!target) throw new Error('找不到目標檔案');
      if (fileName !== target.fileName) {
        throw new Error('Memory 檔名綁定檔案,若要改名請於檔案系統手動改後重新載入。');
      }
      await updateResourceFile(target.path, content);
    }
    await loadMemory();
    setMode({ kind: 'idle' });
  };

  /** 儲存 MEMORY.md — 直接覆寫 raw 內容（不解析 frontmatter） */
  const [indexDraft, setIndexDraft] = useState<string>('');
  const [indexSaving, setIndexSaving] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  // 切換到編輯 MEMORY.md 時同步 draft
  useEffect(() => {
    if (mode.kind === 'edit' && indexFile && mode.id === indexFile.id) {
      setIndexDraft(indexFile.raw);
      setIndexError(null);
    }
  }, [mode, indexFile]);

  const handleSaveIndex = async () => {
    if (!indexFile) return;
    setIndexSaving(true);
    setIndexError(null);
    try {
      await updateResourceFile(indexFile.path, indexDraft);
      await loadMemory();
      setMode({ kind: 'idle' });
    } catch (e) {
      setIndexError((e as Error).message || '儲存失敗');
    } finally {
      setIndexSaving(false);
    }
  };

  /** 刪除單一檔案 */
  const handleDelete = async (id: string) => {
    const target = memoryFiles.find((m) => m.id === id);
    if (!target) return;
    if (target.isIndex) {
      window.alert('不可刪除 MEMORY.md 索引檔。若要清空請手動編輯內容。');
      return;
    }
    const ok = window.confirm(
      `確定要刪除 Memory「${target.fileName}」嗎?\n\n` +
      `檔案路徑:\n${target.path}\n\n` +
      `此操作不可復原。`,
    );
    if (!ok) return;
    await deleteResourceFile(target.path);
    await loadMemory();
    if (selectedId === id) setSelectedId(null);
  };

  /** 建立 MEMORY.md 骨架（若使用者目錄無索引檔時） */
  const handleCreateIndex = async () => {
    if (!memoryDir) return;
    const skeleton = '# Memory Index\n\n這是 Claude 自動記憶的索引檔,每次 session 前 200 行或 25KB 會載入。\n\n- [範例 topic](example.md) — 一句話描述\n';
    await ensureDir(memoryDir);
    await createResourceFile(`${memoryDir}/MEMORY.md`, skeleton);
    await loadMemory();
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🧠 Auto Memory</h2>
      <p className="tab-desc">
        Claude 自動記憶檔案。索引 <code>MEMORY.md</code> 每次 session 前 200 行載入；其他 topic 檔案按需讀取。
        預設位於 <span className="mono">~/.claude/projects/&lt;slug&gt;/memory/</span>，可由 <code>autoMemoryDirectory</code> 覆蓋。
      </p>

      {/* 目錄路徑顯示 */}
      <div
        style={{
          marginBottom: 14,
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <FolderOpen size={12} />
          <strong>記憶目錄</strong>
        </div>
        <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
          {memoryDir ?? '（尚未選擇專案或無法解析路徑）'}
        </div>
      </div>

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
        <span>MEMORY.md {indexFile ? <strong style={{ color: 'var(--color-success)' }}>✓</strong> : <strong style={{ color: 'var(--color-danger, #ef4444)' }}>缺失</strong>}</span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span>共 <strong>{topicCount}</strong> 個 topic</span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        {(Object.keys(MEMORY_TYPE_META) as MemoryType[]).map((t) => (
          <span key={t}>
            {MEMORY_TYPE_META[t].label}{' '}
            <strong style={{ color: MEMORY_TYPE_META[t].color }}>{typeCounts[t]}</strong>
          </span>
        ))}
      </div>

      <div className="resource-toolbar">
        <input
          type="text"
          className="resource-toolbar__search"
          placeholder="🔍 搜尋檔名、名稱或描述"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn-primary"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={() => setMode({ kind: 'create' })}
          title="新建 topic 檔案"
          disabled={!memoryDir}
        >
          <Plus size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          新建 Topic
        </button>
        {!indexFile && memoryDir && (
          <button
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={handleCreateIndex}
            title="建立 MEMORY.md 骨架"
          >
            <Star size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            建立 MEMORY.md
          </button>
        )}
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => loadMemory()}>
          <RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          重新載入
        </button>
      </div>

      <div className="resource-layout">
        {filtered.length === 0 ? (
          <div className="resource-empty">
            <Brain size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>{memoryDir ? '此專案尚無記憶檔案' : '請先於側欄選擇專案目錄'}</div>
            {memoryDir && (
              <div style={{ fontSize: 11, marginTop: 6 }}>
                Claude 首次寫入記憶時會自動建立此資料夾
              </div>
            )}
          </div>
        ) : (
          <ul className="resource-list">
            {filtered.map((m) => {
              const meta = m.memoryType ? MEMORY_TYPE_META[m.memoryType] : undefined;
              return (
                <li
                  key={m.id}
                  className={`resource-list__item${selected?.id === m.id ? ' resource-list__item--selected' : ''}`}
                  onClick={() => { setSelectedId(m.id); setMode({ kind: 'idle' }); }}
                >
                  <div className="resource-list__name">
                    {m.isIndex ? <Star size={12} style={{ color: '#f59e0b' }} /> : <FileText size={12} />}
                    <span>{m.displayName ?? m.fileName}</span>
                    {m.isIndex && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                        }}
                      >
                        INDEX
                      </span>
                    )}
                    {meta && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-elevated)',
                          color: meta.color,
                        }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </div>
                  {(m.description || m.fileName !== (m.displayName ?? m.fileName)) && (
                    <div className="resource-list__desc">
                      {m.description || <span className="mono">{m.fileName}</span>}
                    </div>
                  )}
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
                onClick={() => setMode({ kind: 'edit', id: selected.id })}
              >
                <Pencil size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                編輯
              </button>
              {!selected.isIndex && (
                <button
                  className="btn-danger"
                  onClick={() => handleDelete(selected.id)}
                >
                  <Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  刪除
                </button>
              )}
            </div>

            <div className="resource-detail__header">
              <span className="resource-detail__title">
                {selected.displayName ?? selected.fileName}
              </span>
              {selected.isIndex && (
                <span
                  className="resource-scope-tag"
                  style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
                >
                  INDEX
                </span>
              )}
              {selected.memoryType && (
                <span
                  className="resource-scope-tag"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: MEMORY_TYPE_META[selected.memoryType].color,
                  }}
                >
                  {MEMORY_TYPE_META[selected.memoryType].label}
                </span>
              )}
            </div>

            <div className="resource-detail__meta">
              <span className="resource-detail__meta-key">檔名</span>
              <span className="resource-detail__meta-val mono">{selected.fileName}</span>

              {!selected.isIndex && (
                <>
                  <span className="resource-detail__meta-key">Name</span>
                  <span className="resource-detail__meta-val">{selected.displayName ?? '—'}</span>

                  <span className="resource-detail__meta-key">Description</span>
                  <span className="resource-detail__meta-val">{selected.description ?? '—'}</span>

                  <span className="resource-detail__meta-key">Type</span>
                  <span className="resource-detail__meta-val">
                    {selected.memoryType
                      ? `${MEMORY_TYPE_META[selected.memoryType].label} (${selected.memoryType})`
                      : '—'}
                  </span>
                </>
              )}

              <span className="resource-detail__meta-key">
                <FolderOpen size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                檔案路徑
              </span>
              <span className="resource-detail__meta-val mono">{selected.path}</span>
            </div>

            <div className="section-title" style={{ fontSize: 12, marginTop: 12, marginBottom: 8 }}>
              {selected.isIndex ? 'MEMORY.md Content' : 'Body'}
            </div>
            <pre className="resource-detail__body">
              {(selected.isIndex ? selected.raw : selected.body).trim() || '(空白)'}
            </pre>
          </div>
        )}

        {mode.kind === 'idle' && !selected && (
          <div className="resource-detail resource-empty">
            {memoryDir ? '選擇左側記憶檔以查看詳情' : '請先選擇專案目錄'}
          </div>
        )}

        {/* 新建 topic */}
        {mode.kind === 'create' && (
          <div className="resource-detail">
            <ResourceEditor
              title="新建 Memory Topic"
              fields={TOPIC_FIELDS}
              initialData={{ fileName: '', name: '', description: '', type: 'project' }}
              initialBody={'# 記憶內容\n\n在此撰寫這筆記憶的詳細內容...'}
              onSave={handleSaveTopic}
              onCancel={() => setMode({ kind: 'idle' })}
            />
          </div>
        )}

        {/* 編輯模式 — MEMORY.md 走純文字編輯器；其他走 ResourceEditor */}
        {mode.kind === 'edit' && (() => {
          const target = memoryFiles.find((m) => m.id === mode.id);
          if (!target) return null;
          if (target.isIndex) {
            return (
              <div className="resource-detail">
                <div className="resource-editor">
                  <header className="resource-editor__header">
                    <h3>編輯 MEMORY.md</h3>
                    <div className="resource-editor__actions">
                      <button className="btn-secondary" onClick={() => setMode({ kind: 'idle' })} disabled={indexSaving}>
                        取消
                      </button>
                      <button className="btn-primary" onClick={handleSaveIndex} disabled={indexSaving}>
                        {indexSaving ? '儲存中…' : '儲存'}
                      </button>
                    </div>
                  </header>
                  <section className="resource-editor__body-section">
                    <label className="resource-editor__body-label">
                      Raw content(索引檔直接編輯,不解析 frontmatter)
                    </label>
                    <textarea
                      className="resource-editor__body"
                      value={indexDraft}
                      onChange={(e) => setIndexDraft(e.target.value)}
                      spellCheck={false}
                      style={{ minHeight: 400 }}
                    />
                  </section>
                  {indexError && <div className="resource-editor__error">⚠ {indexError}</div>}
                </div>
              </div>
            );
          }
          return (
            <div className="resource-detail">
              <ResourceEditor
                title={`編輯 Memory:${target.fileName}`}
                fields={TOPIC_FIELDS}
                initialData={{
                  fileName: target.fileName,
                  name: target.displayName ?? '',
                  description: target.description ?? '',
                  type: target.memoryType ?? 'project',
                }}
                initialBody={target.body}
                onSave={handleSaveTopic}
                onCancel={() => setMode({ kind: 'idle' })}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default MemoryTab;
