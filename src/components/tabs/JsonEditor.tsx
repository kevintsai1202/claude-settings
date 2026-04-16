/**
 * JsonEditor Tab — JSON 原始檢視 / 編輯器
 * 支援即時語法驗證，可針對各層設定進行直接編輯
 */
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import { validateFull } from '../../utils/validate';
import type { SettingsLayer, ClaudeSettings } from '../../types/settings';
import './TabContent.css';

const LAYERS: { value: SettingsLayer; label: string }[] = [
  { value: 'user',    label: 'User Settings' },
  { value: 'project', label: 'Project Settings' },
  { value: 'local',   label: 'Local Settings' },
];

const JsonEditor: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  const [selectedLayer, setSelectedLayer] = useState<SettingsLayer>('user');
  const [rawText, setRawText]             = useState('');
  const [isDirty, setIsDirty]             = useState(false);

  // 當切換層或 store 更新時，同步 rawText
  useEffect(() => {
    const raw = files[selectedLayer].raw;
    // 格式化顯示
    if (!raw.trim()) {
      setRawText('{}');
    } else {
      try {
        setRawText(JSON.stringify(JSON.parse(raw), null, 2));
      } catch {
        setRawText(raw);
      }
    }
    setIsDirty(false);
  }, [selectedLayer, files]);

  const validation = validateFull(rawText);

  /** 儲存當前編輯的 JSON */
  const handleSave = async () => {
    if (!validation.valid) return;
    const data = JSON.parse(rawText) as ClaudeSettings;
    await saveFile(selectedLayer, files[selectedLayer].path, data);
    setIsDirty(false);
  };

  /** 從 store 重新載入（捨棄編輯） */
  const handleReload = () => {
    const raw = files[selectedLayer].raw;
    setRawText(raw ? JSON.stringify(JSON.parse(raw), null, 2) : '{}');
    setIsDirty(false);
  };

  return (
    <div className="tab-content json-editor">
      <h2 className="tab-title">&#123; &#125; JSON 原始編輯器</h2>

      {/* 工具列 */}
      <div className="json-editor__toolbar">
        <select
          value={selectedLayer}
          onChange={(e) => setSelectedLayer(e.target.value as SettingsLayer)}
          style={{ width: 180 }}
        >
          {LAYERS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        <span className={`json-editor__status json-editor__status--${validation.valid ? 'ok' : 'error'}`}>
          {validation.valid ? '✅ 有效 JSON' : '❌ 格式錯誤'}
        </span>

        {isDirty && <span style={{ fontSize: 12, color: 'var(--color-warning)' }}>● 未儲存</span>}

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={handleReload}>🔄 重新載入</button>
          <button
            className="btn-secondary"
            onClick={() => navigator.clipboard.writeText(rawText)}
          >
            📋 複製
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!validation.valid || !isDirty}
          >
            💾 儲存
          </button>
        </div>
      </div>

      {/* 錯誤訊息 */}
      {!validation.valid && (
        <div className="json-editor__errors">
          {validation.errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* JSON 文字區 */}
      <textarea
        className="json-editor__textarea glass-card"
        value={rawText}
        onChange={(e) => { setRawText(e.target.value); setIsDirty(true); }}
        spellCheck={false}
      />
    </div>
  );
};

export default JsonEditor;
