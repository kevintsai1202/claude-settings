/**
 * Toggle 開關元件
 * 顯示 ON/OFF 狀態的滑動開關
 */
import React from 'react';
import './Toggle.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled = false, label }) => (
  <label className={`toggle${disabled ? ' toggle--disabled' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => !disabled && onChange(e.target.checked)}
      disabled={disabled}
    />
    <span className="toggle__track">
      <span className="toggle__thumb" />
    </span>
    {label && <span className="toggle__label">{label}</span>}
  </label>
);

export default Toggle;
