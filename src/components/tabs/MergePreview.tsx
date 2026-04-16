/**
 * MergePreview Tab — 多層設定合并預覽
 * 顯示所有層合并後的最終有效值及其來源
 */
import React from 'react';
import { useAppStore } from '../../store/settingsStore';
import { mergeSettings } from '../../utils/merge';
import type { SettingsLayer } from '../../types/settings';
import './TabContent.css';

// 來源標記的 CSS class 名稱
const sourceClass = (source: SettingsLayer | 'default') => `source-badge source-${source}`;

// 來源顯示名稱
const SOURCE_LABEL: Record<SettingsLayer | 'default', string> = {
  user:    'User',
  project: 'Project',
  local:   'Local',
  managed: 'Managed',
  default: '預設值',
};

const MergePreview: React.FC = () => {
  const { files } = useAppStore();
  const { entries } = mergeSettings(files);

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">📊 合并預覽</h2>
      <p className="tab-desc">
        所有層設定合并後的最終有效值（managed &gt; local &gt; project &gt; user）
      </p>

      {/* 來源圖例 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['user', 'project', 'local', 'managed', 'default'] as const).map((s) => (
          <span key={s} className={sourceClass(s)}>{SOURCE_LABEL[s]}</span>
        ))}
      </div>

      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>尚未載入任何設定檔，請先開啟專案或確認 User 設定存在。</p>
      ) : (
        <table className="merge-table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>設定項</th>
              <th style={{ width: '40%' }}>有效值</th>
              <th style={{ width: '25%' }}>來源</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ key, value, source }) => (
              <tr key={key}>
                <td className="mono" style={{ color: 'var(--text-secondary)' }}>{key}</td>
                <td className="mono">
                  {typeof value === 'boolean'
                    ? (value ? '✅ true' : '❌ false')
                    : Array.isArray(value)
                    ? (value as string[]).join(', ') || '（空）'
                    : String(value ?? '（空）')}
                </td>
                <td>
                  <span className={sourceClass(source)}>{SOURCE_LABEL[source]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MergePreview;
