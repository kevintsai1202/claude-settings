/**
 * DialogueTab — 檢視當前專案的 Claude Code session 歷史
 * 主 Tab 元件：協調 SessionList + SessionView，並依 projectDir 觸發載入
 */
import React, { useEffect } from 'react';
import { MessageSquareOff } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useDialogue } from '../../hooks/useDialogue';
import { useDialogueStore } from '../../store/dialogueStore';
import '../dialogue/DialogueTab.css';

const DialogueTab: React.FC = () => {
  const projectDir = useAppStore((s) => s.projectDir);
  const { loadProjectIndex } = useDialogue();
  const { loadingIndex, indexByProject } = useDialogueStore();

  // 進入此 Tab 或 projectDir 變動 → 載入索引
  useEffect(() => {
    useDialogueStore.getState().clearSelection();
    useDialogueStore.getState().clearSearch();
    if (projectDir) void loadProjectIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

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
  const sessionCount = idx?.sessions.length ?? 0;

  return (
    <div className="dialogue-tab">
      <div className="dialogue-tab__list">
        {/* 後續 task 放 SessionList */}
        <div style={{ padding: 12, fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
          {loadingIndex ? '載入中…' : `共 ${sessionCount} 個 session`}
        </div>
      </div>
      <div className="dialogue-tab__view">
        <div className="dialogue-tab__empty">
          尚未選擇 session
        </div>
      </div>
    </div>
  );
};

export default DialogueTab;
