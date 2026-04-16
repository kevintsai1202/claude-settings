/**
 * CollapsibleSection 可折疊區段元件
 * 用於 Sandbox 等設定頁的分組顯示，支援展開/收合
 */
import React, { useState } from 'react';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = true,
}) => {
  /** 目前展開狀態 */
  const [isOpen, setIsOpen] = useState(defaultOpen);

  /** 切換展開/收合狀態 */
  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`collapsible-section${isOpen ? ' collapsible-section--open' : ''}`}>
      <button
        type="button"
        className="collapsible-section__header"
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <span className="collapsible-section__title">{title}</span>
        <span className="collapsible-section__arrow" aria-hidden="true">
          {isOpen ? '▾' : '▸'}
        </span>
      </button>
      {isOpen && (
        <div className="collapsible-section__body">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
