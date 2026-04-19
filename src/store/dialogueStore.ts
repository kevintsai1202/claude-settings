/**
 * dialogueStore.ts — Session History Viewer 的全局狀態
 * 獨立於 settingsStore，避免混入既有設定編輯邏輯
 */
import { create } from 'zustand';
import type {
  DialogueEvent,
  DialogueViewMode,
  ProjectDialogueIndex,
} from '../types/dialogue';

/** 搜尋結果 */
export interface DialogueSearchResults {
  /** 命中的 sessionId 集合（依 lastTime 降冪） */
  sessionIds: string[];
  /** 命中訊息總數（含重複；僅供提示） */
  hitCount: number;
  /** 是否被 500 筆截斷 */
  truncated: boolean;
}

interface DialogueState {
  /** 依 projectDir 快取索引 */
  indexByProject: Record<string, ProjectDialogueIndex>;
  /** 依 sessionId 快取完整事件陣列 */
  eventsBySession: Record<string, DialogueEvent[]>;
  /** 目前選中的 sessionId（null = 未選） */
  selectedSessionId: string | null;
  /** 當前顆粒度 */
  viewMode: DialogueViewMode;
  /** 搜尋字串（原樣保留；展示用；實際搜尋由 hook 處理 debounce） */
  searchQuery: string;
  /** 搜尋結果；null = 無搜尋進行中 */
  searchResults: DialogueSearchResults | null;
  /** 索引載入中 */
  loadingIndex: boolean;
  /** 單一 session 載入中 */
  loadingSession: boolean;

  // ── actions ───────────────────────────────
  setSelected: (id: string | null) => void;
  setViewMode: (mode: DialogueViewMode) => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (r: DialogueSearchResults | null) => void;
  setProjectIndex: (projectDir: string, index: ProjectDialogueIndex) => void;
  setEvents: (sessionId: string, events: DialogueEvent[]) => void;
  removeSession: (projectDir: string, sessionId: string) => void;
  clearSelection: () => void;
  clearSearch: () => void;
  setLoadingIndex: (b: boolean) => void;
  setLoadingSession: (b: boolean) => void;
}

export const useDialogueStore = create<DialogueState>((set) => ({
  indexByProject: {},
  eventsBySession: {},
  selectedSessionId: null,
  viewMode: 'chat',
  searchQuery: '',
  searchResults: null,
  loadingIndex: false,
  loadingSession: false,

  setSelected: (id) => set({ selectedSessionId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
  setProjectIndex: (projectDir, index) =>
    set((state) => ({
      indexByProject: { ...state.indexByProject, [projectDir]: index },
    })),
  setEvents: (sessionId, events) =>
    set((state) => ({
      eventsBySession: { ...state.eventsBySession, [sessionId]: events },
    })),
  removeSession: (projectDir, sessionId) =>
    set((state) => {
      // 1. 從索引移除
      const idx = state.indexByProject[projectDir];
      const nextIndex = idx
        ? {
            ...idx,
            sessions: idx.sessions.filter((s) => s.sessionId !== sessionId),
          }
        : idx;
      // 2. 從 events cache 移除
      const nextEvents = { ...state.eventsBySession };
      delete nextEvents[sessionId];
      // 3. 若刪除的是當前選取 → 清空
      const nextSelected =
        state.selectedSessionId === sessionId ? null : state.selectedSessionId;
      return {
        indexByProject: nextIndex
          ? { ...state.indexByProject, [projectDir]: nextIndex }
          : state.indexByProject,
        eventsBySession: nextEvents,
        selectedSessionId: nextSelected,
      };
    }),
  clearSelection: () => set({ selectedSessionId: null }),
  clearSearch: () => set({ searchQuery: '', searchResults: null }),
  setLoadingIndex: (b) => set({ loadingIndex: b }),
  setLoadingSession: (b) => set({ loadingSession: b }),
}));
