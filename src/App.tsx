/**
 * App.tsx — 根元件，負責三欄式佈局與 Tab 路由
 * 應用程式啟動時自動載入 User 層設定
 */
import React, { useEffect, useState } from 'react';
import { Settings, Sun, Moon, Save, Undo2 } from 'lucide-react';
import Sidebar from './components/Sidebar/Sidebar';
import TabBar from './components/TabBar/TabBar';
import BasicSettings from './components/tabs/BasicSettings';
import Permissions from './components/tabs/Permissions';
import Hooks from './components/tabs/Hooks';
import EnvVars from './components/tabs/EnvVars';
import ClaudeMd from './components/tabs/ClaudeMd';
import MergePreview from './components/tabs/MergePreview';
import JsonEditor from './components/tabs/JsonEditor';
import SandboxTab from './components/tabs/SandboxTab';
import McpPluginsTab from './components/tabs/McpPluginsTab';
import AdvancedTab from './components/tabs/AdvancedTab';
import GlobalTab from './components/tabs/GlobalTab';
import AgentsTab from './components/tabs/AgentsTab';
import CommandsTab from './components/tabs/CommandsTab';
import OutputStylesTab from './components/tabs/OutputStylesTab';
import SkillsTab from './components/tabs/SkillsTab';
import StatusLineTab from './components/tabs/StatusLineTab';
import { useAppStore, getTotalDirtyCount } from './store/settingsStore';
import { useFileManager } from './hooks/useFileManager';
import { useResourceLoader } from './hooks/useResourceLoader';
import { useTheme } from './hooks/useTheme';
import './App.css';
import type { SettingsLayer } from './types/settings';

// Tab 元件對照表
const TAB_COMPONENTS: Record<string, React.FC> = {
  basic:        BasicSettings,
  permissions:  Permissions,
  hooks:        Hooks,
  env:          EnvVars,
  sandbox:      SandboxTab,
  mcp:          McpPluginsTab,
  agents:       AgentsTab,
  commands:     CommandsTab,
  outputstyles: OutputStylesTab,
  skills:       SkillsTab,
  statusline:   StatusLineTab,
  advanced:     AdvancedTab,
  global:       GlobalTab,
  claudemd:     ClaudeMd,
  merge:        MergePreview,
  json:         JsonEditor,
};

const App: React.FC = () => {
  const { activeTab, projectDir, files, globalFile, claudeMd } = useAppStore();
  const { loadUserSettings, commitAll, undoFile, undoGlobal, undoClaudeMd } = useFileManager();
  const { loadAllResources } = useResourceLoader();
  const { theme, toggle } = useTheme();

  /** 儲存後短暫顯示 toast */
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  /** 計算目前 dirty 檔案數 */
  const dirtyCount = getTotalDirtyCount(useAppStore.getState());

  /** 是否有任何可 undo 的 snapshot */
  const canUndoAny =
    (['user', 'project', 'local', 'managed'] as SettingsLayer[]).some((l) => files[l].previousData !== undefined) ||
    globalFile.previousData !== undefined ||
    claudeMd.global.previousContent !== undefined ||
    claudeMd.project.previousContent !== undefined;

  // 啟動時自動載入 User 層設定與衍生資源（agents / commands / output styles）
  useEffect(() => {
    loadUserSettings();
    loadAllResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切換專案時重新載入 project 層的 agents/commands/output styles
  useEffect(() => {
    loadAllResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  /** 儲存全部 dirty 檔案 */
  const handleSaveAll = async () => {
    if (dirtyCount === 0) return;
    const written = await commitAll();
    setSavedMessage(`✓ 已儲存 ${written} 個檔案`);
    setTimeout(() => setSavedMessage(null), 2000);
  };

  /** 復原最近一次變更：優先順序 settings 層 > global > claudeMd */
  const handleUndo = () => {
    for (const l of ['user', 'project', 'local', 'managed'] as SettingsLayer[]) {
      if (files[l].previousData !== undefined) { undoFile(l); return; }
    }
    if (globalFile.previousData !== undefined) { undoGlobal(); return; }
    for (const scope of ['global', 'project'] as const) {
      if (claudeMd[scope].previousContent !== undefined) { undoClaudeMd(scope); return; }
    }
  };

  /** Ctrl+S 儲存、Ctrl+Z 復原 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAll();
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        // 只在非輸入元件內觸發（textarea/input 由原生 undo 處理）
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'TEXTAREA' && tag !== 'INPUT') {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyCount, canUndoAny]);

  /**
   * 視窗關閉攔截 — 僅在有 dirty 時介入
   * 無 dirty：不註冊 preventDefault，Tauri 預設關閉行為生效
   * 有 dirty：preventDefault → ask() → 使用者確認後呼叫 win.destroy() 主動關閉
   *   （不依賴「不呼叫 preventDefault 即關閉」的預設行為，避免 Tauri v2 async handler 時序問題）
   */
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const { ask } = await import('@tauri-apps/plugin-dialog');
        const win = getCurrentWindow();
        if (cancelled) return;
        unlisten = await win.onCloseRequested(async (event) => {
          const count = getTotalDirtyCount(useAppStore.getState());
          if (count === 0) {
            // 無未儲存變更 — 直接放行，不做任何事
            return;
          }
          // 有未儲存變更 — 先攔下事件，顯示確認對話框
          event.preventDefault();
          const confirmed = await ask(
            `還有 ${count} 個檔案未儲存，關閉後變更將遺失。\n\n確定關閉？`,
            { title: '未儲存的變更', kind: 'warning', okLabel: '確定關閉', cancelLabel: '取消' }
          );
          if (confirmed) {
            // 使用者確認關閉 — 主動 destroy
            await win.destroy();
          }
          // 否則保持攔下，視窗維持開啟
        });
      } catch {
        // 非 Tauri 環境（dev in browser）忽略
      }
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  const ActiveTab = TAB_COMPONENTS[activeTab] ?? BasicSettings;

  return (
    <div className="app-layout">
      {/* 頂部標題列 */}
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo">
            <Settings size={16} />
          </span>
          <span className="app-header__title">Claude Settings Manager</span>
          <span className="app-header__version">v3.0.0</span>
        </div>

        <div className="app-header__right">
          {/* Saved toast */}
          {savedMessage && (
            <span className="app-header__saved">{savedMessage}</span>
          )}

          {/* Dirty 徽章 */}
          {dirtyCount > 0 && (
            <span className="app-header__dirty" title="尚有未儲存的變更">
              ● {dirtyCount} 檔案未儲存
            </span>
          )}

          {/* Undo 按鈕 */}
          <button
            className="header-btn"
            onClick={handleUndo}
            disabled={!canUndoAny}
            title="復原上一次變更（Ctrl+Z）"
          >
            <Undo2 size={13} />
            <span>復原</span>
          </button>

          {/* 儲存全部按鈕 */}
          <button
            className={`header-btn header-btn--primary${dirtyCount > 0 ? ' header-btn--pulse' : ''}`}
            onClick={handleSaveAll}
            disabled={dirtyCount === 0}
            title="將所有變更寫入磁碟（Ctrl+S）"
          >
            <Save size={13} />
            <span>儲存全部{dirtyCount > 0 ? ` (${dirtyCount})` : ''}</span>
          </button>

          {/* 日夜模式切換 */}
          <button
            className="theme-toggle"
            onClick={toggle}
            title={theme === 'dark' ? '切換為亮色模式' : '切換為深色模式'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* 主體：左側欄 + 右側內容 */}
      <div className="app-body">
        <Sidebar />

        {/* 右側：Tab 導航 + Tab 內容 */}
        <div className="app-main">
          <TabBar />
          <div className="app-tab-content">
            <ActiveTab />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
