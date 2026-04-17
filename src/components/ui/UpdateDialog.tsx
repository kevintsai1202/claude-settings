/// UpdateDialog — 自動更新對話框
/// 根據 useUpdater 的狀態機渲染不同畫面：有更新 / 下載中 / 完成 / 錯誤
import React from 'react';
import { Download, RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react';
import type { UseUpdaterReturn, DownloadProgress } from '../../hooks/useUpdater';
import { setSkippedVersion } from '../../utils/skippedVersion';
import './UpdateDialog.css';

interface UpdateDialogProps {
  updater: UseUpdaterReturn;
  /// 由父層判斷是否真的要顯示（會考慮 skipped version + 觸發來源）
  isOpen: boolean;
  /// 對話框關閉時通知父層同步狀態
  onClose: () => void;
}

/// 把進度資訊（bytes）格式化成「百分比 + MB 數」雙顯示文字
///
/// 給開發者的決策說明：
/// - 預期格式：左側顯示「12.3 MB / 45.6 MB」，右側顯示「27%」
/// - 但 contentLength 可能為 null（伺服器未回報 Content-Length），此時 percent 無從計算
/// - 你需決定：null 時要顯示什麼？「下載中…」？只顯示已下載的 MB？
///
/// TODO: 請實作格式化邏輯（建議 5-8 行）
///   1. 將 bytes 轉成 MB（除以 1024 * 1024，保留 1 位小數）
///   2. 若 total 為 null：回傳 { left: 已下載 MB + ' MB', right: '' }（並讓 UI 顯示不確定動畫）
///   3. 若 total 有值：計算 percent = (downloaded / total) * 100
///   4. 回傳 { left: '12.3 MB / 45.6 MB', right: '27%' }
function formatProgress(progress: DownloadProgress): { left: string; right: string; percent: number | null } {
  const toMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  // 伺服器未回報 Content-Length：只顯示已下載量，UI 改用不確定動畫
  if (progress.total === null) {
    return { left: `${toMB(progress.downloaded)} MB`, right: '', percent: null };
  }

  const percent = Math.round((progress.downloaded / progress.total) * 100);
  return {
    left: `${toMB(progress.downloaded)} MB / ${toMB(progress.total)} MB`,
    right: `${percent}%`,
    percent,
  };
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ updater, isOpen, onClose }) => {
  const { status, update, progress, errorMessage, downloadAndInstall, restartApp, dismiss } = updater;

  if (!isOpen) return null;

  /// 統一關閉行為：重置 updater 狀態 + 通知父層
  const handleClose = () => {
    dismiss();
    onClose();
  };

  /// 「跳過此版本」按鈕邏輯：寫入 localStorage 後關閉對話框
  const handleSkip = () => {
    if (update) setSkippedVersion(update.version);
    handleClose();
  };

  const formatted = formatProgress(progress);

  return (
    <div className="update-dialog__backdrop" onClick={(e) => {
      // 點擊背景僅在「非下載中」階段才關閉
      if (e.target === e.currentTarget && status !== 'downloading' && status !== 'installing') {
        handleClose();
      }
    }}>
      <div className="update-dialog" role="dialog" aria-labelledby="update-dialog-title">

        {/* 標題列 */}
        <div className="update-dialog__header">
          {status === 'available' && <Download size={18} color="#3b82f6" />}
          {status === 'downloading' && <RefreshCw size={18} color="#3b82f6" className="spin" />}
          {status === 'installing' && <RefreshCw size={18} color="#3b82f6" className="spin" />}
          {status === 'ready' && <CheckCircle2 size={18} color="#22c55e" />}
          {status === 'up-to-date' && <CheckCircle2 size={18} color="#22c55e" />}
          {status === 'error' && <AlertCircle size={18} color="#ef4444" />}
          {status === 'checking' && <RefreshCw size={18} className="spin" />}

          <h2 id="update-dialog-title" className="update-dialog__title">
            {status === 'checking'    && '檢查更新中…'}
            {status === 'available'   && '有新版本可用'}
            {status === 'downloading' && '下載中…'}
            {status === 'installing'  && '安裝中…'}
            {status === 'ready'       && '更新已就緒'}
            {status === 'up-to-date'  && '已是最新版本'}
            {status === 'error'       && '更新失敗'}
          </h2>

          {update && (
            <span className="update-dialog__version">v{update.version}</span>
          )}
        </div>

        {/* 內容區 */}
        <div className="update-dialog__body">

          {/* 有更新可用：顯示 release notes */}
          {status === 'available' && update?.body && (
            <>
              <div className="update-dialog__notes-label">更新內容</div>
              <div className="update-dialog__notes">{update.body}</div>
            </>
          )}

          {/* 下載中：顯示進度條 + 雙資訊 */}
          {(status === 'downloading' || status === 'installing') && (
            <div className="update-dialog__progress-wrapper">
              <div className="update-dialog__progress-text">
                <span>{formatted.left || (status === 'installing' ? '正在安裝…' : '準備下載…')}</span>
                <span>{formatted.right}</span>
              </div>
              <div className="update-dialog__progress-bar">
                <div
                  className={
                    formatted.percent === null
                      ? 'update-dialog__progress-fill update-dialog__progress-fill--indeterminate'
                      : 'update-dialog__progress-fill'
                  }
                  style={formatted.percent !== null ? { width: `${formatted.percent}%` } : undefined}
                />
              </div>
            </div>
          )}

          {/* 完成：提示重啟 */}
          {status === 'ready' && (
            <div>更新已下載並安裝完成，重新啟動應用程式以套用新版本。</div>
          )}

          {/* 已是最新 */}
          {status === 'up-to-date' && (
            <div>你目前使用的是最新版本，無需更新。</div>
          )}

          {/* 錯誤 */}
          {status === 'error' && errorMessage && (
            <div className="update-dialog__error">{errorMessage}</div>
          )}
        </div>

        {/* 按鈕列 */}
        <div className="update-dialog__footer">

          {status === 'available' && (
            <>
              <button className="update-dialog__btn update-dialog__btn--ghost" onClick={handleSkip}>
                跳過此版本
              </button>
              <button className="update-dialog__btn" onClick={handleClose}>
                稍後再說
              </button>
              <button className="update-dialog__btn update-dialog__btn--primary" onClick={downloadAndInstall}>
                <Download size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                立即更新
              </button>
            </>
          )}

          {status === 'ready' && (
            <>
              <button className="update-dialog__btn" onClick={handleClose}>
                稍後重啟
              </button>
              <button className="update-dialog__btn update-dialog__btn--primary" onClick={restartApp}>
                立即重啟
              </button>
            </>
          )}

          {(status === 'up-to-date' || status === 'error') && (
            <button className="update-dialog__btn update-dialog__btn--primary" onClick={handleClose}>
              關閉
            </button>
          )}

          {status === 'checking' && (
            <button className="update-dialog__btn" onClick={handleClose}>
              <X size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateDialog;
