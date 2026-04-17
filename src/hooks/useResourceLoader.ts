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
import type {
  AgentFile,
  CommandFile,
  OutputStyleFile,
  SkillFile,
  RuleFile,
  MemoryFile,
  MemoryType,
} from '../types/settings';

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

/**
 * 遞迴列出目錄下所有 .md 檔案
 * 回傳相對於 rootDir 的路徑（含 .md），用於 Rules 的巢狀掃描
 */
async function listMdFilesRecursive(
  rootDir: string,
  subDir = '',
): Promise<{ relPath: string; absPath: string }[]> {
  const results: { relPath: string; absPath: string }[] = [];
  const currentDir = subDir ? `${rootDir}/${subDir}` : rootDir;
  try {
    const dirOk = await exists(currentDir);
    if (!dirOk) return results;
    const entries = await readDir(currentDir);
    for (const entry of entries) {
      const childRel = subDir ? `${subDir}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        const nested = await listMdFilesRecursive(rootDir, childRel);
        results.push(...nested);
      } else if (entry.isFile && entry.name.endsWith('.md')) {
        results.push({ relPath: childRel, absPath: `${currentDir}/${entry.name}` });
      }
    }
  } catch {
    // 單一子目錄讀取失敗時不影響其他
  }
  return results;
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

  /**
   * 讀取 rules（user + project）
   * 遞迴掃描 .claude/rules/ 下所有 .md，保留相對路徑支援巢狀分類
   */
  const loadRules = async (): Promise<void> => {
    const home = await resolveHome();
    const project = resolveProject();
    const sources: Array<{ scope: 'user' | 'project'; dir: string }> = [
      { scope: 'user', dir: `${home}/.claude/rules` },
    ];
    if (project) sources.push({ scope: 'project', dir: `${project}/.claude/rules` });

    const results: RuleFile[] = [];
    for (const src of sources) {
      const files = await listMdFilesRecursive(src.dir);
      for (const f of files) {
        const parsed = await readMarkdown(f.absPath);
        if (!parsed) continue;
        const { data, body } = parsed;
        // 去掉尾端 .md 作為顯示名
        const displayName = f.relPath.replace(/\.md$/, '');
        results.push({
          id: `${src.scope}:${f.relPath}`,
          scope: src.scope,
          name: displayName,
          description: asString(data.description),
          paths: asStringArray(data.paths),
          path: f.absPath,
          relPath: f.relPath,
          body,
        });
      }
    }
    useAppStore.getState().setRules(results);
  };

  /**
   * 將專案路徑轉為 Claude Code 的 memory slug
   * 規則：全部路徑分隔符（: / \）替換為 "-"
   * 範例：d:/GitHub/claude-settings → d--GitHub-claude-settings
   */
  const slugifyProjectPath = (projectPath: string): string => {
    return projectPath.replace(/[:/\\]/g, '-');
  };

  /**
   * 解析目前專案的 auto memory 資料夾
   * 優先順序：user settings.autoMemoryDirectory > slug 推導
   * @returns 絕對路徑（正斜線）或 null
   */
  const resolveMemoryDir = async (): Promise<string | null> => {
    const state = useAppStore.getState();
    const customDir = state.files.user.data?.autoMemoryDirectory;
    if (customDir && customDir.trim()) {
      // 展開 ~ 為家目錄
      if (customDir.startsWith('~')) {
        const home = await resolveHome();
        return (home + customDir.slice(1)).replace(/\\/g, '/');
      }
      return customDir.replace(/\\/g, '/');
    }
    const project = resolveProject();
    if (!project) return null;
    const home = await resolveHome();
    const slug = slugifyProjectPath(project);
    return `${home}/.claude/projects/${slug}/memory`;
  };

  /**
   * 讀取 auto memory 檔案清單
   * MEMORY.md 作為索引特別標示；topic files 解析 frontmatter name/description/type
   */
  const loadMemory = async (): Promise<void> => {
    const dir = await resolveMemoryDir();
    if (!dir) {
      useAppStore.getState().setMemory([], null);
      return;
    }
    try {
      const dirOk = await exists(dir);
      if (!dirOk) {
        useAppStore.getState().setMemory([], dir);
        return;
      }
    } catch {
      useAppStore.getState().setMemory([], dir);
      return;
    }

    const files = await listMdFiles(dir);
    const results: MemoryFile[] = [];
    for (const f of files) {
      try {
        const raw = await readTextFile(f.path);
        const isIndex = f.name === 'MEMORY.md';
        const parsed = parseFrontmatter(raw);
        const typeVal = asString(parsed.data.type);
        const memoryType: MemoryType | undefined =
          typeVal === 'user' || typeVal === 'feedback' || typeVal === 'project' || typeVal === 'reference'
            ? typeVal
            : undefined;
        results.push({
          id: f.name,
          fileName: f.name,
          isIndex,
          displayName: isIndex ? undefined : asString(parsed.data.name),
          description: asString(parsed.data.description),
          memoryType,
          path: f.path,
          body: parsed.body,
          raw,
        });
      } catch {
        // 讀檔失敗則略過該檔，不影響其他
      }
    }
    // 排序：MEMORY.md 永遠在最前
    results.sort((a, b) => {
      if (a.isIndex) return -1;
      if (b.isIndex) return 1;
      return a.fileName.localeCompare(b.fileName);
    });
    useAppStore.getState().setMemory(results, dir);
  };

  /** 一次載入所有資源 */
  const loadAllResources = async (): Promise<void> => {
    await Promise.all([
      loadAgents(),
      loadCommands(),
      loadOutputStyles(),
      loadSkills(),
      loadRules(),
      loadMemory(),
    ]);
  };

  return {
    loadAgents,
    loadCommands,
    loadOutputStyles,
    loadSkills,
    loadRules,
    loadMemory,
    loadAllResources,
  };
};
