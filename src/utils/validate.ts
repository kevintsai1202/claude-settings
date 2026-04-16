/**
 * JSON 驗證工具
 * 提供純文字 JSON 的語法驗證，以及 Claude settings 結構驗證
 */
import type { ClaudeSettings, DefaultMode, EffortLevel } from '../types/settings';

/** 驗證結果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** 允許的 defaultMode 值 */
const VALID_DEFAULT_MODES: DefaultMode[] = ['default', 'acceptEdits', 'dontAsk', 'bypassPermissions'];

/** 允許的 effortLevel 值 */
const VALID_EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high'];

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
 * @param data 已解析的設定物件
 */
export const validateSettings = (data: unknown): ValidationResult => {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { valid: false, errors: ['設定必須是 JSON 物件'] };
  }

  const settings = data as Record<string, unknown>;

  // 驗證 effortLevel
  if (settings.effortLevel !== undefined) {
    if (!VALID_EFFORT_LEVELS.includes(settings.effortLevel as EffortLevel)) {
      errors.push(`effortLevel 必須是 ${VALID_EFFORT_LEVELS.join(' / ')}`);
    }
  }

  // 驗證 permissions 結構
  if (settings.permissions !== undefined) {
    const perms = settings.permissions as Record<string, unknown>;
    if (typeof perms !== 'object' || perms === null) {
      errors.push('permissions 必須是物件');
    } else {
      // 驗證 allow / ask / deny 是字串陣列
      for (const key of ['allow', 'ask', 'deny']) {
        if (perms[key] !== undefined) {
          const arr = perms[key];
          if (!Array.isArray(arr) || arr.some((v) => typeof v !== 'string')) {
            errors.push(`permissions.${key} 必須是字串陣列`);
          }
        }
      }
      // 驗證 defaultMode
      if (perms.defaultMode !== undefined) {
        if (!VALID_DEFAULT_MODES.includes(perms.defaultMode as DefaultMode)) {
          errors.push(`permissions.defaultMode 必須是 ${VALID_DEFAULT_MODES.join(' / ')}`);
        }
      }
    }
  }

  // 驗證 env 結構
  if (settings.env !== undefined) {
    const env = settings.env as Record<string, unknown>;
    if (typeof env !== 'object' || env === null) {
      errors.push('env 必須是物件');
    } else {
      const badKeys = Object.entries(env).filter(([, v]) => typeof v !== 'string');
      if (badKeys.length) {
        errors.push(`env 的值必須全為字串，問題鍵：${badKeys.map(([k]) => k).join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * 完整驗證流程：先驗語法，再驗結構
 */
export const validateFull = (raw: string): ValidationResult => {
  const syntaxResult = validateJson(raw);
  if (!syntaxResult.valid) return syntaxResult;
  if (!raw.trim()) return { valid: true, errors: [] };

  const data = JSON.parse(raw) as ClaudeSettings;
  return validateSettings(data);
};
