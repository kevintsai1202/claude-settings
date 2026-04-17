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

/**
 * 將 frontmatter data 序列化為 YAML 區塊 + body
 * 對應 parseFrontmatter() 的反向操作。
 * - string 值在含特殊字元(: # 或首尾空白)時自動加雙引號
 * - string[] 輸出成 [a, b, c] 格式
 * - 若 data 為空物件,則不輸出 frontmatter 區塊(僅回傳 body)
 * - 已知限制:值若同時含雙引號與冒號/井號,parseFrontmatter 不會反轉 \" 轉義(round-trip 非完全對稱)
 */
export function stringifyFrontmatter(
  data: Record<string, string | string[] | undefined>,
  body: string,
): string {
  const entries = Object.entries(data).filter(
    ([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
  );

  if (entries.length === 0) {
    return body;
  }

  const yamlLines = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      const items = value.map((v) => quoteIfNeeded(v)).join(', ');
      return `${key}: [${items}]`;
    }
    return `${key}: ${quoteIfNeeded(String(value))}`;
  });

  const yamlBlock = yamlLines.join('\n');
  const bodyPart = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${yamlBlock}\n---${bodyPart}`;
}

/** 判斷是否需要加引號(含冒號、井號、或首尾空白) */
function quoteIfNeeded(value: string): string {
  if (/[:#]|^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}
