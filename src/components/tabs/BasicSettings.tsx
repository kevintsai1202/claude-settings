/**
 * BasicSettings Tab — 基本設定表單
 * 提供 model、effortLevel、language、outputStyle、布爾開關、數字輸入
 * v2.0 — 擴充 Model & AI、UI/顯示、更新、其他區段
 */
import React from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import { useManagedField } from '../../hooks/useManagedField';
import Toggle from '../ui/Toggle';
import ManagedBadge from '../ui/ManagedBadge';
import TagArrayInput from '../ui/TagArrayInput';
import type { EffortLevel, UpdateChannel, ClaudeSettings } from '../../types/settings';
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

  // 判斷各欄位是否被 managed 層鎖定
  const { isManaged: modelManaged }    = useManagedField('model');
  const { isManaged: langManaged }     = useManagedField('language');
  const { isManaged: channelManaged }  = useManagedField('autoUpdatesChannel');
  const { isManaged: thinkingManaged } = useManagedField('alwaysThinkingEnabled');

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
        <label className="form-label">
          Model
          {modelManaged && <ManagedBadge />}
        </label>
        <select
          value={userSettings.model ?? ''}
          onChange={(e) => update({ model: e.target.value || undefined })}
          disabled={modelManaged}
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

      {/* Available Models — 可選模型清單 */}
      <div className="form-row">
        <label className="form-label">Available Models</label>
        <TagArrayInput
          value={userSettings.availableModels ?? []}
          onChange={(v) => update({ availableModels: v.length ? v : undefined })}
          placeholder="輸入模型名稱後按 Enter"
        />
      </div>

      {/* Agent — agent 名稱 */}
      <div className="form-row">
        <label className="form-label">Agent</label>
        <input
          type="text"
          placeholder="（預設 agent）"
          value={userSettings.agent ?? ''}
          onChange={(e) => update({ agent: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
      </div>

      {/* Language */}
      <div className="form-row">
        <label className="form-label">
          Language
          {langManaged && <ManagedBadge />}
        </label>
        <select
          value={userSettings.language ?? ''}
          onChange={(e) => update({ language: e.target.value || undefined })}
          disabled={langManaged}
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
          <div className="form-label">
            Always Thinking
            {thinkingManaged && <ManagedBadge />}
          </div>
          <div className="form-hint">每次回應都使用延伸思考</div>
        </div>
        <Toggle
          checked={userSettings.alwaysThinkingEnabled ?? false}
          onChange={(v) => update({ alwaysThinkingEnabled: v })}
          disabled={thinkingManaged}
        />
      </div>

      <hr className="divider" />
      <p className="section-title">UI / 顯示設定</p>

      {/* Prefers Reduced Motion — 減少動畫 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Prefers Reduced Motion</div>
          <div className="form-hint">減少介面動畫效果</div>
        </div>
        <Toggle
          checked={userSettings.prefersReducedMotion ?? false}
          onChange={(v) => update({ prefersReducedMotion: v })}
        />
      </div>

      {/* Show Thinking Summaries — 顯示思考摘要 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Show Thinking Summaries</div>
          <div className="form-hint">顯示延伸思考的摘要內容</div>
        </div>
        <Toggle
          checked={userSettings.showThinkingSummaries ?? false}
          onChange={(v) => update({ showThinkingSummaries: v })}
        />
      </div>

      {/* Spinner Tips Enabled — 等待提示（取代棄用的 spinnerTips） */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Spinner Tips</div>
          <div className="form-hint">等待時顯示使用提示</div>
        </div>
        <Toggle
          checked={userSettings.spinnerTipsEnabled ?? true}
          onChange={(v) => update({ spinnerTipsEnabled: v })}
        />
      </div>

      {/* Voice Enabled — 語音功能 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Voice Enabled</div>
          <div className="form-hint">啟用語音輸入/輸出功能</div>
        </div>
        <Toggle
          checked={userSettings.voiceEnabled ?? false}
          onChange={(v) => update({ voiceEnabled: v })}
        />
      </div>

      <hr className="divider" />
      <p className="section-title">更新設定</p>

      {/* Auto Updates Channel — 更新通道 */}
      <div className="form-row">
        <label className="form-label">
          Auto Updates Channel
          {channelManaged && <ManagedBadge />}
        </label>
        <select
          value={userSettings.autoUpdatesChannel ?? 'stable'}
          onChange={(e) => update({ autoUpdatesChannel: e.target.value as UpdateChannel })}
          disabled={channelManaged}
        >
          <option value="stable">stable（穩定版）</option>
          <option value="latest">latest（最新版）</option>
        </select>
      </div>

      {/* Auto Updates — 是否自動更新 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Auto Updates</div>
          <div className="form-hint">啟用後自動下載並安裝更新</div>
        </div>
        <Toggle
          checked={userSettings.autoUpdates ?? true}
          onChange={(v) => update({ autoUpdates: v })}
        />
      </div>

      <hr className="divider" />
      <p className="section-title">Git 設定</p>

      {/* Respect Gitignore — 遵守 .gitignore */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Respect Gitignore</div>
          <div className="form-hint">讀取檔案時遵守 .gitignore 規則</div>
        </div>
        <Toggle
          checked={userSettings.respectGitignore ?? true}
          onChange={(v) => update({ respectGitignore: v })}
        />
      </div>

      {/* Include Git Instructions — 包含 git 操作指引 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Include Git Instructions</div>
          <div className="form-hint">系統提示中包含 git 操作指引</div>
        </div>
        <Toggle
          checked={userSettings.includeGitInstructions ?? true}
          onChange={(v) => update({ includeGitInstructions: v })}
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
