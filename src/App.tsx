/**
 * App.tsx — 根元件，負責三欄式佈局與 Tab 路由
 * 應用程式啟動時自動載入 User 層設定
 */
import React, { useEffect } from 'react';
import { Settings, Sun, Moon } from 'lucide-react';
import Sidebar from './components/Sidebar/Sidebar';
import TabBar from './components/TabBar/TabBar';
import BasicSettings from './components/tabs/BasicSettings';
import Permissions from './components/tabs/Permissions';
import Hooks from './components/tabs/Hooks';
import EnvVars from './components/tabs/EnvVars';
import ClaudeMd from './components/tabs/ClaudeMd';
import MergePreview from './components/tabs/MergePreview';
import JsonEditor from './components/tabs/JsonEditor';
import { useAppStore } from './store/settingsStore';
import { useFileManager } from './hooks/useFileManager';
import { useTheme } from './hooks/useTheme';
import './App.css';

// Tab 元件對照表
const TAB_COMPONENTS: Record<string, React.FC> = {
  basic:       BasicSettings,
  permissions: Permissions,
  hooks:       Hooks,
  env:         EnvVars,
  claudemd:    ClaudeMd,
  merge:       MergePreview,
  json:        JsonEditor,
};

const App: React.FC = () => {
  const { activeTab, isDirty } = useAppStore();
  const { loadUserSettings } = useFileManager();
  const { theme, toggle } = useTheme();

  // 啟動時自動載入 User 層設定
  useEffect(() => {
    loadUserSettings();
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
          <span className="app-header__version">v1.0.0</span>
        </div>

        <div className="app-header__right">
          {isDirty && (
            <span className="app-header__dirty">● 有未儲存的變更</span>
          )}
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
