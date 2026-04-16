/**
 * StatusBadge — 顯示設定檔的讀取狀態
 */
import React from 'react';
import type { FileStatus } from '../../types/settings';

interface StatusBadgeProps {
  status: FileStatus;
}

const STATUS_TEXT: Record<FileStatus, string> = {
  ok:       '有效',
  missing:  '不存在',
  invalid:  '格式錯誤',
  readonly: '唯讀',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span className={`badge badge-${status}`}>
    {STATUS_TEXT[status]}
  </span>
);

export default StatusBadge;
