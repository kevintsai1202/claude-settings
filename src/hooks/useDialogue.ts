/**
 * useDialogue.ts — Session History Viewer 的核心資料操作
 *
 * 提供四個動作：
 *  - loadProjectIndex(): 掃描當前 projectDir 的 jsonl，建構 metadata 索引
 *  - loadSession(sessionId): 讀取並快取單一 session 完整事件
 *  - searchInProject(query): 跨當前專案的 session 做關鍵字搜尋
 *  - deleteSession(sessionId): 刪除 jsonl 檔（已含 path traversal 防護）
 */
import { useCallback, useRef } from 'react';
import {
  exists,
  readDir,
  readTextFile,
  remove,
  stat,
} from '@tauri-apps/plugin-fs';
import { useAppStore } from '../store/settingsStore';
import { useDialogueStore } from '../store/dialogueStore';
import { resolvePath } from '../utils/pathResolver';
import { encodeProjectPath } from '../utils/pathEncoder';
import { parseJsonl, summarizeSession } from '../utils/jsonlParser';
import type {
  ProjectDialogueIndex,
  SessionMeta,
} from '../types/dialogue';

/** 並行 I/O 池上限（避免 Windows file handle 爆量） */
const IO_POOL_LIMIT = 8;

/** 搜尋結果截斷上限 */
const SEARCH_TRUNCATE_AT = 500;

/** 最小可搜尋字串長度 */
const MIN_SEARCH_LEN = 2;

/**
 * 手寫並行池：依序跑 tasks，同時執行數量不超過 limit
 */
const runPool = async <T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> => {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const i = cursor++;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
};

export const useDialogue = () => {
  const projectDir = useAppStore((s) => s.projectDir);
  const store = useDialogueStore;
  /** 搜尋用的 abort 版本號（新搜尋啟動 → 舊的忽略） */
  const searchVersionRef = useRef(0);

  /** 載入當前專案的 session 索引 */
  const loadProjectIndex = useCallback(async (): Promise<void> => {
    if (!projectDir) return;
    store.getState().setLoadingIndex(true);
    try {
      const encoded = encodeProjectPath(projectDir);
      const folderPath = await resolvePath(`%USERPROFILE%/.claude/projects/${encoded}`);
      const folderExists = await exists(folderPath);
      if (!folderExists) {
        const empty: ProjectDialogueIndex = {
          projectDir,
          encodedDir: encoded,
          folderPath,
          sessions: [],
        };
        store.getState().setProjectIndex(projectDir, empty);
        return;
      }
      const entries = await readDir(folderPath);
      const jsonlEntries = entries.filter(
        (e) => e.isFile && e.name.toLowerCase().endsWith('.jsonl'),
      );

      // 並行讀取 + 摘要
      const tasks = jsonlEntries.map((e) => async (): Promise<SessionMeta | null> => {
        const filePath = `${folderPath}/${e.name}`;
        try {
          const text = await readTextFile(filePath);
          const { events } = parseJsonl(text);
          const { meta } = summarizeSession(events);
          const st = await stat(filePath);
          return {
            sessionId: e.name.replace(/\.jsonl$/i, ''),
            filePath,
            fileSize: Number(st.size ?? 0),
            ...meta,
          };
        } catch {
          // 檔案被鎖或破損，靜默跳過
          return null;
        }
      });
      const results = await runPool(tasks, IO_POOL_LIMIT);
      const sessions = results
        .filter((r): r is SessionMeta => r !== null)
        .sort((a, b) => (b.lastTime ?? '').localeCompare(a.lastTime ?? ''));

      const index: ProjectDialogueIndex = {
        projectDir,
        encodedDir: encoded,
        folderPath,
        sessions,
      };
      store.getState().setProjectIndex(projectDir, index);
    } finally {
      store.getState().setLoadingIndex(false);
    }
  }, [projectDir, store]);

  /** 讀取並快取單一 session 的完整事件 */
  const loadSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!projectDir) return;
      // 已快取 → skip
      if (store.getState().eventsBySession[sessionId]) return;
      const idx = store.getState().indexByProject[projectDir];
      const meta = idx?.sessions.find((s) => s.sessionId === sessionId);
      if (!meta) return;
      store.getState().setLoadingSession(true);
      try {
        const text = await readTextFile(meta.filePath);
        const { events } = parseJsonl(text);
        // 依 timestamp 升冪排（jsonl 多半本就順序，保險起見）
        events.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
        store.getState().setEvents(sessionId, events);
      } finally {
        store.getState().setLoadingSession(false);
      }
    },
    [projectDir, store],
  );

  /** 跨當前專案搜尋（>= 2 字、AbortController 版本化） */
  const searchInProject = useCallback(
    async (query: string): Promise<void> => {
      const q = query.trim();
      if (q.length < MIN_SEARCH_LEN) {
        store.getState().setSearchResults(null);
        return;
      }
      const version = ++searchVersionRef.current;
      if (!projectDir) return;
      const idx = store.getState().indexByProject[projectDir];
      if (!idx) return;
      const lower = q.toLowerCase();
      const matched: string[] = [];
      let hitCount = 0;
      let truncated = false;
      for (const s of idx.sessions) {
        if (version !== searchVersionRef.current) return; // 被新搜尋取代，中止
        // 命中 metadata：firstPromptPreview
        let hits = 0;
        if (s.firstPromptPreview.toLowerCase().includes(lower)) hits += 1;
        // 命中內文：已快取用 cache；否則讀檔以 indexOf 粗掃
        const cached = store.getState().eventsBySession[s.sessionId];
        if (cached) {
          for (const ev of cached) {
            const body =
              typeof ev.message?.content === 'string'
                ? ev.message.content
                : JSON.stringify(ev.message?.content ?? '');
            if (body.toLowerCase().includes(lower)) hits += 1;
          }
        } else {
          try {
            const text = await readTextFile(s.filePath);
            if (version !== searchVersionRef.current) return;
            // 粗估命中次數（逐字數量可能偏高但足以排序提示）
            let i = 0;
            let fromIdx = 0;
            const lowerText = text.toLowerCase();
            while ((fromIdx = lowerText.indexOf(lower, fromIdx)) !== -1) {
              i += 1;
              fromIdx += lower.length;
              if (i > 100) break; // 單檔上限
            }
            hits += i;
          } catch {
            // 檔案讀取失敗（例如被鎖）→ 視為 0 命中
          }
        }
        if (hits > 0) {
          matched.push(s.sessionId);
          hitCount += hits;
          if (matched.length >= SEARCH_TRUNCATE_AT) {
            truncated = true;
            break;
          }
        }
      }
      if (version !== searchVersionRef.current) return;
      store.getState().setSearchResults({
        sessionIds: matched,
        hitCount,
        truncated,
      });
    },
    [projectDir, store],
  );

  /**
   * 刪除 session（呼叫端負責先彈 ConfirmDialog）
   * 路徑若不在 ~/.claude/projects/ 底下直接 throw，防 path traversal
   */
  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!projectDir) return;
      const idx = store.getState().indexByProject[projectDir];
      const meta = idx?.sessions.find((s) => s.sessionId === sessionId);
      if (!meta) throw new Error('找不到 session');
      // 安全檢查：filePath 必須是 resolvePath 過、且起始於預期根目錄
      const root = await resolvePath('%USERPROFILE%/.claude/projects/');
      if (!meta.filePath.startsWith(root)) {
        throw new Error(
          `拒絕刪除非 projects/ 底下的檔案：${meta.filePath}`,
        );
      }
      await remove(meta.filePath);
      store.getState().removeSession(projectDir, sessionId);
    },
    [projectDir, store],
  );

  return {
    loadProjectIndex,
    loadSession,
    searchInProject,
    deleteSession,
  };
};
