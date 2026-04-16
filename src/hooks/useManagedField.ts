/**
 * useManagedField — 判斷某設定欄位是否被 managed 層鎖定的 hook
 * 企業政策層（managed）的設定值優先於使用者設定，不允許覆蓋
 */
import { useAppStore } from '../store/settingsStore';

/**
 * 根據點分隔路徑從物件中取得巢狀值
 * @param obj 目標物件
 * @param path 點分隔路徑，如 'permissions.defaultMode'
 * @returns 對應的值，路徑不存在時回傳 undefined
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current !== null && current !== undefined && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * 判斷欄位是否由 managed 層控制（唯讀）
 * @param fieldPath 欄位路徑，如 'model' 或 'permissions.defaultMode'
 * @returns isManaged: 是否被 managed 層鎖定；managedValue: managed 層的值
 */
export function useManagedField(fieldPath: string): {
  isManaged: boolean;
  managedValue: unknown;
} {
  // 從 store 取得 managed 層的設定資料
  const managedData = useAppStore((state) => state.files.managed.data);

  // managed 層無資料時，欄位不受鎖定
  if (!managedData) {
    return { isManaged: false, managedValue: undefined };
  }

  // 以點分隔路徑取得 managed 層中對應的值
  const managedValue = getNestedValue(
    managedData as Record<string, unknown>,
    fieldPath
  );

  // 值不為 undefined 表示 managed 層有明確設定，欄位應被鎖定
  const isManaged = managedValue !== undefined;

  return { isManaged, managedValue };
}
