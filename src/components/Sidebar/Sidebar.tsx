/**
 * Sidebar — 左側文件管理面板
 * 顯示各層設定檔狀態，並提供開啟專案目錄的入口
 */
import React from 'react';
import { User, FolderOpen, Monitor, Lock, FolderInput } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import StatusBadge from '../ui/StatusBadge';
import type { SettingsLayer } from '../../types/settings';
import './Sidebar.css';

// 各層顯示名稱
const LAYER_LABELS: Record<SettingsLayer, string> = {
  user:    'User',
  project: 'Project',
  local:   'Local',
  managed: 'Managed',
};

// 各層 Lucide 圖示
const LAYER_ICONS: Record<SettingsLayer, React.ReactNode> = {
  user:    <User size={14} />,
  project: <FolderOpen size={14} />,
  local:   <Monitor size={14} />,
  managed: <Lock size={14} />,
};

const LAYER_ORDER: SettingsLayer[] = ['user', 'project', 'local', 'managed'];

const Sidebar: React.FC = () => {
  const { files, projectDir } = useAppStore();
  const { openProject } = useFileManager();

  return (
    <aside className="sidebar">
      {/* 標題 */}
      <div className="sidebar__header">
        <span className="section-title">Files</span>
      </div>

      {/* 設定檔列表 */}
      <ul className="sidebar__file-list">
        {LAYER_ORDER.map((layer) => {
          const file = files[layer];
          return (
            <li key={layer} className="sidebar__file-item">
              <span className="sidebar__file-icon">{LAYER_ICONS[layer]}</span>
              <div className="sidebar__file-info">
                <span className="sidebar__file-name">{LAYER_LABELS[layer]}</span>
                <StatusBadge status={file.status} />
              </div>
            </li>
          );
        })}
      </ul>

      <hr className="divider" />

      {/* 專案目錄顯示 */}
      {projectDir && (
        <div className="sidebar__project">
          <span className="section-title">Project</span>
          <p className="sidebar__project-path mono" title={projectDir}>
            {projectDir.split('\\').pop() ?? projectDir}
          </p>
        </div>
      )}

      {/* 開啟專案按鈕 */}
      <button className="sidebar__open-btn" onClick={openProject}>
        <FolderInput size={13} />
        開啟專案
      </button>
    </aside>
  );
};

export default Sidebar;
