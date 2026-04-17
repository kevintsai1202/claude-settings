/// useUpdater — 封裝 Tauri 自動更新流程的 React Hook
/// 負責「檢查 / 下載 / 安裝 / 重啟」的呼叫，並暴露狀態給 UI 元件使用
import { useCallback, useState } from 'react';
import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/// 更新流程的狀態機
export type UpdaterStatus =
  | 'idle'           // 尚未檢查
  | 'checking'       // 正在向 endpoint 詢問是否有新版
  | 'available'      // 有新版本，等待使用者決定
  | 'up-to-date'     // 已是最新版
  | 'downloading'    // 正在下載
  | 'installing'     // 下載完成，正在套用
  | 'ready'          // 安裝完成，等待重啟
  | 'error';         // 任何階段失敗

/// 下載進度資訊（單位：bytes）
export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

export interface UseUpdaterReturn {
  status: UpdaterStatus;
  /// 若有新版會帶回 Tauri Update 物件（含 version、notes 等）
  update: Update | null;
  progress: DownloadProgress;
  errorMessage: string | null;
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restartApp: () => Promise<void>;
  /// 重置狀態回 idle（例如使用者按「稍後再說」時呼叫）
  dismiss: () => void;
}

export function useUpdater(): UseUpdaterReturn {
  const [status, setStatus] = useState<UpdaterStatus>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: null });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /// 詢問 endpoint 是否有新版本，結果寫入 status / update
  const checkForUpdate = useCallback(async () => {
    setStatus('checking');
    setErrorMessage(null);
    try {
      const result = await check();
      if (result) {
        setUpdate(result);
        setStatus('available');
      } else {
        setStatus('up-to-date');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  /// 下載並安裝目前 update 物件指向的版本，邊下載邊回報進度
  const downloadAndInstall = useCallback(async () => {
    if (!update) return;
    setStatus('downloading');
    setProgress({ downloaded: 0, total: null });
    setErrorMessage(null);

    let downloaded = 0;
    let total: number | null = null;

    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? null;
          setProgress({ downloaded: 0, total });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          setProgress({ downloaded, total });
        } else if (event.event === 'Finished') {
          setStatus('installing');
        }
      });
      setStatus('ready');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [update]);

  const restartApp = useCallback(async () => {
    await relaunch();
  }, []);

  const dismiss = useCallback(() => {
    setStatus('idle');
    setUpdate(null);
    setProgress({ downloaded: 0, total: null });
    setErrorMessage(null);
  }, []);

  return {
    status,
    update,
    progress,
    errorMessage,
    checkForUpdate,
    downloadAndInstall,
    restartApp,
    dismiss,
  };
}
