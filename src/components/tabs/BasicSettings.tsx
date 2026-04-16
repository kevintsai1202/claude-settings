/**
 * BasicSettings Tab — 基本設定表單
 * 提供 model、effortLevel、language、outputStyle、布爾開關、數字輸入
 */
import React from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import Toggle from '../ui/Toggle';
import type { EffortLevel, ClaudeSettings } from '../../types/settings';
import './TabContent.css';

// 可選的 Claude 模型清單
const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

// 語言選項
const LANGUAGES = [
  { value: '',         label: '（預設）' },
  { value: 'zh-TW',   label: '繁體中文' },
  { value: 'zh-CN',   label: '簡體中文' },
  { value: 'en',      label: 'English' },
  { value: 'japanese', label: '日本語' },
];

// 輸出風格
const OUTPUT_STYLES = [
  { value: '',              label: '（預設）' },
  { value: 'concise',      label: 'Concise' },
  { value: 'explanatory',  label: 'Explanatory' },
  { value: 'formal',       label: 'Formal' },
];

const BasicSettings: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  // 以 user 層為主要編輯對象
  const userSettings: ClaudeSettings = files.user.data ?? {};

  /** 更新 user 層設定並儲存 */
  const update = async (patch: Partial<ClaudeSettings>) => {
    const updated = { ...userSettings, ...patch };
    await saveFile('user', files.user.path, updated);
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🔧 基本設定</h2>
      <p className="tab-desc">編輯 User 層的常用設定（儲存至 <span className="mono">~/.claude/settings.json</span>）</p>

      {/* Model */}
      <div className="form-row">
        <label className="form-label">Model</label>
        <select
          value={userSettings.model ?? ''}
          onChange={(e) => update({ model: e.target.value || undefined })}
        >
          <option value="">（使用預設）</option>
          {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Effort Level */}
      <div className="form-row">
        <label className="form-label">Effort Level</label>
        <div className="radio-group">
          {(['low', 'medium', 'high'] as EffortLevel[]).map((level) => (
            <label key={level} className="radio-label">
              <input
                type="radio"
                name="effortLevel"
                value={level}
                checked={userSettings.effortLevel === level}
                onChange={() => update({ effortLevel: level })}
              />
              {level}
            </label>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="form-row">
        <label className="form-label">Language</label>
        <select
          value={userSettings.language ?? ''}
          onChange={(e) => update({ language: e.target.value || undefined })}
        >
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>

      {/* Output Style */}
      <div className="form-row">
        <label className="form-label">Output Style</label>
        <select
          value={userSettings.outputStyle ?? ''}
          onChange={(e) => update({ outputStyle: e.target.value || undefined })}
        >
          {OUTPUT_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <hr className="divider" />
      <p className="section-title">開關設定</p>

      {/* Always Thinking */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Always Thinking</div>
          <div className="form-hint">每次回應都使用延伸思考</div>
        </div>
        <Toggle
          checked={userSettings.alwaysThinkingEnabled ?? false}
          onChange={(v) => update({ alwaysThinkingEnabled: v })}
        />
      </div>

      {/* Include Co-Author */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Include Co-Authored-By</div>
          <div className="form-hint">Commit 訊息加入 Claude 共同作者標記</div>
        </div>
        <Toggle
          checked={userSettings.includeCoAuthoredBy ?? true}
          onChange={(v) => update({ includeCoAuthoredBy: v })}
        />
      </div>

      {/* Spinner Tips */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Spinner Tips</div>
          <div className="form-hint">等待時顯示使用提示</div>
        </div>
        <Toggle
          checked={userSettings.spinnerTips ?? true}
          onChange={(v) => update({ spinnerTips: v })}
        />
      </div>

      <hr className="divider" />
      <p className="section-title">數值設定</p>

      {/* Cleanup Period */}
      <div className="form-row">
        <label className="form-label">Cleanup Period（天）</label>
        <input
          type="number"
          min={1}
          max={365}
          value={userSettings.cleanupPeriodDays ?? 30}
          onChange={(e) => update({ cleanupPeriodDays: Number(e.target.value) })}
          style={{ width: 100 }}
        />
      </div>
    </div>
  );
};

export default BasicSettings;
