/**
 * 預設路徑工具 — 封裝「不得已需 per-OS 分支」的絕對路徑
 * User 層用 %USERPROFILE% 佔位符即可跨平台（由 resolvePath 展開）
 * Managed 層為系統絕對路徑，必須依平台分支
 */
import { getPlatform } from './platform';

/**
 * Claude Code managed-settings 的系統絕對路徑
 * - Windows: C:\Program Files\ClaudeCode\managed-settings.json
 * - macOS:   /Library/Application Support/ClaudeCode/managed-settings.json
 * - Linux:   /etc/claude-code/managed-settings.json
 */
export function getDefaultManagedPath(): string {
  switch (getPlatform()) {
    case 'windows':
      return 'C:/Program Files/ClaudeCode/managed-settings.json';
    case 'macos':
      return '/Library/Application Support/ClaudeCode/managed-settings.json';
    case 'linux':
      return '/etc/claude-code/managed-settings.json';
    default:
      return '';
  }
}

/**
 * User 層設定檔路徑（使用 %USERPROFILE% 佔位符；由 resolvePath() 展開）
 * 此為跨平台寫法，Windows / macOS / Linux 共用
 */
export const DEFAULT_USER_PATH = '%USERPROFILE%/.claude/settings.json';

/** User 層 global settings (~/.claude.json) */
export const DEFAULT_GLOBAL_PATH = '%USERPROFILE%/.claude.json';

/** User 層全局 CLAUDE.md */
export const DEFAULT_USER_CLAUDE_MD = '%USERPROFILE%/.claude/CLAUDE.md';

/**
 * 當前平台推薦的預設 shell
 */
export function getDefaultShell(): string {
  switch (getPlatform()) {
    case 'windows': return 'pwsh';
    case 'macos':   return '/bin/zsh';
    case 'linux':   return '/bin/bash';
    default:        return '/bin/sh';
  }
}

/**
 * 當前平台的 Python 執行檔名稱
 * - Windows: py（Python Launcher，最穩定）
 * - macOS/Linux: python3（py 在類 Unix 系統不存在）
 */
export function getDefaultPython(): string {
  return getPlatform() === 'windows' ? 'py' : 'python3';
}
