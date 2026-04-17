/**
 * ResourceEditor — 資源(Agent/Command/Skill/OutputStyle)統一編輯器
 *
 * 分割式表單:上方由 fields prop 驅動的 frontmatter 欄位,下方 body textarea。
 * 由各 Tab 負責將 frontmatter data + body 序列化後寫檔。
 */
import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import './ResourceEditor.css';

export type FieldKind = 'text' | 'textarea' | 'tags' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  helpText?: string;
}

export interface ResourceEditorProps {
  title: string;
  fields: FieldDef[];
  initialData: Record<string, string | string[]>;
  initialBody: string;
  onSave: (data: Record<string, string | string[]>, body: string) => Promise<void>;
  onCancel: () => void;
  extraHeader?: React.ReactNode;
}

const ResourceEditor: React.FC<ResourceEditorProps> = ({
  title,
  fields,
  initialData,
  initialBody,
  onSave,
  onCancel,
  extraHeader,
}) => {
  const [data, setData] = useState<Record<string, string | string[]>>(initialData);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(initialData);
    setBody(initialBody);
    setError(null);
  }, [initialData, initialBody]);

  const updateField = (key: string, value: string | string[]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    for (const f of fields) {
      if (f.required) {
        const v = data[f.key];
        const empty = !v
          || (Array.isArray(v) && v.length === 0)
          || (typeof v === 'string' && !v.trim());
        if (empty) {
          setError(`必填欄位缺失:${f.label}`);
          return;
        }
      }
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(data, body);
    } catch (e) {
      setError((e as Error).message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="resource-editor">
      <header className="resource-editor__header">
        <h3>{title}</h3>
        <div className="resource-editor__actions">
          <button className="btn-secondary" onClick={onCancel} disabled={saving}>
            <X size={14} /> 取消
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </header>

      {extraHeader && <div className="resource-editor__extra">{extraHeader}</div>}

      <section className="resource-editor__fields">
        {fields.map((f) => (
          <FieldRow
            key={f.key}
            field={f}
            value={data[f.key]}
            onChange={(v) => updateField(f.key, v)}
          />
        ))}
      </section>

      <section className="resource-editor__body-section">
        <label className="resource-editor__body-label">內容(body)</label>
        <textarea
          className="resource-editor__body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="在此撰寫 Markdown 內容(frontmatter 以外的部分)..."
          spellCheck={false}
        />
      </section>

      {error && <div className="resource-editor__error">⚠ {error}</div>}
    </div>
  );
};

const FieldRow: React.FC<{
  field: FieldDef;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}> = ({ field, value, onChange }) => {
  const id = `fld-${field.key}`;
  return (
    <div className="field-row">
      <label htmlFor={id} className="field-row__label">
        {field.label}
        {field.required && <span className="field-row__required">*</span>}
      </label>
      {field.kind === 'text' && (
        <input
          id={id}
          className="field-row__input"
          type="text"
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.kind === 'textarea' && (
        <textarea
          id={id}
          className="field-row__textarea"
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.kind === 'tags' && (
        <input
          id={id}
          className="field-row__input"
          type="text"
          value={Array.isArray(value) ? value.join(', ') : (value ?? '')}
          placeholder={field.placeholder ?? '用逗號分隔,例如: Read, Edit, Bash'}
          onChange={(e) =>
            onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
          }
        />
      )}
      {field.kind === 'select' && (
        <select
          id={id}
          className="field-row__input"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">(不指定)</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {field.helpText && <div className="field-row__help">{field.helpText}</div>}
    </div>
  );
};

export default ResourceEditor;
