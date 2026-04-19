/**
 * DialogueTab — 檢視當前專案的 Claude Code session 歷史
 */
import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquareOff } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useDialogue } from '../../hooks/useDialogue';
import { useDialogueStore } from '../../store/dialogueStore';
import SessionList from '../dialogue/SessionList';
import SessionView from '../dialogue/SessionView';
import ConfirmDialog from '../ui/ConfirmDialog';
import '../dialogue/DialogueTab.css';

/** 搜尋輸入 debounce 毫秒 */
const SEARCH_DEBOUNCE_MS = 200;

const DialogueTab: React.FC = () => {
  const projectDir = useAppStore((s) => s.projectDir);
  const { loadProjectIndex, searchInProject, deleteSession } = useDialogue();
  const indexByProject = useDialogueStore((s) => s.indexByProject);
  const selectedSessionId = useDialogueStore((s) => s.selectedSessionId);
  const searchQuery = useDialogueStore((s) => s.searchQuery);
  const searchResults = useDialogueStore((s) => s.searchResults);
  const loadingIndex = useDialogueStore((s) => s.loadingIndex);
  const setSelected = useDialogueStore((s) => s.setSelected);
  const setSearchQuery = useDialogueStore((s) => s.setSearchQuery);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 進入此 Tab 或 projectDir 變動 → 載入索引
  useEffect(() => {
    useDialogueStore.getState().clearSelection();
    useDialogueStore.getState().clearSearch();
    if (projectDir) void loadProjectIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  // 搜尋 debounce
  useEffect(() => {
    if (!projectDir) return;
    const handler = setTimeout(() => {
      void searchInProject(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, projectDir]);

  const pendingMeta = useMemo(() => {
    if (!pendingDeleteId) return null;
    const sessions = indexByProject[projectDir ?? '']?.sessions ?? [];
    return sessions.find((s) => s.sessionId === pendingDeleteId) ?? null;
  }, [pendingDeleteId, indexByProject, projectDir]);

  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await deleteSession(pendingDeleteId);
      setToast('✓ 已刪除對話紀錄');
      setTimeout(() => setToast(null), 2000);
      setPendingDeleteId(null);
    } catch (err) {
      setToast(`✗ 刪除失敗：${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setToast(null), 3500);
    } finally {
      setDeleting(false);
    }
  };

  if (!projectDir) {
    return (
      <div className="dialogue-tab">
        <div className="dialogue-tab__empty">
          <div>
            <MessageSquareOff
              size={28}
              className="dialogue-tab__empty-icon"
            />
            請從左側 Sidebar 選擇專案，才能檢視對話歷史
          </div>
        </div>
      </div>
    );
  }

  const idx = indexByProject[projectDir];
  const sessions = idx?.sessions ?? [];

  return (
    <div className="dialogue-tab">
      <div className="dialogue-tab__list">
        <SessionList
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={(id) => setSelected(id)}
          onRequestDelete={(id) => setPendingDeleteId(id)}
          filteredIds={searchResults?.sessionIds ?? null}
          searchTruncated={searchResults?.truncated ?? false}
          query={searchQuery}
          onQueryChange={(q) => setSearchQuery(q)}
        />
      </div>
      <div className="dialogue-tab__view">
        {selectedSessionId ? (
          <SessionView
            sessionId={selectedSessionId}
            onRequestDelete={(id) => setPendingDeleteId(id)}
          />
        ) : (
          <div className="dialogue-tab__empty">
            {loadingIndex ? '載入中…' : '← 從左側選擇一個對話'}
          </div>
        )}
      </div>
      {pendingMeta && (
        <ConfirmDialog
          isOpen={!!pendingMeta && !deleting}
          title="刪除此對話紀錄？"
          message={
            `開始時間：${pendingMeta.startTime}\n` +
            `首則 prompt：${pendingMeta.firstPromptPreview || '（無）'}\n` +
            `檔案：${pendingMeta.filePath}`
          }
          warning="此操作不可復原。若此 session 正由 Claude Code 寫入中，刪除可能造成異常。"
          confirmLabel="刪除"
          cancelLabel="取消"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />
      )}
      {toast && (
        <div className="dialogue-tab__toast">{toast}</div>
      )}
    </div>
  );
};

export default DialogueTab;
