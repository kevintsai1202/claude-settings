/**
 * TabBar — 頂部 Tab 導航列
 * 支援十一個功能 Tab 的切換
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
} from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import type { TabId } from '../../types/settings';
import './TabBar.css';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'basic',       label: '基本設定',      icon: <SlidersHorizontal size={14} /> },
  { id: 'permissions', label: 'Permissions',   icon: <ShieldCheck size={14} /> },
  { id: 'hooks',       label: 'Hooks',         icon: <Webhook size={14} /> },
  { id: 'env',         label: 'Env Vars',      icon: <KeyRound size={14} /> },
  { id: 'sandbox',     label: 'Sandbox',       icon: <Box size={14} /> },
  { id: 'mcp',         label: 'MCP / Plugins', icon: <Plug size={14} /> },
  { id: 'advanced',    label: '進階設定',      icon: <Wrench size={14} /> },
  { id: 'global',      label: '全域設定',      icon: <Globe size={14} /> },
  { id: 'claudemd',    label: 'CLAUDE.md',     icon: <FileText size={14} /> },
  { id: 'merge',       label: 'Merge',         icon: <GitMerge size={14} /> },
  { id: 'json',        label: 'JSON',          icon: <Braces size={14} /> },
];

const TabBar: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tabbar__tab${activeTab === tab.id ? ' tabbar__tab--active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tabbar__icon">{tab.icon}</span>
          <span className="tabbar__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default TabBar;
