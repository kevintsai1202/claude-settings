/**
 * Sidebar — 左側受管檔案狀態面板（唯讀）
 * 分兩個區段：
 *   1. Settings.json  — user / project / local / managed 四層
 *   2. CLAUDE.md      — global / project 兩份
 * 每個項目顯示檔案狀態徽章 + dirty 指示點，僅供檢視不可互動
 */
import React from 'react';
import { User, FolderOpen, Monitor, Lock, FileText, Globe, Circle, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import StatusBadge from '../ui/StatusBadge';
import type { SettingsLayer } from '../../types/settings';
import './Sidebar.css';

// Settings.json 各層顯示名稱
const LAYER_LABELS: Record<SettingsLayer, string> = {
  user:    'User',
  project: 'Project',
  local:   'Local',
  managed: 'Managed',
};

// Settings.json 各層 icon
const LAYER_ICONS: Record<SettingsLayer, React.ReactNode> = {
  user:    <User size={14} />,
  project: <FolderOpen size={14} />,
  local:   <Monitor size={14} />,
  managed: <Lock size={14} />,
};

const LAYER_ORDER: SettingsLayer[] = ['user', 'project', 'local', 'managed'];

/** Dirty 指示點：若 dirty 則在名稱後附小橘點 */
const DirtyDot: React.FC<{ dirty: boolean }> = ({ dirty }) =>
  dirty ? (
    <Circle
      size={7}
      fill="var(--color-warning)"
      stroke="none"
      style={{ marginLeft: 5, verticalAlign: 'middle' }}
    />
  ) : null;

const Sidebar: React.FC = () => {
  const { files, claudeMd, projectDir } = useAppStore();
  const { openProject } = useFileManager();

  /** 取路徑最後一段作為顯示名稱（跨平台相容 \ 與 /） */
  const projectName = projectDir
    ? (projectDir.split(/[\\/]/).filter(Boolean).pop() ?? projectDir)
    : null;

  return (
    <aside className="sidebar">
      {/* ── 專案選擇器（常駐於 Sidebar 最上方）── */}
      <button
        className={`sidebar__project-btn${projectDir ? ' sidebar__project-btn--active' : ''}`}
        onClick={openProject}
        title={projectDir ? `目前專案：${projectDir}\n點擊切換其他專案` : '選擇專案目錄'}
      >
        <FolderOpen size={14} className="sidebar__project-btn-icon" />
        <span className="sidebar__project-btn-name">
          {projectName ?? '選擇專案'}
        </span>
        <ChevronDown size={12} className="sidebar__project-btn-chevron" />
      </button>

      {/* ── 分組 1：Settings.json ── */}
      <div className="sidebar__group">
        <div className="sidebar__group-title">
          <span className="sidebar__group-icon">📋</span>
          Settings.json
        </div>
        <ul className="sidebar__file-list">
          {LAYER_ORDER.map((layer) => {
            const file = files[layer];
            return (
              <li
                key={layer}
                className={`sidebar__file-item${file.dirty ? ' sidebar__file-item--dirty' : ''}`}
                title={`${file.path}${file.dirty ? '（未儲存）' : ''}`}
              >
                <span className="sidebar__file-icon">{LAYER_ICONS[layer]}</span>
                <div className="sidebar__file-info">
                  <span className="sidebar__file-name">
                    {LAYER_LABELS[layer]}
                    <DirtyDot dirty={file.dirty} />
                  </span>
                  <StatusBadge status={file.status} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── 分組 2：CLAUDE.md ── */}
      <div className="sidebar__group">
        <div className="sidebar__group-title">
          <span className="sidebar__group-icon">📝</span>
          CLAUDE.md
        </div>
        <ul className="sidebar__file-list">
          <li
            className={`sidebar__file-item${claudeMd.global.dirty ? ' sidebar__file-item--dirty' : ''}`}
            title={`${claudeMd.global.path}${claudeMd.global.dirty ? '（未儲存）' : ''}`}
          >
            <span className="sidebar__file-icon"><Globe size={14} /></span>
            <div className="sidebar__file-info">
              <span className="sidebar__file-name">
                Global
                <DirtyDot dirty={claudeMd.global.dirty} />
              </span>
              <StatusBadge status={claudeMd.global.status} />
            </div>
          </li>
          <li
            className={`sidebar__file-item${claudeMd.project.dirty ? ' sidebar__file-item--dirty' : ''}`}
            title={`${claudeMd.project.path || '（未開啟專案）'}${claudeMd.project.dirty ? '（未儲存）' : ''}`}
          >
            <span className="sidebar__file-icon"><FileText size={14} /></span>
            <div className="sidebar__file-info">
              <span className="sidebar__file-name">
                Project
                <DirtyDot dirty={claudeMd.project.dirty} />
              </span>
              <StatusBadge status={claudeMd.project.status} />
            </div>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
