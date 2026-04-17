/**
 * 輕量 token 估算 — 採用 OpenAI / Anthropic 社群常用的 "約 4 字元 ≈ 1 token" 經驗法則
 * CJK 字元 token 比較高(約 1 char = 1 token),英文約 4 char = 1 token
 * 精確度約 ±15%,足以作為「CLAUDE.md 過肥」的警示門檻
 */

export interface TextStats {
  chars: number;
  lines: number;
  words: number;
  estimatedTokens: number;
}

export function estimateStats(text: string): TextStats {
  const chars = text.length;
  const lines = text === '' ? 0 : text.split('\n').length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  const nonCjk = chars - cjkCount;
  const estimatedTokens = Math.ceil(cjkCount + nonCjk / 4);
  return { chars, lines, words, estimatedTokens };
}

export function tokenWarningLevel(tokens: number): 'ok' | 'warn' | 'critical' {
  if (tokens < 2000) return 'ok';
  if (tokens < 5000) return 'warn';
  return 'critical';
}
