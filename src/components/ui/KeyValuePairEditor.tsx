/**
 * KeyValuePairEditor 鍵值對編輯器元件
 * 通用的 Record<string, string> 編輯介面，以表格形式呈現
 */
import React, { useState } from 'react';
import './KeyValuePairEditor.css';

interface KeyValuePairEditorProps {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  disabled?: boolean;
}

const KeyValuePairEditor: React.FC<KeyValuePairEditorProps> = ({
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  disabled = false,
}) => {
  /** 新增列的暫存 key */
  const [newKey, setNewKey] = useState('');
  /** 新增列的暫存 value */
  const [newValue, setNewValue] = useState('');

  /** 更新已存在的 key 對應的 value */
  const handleValueChange = (key: string, newVal: string) => {
    onChange({ ...value, [key]: newVal });
  };

  /** 更新已存在的 key 名稱（需重建物件以維持順序） */
  const handleKeyChange = (oldKey: string, newKeyName: string) => {
    const entries = Object.entries(value).map(([k, v]) =>
      k === oldKey ? [newKeyName, v] : [k, v]
    );
    onChange(Object.fromEntries(entries));
  };

  /** 刪除指定 key 的行 */
  const handleRemove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  /** 新增一行鍵值對 */
  const handleAdd = () => {
    const trimmedKey = newKey.trim();
    if (!trimmedKey) return;
    onChange({ ...value, [trimmedKey]: newValue });
    setNewKey('');
    setNewValue('');
  };

  /** 在新增列按下 Enter 鍵時提交 */
  const handleNewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const entries = Object.entries(value);

  return (
    <div className={`kv-editor${disabled ? ' kv-editor--disabled' : ''}`}>
      <table className="kv-editor__table">
        <thead>
          <tr className="kv-editor__head-row">
            <th className="kv-editor__th kv-editor__th--key">Key</th>
            <th className="kv-editor__th kv-editor__th--value">Value</th>
            {!disabled && <th className="kv-editor__th kv-editor__th--action" />}
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, val]) => (
            <tr key={key} className="kv-editor__row">
              <td className="kv-editor__td kv-editor__td--key">
                <input
                  className="kv-editor__input"
                  type="text"
                  value={key}
                  onChange={(e) => handleKeyChange(key, e.target.value)}
                  disabled={disabled}
                  placeholder={keyPlaceholder}
                />
              </td>
              <td className="kv-editor__td kv-editor__td--value">
                <input
                  className="kv-editor__input"
                  type="text"
                  value={val}
                  onChange={(e) => handleValueChange(key, e.target.value)}
                  disabled={disabled}
                  placeholder={valuePlaceholder}
                />
              </td>
              {!disabled && (
                <td className="kv-editor__td kv-editor__td--action">
                  <button
                    type="button"
                    className="kv-editor__remove-btn"
                    onClick={() => handleRemove(key)}
                    aria-label={`移除 ${key}`}
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}

          {/* 新增列 */}
          {!disabled && (
            <tr className="kv-editor__row kv-editor__row--new">
              <td className="kv-editor__td kv-editor__td--key">
                <input
                  className="kv-editor__input kv-editor__input--new"
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  onKeyDown={handleNewKeyDown}
                  placeholder={keyPlaceholder}
                />
              </td>
              <td className="kv-editor__td kv-editor__td--value">
                <input
                  className="kv-editor__input kv-editor__input--new"
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={handleNewKeyDown}
                  placeholder={valuePlaceholder}
                />
              </td>
              <td className="kv-editor__td kv-editor__td--action">
                <button
                  type="button"
                  className="kv-editor__add-btn"
                  onClick={handleAdd}
                  disabled={!newKey.trim()}
                  aria-label="新增"
                >
                  +
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {entries.length === 0 && disabled && (
        <p className="kv-editor__empty">（無資料）</p>
      )}
    </div>
  );
};

export default KeyValuePairEditor;
