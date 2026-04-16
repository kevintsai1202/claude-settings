/**
 * 欄位驗證錯誤顯示元件
 * 顯示在欄位下方的紅色小字錯誤提示，error 為 null 時不渲染
 */
import React from 'react';

/** FieldError 元件的 Props */
interface FieldErrorProps {
  /** 錯誤訊息，為 null 時元件不渲染 */
  error: string | null;
}

/**
 * 欄位錯誤訊息元件
 * @param props.error 錯誤訊息字串，null 表示無錯誤
 */
const FieldError: React.FC<FieldErrorProps> = ({ error }) => {
  if (!error) return null;

  return (
    <p
      role="alert"
      style={{
        color: '#ef4444',
        fontSize: '0.75rem',
        marginTop: '0.25rem',
        marginBottom: 0,
        lineHeight: 1.4,
      }}
    >
      {error}
    </p>
  );
};

export default FieldError;
