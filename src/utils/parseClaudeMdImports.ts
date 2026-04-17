/**
 * 解析 CLAUDE.md 內的 @path 引用語法
 * 官方規則:`@` 後接相對/絕對路徑(無空白),通常單行獨立出現
 * 範例:`@docs/spec.md`、`@/abs/path/note.md`、`@src/App.tsx`、`@C:/proj/foo.ts`
 */

export interface ImportRef {
  /** 原始出現的字串(含 @) */
  raw: string;
  /** 不含 @ 的路徑 */
  ref: string;
  /** 展開後的絕對路徑(正斜線);以 ~ 開頭者保留 ~,由呼叫端處理 homeDir */
  absolute: string;
  /** 在原文中的 char offset */
  offset: number;
  /** 原始字串長度 */
  length: number;
}

/**
 * 匹配規則:
 *  - 起點:行首、空白、或 ( [ 等括號後
 *  - 結構:`@` + 非空白字元(含 / - . : 等,支援副檔名與 Windows 磁碟代號)
 *  - 終點:空白、行尾、或常見標點(, ; ) ] < > " ')
 *
 * 註:原計畫將 `.` `:` 列入終止字元;但會導致 @docs/spec.md 只匹配到
 *   @docs/spec、@C:/foo.ts 只匹配到 @C,失去 util 的實用性,故移除。
 *   非貪婪匹配仍會在下一個空白/逗號/括號處停止,句尾 trailing 句點是
 *   可接受的邊緣情況(呼叫端解析檔案時會 fallback 到 not-found)。
 */
const IMPORT_RE = /(^|[\s([])@([^\s)\]<>"']+?)(?=[\s,;)\]<>"']|$)/gm;

export function parseClaudeMdImports(content: string, baseDir: string): ImportRef[] {
  const refs: ImportRef[] = [];
  const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/$/, '');

  for (const match of content.matchAll(IMPORT_RE)) {
    const [, prefix, pathPart] = match;
    const offset = (match.index ?? 0) + prefix.length;
    const raw = `@${pathPart}`;
    const absolute = resolveRefToAbsolute(pathPart, normalizedBase);
    refs.push({ raw, ref: pathPart, absolute, offset, length: raw.length });
  }
  return refs;
}

/** 將相對路徑相對 baseDir 展開為絕對路徑 */
function resolveRefToAbsolute(ref: string, baseDir: string): string {
  if (/^[a-zA-Z]:/.test(ref) || ref.startsWith('/')) {
    return ref.replace(/\\/g, '/');
  }
  if (ref.startsWith('~/')) return ref; // 保留 ~,由呼叫端處理 homeDir
  return `${baseDir}/${ref}`.replace(/\/+/g, '/');
}
