/**
 * TagArrayInput 標籤陣列輸入元件
 * 用於編輯 string[] 欄位，如 allowedDomains、excludedCommands
 */
import React, { useState, KeyboardEvent } from 'react';
import './TagArrayInput.css';

interface TagArrayInputProps {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const TagArrayInput: React.FC<TagArrayInputProps> = ({
  value,
  onChange,
  placeholder = '輸入後按 Enter 新增',
  disabled = false,
}) => {
  /** 目前輸入框的暫存文字 */
  const [inputText, setInputText] = useState('');

  /** 新增標籤（去除空白並避免重複） */
  const handleAdd = () => {
    const trimmed = inputText.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputText('');
  };

  /** 按下 Enter 鍵時新增標籤 */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  /** 刪除指定索引的標籤 */
  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className={`tag-array-input${disabled ? ' tag-array-input--disabled' : ''}`}>
      {value.map((tag, index) => (
        <span key={index} className="tag-array-input__chip">
          <span className="tag-array-input__chip-label">{tag}</span>
          {!disabled && (
            <button
              type="button"
              className="tag-array-input__chip-remove"
              onClick={() => handleRemove(index)}
              aria-label={`移除 ${tag}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          className="tag-array-input__input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAdd}
          placeholder={value.length === 0 ? placeholder : ''}
        />
      )}
    </div>
  );
};

export default TagArrayInput;
