/**
 * 單欄位即時驗證 Hook
 * 根據欄位路徑與當前值，從 JSON Schema 驗證結果中提取對應的錯誤訊息
 */
import { useMemo } from 'react';
import { validateWithSchema } from '../utils/schemaValidator';

/** 單欄位驗證結果 */
export interface FieldValidationResult {
  /** 欄位是否通過驗證 */
  isValid: boolean;
  /** 驗證錯誤訊息，無錯誤時為 null */
  error: string | null;
}

/**
 * 針對單一欄位進行即時 Schema 驗證
 * 將欄位路徑對應到 JSON Schema 驗證結果，提取相關錯誤
 * @param fieldPath 欄位路徑，如 "permissions.defaultMode" 或 "cleanupPeriodDays"
 * @param value 欄位目前的值
 * @returns FieldValidationResult 包含 isValid 與 error
 */
export function useFieldValidation(fieldPath: string, value: unknown): FieldValidationResult {
  return useMemo(() => {
    // 根據欄位路徑建立最小化的測試物件進行驗證
    const testObj = buildTestObject(fieldPath, value);
    const result = validateWithSchema(testObj);

    if (result.valid) {
      return { isValid: true, error: null };
    }

    // 找出與此欄位路徑相關的錯誤
    const fieldError = result.errors.find(
      (e) => e.path === fieldPath || e.path === '(根層級)' || e.path.startsWith(fieldPath)
    );

    if (fieldError) {
      return { isValid: false, error: fieldError.message };
    }

    return { isValid: true, error: null };
  }, [fieldPath, value]);
}

/**
 * 根據欄位路徑與值，建立用於驗證的最小化物件
 * 支援點號分隔的巢狀路徑，如 "permissions.defaultMode"
 * @param path 欄位路徑
 * @param value 欄位值
 * @returns 可傳入 validateWithSchema 的物件
 */
function buildTestObject(path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.');
  // 從最深層逐層往外包裝，形成巢狀物件
  const result: Record<string, unknown> = {};
  let current: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const next: Record<string, unknown> = {};
    current[parts[i]] = next;
    current = next;
  }
  current[parts[parts.length - 1]] = value;

  return result;
}
