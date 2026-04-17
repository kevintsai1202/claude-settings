/**
 * ClaudeMd Tab — CLAUDE.md 多標籤 Markdown 編輯器
 * 支援 Global (~/.claude/CLAUDE.md) 和 Project (./CLAUDE.md) 兩個標籤
 * 右側面板顯示 @path 引用列表，支援點擊預覽檔案前 200 行
 */
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { readTextFile, exists } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import { parseClaudeMdImports, type ImportRef } from '../../utils/parseClaudeMdImports';
import { estimateStats, tokenWarningLevel } from '../../utils/estimateTokens';
import './TabContent.css';

type Scope = 'global' | 'project';

const SCOPE_LABELS: Record<Scope, string> = {
  global:  'Global (~/.claude/CLAUDE.md)',
  project: 'Project (./CLAUDE.md)',
};

const ClaudeMd: React.FC = () => {
  const { claudeMd, projectDir } = useAppStore();
  const { saveClaudeMd, commitClaudeMd } = useFileManager();
  const [activeScope, setActiveScope] = useState<Scope>('global');

  /** 目前選取的 @path 引用 */
  const [selectedImport, setSelectedImport] = useState<ImportRef | null>(null);
  /** 預覽檔案內容 */
  const [previewContent, setPreviewContent] = useState<string>('');
  /** 預覽讀取錯誤訊息 */
  const [previewError, setPreviewError] = useState<string | null>(null);

  /** 當前 scope 的內容 */
  const content = claudeMd[activeScope].content;

  /** baseDir — 用於解析相對路徑 */
  const baseDir = useMemo(() => projectDir ?? '', [projectDir]);

  /** 解析出所有 @path 引用 */
  const importRefs = useMemo(
    () => parseClaudeMdImports(content, baseDir),
    [content, baseDir],
  );

  /** 字數/行數/詞數/token 估算 */
  const stats = useMemo(() => estimateStats(content), [content]);
  const warningLevel = tokenWarningLevel(stats.estimatedTokens);

  /** scope 切換時清除預覽狀態 */
  useEffect(() => {
    setSelectedImport(null);
    setPreviewContent('');
    setPreviewError(null);
  }, [activeScope]);

  /** 儲存當前標籤：先寫 draft 再 commit 到磁碟 */
  const handleSave = async () => {
    await saveClaudeMd(activeScope, content);
    await commitClaudeMd(activeScope);
  };

  /** 複製到剪貼簿 */
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  /**
   * 點擊 @path 引用後讀取對應檔案並顯示前 200 行
   * @param ref - 被點擊的引用物件
   */
  const handleOpenImport = async (ref: ImportRef) => {
    setSelectedImport(ref);
    setPreviewError(null);
    try {
      let abs = ref.absolute;
      // ~ 開頭需展開為 homeDir
      if (abs.startsWith('~/')) {
        const home = (await homeDir()).replace(/\\/g, '/');
        abs = `${home}${abs.slice(2)}`;
      }
      if (!(await exists(abs))) {
        setPreviewError(`檔案不存在：${abs}`);
        setPreviewContent('');
        return;
      }
      const text = await readTextFile(abs);
      const lines = text.split('\n');
      const truncated = lines.length > 200
        ? lines.slice(0, 200).join('\n') + `\n\n... (共 ${lines.length} 行，僅顯示前 200 行)`
        : text;
      setPreviewContent(truncated);
    } catch (e) {
      setPreviewError(`讀取錯誤：${(e as Error).message}`);
      setPreviewContent('');
    }
  };

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 className="tab-title">📝 CLAUDE.md 編輯器</h2>

      {/* 標籤切換 */}
      <div className="md-tabs">
        {(['global', 'project'] as Scope[]).map((scope) => (
          <button
            key={scope}
            className={`md-tab${activeScope === scope ? ' md-tab--active' : ''}`}
            onClick={() => setActiveScope(scope)}
          >
            {SCOPE_LABELS[scope]}
          </button>
        ))}
      </div>

      {/* 統計列 — 字數/行數/詞數/估算 tokens */}
      <div className={`md-stats md-stats--${warningLevel}`}>
        <span>📏 字數：{stats.chars.toLocaleString()}</span>
        <span>📑 行數：{stats.lines}</span>
        <span>🔤 詞數：{stats.words}</span>
        <span>🧠 估算 tokens：<strong>{stats.estimatedTokens.toLocaleString()}</strong></span>
        {warningLevel === 'warn' && (
          <span className="md-stats__hint">⚠ 檔案偏大,建議用 @path 拆分細節到獨立檔案</span>
        )}
        {warningLevel === 'critical' && (
          <span className="md-stats__hint">🚨 檔案過大(&gt;5000 tokens),強烈建議拆分 — 過大的 CLAUDE.md 會壓縮模型可用上下文</span>
        )}
      </div>

      {/* 左右兩欄：編輯區 + 引用預覽面板 */}
      <div className="md-editor-layout">
        {/* 左側：Markdown 編輯區 */}
        <div className="md-editor-pane">
          <textarea
            className="md-textarea glass-card"
            value={content}
            onChange={(e) =>
              useAppStore.getState().updateClaudeMdDraft(activeScope, e.target.value)
            }
            placeholder={`在此輸入 ${SCOPE_LABELS[activeScope]} 的內容...`}
            spellCheck={false}
          />
        </div>

        {/* 右側：@path 引用面板 */}
        <aside className="md-imports-pane">
          <header className="md-imports-header">
            <FileText size={14} />
            引用檔案
            <span className="md-imports-count">({importRefs.length})</span>
          </header>

          <ul className="md-imports-list">
            {importRefs.length === 0 && (
              <li className="md-imports-empty">尚無 @path 引用</li>
            )}
            {importRefs.map((r, i) => (
              <li
                key={`${r.offset}-${i}`}
                className={`md-imports-item${selectedImport?.offset === r.offset ? ' md-imports-item--active' : ''}`}
                onClick={() => handleOpenImport(r)}
                title={r.absolute}
              >
                <ExternalLink size={12} />
                {r.ref}
              </li>
            ))}
          </ul>

          {/* 預覽區塊 */}
          {selectedImport && (
            <div className="md-imports-preview">
              <div className="md-imports-preview-header">
                <FileText size={12} />
                {selectedImport.ref}
              </div>
              {previewError ? (
                <div className="md-imports-preview-error">⚠ {previewError}</div>
              ) : (
                <pre className="md-imports-preview-body">{previewContent}</pre>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* 底部操作列 — 字數/行數統計已移至頂部 .md-stats */}
      <div className="md-footer">
        <span />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={handleCopy}>📋 複製</button>
          <button className="btn-primary"   onClick={handleSave}>💾 儲存</button>
        </div>
      </div>
    </div>
  );
};

export default ClaudeMd;
