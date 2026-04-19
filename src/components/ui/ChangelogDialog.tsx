/**
 * ChangelogDialog — 更新紀錄對話框
 * 資料來源：src/data/changelog.ts（新版在前）
 * 視覺沿用 UpdateDialog 的 backdrop / dialog 樣式以保持語言一致
 */
import React from 'react';
import { History, X } from 'lucide-react';
import { CHANGELOG, type ChangeKind, type ChangelogEntry } from '../../data/changelog';
import './UpdateDialog.css';

const KIND_LABEL: Record<ChangeKind, string> = {
  added:    '新增',
  changed:  '調整',
  fixed:    '修復',
  security: '安全',
};

interface ChangelogDialogProps {
  isOpen: boolean;
  /** 目前執行中的版本號（不含 v 前綴），用於標記「目前」badge */
  currentVersion?: string;
  onClose: () => void;
}

const ChangelogDialog: React.FC<ChangelogDialogProps> = ({ isOpen, currentVersion, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="update-dialog__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-dialog-title"
    >
      <div className="update-dialog" style={{ width: 'min(640px, 92vw)' }}>
        <div className="update-dialog__header">
          <History size={18} aria-hidden />
          <h2 className="update-dialog__title" id="changelog-dialog-title">
            更新紀錄
          </h2>
          {currentVersion && (
            <span className="update-dialog__version" title="目前執行中的版本">
              v{currentVersion}
            </span>
          )}
          <button
            className="update-dialog__close"
            onClick={onClose}
            title="關閉"
            aria-label="關閉"
          >
            <X size={14} />
          </button>
        </div>

        <div className="changelog-dialog__body">
          {CHANGELOG.map((entry) => (
            <EntryBlock
              key={entry.version}
              entry={entry}
              isCurrent={entry.version === currentVersion}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const EntryBlock: React.FC<{ entry: ChangelogEntry; isCurrent: boolean }> = ({ entry, isCurrent }) => {
  return (
    <section>
      <header className="changelog-entry__header">
        <h3 className="changelog-entry__version">v{entry.version}</h3>
        <span className="changelog-entry__date">{entry.date}</span>
        {isCurrent && <span className="changelog-entry__current-badge">目前</span>}
      </header>
      {entry.summary && <p className="changelog-entry__summary">{entry.summary}</p>}
      <ul className="changelog-entry__list">
        {entry.changes.map((item, idx) => (
          <li key={idx} className="changelog-entry__item">
            <span className={`changelog-entry__kind changelog-entry__kind--${item.kind}`}>
              {KIND_LABEL[item.kind]}
            </span>
            <span className="changelog-entry__item-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ChangelogDialog;
