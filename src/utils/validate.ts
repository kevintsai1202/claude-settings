/**
 * JSON 驗證工具
 * 提供純文字 JSON 的語法驗證，以及 Claude settings 結構驗證
 * v2.0 — validateSettings 改用 ajv JSON Schema 驗證，取代手動逐欄位檢查
 */
import type { ClaudeSettings } from '../types/settings';
import { validateWithSchema } from './schemaValidator';

/** 驗證結果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 驗證 JSON 字串語法
 * @param raw 原始 JSON 字串
 */
export const validateJson = (raw: string): ValidationResult => {
  if (!raw.trim()) {
    return { valid: true, errors: [] }; // 空字串視為有效（尚未輸入）
  }
  try {
    JSON.parse(raw);
    return { valid: true, errors: [] };
  } catch (err) {
    return {
      valid: false,
      errors: [`JSON 語法錯誤：${(err as Error).message}`],
    };
  }
};

/**
 * 驗證解析後的 ClaudeSettings 物件結構
 * 使用 ajv JSON Schema 進行完整驗證（型別、枚舉、未知欄位、範圍）
 * @param data 已解析的設定物件
 */
export const validateSettings = (data: unknown): ValidationResult => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { valid: false, errors: ['設定必須是 JSON 物件'] };
  }

  const result = validateWithSchema(data);
  return {
    valid: result.valid,
    errors: result.errors.map((e) => e.message),
  };
};

/**
 * 完整驗證流程：先驗語法，再驗結構
 * @param raw 原始 JSON 字串
 */
export const validateFull = (raw: string): ValidationResult => {
  const syntaxResult = validateJson(raw);
  if (!syntaxResult.valid) return syntaxResult;
  if (!raw.trim()) return { valid: true, errors: [] };

  const data = JSON.parse(raw) as ClaudeSettings;
  return validateSettings(data);
};
