/**
 * pathEncoder.ts — Claude Code projects 路徑 ↔ 資料夾名 編碼
 *
 * Claude Code 將專案對話歷史存於 ~/.claude/projects/<encoded>/，其中
 * encoded 是把原始路徑的 `:`、`\`、`/` 都替換成 `-`。
 *
 * 例：d:\GitHub\claude-settings → d--GitHub-claude-settings
 *     /Users/kevin/Repo/app    → -Users-kevin-Repo-app
 */

/**
 * 將原始 projectDir 編碼為 Claude Code 使用的資料夾名稱
 * @param projectDir 原始專案路徑（含磁碟機代號或根斜線）
 * @returns 編碼後字串（不含結尾 -）
 */
export const encodeProjectPath = (projectDir: string): string => {
  return projectDir
    .replace(/[\\/:]/g, '-')
    .replace(/-+$/, ''); // 去掉結尾連續的 -
};
