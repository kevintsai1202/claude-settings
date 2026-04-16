/**
 * JsonEditor Tab — JSON 原始檢視 / 編輯器
 * 支援即時語法驗證，錯誤位置直接在內文中以紅色標示
 * Hover 紅色字元可浮出錯誤原因 tooltip；點擊會把游標定位到該處
 */
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import { validateFull, validateJson, validateSettings } from '../../utils/validate';
import type { SettingsLayer, ClaudeSettings } from '../../types/settings';
import './TabContent.css';

const LAYERS: { value: SettingsLayer; label: string }[] = [
  { value: 'user',    label: 'User Settings' },
  { value: 'project', label: 'Project Settings' },
  { value: 'local',   label: 'Local Settings' },
];

/** 標記類型：語法錯誤 or schema 錯誤 */
type MarkKind = 'syntax' | 'schema';

/** 單一錯誤標記 */
interface ErrorMark {
  start: number;
  end: number;
  kind: MarkKind;
  message: string;
}

/** 從 JSON.parse 的錯誤訊息抽出錯誤位置（char offset） */
const extractSyntaxError = (raw: string): { pos: number | null; message: string } => {
  try {
    JSON.parse(raw);
    return { pos: null, message: '' };
  } catch (err) {
    const message = (err as Error).message;
    // V8 格式："... at position 15"
    const m1 = message.match(/at position (\d+)/);
    if (m1) return { pos: parseInt(m1[1], 10), message };
    // fallback：line/column 格式
    const m2 = message.match(/line (\d+) column (\d+)/);
    if (m2) {
      const line = parseInt(m2[1], 10);
      const col  = parseInt(m2[2], 10);
      const lines = raw.split(/\r?\n/);
      let offset = 0;
      for (let i = 0; i < line - 1 && i < lines.length; i++) {
        offset += lines[i].length + 1;
      }
      return { pos: offset + col - 1, message };
    }
    return { pos: null, message };
  }
};

/** 從 schema 錯誤的 instancePath 推算原文中對應 key 的位置 */
const findKeyPositionInJson = (raw: string, key: string): [number, number] | null => {
  if (!key || /^\d+$/.test(key)) return null; // 陣列 index 不處理
  const needle = `"${key}"`;
  const idx = raw.indexOf(needle);
  if (idx < 0) return null;
  return [idx, idx + needle.length];
};

const JsonEditor: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile, commitLayer } = useFileManager();

  const [selectedLayer, setSelectedLayer] = useState<SettingsLayer>('user');
  const [rawText, setRawText]             = useState('');
  const [isDirty, setIsDirty]             = useState(false);

  /** Tooltip 顯示狀態 —— 含錯誤訊息、類型、滑鼠位置 */
  const [hovered, setHovered] = useState<{
    message: string;
    kind: MarkKind;
    x: number;
    y: number;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef      = useRef<HTMLPreElement>(null);

  // 切換層或 store 更新時，同步 rawText
  useEffect(() => {
    const raw = files[selectedLayer].raw;
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
  const syntaxResult = validateJson(rawText);
  const { pos: syntaxErrorPos, message: syntaxErrorMsg } = !syntaxResult.valid
    ? extractSyntaxError(rawText)
    : { pos: null, message: '' };

  /** 收集所有錯誤標記（語法 + schema）含訊息 */
  const marks: ErrorMark[] = (() => {
    const result: ErrorMark[] = [];

    if (syntaxErrorPos !== null) {
      result.push({
        start: syntaxErrorPos,
        end: syntaxErrorPos + 1,
        kind: 'syntax',
        message: syntaxErrorMsg || 'JSON 語法錯誤',
      });
    }

    // schema 錯誤（只在語法 OK 時才檢查）
    if (syntaxResult.valid) {
      try {
        const data = JSON.parse(rawText);
        const res = validateSettings(data);
        if (!res.valid) {
          for (const msg of res.errors) {
            const keyMatch = msg.match(/"([^"]+)"/);
            if (!keyMatch) continue;
            const range = findKeyPositionInJson(rawText, keyMatch[1]);
            if (!range) continue;
            result.push({
              start: range[0],
              end: range[1],
              kind: 'schema',
              message: msg,
            });
          }
        }
      } catch {
        /* 忽略 */
      }
    }

    result.sort((a, b) => a.start - b.start);
    return result;
  })();

  /** 同步 textarea 的 scroll 位置到 overlay pre */
  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  /** 處理錯誤 span 的 hover：顯示 tooltip */
  const handleMarkMouseEnter = (mark: ErrorMark, e: React.MouseEvent) => {
    setHovered({ message: mark.message, kind: mark.kind, x: e.clientX, y: e.clientY });
  };
  const handleMarkMouseMove = (e: React.MouseEvent) => {
    setHovered((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : null));
  };
  const handleMarkMouseLeave = () => setHovered(null);

  /** 點擊紅字 → 把游標移到錯誤位置並聚焦 textarea，保持可編輯體驗 */
  const handleMarkClick = (mark: ErrorMark, e: React.MouseEvent) => {
    e.preventDefault();
    const tx = textareaRef.current;
    if (!tx) return;
    tx.focus();
    tx.setSelectionRange(mark.start, mark.start);
  };

  /** 依錯誤位置把 rawText 切成 React nodes，錯誤字元套紅色樣式 */
  const renderHighlighted = (): React.ReactNode => {
    if (marks.length === 0) {
      return rawText + '\n'; // 結尾加換行確保最後一行可見
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    marks.forEach((mark, i) => {
      if (mark.start < cursor) return; // 跳過重疊
      if (mark.start > cursor) nodes.push(rawText.slice(cursor, mark.start));
      const text = rawText.slice(mark.start, mark.end) || ' ';
      nodes.push(
        <span
          key={i}
          className={`json-err json-err--${mark.kind}`}
          onMouseEnter={(e) => handleMarkMouseEnter(mark, e)}
          onMouseMove={handleMarkMouseMove}
          onMouseLeave={handleMarkMouseLeave}
          onMouseDown={(e) => handleMarkClick(mark, e)}
        >
          {text}
        </span>
      );
      cursor = mark.end;
    });
    if (cursor < rawText.length) nodes.push(rawText.slice(cursor));
    nodes.push('\n');
    return nodes;
  };

  /** 儲存當前編輯的 JSON（draft → commit）*/
  const handleSave = async () => {
    if (!validation.valid) return;
    const data = JSON.parse(rawText) as ClaudeSettings;
    // 先更新 draft 再 commit 該層 —— 這樣才會寫到磁碟
    await saveFile(selectedLayer, files[selectedLayer].path, data);
    await commitLayer(selectedLayer);
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

        <span
          className={`json-editor__status json-editor__status--${validation.valid ? 'ok' : 'error'}`}
        >
          {validation.valid
            ? '✅ 有效 JSON'
            : `❌ ${validation.errors.length} 個錯誤（滑鼠移至紅字查看原因）`}
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

      {/* 編輯器容器：overlay pre + textarea */}
      <div className="json-editor__editor">
        {/* Highlight overlay */}
        <pre
          ref={preRef}
          className="json-editor__highlight glass-card"
          aria-hidden="true"
        >
          {renderHighlighted()}
        </pre>

        {/* 透明 textarea —— 實際輸入層 */}
        <textarea
          ref={textareaRef}
          className="json-editor__textarea json-editor__textarea--overlay"
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setIsDirty(true); }}
          onScroll={handleScroll}
          spellCheck={false}
        />
      </div>

      {/* 錯誤 tooltip —— 跟隨滑鼠顯示 */}
      {hovered && (
        <div
          className={`json-err__tooltip json-err__tooltip--${hovered.kind}`}
          style={{
            left: Math.min(hovered.x + 14, window.innerWidth - 420),
            top:  hovered.y + 18,
          }}
          role="tooltip"
        >
          <div className="json-err__tooltip-kind">
            {hovered.kind === 'syntax' ? '⚠ 語法錯誤' : '⚠ Schema 錯誤'}
          </div>
          <div className="json-err__tooltip-msg">{hovered.message}</div>
        </div>
      )}
    </div>
  );
};

export default JsonEditor;
