/**
 * JSON Schema 驗證工具
 * 使用 ajv 對 settings.json 進行完整驗證，涵蓋型別、枚舉、未知欄位等
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../schemas/claude-code-settings.schema.json';

/** Schema 驗證錯誤的結構 */
export interface SchemaError {
  /** 欄位路徑，如 "permissions.defaultMode" */
  path: string;
  /** 錯誤訊息（中文化） */
  message: string;
  /** 錯誤類型分類 */
  type: 'type' | 'enum' | 'unknown_field' | 'format' | 'range' | 'other';
}

/** Schema 驗證結果 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaError[];
}

/** Schema 中所有已知的頂層欄位名稱清單（用於相似字建議） */
const KNOWN_SCHEMA_PROPERTIES: string[] = [
  'model', 'effortLevel', 'availableModels', 'modelOverrides', 'agent',
  'language', 'outputStyle', 'alwaysThinkingEnabled', 'showThinkingSummaries',
  'autoUpdatesChannel', 'autoUpdates', 'prefersReducedMotion', 'spinnerTipsEnabled',
  'spinnerTipsOverride', 'spinnerVerbs', 'voiceEnabled', 'includeCoAuthoredBy',
  'includeGitInstructions', 'attribution', 'respectGitignore', 'defaultShell',
  'disableAutoMode', 'useAutoModeDuringPlan', 'fastModePerSessionOptIn', 'autoMode',
  'cleanupPeriodDays', 'autoMemoryDirectory', 'plansDirectory',
  'enableAllProjectMcpServers', 'enabledMcpjsonServers', 'disabledMcpjsonServers',
  'allowedMcpServers', 'deniedMcpServers', 'allowManagedMcpServersOnly', 'mcpServers',
  'enabledPlugins', 'channelsEnabled', 'allowedChannelPlugins', 'blockedMarketplaces',
  'strictKnownMarketplaces', 'extraKnownMarketplaces', 'hooks', 'disableAllHooks',
  'allowedHttpHookUrls', 'httpHookAllowedEnvVars', 'allowManagedHooksOnly',
  'env', 'permissions', 'sandbox', 'worktree',
  'apiKeyHelper', 'awsAuthRefresh', 'awsCredentialExport', 'forceLoginMethod',
  'forceLoginOrgUUID', 'otelHeadersHelper', 'companyAnnouncements',
  'pluginTrustMessage', 'feedbackSurveyRate', 'disableDeepLinkRegistration',
];

/**
 * 計算兩個字串之間的 Levenshtein 編輯距離
 * @param a 字串 A
 * @param b 字串 B
 * @returns 編輯距離數值
 */
function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

/**
 * 根據 Levenshtein 距離找出相似的已知欄位名稱建議
 * @param unknownKey 未知的欄位名稱
 * @param maxDistance 允許的最大編輯距離（預設 3）
 * @returns 相似欄位名稱清單（距離由小到大排序）
 */
export function suggestSimilarKeys(unknownKey: string, maxDistance = 3): string[] {
  return KNOWN_SCHEMA_PROPERTIES
    .map((key) => ({ key, distance: levenshteinDistance(unknownKey.toLowerCase(), key.toLowerCase()) }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map(({ key }) => key);
}

/**
 * 將 ajv 的 instancePath 轉換為易讀的欄位路徑字串
 * @param instancePath ajv 回傳的路徑（如 "/permissions/defaultMode"）
 * @returns 易讀路徑（如 "permissions.defaultMode"）
 */
function normalizePath(instancePath: string): string {
  if (!instancePath) return '(根層級)';
  return instancePath.replace(/^\//, '').replace(/\//g, '.');
}

/**
 * 將 ajv 錯誤關鍵字對應到 SchemaError 的 type 分類
 * @param keyword ajv 錯誤關鍵字
 */
function mapErrorType(keyword: string): SchemaError['type'] {
  switch (keyword) {
    case 'type': return 'type';
    case 'enum': return 'enum';
    case 'additionalProperties': return 'unknown_field';
    case 'format': return 'format';
    case 'minimum':
    case 'maximum':
    case 'exclusiveMinimum':
    case 'exclusiveMaximum': return 'range';
    default: return 'other';
  }
}

/**
 * 將 ajv 的原始錯誤轉換為中文化的 SchemaError
 * @param err ajv ErrorObject
 * @param data 被驗證的原始資料（用於 unknown_field 時查找欄位名稱）
 */
function mapAjvError(
  err: { instancePath: string; keyword: string; message?: string; params: Record<string, unknown> }
): SchemaError {
  const path = normalizePath(err.instancePath);
  const type = mapErrorType(err.keyword);

  let message: string;
  switch (err.keyword) {
    case 'type':
      message = `欄位 "${path}" 型別錯誤：${err.message ?? '型別不符'}`;
      break;
    case 'enum': {
      const allowed = (err.params['allowedValues'] as unknown[])?.join(' | ') ?? '';
      message = `欄位 "${path}" 值無效，允許的值為：${allowed}`;
      break;
    }
    case 'additionalProperties': {
      const extra = err.params['additionalProperty'] as string;
      const suggestions = suggestSimilarKeys(extra);
      const hint = suggestions.length > 0 ? `（是否指 ${suggestions.slice(0, 2).join(' 或 ')}？）` : '';
      message = `發現未知欄位 "${extra}"${hint}`;
      break;
    }
    case 'minimum':
    case 'maximum':
      message = `欄位 "${path}" 超出允許範圍：${err.message ?? ''}`;
      break;
    case 'format':
      message = `欄位 "${path}" 格式錯誤：${err.message ?? ''}`;
      break;
    default:
      message = `欄位 "${path}" 驗證失敗：${err.message ?? err.keyword}`;
  }

  return { path, message, type };
}

/** 初始化 Ajv 實例，啟用 allErrors 模式以收集所有錯誤 */
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/** 預先編譯 schema 的驗證函數 */
const validateCompiled = ajv.compile(schema);

/**
 * 對設定物件進行 JSON Schema 全面驗證
 * @param data 待驗證的設定物件（型別 unknown，內部會做完整校驗）
 * @returns SchemaValidationResult 包含驗證結果與所有錯誤
 */
export function validateWithSchema(data: unknown): SchemaValidationResult {
  const valid = validateCompiled(data) as boolean;

  if (valid || !validateCompiled.errors) {
    return { valid: true, errors: [] };
  }

  const errors: SchemaError[] = validateCompiled.errors.map((err) =>
    mapAjvError({
      instancePath: err.instancePath,
      keyword: err.keyword,
      message: err.message,
      params: err.params as Record<string, unknown>,
    })
  );

  return { valid: false, errors };
}
