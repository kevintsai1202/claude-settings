/**
 * TabBar — 兩層導航（類別 → Tab）
 * 上層：3 個類別（設定 / 資源 / 文件）
 * 下層：當前類別底下的 Tab 清單
 */
import React from 'react';
import {
  SlidersHorizontal,
  ShieldCheck,
  Webhook,
  KeyRound,
  FileText,
  GitMerge,
  Braces,
  Box,
  Plug,
  Wrench,
  Globe,
  Bot,
  Terminal,
  Palette,
  Activity,
  BookOpen,
  Ruler,
  Brain,
  Settings,
  Layers,
  FolderTree,
} from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import type { TabId } from '../../types/settings';
import './TabBar.css';

/** 類別 ID */
type CategoryId = 'settings' | 'resources' | 'files';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: React.ReactNode;
  tabs: TabDef[];
}

/** 類別定義 —— 把 16 個 Tab 依功能分為 3 大類 */
const CATEGORIES: CategoryDef[] = [
  {
    id: 'settings',
    label: '設定',
    icon: <Settings size={14} />,
    tabs: [
      { id: 'basic',       label: '基本設定',    icon: <SlidersHorizontal size={14} /> },
      { id: 'permissions', label: 'Permissions', icon: <ShieldCheck size={14} /> },
      { id: 'hooks',       label: 'Hooks',       icon: <Webhook size={14} /> },
      { id: 'env',         label: 'Env Vars',    icon: <KeyRound size={14} /> },
      { id: 'sandbox',     label: 'Sandbox',     icon: <Box size={14} /> },
      { id: 'advanced',    label: '進階設定',    icon: <Wrench size={14} /> },
      { id: 'global',      label: '全域設定',    icon: <Globe size={14} /> },
    ],
  },
  {
    id: 'resources',
    label: '資源',
    icon: <Layers size={14} />,
    tabs: [
      { id: 'agents',       label: 'Agents',        icon: <Bot size={14} /> },
      { id: 'commands',     label: 'Commands',      icon: <Terminal size={14} /> },
      { id: 'outputstyles', label: 'Output Styles', icon: <Palette size={14} /> },
      { id: 'skills',       label: 'Skills',        icon: <BookOpen size={14} /> },
      { id: 'rules',        label: 'Rules',         icon: <Ruler size={14} /> },
      { id: 'mcp',          label: 'MCP / Plugins', icon: <Plug size={14} /> },
      { id: 'statusline',   label: 'Status Line',   icon: <Activity size={14} /> },
    ],
  },
  {
    id: 'files',
    label: '文件',
    icon: <FolderTree size={14} />,
    tabs: [
      { id: 'claudemd', label: 'CLAUDE.md', icon: <FileText size={14} /> },
      { id: 'memory',   label: 'Memory',    icon: <Brain size={14} /> },
      { id: 'merge',    label: 'Merge',     icon: <GitMerge size={14} /> },
      { id: 'json',     label: 'JSON',      icon: <Braces size={14} /> },
    ],
  },
];

/** 反查：給定 tabId 找它屬於哪個類別 */
const findCategoryByTab = (tabId: TabId): CategoryDef => {
  return CATEGORIES.find((cat) => cat.tabs.some((t) => t.id === tabId)) ?? CATEGORIES[0];
};

const TabBar: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  /** 依目前 active tab 推算所屬類別，保持兩層一致 */
  const activeCategory = findCategoryByTab(activeTab);

  /** 切換類別：自動選到該類別的第一個 tab */
  const handleCategoryClick = (cat: CategoryDef) => {
    if (cat.id === activeCategory.id) return;
    setActiveTab(cat.tabs[0].id);
  };

  return (
    <nav className="tabbar-wrap">
      {/* 上層：類別列 */}
      <div className="tabbar-cat">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`tabbar-cat__btn${activeCategory.id === cat.id ? ' tabbar-cat__btn--active' : ''}`}
            onClick={() => handleCategoryClick(cat)}
          >
            <span className="tabbar-cat__icon">{cat.icon}</span>
            <span className="tabbar-cat__label">{cat.label}</span>
            <span className="tabbar-cat__count">{cat.tabs.length}</span>
          </button>
        ))}
      </div>

      {/* 下層：當前類別的 Tabs */}
      <div className="tabbar">
        {activeCategory.tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tabbar__tab${activeTab === tab.id ? ' tabbar__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tabbar__icon">{tab.icon}</span>
            <span className="tabbar__label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default TabBar;
