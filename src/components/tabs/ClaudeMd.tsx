/**
 * ClaudeMd Tab — CLAUDE.md 多標籤 Markdown 編輯器
 * 支援 Global (~/.claude/CLAUDE.md) 和 Project (./CLAUDE.md) 兩個標籤
 */
import React, { useState } from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import './TabContent.css';

type Scope = 'global' | 'project';

const SCOPE_LABELS: Record<Scope, string> = {
  global:  'Global (~/.claude/CLAUDE.md)',
  project: 'Project (./CLAUDE.md)',
};

const ClaudeMd: React.FC = () => {
  const { claudeMd } = useAppStore();
  const { saveClaudeMd, commitClaudeMd } = useFileManager();
  const [activeScope, setActiveScope] = useState<Scope>('global');

  /** 當前 scope 的內容 */
  const content = claudeMd[activeScope].content;

  /** 儲存當前標籤：先寫 draft 再 commit 到磁碟 */
  const handleSave = async () => {
    await saveClaudeMd(activeScope, content);
    await commitClaudeMd(activeScope);
  };

  /** 複製到剪貼簿 */
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
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

      {/* Markdown 編輯區 */}
      <textarea
        className="md-textarea glass-card"
        value={content}
        onChange={(e) =>
          useAppStore.getState().updateClaudeMdDraft(activeScope, e.target.value)
        }
        placeholder={`在此輸入 ${SCOPE_LABELS[activeScope]} 的內容...`}
        spellCheck={false}
      />

      {/* 底部狀態列 */}
      <div className="md-footer">
        <span>字數：{content.length} ／ 行數：{content.split('\n').length}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={handleCopy}>📋 複製</button>
          <button className="btn-primary"   onClick={handleSave}>💾 儲存</button>
        </div>
      </div>
    </div>
  );
};

export default ClaudeMd;
