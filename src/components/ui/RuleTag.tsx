/**
 * RuleTag — 顯示單一權限規則標籤（allow / ask / deny）
 */
import React from 'react';

interface RuleTagProps {
  rule: string;                          // 規則字串，例如 "Bash(npm run *)"
  type: 'allow' | 'ask' | 'deny';
  onDelete?: () => void;
}

const RuleTag: React.FC<RuleTagProps> = ({ rule, type, onDelete }) => (
  <span className={`tag tag-${type}`}>
    <span className="mono">{rule}</span>
    {onDelete && (
      <button
        onClick={onDelete}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', opacity: 0.7, lineHeight: 1, marginLeft: 2 }}
        title="刪除規則"
      >
        ✕
      </button>
    )}
  </span>
);

export default RuleTag;
