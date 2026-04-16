/**
 * Permissions Tab — 權限規則管理
 * 分 Allow / Ask / Deny 三區塊，支援新增與刪除規則
 * v2.0 — 擴充 defaultMode 6 選項、additionalDirectories、安全開關
 */
import React, { useState } from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import { useManagedField } from '../../hooks/useManagedField';
import RuleTag from '../ui/RuleTag';
import Toggle from '../ui/Toggle';
import ManagedBadge from '../ui/ManagedBadge';
import TagArrayInput from '../ui/TagArrayInput';
import type { DefaultMode, ClaudeSettings } from '../../types/settings';
import './TabContent.css';

// 常用工具名稱選項
const TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Glob', 'Grep', 'mcp__*'];

// 完整 6 個 defaultMode 選項（對應官方 v2.0 型別）
const DEFAULT_MODES: { value: DefaultMode; label: string }[] = [
  { value: 'default',            label: 'default（預設行為）' },
  { value: 'acceptEdits',        label: 'acceptEdits（自動接受檔案編輯）' },
  { value: 'dontAsk',            label: 'dontAsk（不詢問但提示）' },
  { value: 'bypassPermissions',  label: 'bypassPermissions（跳過所有確認）' },
  { value: 'plan',               label: 'plan（計畫模式，僅規劃不執行）' },
  { value: 'auto',               label: 'auto（全自動模式）' },
];

const Permissions: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  // 以 user 層為主要編輯對象
  const userSettings: ClaudeSettings = files.user.data ?? {};
  const perms = userSettings.permissions ?? { allow: [], ask: [], deny: [] };

  // 判斷 defaultMode 是否被 managed 層鎖定
  const { isManaged: defaultModeManaged } = useManagedField('permissions.defaultMode');

  // 新增規則的臨時狀態
  const [newTool, setNewTool]       = useState('Bash');
  const [newPattern, setNewPattern] = useState('');
  const [addTarget, setAddTarget]   = useState<'allow' | 'ask' | 'deny'>('allow');

  /** 儲存變更後的 permissions */
  const savePerms = async (updated: typeof perms) => {
    await saveFile('user', files.user.path, {
      ...userSettings,
      permissions: updated,
    });
  };

  /** 刪除規則 */
  const deleteRule = (type: 'allow' | 'ask' | 'deny', rule: string) => {
    const updated = {
      ...perms,
      [type]: (perms[type] ?? []).filter((r) => r !== rule),
    };
    savePerms(updated);
  };

  /** 新增規則 */
  const addRule = () => {
    const rule = newPattern.trim()
      ? `${newTool}(${newPattern.trim()})`
      : newTool;
    if ((perms[addTarget] ?? []).includes(rule)) return;
    const updated = {
      ...perms,
      [addTarget]: [...(perms[addTarget] ?? []), rule],
    };
    savePerms(updated);
    setNewPattern('');
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">⚠️ Permissions</h2>
      <p className="tab-desc">管理工具呼叫的權限規則（User 層）</p>

      {/* Deny 區塊 */}
      <div className="rule-section">
        <div className="rule-section__title">
          <span style={{ color: 'var(--color-danger)' }}>🔴 Deny 規則（最高優先）</span>
        </div>
        <div className="rule-list">
          {(perms.deny ?? []).length === 0
            ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>無規則</span>
            : (perms.deny ?? []).map((rule) => (
                <RuleTag key={rule} rule={rule} type="deny" onDelete={() => deleteRule('deny', rule)} />
              ))
          }
        </div>
      </div>

      {/* Ask 區塊 */}
      <div className="rule-section">
        <div className="rule-section__title">
          <span style={{ color: 'var(--color-warning)' }}>🟡 Ask 規則（需確認）</span>
        </div>
        <div className="rule-list">
          {(perms.ask ?? []).length === 0
            ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>無規則</span>
            : (perms.ask ?? []).map((rule) => (
                <RuleTag key={rule} rule={rule} type="ask" onDelete={() => deleteRule('ask', rule)} />
              ))
          }
        </div>
      </div>

      {/* Allow 區塊 */}
      <div className="rule-section">
        <div className="rule-section__title">
          <span style={{ color: 'var(--color-success)' }}>🟢 Allow 規則（自動允許）</span>
        </div>
        <div className="rule-list">
          {(perms.allow ?? []).length === 0
            ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>無規則</span>
            : (perms.allow ?? []).map((rule) => (
                <RuleTag key={rule} rule={rule} type="allow" onDelete={() => deleteRule('allow', rule)} />
              ))
          }
        </div>
      </div>

      {/* 新增規則表單 */}
      <div className="rule-section">
        <div className="rule-section__title">＋ 新增規則</div>
        <div className="add-rule-row">
          <select
            value={addTarget}
            onChange={(e) => setAddTarget(e.target.value as typeof addTarget)}
            style={{ width: 90 }}
          >
            <option value="allow">Allow</option>
            <option value="ask">Ask</option>
            <option value="deny">Deny</option>
          </select>

          <select
            value={newTool}
            onChange={(e) => setNewTool(e.target.value)}
            style={{ width: 130 }}
          >
            {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <input
            type="text"
            placeholder="指定 glob（可留空）"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            style={{ flex: 1 }}
          />

          <button className="btn-primary" onClick={addRule}>確認新增</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          範例：Bash(npm run *) 表示允許所有以 npm run 開頭的命令
        </p>
      </div>

      <hr className="divider" />

      {/* Default Mode */}
      <div className="form-row">
        <label className="form-label">
          Default Mode
          {defaultModeManaged && <ManagedBadge />}
        </label>
        <select
          value={perms.defaultMode ?? 'default'}
          onChange={(e) =>
            savePerms({ ...perms, defaultMode: e.target.value as DefaultMode })
          }
          style={{ maxWidth: 340 }}
          disabled={defaultModeManaged}
        >
          {DEFAULT_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>
      {(perms.defaultMode === 'bypassPermissions' || perms.defaultMode === 'auto') && (
        <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: -8 }}>
          ⚠️ {perms.defaultMode} 模式會跳過所有權限確認，請謹慎使用
        </p>
      )}

      <hr className="divider" />

      {/* Additional Directories — 額外允許存取的目錄 */}
      <div className="form-row">
        <label className="form-label">Additional Directories</label>
        <TagArrayInput
          value={perms.additionalDirectories ?? []}
          onChange={(v) =>
            savePerms({ ...perms, additionalDirectories: v.length ? v : undefined })
          }
          placeholder="輸入目錄路徑後按 Enter"
        />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8 }}>
        額外允許 Claude 存取的目錄（超出預設工作區的路徑）
      </p>

      <hr className="divider" />
      <p className="section-title">安全限制</p>

      {/* Disable Bypass Permissions Mode — 停用 bypass 模式 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Disable Bypass Permissions Mode</div>
          <div className="form-hint">停用 bypassPermissions 模式，防止跳過所有確認</div>
        </div>
        <Toggle
          checked={perms.disableBypassPermissionsMode ?? false}
          onChange={(v) =>
            savePerms({ ...perms, disableBypassPermissionsMode: v || undefined })
          }
        />
      </div>

      {/* Skip Dangerous Mode Permission Prompt — 略過危險模式確認提示 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Skip Dangerous Mode Permission Prompt</div>
          <div className="form-hint">啟用危險模式時略過確認提示（不建議）</div>
        </div>
        <Toggle
          checked={perms.skipDangerousModePermissionPrompt ?? false}
          onChange={(v) =>
            savePerms({ ...perms, skipDangerousModePermissionPrompt: v || undefined })
          }
        />
      </div>
    </div>
  );
};

export default Permissions;
