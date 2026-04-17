/**
 * Hook / StatusLine 命令佔位符替換
 * 範本字串中使用 {{PYTHON}} 佔位符，套用到 settings.json 時依當前平台替換為實際命令
 * - Windows → py（Python Launcher，最穩定）
 * - macOS/Linux → python3（類 Unix 預設 Python 3 命令）
 */
import { getDefaultPython } from './defaultPaths';

/**
 * 將範本命令中的佔位符替換為當前平台的實際命令
 * 目前支援的佔位符：
 *   {{PYTHON}} — Python 執行檔
 */
export function materializeCommand(command: string): string {
  if (!command) return command;
  // 用 split/join 做全域替換，相容 tsconfig target ES2020（replaceAll 需 ES2021）
  return command.split('{{PYTHON}}').join(getDefaultPython());
}
