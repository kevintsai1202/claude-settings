/**
 * GlobalTab — 全域設定表單
 * 讀寫 globalFile（GlobalSettings，儲存於 ~/.claude.json）
 * 與 settings.json 分離，屬於全域 IDE 相關設定
 */
import React from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import Toggle from '../ui/Toggle';
import type { GlobalSettings } from '../../types/settings';
import './TabContent.css';

const GlobalTab: React.FC = () => {
  const { globalFile } = useAppStore();
  const { saveGlobalFile } = useFileManager();

  /** 目前全域設定資料（可能為空物件） */
  const data: GlobalSettings = globalFile.data ?? {};

  /**
   * 更新全域設定並儲存至 ~/.claude.json
   * @param patch 要合并的部分 GlobalSettings
   */
  const update = async (patch: Partial<GlobalSettings>) => {
    await saveGlobalFile({ ...data, ...patch });
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🌐 全域設定</h2>
      <p className="tab-desc">
        這些設定儲存於 <span className="mono">~/.claude.json</span>，與 settings.json 分離，屬於全域 IDE 相關設定。
      </p>

      {/* 全域設定檔路徑提示 */}
      <div
        style={{
          marginBottom: 20,
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        目前路徑：<code>{globalFile.path}</code>
        &nbsp;|&nbsp;
        狀態：<strong>{globalFile.status}</strong>
      </div>

      {/* 自動連線 IDE */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Auto Connect IDE</div>
          <div className="form-hint">Claude Code 啟動時自動連線到已開啟的 IDE</div>
        </div>
        <Toggle
          checked={data.autoConnectIde ?? false}
          onChange={(v) => update({ autoConnectIde: v })}
        />
      </div>

      {/* 自動安裝 IDE 擴充 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Auto Install IDE Extension</div>
          <div className="form-hint">自動偵測並安裝 IDE 的 Claude Code 擴充套件</div>
        </div>
        <Toggle
          checked={data.autoInstallIdeExtension ?? false}
          onChange={(v) => update({ autoInstallIdeExtension: v })}
        />
      </div>

      {/* 編輯器模式 */}
      <div className="form-row">
        <label className="form-label">Editor Mode</label>
        <select
          value={data.editorMode ?? 'normal'}
          onChange={(e) => update({ editorMode: e.target.value as GlobalSettings['editorMode'] })}
        >
          <option value="normal">Normal（預設）</option>
          <option value="vim">Vim（Vim 鍵盤操作）</option>
        </select>
        <span className="form-hint">文字輸入框的按鍵操作模式</span>
      </div>

      {/* 顯示對話輪次時長 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Show Turn Duration</div>
          <div className="form-hint">在每次對話輪次結束後顯示耗時資訊</div>
        </div>
        <Toggle
          checked={data.showTurnDuration ?? false}
          onChange={(v) => update({ showTurnDuration: v })}
        />
      </div>

      {/* 啟用終端進度列 */}
      <div className="form-row form-row--toggle">
        <div>
          <div className="form-label">Terminal Progress Bar Enabled</div>
          <div className="form-hint">在終端機顯示任務進度列</div>
        </div>
        <Toggle
          checked={data.terminalProgressBarEnabled ?? false}
          onChange={(v) => update({ terminalProgressBarEnabled: v })}
        />
      </div>

      {/* 協作模式 */}
      <div className="form-row">
        <label className="form-label">Teammate Mode</label>
        <select
          value={data.teammateMode ?? 'auto'}
          onChange={(e) => update({ teammateMode: e.target.value as GlobalSettings['teammateMode'] })}
        >
          <option value="auto">Auto（自動選擇）</option>
          <option value="in-process">In-Process（同一 process 執行）</option>
          <option value="tmux">Tmux（透過 tmux 多工執行）</option>
        </select>
        <span className="form-hint">多人協作或平行任務的執行模式</span>
      </div>

    </div>
  );
};

export default GlobalTab;
