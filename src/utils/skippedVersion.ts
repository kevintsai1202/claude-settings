/// skippedVersion — 「跳過此版本」的 localStorage 紀錄
/// 使用者選擇略過某版本後，自動檢查時不再彈出該版本的更新提示
/// 但若有更新版本（例如略過 v3.2.0 後出 v3.2.1），仍會正常通知

const STORAGE_KEY = 'claude-settings-manager:skipped-version';

/// 讀取目前被略過的版本字串；無紀錄時回傳 null
export function getSkippedVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/// 寫入「跳過此版本」紀錄
export function setSkippedVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // localStorage 寫入失敗不影響主流程（例如隱私模式）
  }
}

/// 清除略過紀錄（例如使用者點「立即更新」成功後）
export function clearSkippedVersion(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視失敗
  }
}

/// 判斷是否應該通知使用者有新版本
///
/// 給開發者的決策說明：
/// - 自動檢查（背景）：若使用者已選擇跳過該版本，應靜默不打擾
/// - 手動檢查（按鈕）：使用者主動詢問，應該不論如何都顯示結果
///
/// TODO: 請實作版本比對邏輯。最簡單的版本是「字串完全相等才視為已跳過」，
/// 但你也可以選擇做 semver 比對（例如：略過 v3.2.0 後若出 v3.2.0-hotfix.1
/// 是否視為新版？），這會影響使用者收到通知的頻率。
///
/// @param newVersion — updater check 回傳的最新版本字串（例如 "3.2.0"）
/// @param triggerSource — 'auto' 為背景檢查；'manual' 為使用者按按鈕
/// @returns true 表示該顯示對話框，false 表示靜默略過
export function shouldNotify(
  newVersion: string,
  triggerSource: 'auto' | 'manual',
): boolean {
  // 手動檢查：使用者主動詢問，永遠顯示結果
  if (triggerSource === 'manual') return true;
  // 自動檢查：若已跳過此版本則靜默；版本不同則重新通知
  return getSkippedVersion() !== newVersion;
}
