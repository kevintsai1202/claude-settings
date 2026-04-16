/**
 * ManagedBadge 管理層標示元件
 * 顯示欄位來自 managed 層（唯讀）的視覺提示
 */
import React from 'react';

interface ManagedBadgeProps {
  /** 顯示文字，預設為 "Managed" */
  label?: string;
}

const ManagedBadge: React.FC<ManagedBadgeProps> = ({ label = 'Managed' }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      background: 'var(--bg-active)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      fontSize: '11px',
      color: 'var(--text-secondary, #888)',
      userSelect: 'none',
      verticalAlign: 'middle',
    }}
    title="此欄位由 managed 層控制，無法在此編輯"
  >
    🔒
    <span>{label}</span>
  </span>
);

export default ManagedBadge;
