/**
 * Hooks Tab — Hook 事件設定
 * 五種事件類型的折疊面板，支援 command / http 兩種 Hook 類型
 * v2.0 — 擴充 disableAllHooks、allowedHttpHookUrls、httpHookAllowedEnvVars、allowManagedHooksOnly
 */
import React, { useState } from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import Toggle from '../ui/Toggle';
import TagArrayInput from '../ui/TagArrayInput';
import ComboBox from '../ui/ComboBox';
import { HOOK_TEMPLATES, type HookTemplate } from './hookTemplates';
import type { HookEvent, HookEntry, HookType, HooksConfig, ClaudeSettings } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';  // 借用 .resource-chip 樣式做來源過濾

const HOOK_EVENTS: { event: HookEvent; label: string; desc: string }[] = [
  { event: 'PreToolUse',       label: 'PreToolUse',       desc: '工具執行前觸發' },
  { event: 'PostToolUse',      label: 'PostToolUse',      desc: '工具執行後觸發' },
  { event: 'UserPromptSubmit', label: 'UserPromptSubmit', desc: '使用者送出訊息時觸發（送給模型前）' },
  { event: 'Notification',     label: 'Notification',     desc: 'Claude 發出通知時觸發（如等待輸入）' },
  { event: 'Stop',             label: 'Stop',             desc: '主 agent 回應結束時觸發' },
  { event: 'SubagentStop',     label: 'SubagentStop',     desc: '子代理（subagent）結束時觸發' },
  { event: 'SessionStart',     label: 'SessionStart',     desc: 'Session 開始時觸發（含 startup / resume / clear）' },
  { event: 'SessionEnd',       label: 'SessionEnd',       desc: 'Session 結束時觸發' },
  { event: 'PreCompact',       label: 'PreCompact',       desc: 'Context 壓縮前觸發（可保存對話）' },
];

/** Hook matcher 常見 glob 選項，僅作為下拉參考 */
const COMMON_MATCHERS = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Glob',
  'Grep',
  'Task',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
  'mcp__.*',
  '.*',
];

/** 建立新的空白 HookEntry */
const newEntry = (): HookEntry => ({
  id: crypto.randomUUID(),
  matcher: '',
  type: 'command',
  command: '',
  timeout: 60000,
});

const HookPanel: React.FC<{
  event: HookEvent;
  label: string;
  desc: string;
  hooks: HooksConfig;
  onChange: (hooks: HooksConfig) => void;
}> = ({ event, label, desc, hooks, onChange }) => {
  const [open, setOpen] = useState(false);
  const entries = hooks[event] ?? [];

  const updateEntries = (updated: HookEntry[]) =>
    onChange({ ...hooks, [event]: updated });

  const addEntry = () => updateEntries([...entries, newEntry()]);

  const removeEntry = (id: string) =>
    updateEntries(entries.filter((e) => e.id !== id));

  const updateEntry = (id: string, patch: Partial<HookEntry>) =>
    updateEntries(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return (
    <div className="hook-panel">
      <div className="hook-panel__header" onClick={() => setOpen((o) => !o)}>
        <div>
          <span className="hook-panel__title">{label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{desc}</span>
          {entries.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-cyan)' }}>
              ({entries.length})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-primary"
            style={{ padding: '3px 10px', fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); addEntry(); setOpen(true); }}
          >
            + 新增
          </button>
          <span className={`hook-panel__arrow${open ? ' hook-panel__arrow--open' : ''}`}>▶</span>
        </div>
      </div>

      {open && (
        <div className="hook-panel__body">
          {entries.length === 0
            ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>尚無 Hook，點擊「+ 新增」加入</span>
            : entries.map((entry) => (
              <div key={entry.id} className="hook-entry">
                <div className="hook-entry__row">
                  <span className="hook-entry__label">Matcher</span>
                  <ComboBox
                    value={entry.matcher ?? ''}
                    options={COMMON_MATCHERS.map((m) => ({ value: m }))}
                    onChange={(v) => updateEntry(entry.id, { matcher: v })}
                    placeholder="留空代表全部工具，或從清單選擇"
                    emptyLabel="（全部工具）"
                  />
                </div>
                <div className="hook-entry__row">
                  <span className="hook-entry__label">Type</span>
                  <select
                    value={entry.type}
                    onChange={(e) => updateEntry(entry.id, { type: e.target.value as HookType })}
                    style={{ width: 140 }}
                  >
                    <option value="command">command（執行命令）</option>
                    <option value="http">http（HTTP webhook）</option>
                  </select>
                </div>
                {entry.type === 'command' ? (
                  <div className="hook-entry__row">
                    <span className="hook-entry__label">Command</span>
                    <input
                      type="text"
                      placeholder="例如：~/.claude/hooks/pre-bash.sh"
                      value={entry.command ?? ''}
                      onChange={(e) => updateEntry(entry.id, { command: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="hook-entry__row">
                    <span className="hook-entry__label">URL</span>
                    <input
                      type="text"
                      placeholder="http://localhost:3000/hook"
                      value={entry.url ?? ''}
                      onChange={(e) => updateEntry(entry.id, { url: e.target.value })}
                    />
                  </div>
                )}
                <div className="hook-entry__row">
                  <span className="hook-entry__label">Timeout</span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={entry.timeout ?? 60000}
                    onChange={(e) => updateEntry(entry.id, { timeout: Number(e.target.value) })}
                    style={{ width: 100 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ms</span>
                  <button className="btn-danger" onClick={() => removeEntry(entry.id)} style={{ marginLeft: 'auto' }}>
                    刪除 ✕
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

const Hooks: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  /** 以 user 層為主要編輯對象 */
  const userSettings: ClaudeSettings = files.user.data ?? {};
  const hooks: HooksConfig = userSettings.hooks ?? {};

  /** 是否停用所有 Hook（master toggle） */
  const disableAllHooks = userSettings.disableAllHooks ?? false;

  /** 記錄最近套用的範本 ID，用於套用後 2 秒確認動畫 */
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  /** 範本來源過濾：all / official / community */
  const [templateFilter, setTemplateFilter] = useState<'all' | 'official' | 'community'>('all');

  /** 更新 user 層設定並儲存 */
  const updateSettings = async (patch: Partial<ClaudeSettings>) => {
    await saveFile('user', files.user.path, { ...userSettings, ...patch });
  };

  /** 儲存 hooks 子物件變更 */
  const saveHooks = async (updated: HooksConfig) => {
    await updateSettings({ hooks: updated });
  };

  /**
   * 套用範本：把範本轉成 HookEntry 並附加到該事件的 hook 清單
   * @param tpl 要套用的範本
   */
  const applyTemplate = async (tpl: HookTemplate) => {
    const entry: HookEntry = {
      id: crypto.randomUUID(),
      matcher: tpl.matcher,
      type: 'command',
      command: tpl.command,
      timeout: tpl.timeout ?? 60000,
    };
    const existing = hooks[tpl.event] ?? [];
    await saveHooks({ ...hooks, [tpl.event]: [...existing, entry] });
    setAppliedTemplateId(tpl.id);
    setTimeout(() => setAppliedTemplateId(null), 2000);
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🪝 Hooks</h2>
      <p className="tab-desc">設定各事件的 Hook 命令（User 層）</p>

      {/* Disable All Hooks — 停用所有 Hook 的 master toggle */}
      <div className="form-row form-row--toggle" style={{ marginBottom: 16 }}>
        <div>
          <div className="form-label">Disable All Hooks</div>
          <div className="form-hint">啟用後停用所有 Hook 並鎖定下方編輯</div>
        </div>
        <Toggle
          checked={disableAllHooks}
          onChange={(v) => updateSettings({ disableAllHooks: v || undefined })}
        />
      </div>

      {disableAllHooks && (
        <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 12 }}>
          ⚠️ 所有 Hook 已停用，以下設定暫時無效
        </p>
      )}

      {/* 已設定 Hook 總覽 */}
      <div
        style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>已設定 Hook：</span>
        {HOOK_EVENTS.filter(({ event }) => (hooks[event] ?? []).length > 0).length === 0 ? (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無任何 Hook</span>
        ) : (
          HOOK_EVENTS.filter(({ event }) => (hooks[event] ?? []).length > 0).map(({ event, label }) => (
            <span
              key={event}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(99,102,241,0.14)',
                color: '#818cf8',
                fontSize: 11,
              }}
            >
              {label} × {(hooks[event] ?? []).length}
            </span>
          ))
        )}
      </div>

      {/* ── Hook 範本卡片庫 ── */}
      <div className="hook-templates">
        <div className="hook-templates__header" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p className="section-title" style={{ margin: 0 }}>💡 範本庫</p>
            <span className="form-hint" style={{ marginTop: 0 }}>
              點「套用」會把範本新增為對應事件的一個 Hook，可再進一步微調
            </span>
          </div>
          <div className="resource-toolbar__filter">
            {(['all', 'official', 'community'] as const).map((s) => {
              const count = s === 'all' ? HOOK_TEMPLATES.length : HOOK_TEMPLATES.filter((t) => t.source === s).length;
              return (
                <button
                  key={s}
                  className={`resource-chip${templateFilter === s ? ' resource-chip--active' : ''}`}
                  onClick={() => setTemplateFilter(s)}
                >
                  {s === 'all' ? `全部 (${count})` : s === 'official' ? `🏢 官方 (${count})` : `🌐 社群 (${count})`}
                </button>
              );
            })}
          </div>
        </div>
        <div className="hook-templates__grid">
          {HOOK_TEMPLATES.filter((t) => templateFilter === 'all' || t.source === templateFilter).map((tpl) => (
            <div key={tpl.id} className="hook-template-card">
              <div className="hook-template-card__header">
                <span className="hook-template-card__emoji">{tpl.emoji}</span>
                <span className="hook-template-card__name">{tpl.name}</span>
              </div>

              {/* 事件 / 來源 / 平台 / matcher / 網路 標籤 */}
              <div className="hook-template-card__tags">
                <span className="hook-tag hook-tag--event">{tpl.event}</span>
                <span className={`hook-tag hook-tag--source-${tpl.source}`}>
                  {tpl.source === 'official' ? '🏢 官方' : '🌐 社群'}
                </span>
                {tpl.matcher && <span className="hook-tag hook-tag--matcher">{tpl.matcher}</span>}
                <span className={`hook-tag hook-tag--platform hook-tag--platform-${tpl.platform}`}>
                  {tpl.platform === 'cross' ? 'Cross-platform' : tpl.platform === 'windows' ? 'Windows' : 'Unix'}
                </span>
                {tpl.needsNetwork && <span className="hook-tag hook-tag--network">📡 需網路</span>}
              </div>

              <p className="hook-template-card__desc">{tpl.desc}</p>

              {/* 需要額外設定的提示 */}
              {tpl.needsSetup && (
                <div className="hook-template-card__setup">
                  ⚙️ {tpl.needsSetup}
                </div>
              )}

              {/* 預覽效果 */}
              <div className="hook-template-card__preview">
                <span className="hook-preview-label">效果</span>
                <span className="hook-preview-text">{tpl.preview}</span>
              </div>

              <button
                className={`btn-primary hook-template-card__apply${appliedTemplateId === tpl.id ? ' hook-template-card__apply--applied' : ''}`}
                onClick={() => applyTemplate(tpl)}
                disabled={disableAllHooks}
              >
                {appliedTemplateId === tpl.id ? '✓ 已套用' : '＋ 套用到 ' + tpl.event}
              </button>
            </div>
          ))}
        </div>
      </div>

      <hr className="divider" />
      <p className="section-title" style={{ marginTop: 20 }}>手動設定</p>

      {HOOK_EVENTS.map(({ event, label, desc }) => (
        <HookPanel
          key={event}
          event={event}
          label={label}
          desc={desc}
          hooks={hooks}
          onChange={saveHooks}
        />
      ))}

      <hr className="divider" />
      <p className="section-title">HTTP Hook 設定</p>

      {/* Allowed HTTP Hook URLs — 允許的 HTTP hook URL 清單 */}
      <div className="form-row">
        <label className="form-label">Allowed HTTP Hook URLs</label>
        <TagArrayInput
          value={userSettings.allowedHttpHookUrls ?? []}
          onChange={(v) =>
            updateSettings({ allowedHttpHookUrls: v.length ? v : undefined })
          }
          placeholder="輸入 URL 後按 Enter"
          disabled={disableAllHooks}
        />
      </div>

      {/* HTTP Hook Allowed Env Vars — HTTP hook 可讀取的環境變數 */}
      <div className="form-row">
        <label className="form-label">HTTP Hook Allowed Env Vars</label>
        <TagArrayInput
          value={userSettings.httpHookAllowedEnvVars ?? []}
          onChange={(v) =>
            updateSettings({ httpHookAllowedEnvVars: v.length ? v : undefined })
          }
          placeholder="輸入環境變數名稱後按 Enter"
          disabled={disableAllHooks}
        />
      </div>

      {/* Allow Managed Hooks Only — 僅允許 managed hooks */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Allow Managed Hooks Only</div>
          <div className="form-hint">只允許由管理員設定的 Hooks 執行</div>
        </div>
        <Toggle
          checked={userSettings.allowManagedHooksOnly ?? false}
          onChange={(v) => updateSettings({ allowManagedHooksOnly: v || undefined })}
          disabled={disableAllHooks}
        />
      </div>
    </div>
  );
};

export default Hooks;
