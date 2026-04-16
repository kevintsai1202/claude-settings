/**
 * ComboBox — 下拉 + 自訂輸入混合元件
 * 使用者可從列表選擇常見值，也可輸入自訂值；
 * 若當前 value 不在 options 裡，顯示為「自訂」分組最上方。
 */
import React, { useState, useRef, useEffect } from 'react';
import './ComboBox.css';

export interface ComboOption {
  value: string;
  label?: string;
  hint?: string;
}

interface ComboBoxProps {
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowEmpty?: boolean;           // 是否顯示「（預設）」空值選項
  emptyLabel?: string;            // 空值選項標籤，預設「（預設）」
  style?: React.CSSProperties;
}

const ComboBox: React.FC<ComboBoxProps> = ({
  value,
  options,
  onChange,
  placeholder = '輸入或選擇',
  disabled = false,
  allowEmpty = true,
  emptyLabel = '（預設）',
  style,
}) => {
  /** 下拉選單是否展開 */
  const [open, setOpen] = useState(false);
  /** 輸入框的暫存文字（供搜尋過濾） */
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 同步外部 value 變動
  useEffect(() => setQuery(value), [value]);

  // 點擊外部關閉下拉
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [value]);

  /** 套用使用者選擇或輸入 */
  const applyValue = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  // 過濾後的選項（依 query 模糊比對）
  const filtered = query
    ? options.filter(
        (o) =>
          o.value.toLowerCase().includes(query.toLowerCase()) ||
          (o.label ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options;

  return (
    <div ref={wrapperRef} className={`combobox${disabled ? ' combobox--disabled' : ''}`} style={style}>
      <input
        type="text"
        className="combobox__input"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyValue(query.trim());
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery(value);
          }
        }}
      />
      <button
        type="button"
        className="combobox__arrow"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label="展開選單"
      >
        ▾
      </button>

      {open && filtered.length + (allowEmpty ? 1 : 0) > 0 && (
        <ul className="combobox__list">
          {allowEmpty && (
            <li
              className={`combobox__item${value === '' ? ' combobox__item--selected' : ''}`}
              onClick={() => applyValue('')}
            >
              <span className="combobox__item-label">{emptyLabel}</span>
            </li>
          )}
          {filtered.map((o) => (
            <li
              key={o.value}
              className={`combobox__item${value === o.value ? ' combobox__item--selected' : ''}`}
              onClick={() => applyValue(o.value)}
            >
              <span className="combobox__item-label">{o.label ?? o.value}</span>
              {o.hint && <span className="combobox__item-hint">{o.hint}</span>}
            </li>
          ))}
          {query && !filtered.some((o) => o.value === query) && (
            <li className="combobox__item combobox__item--custom" onClick={() => applyValue(query.trim())}>
              <span className="combobox__item-label">使用自訂值：<strong>{query}</strong></span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default ComboBox;
