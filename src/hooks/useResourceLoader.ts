/**
 * useResourceLoader
 * 讀取 Claude Code 衍生資源：subagents、slash commands、output styles
 * 來源：
 *   - User 層：~/.claude/{agents,commands,output-styles}/*.md
 *   - Project 層：<projectDir>/.claude/{agents,commands,output-styles}/*.md
 * 每個檔案解析 YAML frontmatter，轉為對應的型別資料。
 */
import { readTextFile, readDir, exists } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { useAppStore } from '../store/settingsStore';
import { parseFrontmatter, asString, asStringArray } from '../utils/frontmatter';
import type { AgentFile, CommandFile, OutputStyleFile, SkillFile } from '../types/settings';

// 內建 output style（Claude Code 官方提供，無對應檔案）
const BUILTIN_OUTPUT_STYLES: OutputStyleFile[] = [
  {
    id: 'builtin:default',
    scope: 'builtin',
    name: 'default',
    description: '預設輸出風格，Claude Code 原本的回應方式',
    path: '(builtin)',
    body: '',
  },
  {
    id: 'builtin:explanatory',
    scope: 'builtin',
    name: 'explanatory',
    description: '在回答中加入教育性的說明與洞見',
    path: '(builtin)',
    body: '',
  },
  {
    id: 'builtin:learning',
    scope: 'builtin',
    name: 'learning',
    description: '學習模式：讓使用者貢獻關鍵程式碼',
    path: '(builtin)',
    body: '',
  },
];

/** 嘗試列出指定目錄，不存在時回空陣列 */
async function listMdFiles(dir: string): Promise<{ name: string; path: string }[]> {
  try {
    const dirOk = await exists(dir);
    if (!dirOk) return [];
    const entries = await readDir(dir);
    return entries
      .filter((e) => e.isFile && e.name.endsWith('.md'))
      .map((e) => ({ name: e.name, path: `${dir}/${e.name}` }));
  } catch {
    return [];
  }
}

/** 讀取單一 markdown 檔並解析 frontmatter */
async function readMarkdown(path: string): Promise<{ data: Record<string, string | string[]>; body: string; raw: string } | null> {
  try {
    const raw = await readTextFile(path);
    const parsed = parseFrontmatter(raw);
    return { ...parsed, raw };
  } catch {
    return null;
  }
}

export const useResourceLoader = () => {
  const { projectDir, setAgents, setCommands, setOutputStyles } = useAppStore();

  /** 統一解析家目錄路徑（Tauri fs 需要絕對路徑，Windows 用正斜線） */
  const resolveHome = async (): Promise<string> => {
    const home = await homeDir();
    return home.replace(/\\/g, '/');
  };

  /** 將 project 目錄正規化（可能為 null） */
  const resolveProject = (): string | null => {
    if (!projectDir) return null;
    return projectDir.replace(/\\/g, '/');
  };

  /** 讀取 agents（user + project） */
  const loadAgents = async (): Promise<void> => {
    const home = await resolveHome();
    const project = resolveProject();
    const sources: Array<{ scope: 'user' | 'project'; dir: string }> = [
      { scope: 'user', dir: `${home}/.claude/agents` },
    ];
    if (project) sources.push({ scope: 'project', dir: `${project}/.claude/agents` });

    const results: AgentFile[] = [];
    for (const src of sources) {
      const files = await listMdFiles(src.dir);
      for (const f of files) {
        const parsed = await readMarkdown(f.path);
        if (!parsed) continue;
        const { data, body } = parsed;
        results.push({
          id: `${src.scope}:${f.name}`,
          scope: src.scope,
          name: asString(data.name) ?? f.name.replace(/\.md$/, ''),
          description: asString(data.description),
          tools: asStringArray(data.tools),
          model: asString(data.model),
          path: f.path,
          body,
        });
      }
    }
    setAgents(results);
  };

  /** 讀取 slash commands（user + project） */
  const loadCommands = async (): Promise<void> => {
    const home = await resolveHome();
    const project = resolveProject();
    const sources: Array<{ scope: 'user' | 'project'; dir: string }> = [
      { scope: 'user', dir: `${home}/.claude/commands` },
    ];
    if (project) sources.push({ scope: 'project', dir: `${project}/.claude/commands` });

    const results: CommandFile[] = [];
    for (const src of sources) {
      const files = await listMdFiles(src.dir);
      for (const f of files) {
        const parsed = await readMarkdown(f.path);
        if (!parsed) continue;
        const { data, body } = parsed;
        results.push({
          id: `${src.scope}:${f.name}`,
          scope: src.scope,
          name: f.name.replace(/\.md$/, ''),
          description: asString(data.description),
          argumentHint: asString(data['argument-hint']),
          allowedTools: asStringArray(data['allowed-tools']),
          model: asString(data.model),
          path: f.path,
          body,
        });
      }
    }
    setCommands(results);
  };

  /** 讀取 skills（user + project） */
  const loadSkills = async (): Promise<void> => {
    const home = await resolveHome();
    const project = resolveProject();
    const sources: Array<{ scope: 'user' | 'project'; dir: string }> = [
      { scope: 'user', dir: `${home}/.claude/skills` },
    ];
    if (project) sources.push({ scope: 'project', dir: `${project}/.claude/skills` });

    const results: SkillFile[] = [];
    for (const src of sources) {
      try {
        const dirOk = await exists(src.dir);
        if (!dirOk) continue;

        // 列出 skills 根目錄下的每個 skill 資料夾
        const entries = await readDir(src.dir);
        const skillDirs = entries.filter((e) => e.isDirectory);

        for (const skillDir of skillDirs) {
          const dirPath = `${src.dir}/${skillDir.name}`;

          // 嘗試 SKILL.md / skill.md 兩種常見檔名
          let skillMdPath: string | null = null;
          for (const candidate of ['SKILL.md', 'skill.md']) {
            const p = `${dirPath}/${candidate}`;
            if (await exists(p)) {
              skillMdPath = p;
              break;
            }
          }
          if (!skillMdPath) continue;

          // 讀取 SKILL.md 內容
          const parsed = await readMarkdown(skillMdPath);
          if (!parsed) continue;
          const { data, body } = parsed;

          // 列出 skill 下的子資料夾作為附加資源提示
          let subdirs: string[] = [];
          try {
            const inner = await readDir(dirPath);
            subdirs = inner.filter((e) => e.isDirectory).map((e) => e.name);
          } catch {
            subdirs = [];
          }

          results.push({
            id: `${src.scope}:${skillDir.name}`,
            scope: src.scope,
            name: skillDir.name,
            displayName: asString(data.name),
            description: asString(data.description),
            allowedTools: asStringArray(data['allowed-tools']),
            dir: dirPath,
            path: skillMdPath,
            body,
            subdirs,
          });
        }
      } catch {
        // 任一來源讀取失敗不阻擋另一來源
        continue;
      }
    }
    useAppStore.getState().setSkills(results);
  };

  /** 讀取 output styles（builtin + user + project） */
  const loadOutputStyles = async (): Promise<void> => {
    const home = await resolveHome();
    const project = resolveProject();
    const sources: Array<{ scope: 'user' | 'project'; dir: string }> = [
      { scope: 'user', dir: `${home}/.claude/output-styles` },
    ];
    if (project) sources.push({ scope: 'project', dir: `${project}/.claude/output-styles` });

    const results: OutputStyleFile[] = [...BUILTIN_OUTPUT_STYLES];
    for (const src of sources) {
      const files = await listMdFiles(src.dir);
      for (const f of files) {
        const parsed = await readMarkdown(f.path);
        if (!parsed) continue;
        const { data, body } = parsed;
        results.push({
          id: `${src.scope}:${f.name}`,
          scope: src.scope,
          name: asString(data.name) ?? f.name.replace(/\.md$/, ''),
          description: asString(data.description),
          path: f.path,
          body,
        });
      }
    }
    setOutputStyles(results);
  };

  /** 一次載入所有資源 */
  const loadAllResources = async (): Promise<void> => {
    await Promise.all([loadAgents(), loadCommands(), loadOutputStyles(), loadSkills()]);
  };

  return {
    loadAgents,
    loadCommands,
    loadOutputStyles,
    loadSkills,
    loadAllResources,
  };
};
