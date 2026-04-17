# Resource Editing & CLAUDE.md Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 Agents/Commands/Skills/OutputStyles 四個 Tab 從唯讀瀏覽升級為可新建/編輯/刪除 Markdown 檔案(A);並為 CLAUDE.md 編輯器加上 `@path/to/file` 引用點擊跳轉與字數/token 警告(B)。

**Architecture:** 採「分割式編輯表單」(上:frontmatter 欄位表單;下:body textarea),搭配直接寫盤策略(第一版暫不引入資源類 Draft Mode,保持架構最小)。新建刪除透過 `@tauri-apps/plugin-fs` 操作,Skills 為資料夾結構特例處理。CLAUDE.md 增強採「右側預覽面板 + Header 統計條」模式,不更動既有 textarea 編輯 UX。

**Tech Stack:** Tauri v2 + React 19 + TypeScript 5(strict) + Zustand 5 + `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog`。本專案無測試框架,驗證方式為 `npm run build` 型別檢查 + 手動 UI 操作。

**Verification Strategy:** 因專案未配置 Vitest/Jest,每個 task 使用:
1. `npm run build`(TypeScript 嚴格模式編譯 + Vite 打包,0 錯誤為通過)
2. `npm run tauri dev`(啟動應用手動驗證 UI 行為)
3. 明確的手動步驟清單(含預期結果)

---

## 任務總覽

| Phase | 任務數 | 說明 |
|-------|--------|------|
| 1. 基礎建設 | 3 | frontmatter stringify util、Tauri 權限、useFileManager 檔案操作 API |
| 2. AgentsTab 可編輯(驗證架構) | 2 | ResourceEditor 共用元件、AgentsTab 整合 |
| 3. 複製到 Commands/Skills/OutputStyles | 4 | 三個 Tab 套用相同 pattern + QoL 收斂 |
| 4. CLAUDE.md `@path` 跳轉 | 2 | 引用解析 util、右側預覽面板 |
| 5. CLAUDE.md 字數/token 警告 | 2 | token 估算 util、Header 統計顯示 |
| 收尾 | 1 | 端到端手動回歸 |

**總計 14 個 task,每個 2-5 分鐘步驟,預估完整實作 2-3 小時 + 手動驗證 30-60 分鐘。**

---

## Phase 1: 基礎建設

### Task 1: Frontmatter Stringify Util

**Goal:** 為 `src/utils/frontmatter.ts` 新增反向序列化函數 `stringifyFrontmatter()`,支援將 `data + body` 轉回完整 Markdown(含 `---` 邊界)。

**Files:**
- Modify: `src/utils/frontmatter.ts`(追加 export 函數,保留現有 `parseFrontmatter` 不動)

- [ ] **Step 1: 在 `frontmatter.ts` 檔案底部新增序列化函數**

貼上以下程式碼到 `src/utils/frontmatter.ts` 結尾:

```typescript
/**
 * 將 frontmatter data 序列化為 YAML 區塊 + body
 * 對應 parseFrontmatter() 的反向操作。
 * - string 值在含特殊字元(: # 或首尾空白)時自動加雙引號
 * - string[] 輸出成 [a, b, c] 格式
 * - 若 data 為空物件,則不輸出 frontmatter 區塊(僅回傳 body)
 */
export function stringifyFrontmatter(
  data: Record<string, string | string[] | undefined>,
  body: string,
): string {
  const entries = Object.entries(data).filter(
    ([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
  );

  if (entries.length === 0) {
    return body.startsWith('\n') ? body.slice(1) : body;
  }

  const yamlLines = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      const items = value.map((v) => quoteIfNeeded(v)).join(', ');
      return `${key}: [${items}]`;
    }
    return `${key}: ${quoteIfNeeded(value as string)}`;
  });

  const yamlBlock = yamlLines.join('\n');
  const bodyPart = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${yamlBlock}\n---${bodyPart}`;
}

/** 判斷是否需要加引號(含冒號、井號、或首尾空白) */
function quoteIfNeeded(value: string): string {
  if (/[:#]|^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}
```

- [ ] **Step 2: 對稱性檢查(透過 TypeScript 編譯)**

```bash
npm run build
```

預期:TypeScript 0 錯誤,Vite 正常打包完成。

- [ ] **Step 3: 手動 round-trip 驗證(暫時在 dev console 測試)**

啟動 `npm run tauri dev`,開啟 DevTools console 執行:

```javascript
import('/src/utils/frontmatter.ts').then(m => {
  const { data, body } = m.parseFrontmatter('---\nname: test\ntools: [Read, Edit]\n---\n\nBody text here');
  const out = m.stringifyFrontmatter(data, body);
  const round = m.parseFrontmatter(out);
  console.log({ original: { data, body }, serialized: out, roundtrip: round });
});
```

預期:`original.data` 與 `roundtrip.data` 深度相等;`original.body` 與 `roundtrip.body` 相等。

- [ ] **Step 4: Commit**

```bash
git add src/utils/frontmatter.ts
git commit -m "feat(utils): add stringifyFrontmatter for round-trip serialization"
```

---

### Task 2: Tauri FS 權限 — 開放 remove 能力

**Goal:** 在 `src-tauri/capabilities/default.json` 新增 `fs:allow-remove` 權限,讓前端可刪除 `.md` 檔與 skill 資料夾。

**Files:**
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: 新增 remove 權限**

把 `src-tauri/capabilities/default.json` 內容改為以下(僅在 `fs:allow-mkdir` 後新增一行):

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "fs:allow-read-dir",
    "fs:allow-mkdir",
    "fs:allow-remove",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$HOME/**" },
        { "path": "C:/**" },
        { "path": "D:/**" },
        { "path": "E:/**" },
        { "path": "/Users/**" },
        { "path": "/Applications/**" },
        { "path": "/Library/**" },
        { "path": "/etc/**" },
        { "path": "/opt/**" },
        { "path": "/usr/local/**" }
      ]
    },
    "dialog:default",
    "dialog:allow-open"
  ]
}
```

> 註:`fs:allow-remove` 涵蓋 `remove()` API,搭配 `{ recursive: true }` 選項可刪除資料夾。若 Tauri v2 命名不同,請查 `src-tauri/gen/schemas/desktop-schema.json` 中 fs 區塊實際可用識別並調整。

- [ ] **Step 2: 重啟 tauri dev 確認權限生效**

停掉現行 dev,重新執行:

```bash
npm run tauri dev
```

預期:視窗正常開啟,無 capability 錯誤 log。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/capabilities/default.json
git commit -m "chore(tauri): allow fs:remove for resource deletion"
```

---

### Task 3: useFileManager 新增資源檔案操作 API

**Goal:** 在 `src/hooks/useFileManager.ts` 中新增 `createResourceFile / updateResourceFile / deleteResourceFile / deleteResourceDir / ensureDir` 五個方法。

**Files:**
- Modify: `src/hooks/useFileManager.ts`

- [ ] **Step 1: 用 Read 開啟檔案,記錄末尾 `return { ... }` 的結構**

目的:確認 hook 內現有 method 命名風格與回傳物件格式,方便追加。

- [ ] **Step 2: 在檔案頂部匯入 remove API**

找到 `import { ... } from '@tauri-apps/plugin-fs'` 行,加入 `remove`:

```typescript
import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
  remove,
} from '@tauri-apps/plugin-fs';
```

保留其他既有匯入,僅追加 `remove`。

- [ ] **Step 3: 在 hook body 內新增五個 method**

於其他 method 附近插入:

```typescript
/** 確保資料夾存在(遞迴建立) */
const ensureDir = async (dirPath: string): Promise<void> => {
  const normalized = resolvePath(dirPath);
  if (!(await exists(normalized))) {
    await mkdir(normalized, { recursive: true });
  }
};

/**
 * 建立新資源檔案:若檔案已存在則擲出 Error。
 * 寫入前會先 ensureDir(該檔案的 parent)。
 */
const createResourceFile = async (filePath: string, content: string): Promise<void> => {
  const normalized = resolvePath(filePath);
  if (await exists(normalized)) {
    throw new Error(`檔案已存在:${filePath}`);
  }
  const parent = normalized.replace(/\/[^/]+$/, '');
  if (parent) await ensureDir(parent);
  await writeTextFile(normalized, content);
};

/** 更新現有資源檔案內容(無檔案時擲出 Error) */
const updateResourceFile = async (filePath: string, content: string): Promise<void> => {
  const normalized = resolvePath(filePath);
  if (!(await exists(normalized))) {
    throw new Error(`檔案不存在:${filePath}`);
  }
  await writeTextFile(normalized, content);
};

/** 刪除資源檔案(不存在時 no-op) */
const deleteResourceFile = async (filePath: string): Promise<void> => {
  const normalized = resolvePath(filePath);
  if (await exists(normalized)) {
    await remove(normalized);
  }
};

/** 刪除資源資料夾(遞迴;不存在時 no-op)。供 Skills 刪除整個資料夾使用。 */
const deleteResourceDir = async (dirPath: string): Promise<void> => {
  const normalized = resolvePath(dirPath);
  if (await exists(normalized)) {
    await remove(normalized, { recursive: true });
  }
};
```

> `resolvePath()` 是本檔案既有 helper(展開 `%USERPROFILE%`、正斜線正規化),若命名略有差異以實際檔案為準。

- [ ] **Step 4: 將新方法加入 return**

在 `return { ... }` 加入:

```typescript
return {
  // ... 既有 loadFile / saveFile / commitAll ... 等等保留
  ensureDir,
  createResourceFile,
  updateResourceFile,
  deleteResourceFile,
  deleteResourceDir,
};
```

- [ ] **Step 5: 型別編譯檢查**

```bash
npm run build
```

預期:TypeScript 0 錯誤。

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFileManager.ts
git commit -m "feat(hooks): add createResource/updateResource/deleteResource APIs to useFileManager"
```

---

## Phase 2: AgentsTab 可編輯(驗證架構)

### Task 4: 建立 `ResourceEditor` 共用元件(分割式表單)

**Goal:** 建立一個可重用的分割式編輯器元件,供四個資源 Tab 共用。上半為 frontmatter 欄位表單,下半為 body textarea。

**Files:**
- Create: `src/components/tabs/editors/ResourceEditor.tsx`
- Create: `src/components/tabs/editors/ResourceEditor.css`

- [ ] **Step 1: 建立編輯器元件**

寫入 `src/components/tabs/editors/ResourceEditor.tsx`:

```tsx
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
  key: string;                      // frontmatter key
  label: string;                    // UI 顯示
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  options?: string[];               // 僅 kind='select' 使用
  helpText?: string;
}

export interface ResourceEditorProps {
  title: string;
  fields: FieldDef[];
  initialData: Record<string, string | string[]>;
  initialBody: string;
  onSave: (data: Record<string, string | string[]>, body: string) => Promise<void>;
  onCancel: () => void;
  /** 額外 header 區(如 Command 需要「檔名」輸入) */
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
          <button className="btn btn--ghost" onClick={onCancel} disabled={saving}>
            <X size={14} /> 取消
          </button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
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
```

- [ ] **Step 2: 建立編輯器 CSS**

寫入 `src/components/tabs/editors/ResourceEditor.css`:

```css
.resource-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

.resource-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 10px;
}

.resource-editor__header h3 { margin: 0; font-size: 1.05rem; }
.resource-editor__actions { display: flex; gap: 8px; }

.resource-editor__extra {
  border: 1px dashed var(--border-color);
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--bg-subtle);
}

.resource-editor__fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 50%;
  overflow-y: auto;
}

.resource-editor__body-section {
  flex: 1;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resource-editor__body-label { font-size: 0.85rem; color: var(--text-muted); }

.resource-editor__body {
  flex: 1;
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 0.85rem;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-color);
  resize: none;
}

.resource-editor__error {
  color: #d32f2f;
  font-size: 0.85rem;
  padding: 6px 10px;
  background: rgba(211, 47, 47, 0.08);
  border-radius: 4px;
}

.field-row { display: flex; flex-direction: column; gap: 3px; }
.field-row__label { font-size: 0.85rem; font-weight: 500; }
.field-row__required { color: #d32f2f; margin-left: 2px; }

.field-row__input,
.field-row__textarea {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-color);
  font-size: 0.9rem;
}

.field-row__textarea {
  min-height: 50px;
  resize: vertical;
  font-family: inherit;
}

.field-row__help {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}
```

- [ ] **Step 3: 型別檢查**

```bash
npm run build
```

> 若 CSS 變數(`--border-color` / `--bg-subtle` / `--bg-input` / `--text-muted` / `--text-color`)在專案未定義,查 `src/index.css` 或 `App.css` 的對應變數改用既有名稱。

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/editors/
git commit -m "feat(ui): add ResourceEditor shared component for frontmatter + body editing"
```

---

### Task 5: AgentsTab 整合 ResourceEditor — 新建/編輯/刪除

**Goal:** 在 `src/components/tabs/AgentsTab.tsx` 加入「新建」「編輯」「刪除」按鈕,點擊後顯示 `ResourceEditor`,儲存時序列化 + 寫檔 + reload。

**Files:**
- Modify: `src/components/tabs/AgentsTab.tsx`

- [ ] **Step 1: 新增 import 與 state**

於檔案頂部 import 區:

```tsx
import { Plus, Trash2, Pencil } from 'lucide-react';
import { homeDir } from '@tauri-apps/api/path';
import ResourceEditor, { type FieldDef } from './editors/ResourceEditor';
import { stringifyFrontmatter } from '../../utils/frontmatter';
import { useFileManager } from '../../hooks/useFileManager';
```

於元件 body 現有 `useState` 附近新增:

```tsx
type EditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; agentId: string };

const [mode, setMode] = useState<EditorMode>({ kind: 'idle' });
const { createResourceFile, updateResourceFile, deleteResourceFile } = useFileManager();
```

- [ ] **Step 2: 在元件檔頂部定義 Agent frontmatter 欄位**

```tsx
const AGENT_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: '名稱(name)',
    kind: 'text',
    required: true,
    placeholder: '例如:code-reviewer',
    helpText: '此值會同時作為檔名(小寫連字號)使用',
  },
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
    placeholder: '何時應啟用此 Agent 的說明',
  },
  {
    key: 'tools',
    label: '工具(tools)',
    kind: 'tags',
    placeholder: '例如:Read, Edit, Bash, Grep',
    helpText: '留空代表繼承所有工具',
  },
  {
    key: 'model',
    label: '模型(model)',
    kind: 'select',
    options: ['opus', 'sonnet', 'haiku', 'inherit'],
    helpText: '留空代表繼承主 session 模型',
  },
];
```

- [ ] **Step 3: 實作三個 handler**

```tsx
const resolveAgentDir = async (scope: 'user' | 'project'): Promise<string> => {
  if (scope === 'project') {
    if (!projectDir) throw new Error('尚未選擇專案目錄');
    return `${projectDir}/.claude/agents`;
  }
  const home = await homeDir();
  return `${home.replace(/\\/g, '/')}.claude/agents`;
};

const handleSaveAgent = async (
  data: Record<string, string | string[]>,
  body: string,
) => {
  if (mode.kind === 'idle') return;
  const name = (data.name as string).trim();
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('name 僅允許小寫英文、數字與連字號(-)');
  }
  const content = stringifyFrontmatter(data, body);
  if (mode.kind === 'create') {
    const dir = await resolveAgentDir(mode.scope);
    await createResourceFile(`${dir}/${name}.md`, content);
  } else {
    const target = agents.find((a) => a.id === mode.agentId);
    if (!target) throw new Error('找不到目標 Agent');
    const dir = target.path.replace(/\/[^/]+$/, '');
    const newPath = `${dir}/${name}.md`;
    if (newPath !== target.path) {
      await createResourceFile(newPath, content);
      await deleteResourceFile(target.path);
    } else {
      await updateResourceFile(target.path, content);
    }
  }
  await loadAgents();
  setMode({ kind: 'idle' });
};

const handleDeleteAgent = async (agentId: string) => {
  const target = agents.find((a) => a.id === agentId);
  if (!target) return;
  const ok = window.confirm(
    `確定要刪除 Agent「${target.name}」嗎?\n路徑:${target.path}\n此操作不可復原。`,
  );
  if (!ok) return;
  await deleteResourceFile(target.path);
  await loadAgents();
  if (selectedId === agentId) setSelectedId(null);
};
```

- [ ] **Step 4: 在工具列新增「新建」按鈕**

於現有工具列 JSX(搜尋框/scope 過濾旁邊)加入:

```tsx
<button
  className="btn btn--primary"
  onClick={() => setMode({ kind: 'create', scope: scope === 'project' ? 'project' : 'user' })}
  title="新建 Agent"
>
  <Plus size={14} /> 新建
</button>
```

- [ ] **Step 5: 依 mode 條件渲染右側區域**

找到目前 `.resource-detail` JSX,整段改成:

```tsx
<div className="resource-detail">
  {mode.kind === 'idle' && selected && (
    <>
      <div className="resource-detail__toolbar">
        <button
          className="btn btn--ghost"
          onClick={() => setMode({ kind: 'edit', agentId: selected.id })}
        >
          <Pencil size={14} /> 編輯
        </button>
        <button
          className="btn btn--danger"
          onClick={() => handleDeleteAgent(selected.id)}
        >
          <Trash2 size={14} /> 刪除
        </button>
      </div>
      <h3>{selected.name}</h3>
      {/* 保留既有 description / path / tools / model / body 顯示 */}
    </>
  )}

  {mode.kind === 'create' && (
    <ResourceEditor
      title={`新建 Agent(${mode.scope === 'user' ? 'User' : 'Project'} 範圍)`}
      fields={AGENT_FIELDS}
      initialData={{ name: '', description: '', tools: [], model: '' }}
      initialBody=""
      onSave={handleSaveAgent}
      onCancel={() => setMode({ kind: 'idle' })}
    />
  )}

  {mode.kind === 'edit' && (() => {
    const target = agents.find((a) => a.id === mode.agentId);
    if (!target) return null;
    return (
      <ResourceEditor
        title={`編輯 Agent:${target.name}`}
        fields={AGENT_FIELDS}
        initialData={{
          name: target.name,
          description: target.description ?? '',
          tools: target.tools ?? [],
          model: target.model ?? '',
        }}
        initialBody={target.body}
        onSave={handleSaveAgent}
        onCancel={() => setMode({ kind: 'idle' })}
      />
    );
  })()}
</div>
```

- [ ] **Step 6: 新增 toolbar 樣式(若 ResourceTab.css 未有)**

於 `src/components/tabs/ResourceTab.css` 結尾新增:

```css
.resource-detail__toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}
```

- [ ] **Step 7: 型別檢查**

```bash
npm run build
```

- [ ] **Step 8: 手動驗證「新建 Agent」**

1. `npm run tauri dev`
2. 切到 Agents,點「新建」
3. 填寫 `name = test-agent-demo`、`description = Demo agent`、`tools = Read, Edit`、`model = sonnet`
4. Body 輸入 `# Test Agent\n\nHello`
5. 點「儲存」
6. 預期 `~/.claude/agents/test-agent-demo.md` 存在並內容正確。

- [ ] **Step 9: 手動驗證「編輯」與「刪除」**

- 選取 `test-agent-demo` → 編輯 description → 儲存 → 列表同步更新
- 選取 → 刪除 → 確認框按確定 → 列表與檔案同步移除

- [ ] **Step 10: Commit**

```bash
git add src/components/tabs/AgentsTab.tsx src/components/tabs/ResourceTab.css
git commit -m "feat(agents): add create/edit/delete UI for Agents resource"
```

---

## Phase 3: 複製到 Commands / Skills / OutputStyles

### Task 6: CommandsTab 整合 ResourceEditor

**Goal:** 為 Commands Tab 加入新建/編輯/刪除,pattern 同 Task 5,差異在欄位定義與「檔名不是 frontmatter 欄位」。

**Files:**
- Modify: `src/components/tabs/CommandsTab.tsx`

- [ ] **Step 1: 定義 Command frontmatter 欄位**

```tsx
const COMMAND_FIELDS: FieldDef[] = [
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
    placeholder: '此 slash command 的用途說明',
  },
  {
    key: 'argument-hint',
    label: '參數提示(argument-hint)',
    kind: 'text',
    placeholder: '例如:<file-path> [--verbose]',
    helpText: 'Claude Code 自動補完時顯示的參數格式',
  },
  {
    key: 'allowed-tools',
    label: '允許工具(allowed-tools)',
    kind: 'tags',
    placeholder: '例如:Read, Grep, Bash',
  },
  {
    key: 'model',
    label: '模型(model)',
    kind: 'select',
    options: ['opus', 'sonnet', 'haiku', 'inherit'],
  },
];
```

- [ ] **Step 2: 新增 state(含獨立 `newCommandName` 儲存檔名)**

```tsx
type CmdEditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; commandId: string };

const [mode, setMode] = useState<CmdEditorMode>({ kind: 'idle' });
const [newCommandName, setNewCommandName] = useState('');
const { createResourceFile, updateResourceFile, deleteResourceFile } = useFileManager();
```

- [ ] **Step 3: 實作 handler**

```tsx
const resolveCommandDir = async (scope: 'user' | 'project') => {
  if (scope === 'project') {
    if (!projectDir) throw new Error('尚未選擇專案目錄');
    return `${projectDir}/.claude/commands`;
  }
  const home = await homeDir();
  return `${home.replace(/\\/g, '/')}.claude/commands`;
};

const handleSaveCommand = async (
  data: Record<string, string | string[]>,
  body: string,
) => {
  if (mode.kind === 'idle') return;
  const content = stringifyFrontmatter(data, body);
  if (mode.kind === 'create') {
    if (!/^[a-z0-9-]+$/.test(newCommandName)) {
      throw new Error('Command 名稱僅允許小寫英文、數字與連字號(-)');
    }
    const dir = await resolveCommandDir(mode.scope);
    await createResourceFile(`${dir}/${newCommandName}.md`, content);
  } else {
    const target = commands.find((c) => c.id === mode.commandId);
    if (!target) throw new Error('找不到目標 Command');
    await updateResourceFile(target.path, content);
  }
  await loadCommands();
  setMode({ kind: 'idle' });
  setNewCommandName('');
};

const handleDeleteCommand = async (commandId: string) => {
  const target = commands.find((c) => c.id === commandId);
  if (!target) return;
  const ok = window.confirm(
    `確定要刪除 Command「/${target.name}」嗎?\n路徑:${target.path}`,
  );
  if (!ok) return;
  await deleteResourceFile(target.path);
  await loadCommands();
  if (selectedId === commandId) setSelectedId(null);
};
```

- [ ] **Step 4: 工具列與詳情區 UI(同 Task 5 Step 4-5,替換變數名即可)**

新建模式傳入 `extraHeader`:

```tsx
extraHeader={
  <div className="field-row">
    <label className="field-row__label">
      指令名稱(檔名)<span className="field-row__required">*</span>
    </label>
    <input
      className="field-row__input"
      type="text"
      value={newCommandName}
      placeholder="例如:commit-push-pr"
      onChange={(e) => setNewCommandName(e.target.value)}
    />
    <div className="field-row__help">
      儲存後可透過 /{newCommandName || 'xxx'} 呼叫
    </div>
  </div>
}
```

編輯模式不需 extraHeader(檔名不可改)。

- [ ] **Step 5: 型別檢查 + 手動驗證**

```bash
npm run build
npm run tauri dev
```

流程:新建 `test-cmd` → 編輯描述 → 刪除,三操作成功且列表即時更新。

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/CommandsTab.tsx
git commit -m "feat(commands): add create/edit/delete UI for Commands resource"
```

---

### Task 7: OutputStylesTab 整合(保護 builtin)

**Goal:** 增加 OutputStyles 編輯能力;builtin 3 款不可編輯/刪除(scope === 'builtin')。

**Files:**
- Modify: `src/components/tabs/OutputStylesTab.tsx`

- [ ] **Step 1: 定義欄位**

```tsx
const OUTPUT_STYLE_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: '名稱(name)',
    kind: 'text',
    required: true,
    placeholder: '例如:concise-mode',
    helpText: '此值會同時作為檔名使用',
  },
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
  },
];
```

- [ ] **Step 2: Handler 實作**

```tsx
type StyleEditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; styleId: string };

const [mode, setMode] = useState<StyleEditorMode>({ kind: 'idle' });
const { createResourceFile, updateResourceFile, deleteResourceFile } = useFileManager();

const resolveStyleDir = async (scope: 'user' | 'project') => {
  if (scope === 'project') {
    if (!projectDir) throw new Error('尚未選擇專案目錄');
    return `${projectDir}/.claude/output-styles`;
  }
  const home = await homeDir();
  return `${home.replace(/\\/g, '/')}.claude/output-styles`;
};

const handleSaveStyle = async (
  data: Record<string, string | string[]>,
  body: string,
) => {
  if (mode.kind === 'idle') return;
  const name = (data.name as string).trim();
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('name 僅允許小寫英文、數字與連字號(-)');
  }
  const content = stringifyFrontmatter(data, body);
  if (mode.kind === 'create') {
    const dir = await resolveStyleDir(mode.scope);
    await createResourceFile(`${dir}/${name}.md`, content);
  } else {
    const target = outputStyles.find((s) => s.id === mode.styleId);
    if (!target) throw new Error('找不到目標 OutputStyle');
    if (target.scope === 'builtin') throw new Error('內建 OutputStyle 不可編輯');
    const dir = target.path.replace(/\/[^/]+$/, '');
    const newPath = `${dir}/${name}.md`;
    if (newPath !== target.path) {
      await createResourceFile(newPath, content);
      await deleteResourceFile(target.path);
    } else {
      await updateResourceFile(target.path, content);
    }
  }
  await loadOutputStyles();
  setMode({ kind: 'idle' });
};

const handleDeleteStyle = async (styleId: string) => {
  const target = outputStyles.find((s) => s.id === styleId);
  if (!target) return;
  if (target.scope === 'builtin') {
    window.alert('內建 OutputStyle 不可刪除');
    return;
  }
  const ok = window.confirm(`確定要刪除 Output Style「${target.name}」嗎?`);
  if (!ok) return;
  await deleteResourceFile(target.path);
  await loadOutputStyles();
  if (selectedId === styleId) setSelectedId(null);
};
```

- [ ] **Step 3: UI 按鈕條件渲染**

```tsx
{selected && selected.scope !== 'builtin' && (
  <div className="resource-detail__toolbar">
    <button className="btn btn--ghost" onClick={() => setMode({ kind: 'edit', styleId: selected.id })}>
      <Pencil size={14} /> 編輯
    </button>
    <button className="btn btn--danger" onClick={() => handleDeleteStyle(selected.id)}>
      <Trash2 size={14} /> 刪除
    </button>
  </div>
)}
{selected && selected.scope === 'builtin' && (
  <div className="resource-detail__notice" style={{ opacity: 0.7, fontStyle: 'italic' }}>
    🔒 內建 Output Style 不可編輯。如需自訂請點「新建」。
  </div>
)}
```

(新建按鈕與 ResourceEditor 區塊同 Task 5 pattern)

- [ ] **Step 4: 型別檢查 + 手動驗證**

```bash
npm run build
npm run tauri dev
```

測試 builtin(無編輯按鈕)、user(可完整 CRUD)。

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/OutputStylesTab.tsx
git commit -m "feat(output-styles): add create/edit/delete UI (builtin protected)"
```

---

### Task 8: SkillsTab 整合(資料夾特例處理)

**Goal:** Skill 是 `~/.claude/skills/<name>/SKILL.md` 資料夾結構;新建需 mkdir + 寫 SKILL.md;刪除需遞迴刪資料夾;改名不支援(第一版提示手動)。

**Files:**
- Modify: `src/components/tabs/SkillsTab.tsx`

- [ ] **Step 1: 定義欄位**

```tsx
const SKILL_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: '名稱(name)',
    kind: 'text',
    required: true,
    placeholder: '與資料夾同名,例如:pdf-processing',
    helpText: '必須與資料夾名相同,第一版不支援改名',
  },
  {
    key: 'description',
    label: '描述(description)',
    kind: 'textarea',
    required: true,
    helpText: '用來觸發 skill 的語意描述,Claude 據此判斷何時載入',
  },
  {
    key: 'allowed-tools',
    label: '允許工具(allowed-tools)',
    kind: 'tags',
  },
];
```

- [ ] **Step 2: 取出新 hook 方法**

```tsx
const {
  ensureDir,
  createResourceFile,
  updateResourceFile,
  deleteResourceDir,
} = useFileManager();
```

- [ ] **Step 3: Handler**

```tsx
type SkillEditorMode =
  | { kind: 'idle' }
  | { kind: 'create'; scope: 'user' | 'project' }
  | { kind: 'edit'; skillId: string };

const [mode, setMode] = useState<SkillEditorMode>({ kind: 'idle' });

const resolveSkillDir = async (scope: 'user' | 'project', name: string) => {
  if (scope === 'project') {
    if (!projectDir) throw new Error('尚未選擇專案目錄');
    return `${projectDir}/.claude/skills/${name}`;
  }
  const home = await homeDir();
  return `${home.replace(/\\/g, '/')}.claude/skills/${name}`;
};

const handleSaveSkill = async (
  data: Record<string, string | string[]>,
  body: string,
) => {
  if (mode.kind === 'idle') return;
  const name = (data.name as string).trim();
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('name 僅允許小寫英文、數字與連字號(-)');
  }
  const content = stringifyFrontmatter(data, body);
  if (mode.kind === 'create') {
    const dir = await resolveSkillDir(mode.scope, name);
    await ensureDir(dir);
    await createResourceFile(`${dir}/SKILL.md`, content);
  } else {
    const target = skills.find((s) => s.id === mode.skillId);
    if (!target) throw new Error('找不到目標 Skill');
    if (name !== target.name) {
      throw new Error('Skill 名稱與資料夾綁定,若要改名請於檔案系統手動操作後重新載入');
    }
    await updateResourceFile(target.path, content);
  }
  await loadSkills();
  setMode({ kind: 'idle' });
};

const handleDeleteSkill = async (skillId: string) => {
  const target = skills.find((s) => s.id === skillId);
  if (!target) return;
  const ok = window.confirm(
    `確定要刪除 Skill「${target.name}」嗎?\n\n` +
    `此操作會遞迴刪除整個資料夾:\n${target.dir}\n\n` +
    `若資料夾內含 references/ 或 scripts/ 子資料夾將一併刪除,此操作不可復原。`,
  );
  if (!ok) return;
  await deleteResourceDir(target.dir);
  await loadSkills();
  if (selectedId === skillId) setSelectedId(null);
};
```

- [ ] **Step 4: UI(工具列按鈕 + 詳情 toolbar + ResourceEditor 條件渲染,同 Task 5 pattern)**

- [ ] **Step 5: 型別檢查 + 手動驗證**

```bash
npm run build
npm run tauri dev
```

1. 新建 skill `test-skill-xyz`,body 輸入 `# Test skill\n任意內容`
2. 驗證 `~/.claude/skills/test-skill-xyz/SKILL.md` 存在
3. 編輯 body,儲存,檔案更新
4. 刪除,確認整個資料夾消失

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/SkillsTab.tsx
git commit -m "feat(skills): add create/edit/delete UI with folder semantics"
```

---

### Task 9: selectedId 清理收斂(QoL)

**Goal:** 新建/刪除後若 selectedId 指向已不存在的資源,清空以避免空白詳情殘留。

**Files:**
- Modify: `src/components/tabs/AgentsTab.tsx`
- Modify: `src/components/tabs/CommandsTab.tsx`
- Modify: `src/components/tabs/SkillsTab.tsx`
- Modify: `src/components/tabs/OutputStylesTab.tsx`

- [ ] **Step 1: 每個 Tab 新增 effect**

以 AgentsTab 為例:

```tsx
useEffect(() => {
  if (selectedId && !agents.find((a) => a.id === selectedId)) {
    setSelectedId(null);
  }
}, [agents, selectedId]);
```

其他三個 Tab 將 `agents` 替換為 `commands` / `skills` / `outputStyles`。

- [ ] **Step 2: 型別檢查**

```bash
npm run build
```

- [ ] **Step 3: 手動煙霧測試**

快速新建 → 選取 → 刪除 → 確認右側詳情區清空,無 console error。

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/AgentsTab.tsx src/components/tabs/CommandsTab.tsx src/components/tabs/SkillsTab.tsx src/components/tabs/OutputStylesTab.tsx
git commit -m "fix(resources): clear selectedId when target resource removed"
```

---

## Phase 4: CLAUDE.md — `@path/to/file` 引用跳轉

### Task 10: 建立 `@path` 引用解析 util

**Goal:** 建立純函數 `parseClaudeMdImports(content, baseDir)`,掃描 CLAUDE.md 內容找出所有 `@path` 引用。

**Files:**
- Create: `src/utils/parseClaudeMdImports.ts`

- [ ] **Step 1: 寫入 util(使用 `matchAll` 迭代,無副作用)**

```typescript
/**
 * 解析 CLAUDE.md 內的 @path 引用語法
 * 官方規則:`@` 後接相對/絕對路徑(無空白),通常單行獨立出現
 * 範例:`@docs/spec.md`、`@/abs/path/note.md`、`@src/App.tsx`
 */

export interface ImportRef {
  /** 原始出現的字串(含 @) */
  raw: string;
  /** 不含 @ 的路徑 */
  ref: string;
  /** 展開後的絕對路徑(正斜線);以 ~ 開頭者保留 ~,由呼叫端處理 homeDir */
  absolute: string;
  /** 在原文中的 char offset */
  offset: number;
  /** 原始字串長度 */
  length: number;
}

/**
 * 匹配規則:
 *  - 起點:行首、空白、或 ( [ 等括號後
 *  - 結構:`@` + 非空白字元(含 / - . 等)
 *  - 終點:空白、行尾、或常見標點
 */
const IMPORT_RE = /(^|[\s([])@([^\s)\]<>"']+?)(?=[\s,;:.)\]<>"']|$)/gm;

export function parseClaudeMdImports(content: string, baseDir: string): ImportRef[] {
  const refs: ImportRef[] = [];
  const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/$/, '');

  for (const match of content.matchAll(IMPORT_RE)) {
    const [, prefix, pathPart] = match;
    const offset = (match.index ?? 0) + prefix.length;
    const raw = `@${pathPart}`;
    const absolute = resolveRefToAbsolute(pathPart, normalizedBase);
    refs.push({ raw, ref: pathPart, absolute, offset, length: raw.length });
  }
  return refs;
}

/** 將相對路徑相對 baseDir 展開為絕對路徑 */
function resolveRefToAbsolute(ref: string, baseDir: string): string {
  if (/^[a-zA-Z]:/.test(ref) || ref.startsWith('/')) {
    return ref.replace(/\\/g, '/');
  }
  if (ref.startsWith('~/')) return ref;        // 保留 ~,由呼叫端處理
  return `${baseDir}/${ref}`.replace(/\/+/g, '/');
}
```

- [ ] **Step 2: 型別檢查**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/parseClaudeMdImports.ts
git commit -m "feat(utils): add parseClaudeMdImports for @path reference detection"
```

---

### Task 11: ClaudeMd Tab 右側預覽面板 + `@path` 點擊跳轉

**Goal:** 左側編輯區保留,右側新增「引用預覽」:列出所有 `@path`,點擊讀取該檔前 200 行顯示。

**Files:**
- Modify: `src/components/tabs/ClaudeMd.tsx`
- Modify: `src/components/tabs/TabContent.css`

- [ ] **Step 1: 匯入依賴**

在 `ClaudeMd.tsx` 頂部:

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { readTextFile, exists } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { parseClaudeMdImports, type ImportRef } from '../../utils/parseClaudeMdImports';
import { FileText, ExternalLink } from 'lucide-react';
```

(保留現有 import,僅追加)

- [ ] **Step 2: 新增 state**

```tsx
const [selectedImport, setSelectedImport] = useState<ImportRef | null>(null);
const [previewContent, setPreviewContent] = useState<string>('');
const [previewError, setPreviewError] = useState<string | null>(null);
const { projectDir } = useAppStore();

const baseDir = useMemo(() => projectDir ?? '', [projectDir]);
const importRefs = useMemo(
  () => parseClaudeMdImports(content, baseDir),
  [content, baseDir],
);

useEffect(() => {
  // 切換 scope 時清空預覽
  setSelectedImport(null);
  setPreviewContent('');
  setPreviewError(null);
}, [activeScope]);
```

- [ ] **Step 3: 實作點擊讀檔 handler**

```tsx
const handleOpenImport = async (ref: ImportRef) => {
  setSelectedImport(ref);
  setPreviewError(null);
  try {
    let abs = ref.absolute;
    if (abs.startsWith('~/')) {
      const home = (await homeDir()).replace(/\\/g, '/');
      abs = `${home}${abs.slice(2)}`;
    }
    if (!(await exists(abs))) {
      setPreviewError(`檔案不存在:${abs}`);
      setPreviewContent('');
      return;
    }
    const text = await readTextFile(abs);
    const lines = text.split('\n');
    const truncated = lines.length > 200
      ? lines.slice(0, 200).join('\n') + `\n\n... (共 ${lines.length} 行,僅顯示前 200 行)`
      : text;
    setPreviewContent(truncated);
  } catch (e) {
    setPreviewError(`讀取錯誤:${(e as Error).message}`);
    setPreviewContent('');
  }
};
```

- [ ] **Step 4: 改寫 JSX 為左右兩欄**

把既有的 `<textarea className="md-textarea ... />` 包入左欄,右側新增預覽 aside:

```tsx
return (
  <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <h2 className="tab-title">📝 CLAUDE.md 編輯器</h2>

    {/* scope 切換按鈕(保留現有) */}
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

    {/* 主編輯區 — 左右兩欄 */}
    <div className="md-editor-layout">
      <div className="md-editor-pane">
        <textarea
          className="md-textarea glass-card"
          value={content}
          onChange={(e) => useAppStore.getState().updateClaudeMdDraft(activeScope, e.target.value)}
          placeholder={`在此輸入 ${SCOPE_LABELS[activeScope]} 的內容...`}
        />
      </div>

      <aside className="md-imports-pane">
        <header className="md-imports-header">
          <FileText size={14} /> 引用檔案
          <span className="md-imports-count">({importRefs.length})</span>
        </header>

        <ul className="md-imports-list">
          {importRefs.length === 0 && (
            <li className="md-imports-empty">尚無 @path 引用</li>
          )}
          {importRefs.map((r, i) => (
            <li
              key={`${r.offset}-${i}`}
              className={`md-imports-item ${selectedImport?.offset === r.offset ? 'md-imports-item--active' : ''}`}
              onClick={() => handleOpenImport(r)}
              title={r.absolute}
            >
              <ExternalLink size={12} /> {r.ref}
            </li>
          ))}
        </ul>

        {selectedImport && (
          <div className="md-imports-preview">
            <div className="md-imports-preview-header">📄 {selectedImport.ref}</div>
            {previewError ? (
              <div className="md-imports-preview-error">⚠ {previewError}</div>
            ) : (
              <pre className="md-imports-preview-body">{previewContent}</pre>
            )}
          </div>
        )}
      </aside>
    </div>

    {/* 按鈕列(保留原有 save/copy) */}
    <div className="md-actions">
      <button className="btn btn--primary" onClick={handleSave}>💾 儲存</button>
      <button className="btn btn--ghost" onClick={handleCopy}>📋 複製</button>
    </div>
  </div>
);
```

- [ ] **Step 5: 新增 CSS**

於 `src/components/tabs/TabContent.css` 最後新增:

```css
.md-editor-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 12px;
  min-height: 0;
}

.md-editor-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.md-imports-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 1px solid var(--border-color);
  padding-left: 12px;
  min-height: 0;
  overflow: hidden;
}

.md-imports-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.md-imports-count { color: var(--text-muted); font-weight: normal; }

.md-imports-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  max-height: 160px;
}

.md-imports-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  font-size: 0.8rem;
  cursor: pointer;
  border-radius: 3px;
  color: var(--text-color);
}

.md-imports-item:hover { background: var(--bg-subtle); }
.md-imports-item--active { background: var(--accent-color, #3b82f6); color: white; }

.md-imports-empty {
  padding: 8px;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-style: italic;
}

.md-imports-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.md-imports-preview-header {
  padding: 6px 8px;
  background: var(--bg-subtle);
  font-size: 0.8rem;
  border-bottom: 1px solid var(--border-color);
}

.md-imports-preview-body {
  flex: 1;
  overflow: auto;
  padding: 8px;
  margin: 0;
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  background: var(--bg-input);
}

.md-imports-preview-error {
  padding: 10px;
  color: #d32f2f;
  font-size: 0.85rem;
}
```

- [ ] **Step 6: 型別檢查 + 視覺驗證**

```bash
npm run build
npm run tauri dev
```

1. 切到 CLAUDE.md Tab
2. 在 body 輸入:
```
# Test
Check @src/App.tsx and @docs/spec.md
```
3. 右側列出 2 個引用
4. 點 `@src/App.tsx` → 預覽前 200 行
5. 點 `@docs/spec.md`(不存在)→ 錯誤訊息

- [ ] **Step 7: Commit**

```bash
git add src/components/tabs/ClaudeMd.tsx src/components/tabs/TabContent.css
git commit -m "feat(claudemd): add @path reference detection and preview pane"
```

---

## Phase 5: CLAUDE.md — 字數/token 警告

### Task 12: 建立 tokenEstimate util

**Goal:** 輕量 token 估算(「約 4 char = 1 token」經驗法則,CJK 字元 1:1),不引入大型依賴。

**Files:**
- Create: `src/utils/estimateTokens.ts`

- [ ] **Step 1: 寫入 util**

```typescript
/**
 * 輕量 token 估算 — 採用 OpenAI / Anthropic 社群常用的 "約 4 字元 ≈ 1 token" 經驗法則
 * CJK 字元 token 比較高(約 1 char = 1 token),英文約 4 char = 1 token
 * 精確度約 ±15%,足以作為「CLAUDE.md 過肥」的警示門檻
 */

export interface TextStats {
  chars: number;
  lines: number;
  words: number;
  estimatedTokens: number;
}

export function estimateStats(text: string): TextStats {
  const chars = text.length;
  const lines = text === '' ? 0 : text.split('\n').length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  const nonCjk = chars - cjkCount;
  const estimatedTokens = Math.ceil(cjkCount + nonCjk / 4);
  return { chars, lines, words, estimatedTokens };
}

export function tokenWarningLevel(tokens: number): 'ok' | 'warn' | 'critical' {
  if (tokens < 2000) return 'ok';
  if (tokens < 5000) return 'warn';
  return 'critical';
}
```

- [ ] **Step 2: 型別檢查**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/estimateTokens.ts
git commit -m "feat(utils): add token estimation for CLAUDE.md sizing"
```

---

### Task 13: ClaudeMd Tab 顯示字數/token 統計與警告

**Goal:** 編輯器 header 下方新增統計條:字數、行數、估算 tokens,依門檻顯示警告色。

**Files:**
- Modify: `src/components/tabs/ClaudeMd.tsx`
- Modify: `src/components/tabs/TabContent.css`

- [ ] **Step 1: 匯入 util**

```tsx
import { estimateStats, tokenWarningLevel } from '../../utils/estimateTokens';
```

- [ ] **Step 2: 計算統計**

在 `importRefs` 附近新增:

```tsx
const stats = useMemo(() => estimateStats(content), [content]);
const warningLevel = tokenWarningLevel(stats.estimatedTokens);
```

- [ ] **Step 3: 在 scope 切換按鈕與編輯區之間插入統計列**

```tsx
<div className={`md-stats md-stats--${warningLevel}`}>
  <span>📏 字數:{stats.chars.toLocaleString()}</span>
  <span>📑 行數:{stats.lines}</span>
  <span>🔤 詞數:{stats.words}</span>
  <span>🧠 估算 tokens:<strong>{stats.estimatedTokens.toLocaleString()}</strong></span>
  {warningLevel === 'warn' && (
    <span className="md-stats__hint">⚠ 檔案偏大,建議用 @path 拆分細節到獨立檔案</span>
  )}
  {warningLevel === 'critical' && (
    <span className="md-stats__hint">🚨 檔案過大(&gt;5000 tokens),強烈建議拆分 — 過大的 CLAUDE.md 會壓縮模型可用上下文</span>
  )}
</div>
```

- [ ] **Step 4: 新增對應 CSS**

於 `TabContent.css` 新增:

```css
.md-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  border: 1px solid var(--border-color);
  background: var(--bg-subtle);
}

.md-stats--warn {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}

.md-stats--critical {
  border-color: #d32f2f;
  background: rgba(211, 47, 47, 0.08);
}

.md-stats__hint {
  color: #d32f2f;
  font-weight: 500;
}

.md-stats--warn .md-stats__hint { color: #f59e0b; }
```

- [ ] **Step 5: 型別檢查 + 視覺驗證**

```bash
npm run build
npm run tauri dev
```

1. CLAUDE.md Tab 現有內容應顯示統計
2. 貼大量文字到 > 2000 tokens → 黃色警告
3. 貼到 > 5000 → 紅色危險提示
4. 刪除至正常 → 統計條回一般樣式

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/ClaudeMd.tsx src/components/tabs/TabContent.css
git commit -m "feat(claudemd): show char/line/token stats with size warnings"
```

---

## 收尾

### Task 14: 端到端手動回歸測試

**Goal:** 全功能手動跑一輪,確認 13 個小改動未破壞既有功能。

- [ ] **Step 1: 清乾淨 build**

```bash
rm -rf dist
npm run build
```

預期:TypeScript 0 錯誤,Vite 打包成功。

- [ ] **Step 2: 開發模式完整跑**

```bash
npm run tauri dev
```

- [ ] **Step 3: 既有功能回歸**

| 檢查項 | 預期 |
|--------|------|
| 基本設定 Tab 編輯 model/language | 正常,Ctrl+S 可儲存 |
| Permissions 新增 allow 規則 | 正常儲存 |
| Hooks Tab 新增 Hook + 範本 | 範本可套用 |
| StatusLine 新增 Command + 13 範本 | 範本可套用 |
| JSON Tab 錯誤高亮 | 紅字正常顯示 |
| Merge Tab 四層合并 | 顏色標記正確 |
| Managed 層 🔒 鎖定 | 欄位變灰不可編輯 |

- [ ] **Step 4: 新功能完整驗證**

| 檢查項 | 預期 |
|--------|------|
| Agents 新建 / 編輯 / 刪除 | 檔案系統同步、UI 列表即時更新 |
| Commands 新建 / 編輯 / 刪除 | 同上 |
| Skills 新建(建資料夾)/ 編輯 / 刪除(遞迴)| 同上,刪除對話框警示 references/scripts |
| OutputStyles builtin 無編輯按鈕 | ✓ |
| OutputStyles user 可編輯 | ✓ |
| CLAUDE.md @path 右側列出 | 引用數量正確 |
| CLAUDE.md @path 點擊預覽 | 前 200 行顯示 |
| CLAUDE.md 統計條 | 字數/tokens 即時更新 |
| CLAUDE.md &gt; 5000 tokens 紅字 | ✓ |

- [ ] **Step 5: 打包測試**

```bash
npm run tauri build
```

預期:產生 `.exe` / `.msi`(Windows)或 `.dmg`(macOS)無錯誤。

- [ ] **Step 6: Release Commit**

```bash
git add -A
git commit -m "chore(release): resource editing + claudemd enhancement complete"
```

---

## 自我審查(Self-Review)

**Spec coverage:**
- ✅ A-1 分割式表單編輯器 → Task 4(ResourceEditor 元件)
- ✅ A-2 新建/編輯/刪除 → Task 5, 6, 7, 8(四個資源 Tab)
- ✅ A-3 純空白新建(無範本庫)→ Task 5 `initialData = { ...空值 }`
- ✅ B-1 @path 點擊跳轉 → Task 10, 11
- ✅ B-2 字數統計 + 警告 → Task 12, 13
- ✅ Skills 資料夾特例 → Task 8(`ensureDir` + `deleteResourceDir`)
- ✅ OutputStyles builtin 保護 → Task 7(scope 條件判斷)

**Placeholder scan:** 無 TBD / "similar to" 未展開 / 未定義的函數引用。

**Type consistency:**
- `createResourceFile/updateResourceFile/deleteResourceFile/deleteResourceDir/ensureDir` 在 Task 3 定義,Task 5/6/7/8 使用,簽名一致。
- `ResourceEditor` props 在 Task 4 定義 `ResourceEditorProps`,Task 5-8 使用均對齊。
- `parseClaudeMdImports` 在 Task 10 定義 `ImportRef`,Task 11 一致使用。
- `estimateStats / tokenWarningLevel` 在 Task 12 定義,Task 13 一致使用。

**已知未覆蓋(刻意 YAGNI):**
- 資源類 Tab 無 Draft Mode(改為直接寫盤,保留 Ctrl+Z 僅限 settings/CLAUDE.md),第一版接受此限制。
- Skill 改名需手動從檔案系統操作(Task 8 有明確提示)。
- `@path` 拆分輔助(選取文字 → 提取為獨立檔案)留給未來。
- 引用圖譜(雙向引用)留給未來。

---

## 風險提醒

1. **`fs:allow-remove` 真實識別可能不同** — Tauri v2 權限命名演進快,若 Task 2 後 `remove()` 仍報未授權,請查 `src-tauri/gen/schemas/desktop-schema.json` 的 fs 區塊確認正確識別(可能為 `fs:allow-remove-file` 或 `fs:allow-remove-recursive`),更新 capabilities。
2. **CSS 變數名** — `--border-color` / `--bg-subtle` / `--bg-input` / `--text-color` / `--text-muted` / `--accent-color` 依 `src/index.css` 實際名稱調整(專案可能用 `--color-border` 等)。
3. **Skills 刪除的破壞性** — 已加 `window.confirm` 警示,PR description 宜標記「含破壞性操作」供 reviewer 留意。
4. **編碼問題** — Tauri v2 的 `writeTextFile` 預設 UTF-8,寫檔含中文無需額外處理。

---

**End of plan.**
