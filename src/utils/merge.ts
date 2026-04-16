/**
 * 多層設定合并演算法
 * 規則：
 *   - 單值欄位（model、effortLevel 等）：高優先級覆蓋低優先級
 *   - 陣列欄位（permissions.allow / deny / ask）：合并後去重
 *   - 優先級由高到低：managed(1) > local(3) > project(4) > user(5)
 */
import type { ClaudeSettings, SettingsLayer, SettingsFile } from '../types/settings';

/** 優先級數字（數字越小優先級越高） */
const PRIORITY: Record<SettingsLayer, number> = {
  managed: 1,
  local:   3,
  project: 4,
  user:    5,
};

/** 合并後的單一設定項，附帶來源資訊 */
export interface MergedEntry {
  key: string;
  value: unknown;
  source: SettingsLayer | 'default';
}

/**
 * 合并多個設定層，回傳最終有效設定與來源標記
 * @param files 各層設定檔（已讀取）
 */
export const mergeSettings = (
  files: Record<SettingsLayer, SettingsFile>
): { merged: ClaudeSettings; entries: MergedEntry[] } => {
  // 依優先級排序（高優先在前）
  const layers: SettingsLayer[] = ['managed', 'local', 'project', 'user'];
  const sorted = layers
    .filter((l) => files[l].data !== null)
    .sort((a, b) => PRIORITY[a] - PRIORITY[b]);

  const merged: ClaudeSettings = {};
  const entries: MergedEntry[] = [];

  // 合并純量欄位（單值覆蓋）
  const scalarKeys: (keyof ClaudeSettings)[] = [
    'model',
    'effortLevel',
    'language',
    'outputStyle',
    'alwaysThinkingEnabled',
    'autoUpdates',
    'includeCoAuthoredBy',
    'spinnerTipsEnabled',
    'cleanupPeriodDays',
  ];

  for (const key of scalarKeys) {
    // 從高優先級往低找，找到第一個有值的
    for (const layer of sorted) {
      const val = files[layer].data?.[key];
      if (val !== undefined) {
        (merged as Record<string, unknown>)[key] = val;
        entries.push({ key, value: val, source: layer });
        break;
      }
    }
  }

  // 合并 permissions（陣列欄位，合并去重）
  const mergedAllow = new Set<string>();
  const mergedAsk   = new Set<string>();
  const mergedDeny  = new Set<string>();
  const permSources: Record<string, SettingsLayer> = {};

  // 高優先級的 deny 優先進入
  for (const layer of sorted) {
    const perms = files[layer].data?.permissions;
    if (!perms) continue;
    (perms.deny ?? []).forEach((r) => { mergedDeny.add(r); permSources[`deny:${r}`] = layer; });
    (perms.ask  ?? []).forEach((r) => { mergedAsk.add(r);  permSources[`ask:${r}`]  = layer; });
    (perms.allow ?? []).forEach((r) => { mergedAllow.add(r); permSources[`allow:${r}`] = layer; });
  }

  if (mergedAllow.size || mergedAsk.size || mergedDeny.size) {
    merged.permissions = {
      allow: [...mergedAllow],
      ask:   [...mergedAsk],
      deny:  [...mergedDeny],
    };
    entries.push({
      key: 'permissions.allow',
      value: [...mergedAllow],
      source: sorted[0] ?? 'default',
    });
    entries.push({
      key: 'permissions.deny',
      value: [...mergedDeny],
      source: sorted[0] ?? 'default',
    });
  }

  // 合并 env（後層可追加，高優先覆蓋同 key）
  const mergedEnv: Record<string, string> = {};
  const envSources: Record<string, SettingsLayer> = {};
  // 從低優先級開始疊加（高優先級後覆蓋）
  for (const layer of [...sorted].reverse()) {
    const envObj = files[layer].data?.env;
    if (!envObj) continue;
    Object.entries(envObj).forEach(([k, v]) => {
      mergedEnv[k] = v;
      envSources[k] = layer;
    });
  }
  if (Object.keys(mergedEnv).length) {
    merged.env = mergedEnv;
  }

  return { merged, entries };
};
