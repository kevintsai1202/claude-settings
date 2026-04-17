/**
 * AdvancedTab — 進階設定表單
 * 涵蓋 Shell/Git、Auto Mode、Attribution、Worktree、認證/API、企業設定
 * 各區段以 <hr className="divider" /> 分隔
 */
import React from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import Toggle from '../ui/Toggle';
import TagArrayInput from '../ui/TagArrayInput';
import ComboBox from '../ui/ComboBox';
import type { ClaudeSettings, AttributionSettings, WorktreeSettings } from '../../types/settings';
import { getPlatform } from '../../utils/platform';
import './TabContent.css';

// 常見 Shell 路徑（跨作業系統；依當前平台排序，推薦項會加 ✅）
type ShellOption = { value: string; label: string; hint: string; platform: 'windows' | 'unix' | 'cross' };
const ALL_SHELL_OPTIONS: ShellOption[] = [
  { value: '/bin/bash',      label: '/bin/bash',      hint: 'macOS/Linux',         platform: 'unix' },
  { value: '/bin/zsh',       label: '/bin/zsh',       hint: 'macOS 預設',          platform: 'unix' },
  { value: '/bin/sh',        label: '/bin/sh',        hint: 'POSIX',               platform: 'unix' },
  { value: '/usr/bin/fish',  label: '/usr/bin/fish',  hint: 'Fish shell',          platform: 'unix' },
  { value: 'pwsh',           label: 'pwsh',           hint: 'PowerShell 7+',       platform: 'cross' },
  { value: 'powershell.exe', label: 'powershell.exe', hint: 'Windows PowerShell', platform: 'windows' },
  { value: 'cmd.exe',        label: 'cmd.exe',        hint: 'Windows cmd',        platform: 'windows' },
];

/**
 * 依當前作業系統排序 shell 選項：
 * - 當前平台適用者排在前，hint 加 "✅ 推薦"
 * - 其他選項仍保留（使用者可能要替其他機器設定）
 */
const buildShellOptions = (): { value: string; label: string; hint: string }[] => {
  const cur = getPlatform();
  const score = (opt: ShellOption): number => {
    if (opt.platform === 'cross') return 1;
    if (cur === 'windows' && opt.platform === 'windows') return 0;
    if ((cur === 'macos' || cur === 'linux') && opt.platform === 'unix') return 0;
    return 2;
  };
  return [...ALL_SHELL_OPTIONS]
    .sort((a, b) => score(a) - score(b))
    .map((opt) => {
      const s = score(opt);
      return {
        value: opt.value,
        label: opt.label,
        hint: s === 0 ? `✅ ${opt.hint}` : opt.hint,
      };
    });
};

const SHELL_OPTIONS = buildShellOptions();

// Force Login Method 官方支援值
const LOGIN_METHOD_OPTIONS = [
  { value: 'claudeai', label: 'claudeai', hint: 'Claude.ai 登入' },
  { value: 'console',  label: 'console',  hint: 'Anthropic Console API key' },
];

const AdvancedTab: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  /** 以 user 層為主要編輯對象 */
  const data: ClaudeSettings = files.user.data ?? {};
  /** attribution 巢狀物件 */
  const attribution: AttributionSettings = data.attribution ?? {};
  /** worktree 巢狀物件 */
  const worktree: WorktreeSettings = data.worktree ?? {};

  /**
   * 更新 user 層設定並儲存
   * @param patch 要合并的部分 ClaudeSettings
   */
  const update = async (patch: Partial<ClaudeSettings>) => {
    await saveFile('user', files.user.path, { ...data, ...patch });
  };

  /**
   * 更新 attribution 巢狀物件並儲存
   * @param patch 要合并的部分 AttributionSettings
   */
  const updateAttribution = async (patch: Partial<AttributionSettings>) => {
    await saveFile('user', files.user.path, {
      ...data,
      attribution: { ...attribution, ...patch },
    });
  };

  /**
   * 更新 worktree 巢狀物件並儲存
   * @param patch 要合并的部分 WorktreeSettings
   */
  const updateWorktree = async (patch: Partial<WorktreeSettings>) => {
    await saveFile('user', files.user.path, {
      ...data,
      worktree: { ...worktree, ...patch },
    });
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">⚙️ 進階設定</h2>
      <p className="tab-desc">Shell、Git、Auto Mode、認證、企業等進階設定項目。</p>

      {/* ── Shell & Git 區段 ── */}
      <p className="section-title">Shell &amp; Git</p>

      {/* 預設 Shell（Combo：常見 shell + 自訂） */}
      <div className="form-row">
        <label className="form-label">Default Shell</label>
        <ComboBox
          value={data.defaultShell ?? ''}
          options={SHELL_OPTIONS}
          onChange={(v) => update({ defaultShell: v || undefined })}
          placeholder="選擇常見 shell 或自訂路徑"
        />
      </div>

      {/* 包含 Git 操作指引 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Include Git Instructions</div>
          <div className="form-hint">在系統提示中加入 Git 操作最佳實踐說明</div>
        </div>
        <Toggle
          checked={data.includeGitInstructions ?? false}
          onChange={(v) => update({ includeGitInstructions: v })}
        />
      </div>

      <hr className="divider" />

      {/* ── Auto Mode 區段 ── */}
      <p className="section-title">Auto Mode</p>

      {/* 停用 Auto 模式 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Disable Auto Mode</div>
          <div className="form-hint">完全停用自動執行模式</div>
        </div>
        <Toggle
          checked={data.disableAutoMode ?? false}
          onChange={(v) => update({ disableAutoMode: v })}
        />
      </div>

      {/* Plan 模式中使用 Auto */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Use Auto Mode During Plan</div>
          <div className="form-hint">在 Plan 模式規劃階段也啟用 Auto 模式</div>
        </div>
        <Toggle
          checked={data.useAutoModeDuringPlan ?? false}
          onChange={(v) => update({ useAutoModeDuringPlan: v })}
        />
      </div>

      {/* 每次 session 選擇 Fast Mode */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Fast Mode Per Session Opt-In</div>
          <div className="form-hint">每次工作階段開始時詢問是否啟用快速模式</div>
        </div>
        <Toggle
          checked={data.fastModePerSessionOptIn ?? false}
          onChange={(v) => update({ fastModePerSessionOptIn: v })}
        />
      </div>

      <hr className="divider" />

      {/* ── Attribution 歸因區段 ── */}
      <p className="section-title">Attribution 歸因</p>

      {/* Commit 訊息模板 */}
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <label className="form-label" style={{ paddingTop: 6 }}>Commit 訊息模板</label>
        <div style={{ flex: 1 }}>
          <textarea
            rows={3}
            placeholder="例如：Co-authored-by: Claude <noreply@anthropic.com>"
            value={attribution.commit ?? ''}
            onChange={(e) => updateAttribution({ commit: e.target.value || undefined })}
            style={{
              width: '100%',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              padding: '8px 12px',
              resize: 'vertical',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="form-hint">附加至 git commit 訊息的歸因模板</div>
        </div>
      </div>

      {/* PR 描述模板 */}
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <label className="form-label" style={{ paddingTop: 6 }}>PR 描述模板</label>
        <div style={{ flex: 1 }}>
          <textarea
            rows={3}
            placeholder="例如：Generated with Claude Code"
            value={attribution.pr ?? ''}
            onChange={(e) => updateAttribution({ pr: e.target.value || undefined })}
            style={{
              width: '100%',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              padding: '8px 12px',
              resize: 'vertical',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="form-hint">附加至 Pull Request 描述的歸因模板</div>
        </div>
      </div>

      <hr className="divider" />

      {/* ── Worktree 區段 ── */}
      <p className="section-title">Worktree</p>

      {/* 要建立 symlink 的目錄清單 */}
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <label className="form-label" style={{ paddingTop: 6 }}>Symlink Directories</label>
        <div style={{ flex: 1 }}>
          <TagArrayInput
            value={worktree.symlinkDirectories ?? []}
            onChange={(v) => updateWorktree({ symlinkDirectories: v.length ? v : undefined })}
            placeholder="目錄路徑，例如 node_modules"
          />
          <div className="form-hint">在 worktree 中建立 symlink 的目錄清單，避免重複安裝</div>
        </div>
      </div>

      {/* sparse checkout 路徑 */}
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <label className="form-label" style={{ paddingTop: 6 }}>Sparse Paths</label>
        <div style={{ flex: 1 }}>
          <TagArrayInput
            value={worktree.sparsePaths ?? []}
            onChange={(v) => updateWorktree({ sparsePaths: v.length ? v : undefined })}
            placeholder="路徑，例如 src/"
          />
          <div className="form-hint">Worktree 的 sparse checkout 路徑，僅取出指定路徑</div>
        </div>
      </div>

      <hr className="divider" />

      {/* ── 認證 / API 區段 ── */}
      <p className="section-title">認證 / API</p>

      {/* API Key Helper */}
      <div className="form-row">
        <label className="form-label">API Key Helper</label>
        <input
          type="text"
          placeholder="執行以取得 API Key 的命令"
          value={data.apiKeyHelper ?? ''}
          onChange={(e) => update({ apiKeyHelper: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
      </div>

      {/* AWS Auth Refresh */}
      <div className="form-row">
        <label className="form-label">AWS Auth Refresh</label>
        <input
          type="text"
          placeholder="AWS 認證刷新命令"
          value={data.awsAuthRefresh ?? ''}
          onChange={(e) => update({ awsAuthRefresh: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
      </div>

      {/* AWS Credential Export */}
      <div className="form-row">
        <label className="form-label">AWS Credential Export</label>
        <input
          type="text"
          placeholder="AWS 憑證匯出命令"
          value={data.awsCredentialExport ?? ''}
          onChange={(e) => update({ awsCredentialExport: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
      </div>

      {/* Force Login Method（純下拉：僅官方兩個值） */}
      <div className="form-row">
        <label className="form-label">Force Login Method</label>
        <select
          value={data.forceLoginMethod ?? ''}
          onChange={(e) => update({ forceLoginMethod: e.target.value || undefined })}
          style={{ flex: 1, maxWidth: 260 }}
        >
          <option value="">（不強制）</option>
          {LOGIN_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.hint}
            </option>
          ))}
        </select>
      </div>

      {/* Force Login Org UUID */}
      <div className="form-row">
        <label className="form-label">Force Login Org UUID</label>
        <input
          type="text"
          placeholder="強制登入的組織 UUID"
          value={data.forceLoginOrgUUID ?? ''}
          onChange={(e) => update({ forceLoginOrgUUID: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
      </div>

      {/* OTel Headers Helper */}
      <div className="form-row">
        <label className="form-label">OTel Headers Helper</label>
        <input
          type="text"
          placeholder="OpenTelemetry headers 輔助命令"
          value={data.otelHeadersHelper ?? ''}
          onChange={(e) => update({ otelHeadersHelper: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
      </div>

      <hr className="divider" />

      {/* ── 企業設定區段 ── */}
      <p className="section-title">企業設定</p>

      {/* 公司公告清單 */}
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <label className="form-label" style={{ paddingTop: 6 }}>Company Announcements</label>
        <div style={{ flex: 1 }}>
          <TagArrayInput
            value={data.companyAnnouncements ?? []}
            onChange={(v) => update({ companyAnnouncements: v.length ? v : undefined })}
            placeholder="輸入公告內容後按 Enter"
          />
          <div className="form-hint">顯示在 Claude 介面中的公司公告訊息</div>
        </div>
      </div>

      {/* Plugin Trust Message */}
      <div className="form-row">
        <label className="form-label">Plugin Trust Message</label>
        <input
          type="text"
          placeholder="安裝插件時的信任提示訊息"
          value={data.pluginTrustMessage ?? ''}
          onChange={(e) => update({ pluginTrustMessage: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
      </div>

      {/* Feedback Survey Rate */}
      <div className="form-row">
        <label className="form-label">Feedback Survey Rate</label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          placeholder="0.0 ~ 1.0"
          value={data.feedbackSurveyRate ?? ''}
          onChange={(e) => update({ feedbackSurveyRate: e.target.value ? Number(e.target.value) : undefined })}
          style={{ width: 120 }}
        />
        <span className="form-hint">意見調查觸發機率（0 = 不顯示，1 = 每次顯示）</span>
      </div>

      {/* Auto Memory Directory */}
      <div className="form-row">
        <label className="form-label">Auto Memory Directory</label>
        <input
          type="text"
          placeholder="例如 ~/.claude/memory"
          value={data.autoMemoryDirectory ?? ''}
          onChange={(e) => update({ autoMemoryDirectory: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
        <span className="form-hint">自動記憶檔案的儲存目錄</span>
      </div>

      {/* Plans Directory */}
      <div className="form-row">
        <label className="form-label">Plans Directory</label>
        <input
          type="text"
          placeholder="例如 ~/.claude/plans"
          value={data.plansDirectory ?? ''}
          onChange={(e) => update({ plansDirectory: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
        <span className="form-hint">Plan 檔案的儲存目錄</span>
      </div>

      {/* 停用 Deep Link 註冊 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Disable Deep Link Registration</div>
          <div className="form-hint">停用 Claude Code 的 deep link（claude://）URL scheme 註冊</div>
        </div>
        <Toggle
          checked={data.disableDeepLinkRegistration ?? false}
          onChange={(v) => update({ disableDeepLinkRegistration: v })}
        />
      </div>

      {/* Cleanup Period Days */}
      <div className="form-row">
        <label className="form-label">Cleanup Period（天）</label>
        <input
          type="number"
          min={1}
          max={365}
          placeholder="預設 30"
          value={data.cleanupPeriodDays ?? ''}
          onChange={(e) => update({ cleanupPeriodDays: e.target.value ? Number(e.target.value) : undefined })}
          style={{ width: 120 }}
        />
        <span className="form-hint">對話記錄的自動清理週期（天數）</span>
      </div>

    </div>
  );
};

export default AdvancedTab;
