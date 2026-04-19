/**
 * ConfirmDialog — 通用二次確認視窗
 * 用於破壞性操作前的使用者確認（如刪除 session）
 */
import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** 主要說明（支援多行；渲染為純文字，不解析 HTML） */
  message: string;
  /** 額外強警告（紅底）；可選 */
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  warning,
  confirmLabel = '確認',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // 開啟時聚焦到「取消」按鈕（安全預設）
  useEffect(() => {
    if (isOpen) cancelBtnRef.current?.focus();
  }, [isOpen]);

  // ESC 關閉
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-dialog__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="confirm-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="confirm-dialog__header">
          <AlertTriangle size={18} className="confirm-dialog__icon" />
          <h2 id="confirm-dialog-title" className="confirm-dialog__title">
            {title}
          </h2>
        </div>
        <div className="confirm-dialog__body">
          <p className="confirm-dialog__message">{message}</p>
          {warning && (
            <p className="confirm-dialog__warning">{warning}</p>
          )}
        </div>
        <div className="confirm-dialog__footer">
          <button
            ref={cancelBtnRef}
            className="confirm-dialog__btn confirm-dialog__btn--secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="confirm-dialog__btn confirm-dialog__btn--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
