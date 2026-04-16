/**
 * 輕量版 YAML frontmatter 解析器
 * 僅處理 Claude Code agent/command/output-style 用到的扁平 key: value 結構
 * 不引入 gray-matter 等依賴以維持 bundle 輕量
 */

/** 解析結果：frontmatter 物件 + 主體內容 */
export interface FrontmatterResult {
  data: Record<string, string | string[]>;
  body: string;
}

/**
 * 從 markdown 原文抽出 YAML frontmatter
 * 僅支援：
 *  - 開頭與結尾皆為 "---"
 *  - 每行形如 "key: value" 或 "key: [a, b, c]"
 *  - 不支援巢狀結構
 */
export function parseFrontmatter(raw: string): FrontmatterResult {
  const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, body: raw };
  }

  const [, yamlRaw, body] = match;
  const data: Record<string, string | string[]> = {};

  for (const line of yamlRaw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    // 去除引號
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // 陣列語法：[a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      data[key] = inner
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      continue;
    }

    data[key] = value;
  }

  return { data, body };
}

/** 將字串欄位標準化為 string[]（支援逗號/分號分隔） */
export function asStringArray(v: string | string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.length ? v : undefined;
  const parts = v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

/** 取得 string 欄位，若是陣列則以逗號串接 */
export function asString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v.join(', ') : v;
}
