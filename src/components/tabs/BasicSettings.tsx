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
import ComboBox from '../ui/ComboBox';
import type { EffortLevel, UpdateChannel, ClaudeSettings } from '../../types/settings';
import './TabContent.css';

// 可選的 Claude 模型（含別名與精確 ID，允許自訂輸入）
const MODEL_OPTIONS = [
  { value: 'claude-opus-4-6',         label: 'claude-opus-4-6',         hint: 'Opus 4.6 最新' },
  { value: 'claude-sonnet-4-6',       label: 'claude-sonnet-4-6',       hint: 'Sonnet 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5-20251001', hint: 'Haiku 4.5' },
  { value: 'opus',                    label: 'opus',                    hint: '別名' },
  { value: 'sonnet',                  label: 'sonnet',                  hint: '別名' },
  { value: 'haiku',                   label: 'haiku',                   hint: '別名' },
  { value: 'default',                 label: 'default',                 hint: 'Claude Code 預設' },
];

// 語言選項（純下拉，ISO 常見語言；新增罕見語言仍允許自訂 → 改為 Combo）
const LANGUAGE_OPTIONS = [
  { value: 'zh-TW',    label: 'zh-TW — 繁體中文' },
  { value: 'zh-CN',    label: 'zh-CN — 簡體中文' },
  { value: 'en',       label: 'en — English' },
  { value: 'ja',       label: 'ja — 日本語' },
  { value: 'ko',       label: 'ko — 한국어' },
  { value: 'es',       label: 'es — Español' },
  { value: 'fr',       label: 'fr — Français' },
  { value: 'de',       label: 'de — Deutsch' },
  { value: 'pt',       label: 'pt — Português' },
  { value: 'it',       label: 'it — Italiano' },
  { value: 'ru',       label: 'ru — Русский' },
];

// 輸出風格（含官方內建，可自訂）
const OUTPUT_STYLE_OPTIONS = [
  { value: 'default',     label: 'default',     hint: '內建' },
  { value: 'explanatory', label: 'explanatory', hint: '內建' },
  { value: 'learning',    label: 'learning',    hint: '內建' },
  { value: 'concise',     label: 'concise' },
  { value: 'formal',      label: 'formal' },
];

const BasicSettings: React.FC = () => {
  const { files, agents, outputStyles } = useAppStore();
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

      {/* Model（Combo：常見模型 + 自訂輸入） */}
      <div className="form-row">
        <label className="form-label">
          Model
          {modelManaged && <ManagedBadge />}
        </label>
        <ComboBox
          value={userSettings.model ?? ''}
          options={MODEL_OPTIONS}
          onChange={(v) => update({ model: v || undefined })}
          disabled={modelManaged}
          placeholder="選擇或輸入自訂模型 ID"
        />
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

      {/* Agent — 依 ~/.claude/agents/ 的 .md 檔動態列出 */}
      <div className="form-row">
        <label className="form-label">Agent</label>
        <ComboBox
          value={userSettings.agent ?? ''}
          options={agents.map((a) => ({
            value: a.name,
            label: a.name,
            hint: a.scope,
          }))}
          onChange={(v) => update({ agent: v || undefined })}
          placeholder="選擇 subagent 或自訂名稱"
        />
      </div>

      {/* Language（Combo：ISO 常見語言 + 自訂） */}
      <div className="form-row">
        <label className="form-label">
          Language
          {langManaged && <ManagedBadge />}
        </label>
        <ComboBox
          value={userSettings.language ?? ''}
          options={LANGUAGE_OPTIONS}
          onChange={(v) => update({ language: v || undefined })}
          disabled={langManaged}
          placeholder="選擇語言代碼或自訂"
        />
      </div>

      {/* Output Style（Combo：整合 outputStyles store 動態清單 + 內建） */}
      <div className="form-row">
        <label className="form-label">Output Style</label>
        <ComboBox
          value={userSettings.outputStyle ?? ''}
          options={[
            ...OUTPUT_STYLE_OPTIONS,
            ...outputStyles
              .filter((o) => o.scope !== 'builtin')
              .map((o) => ({ value: o.name, label: o.name, hint: o.scope })),
          ]}
          onChange={(v) => update({ outputStyle: v || undefined })}
          placeholder="選擇或輸入 output style 名稱"
        />
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
