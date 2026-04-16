/**
 * StatusLineTab — 自訂 Claude Code 狀態列
 * 僅支援 command 模式（Claude Code 2.1.x 的 schema 以 h.literal("command") 限定）
 * v3.0 — 雙軌並行：每個範本同時支援 Python / PowerShell / Shell 多語言版本
 */
import React, { useState } from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import type { ClaudeSettings, StatusLineSettings } from '../../types/settings';
import './TabContent.css';
import './ResourceTab.css';  // 借用 .resource-chip 樣式做來源/語言過濾

// ─── 範本型別 ─────────────────────────────────────────────
/** 範本來源：官方風格 or 社群創意 */
type TemplateSource = 'official' | 'community';

/** 指令實作語言（決定範本卡底部的套用按鈕） */
type Lang = 'python' | 'powershell' | 'shell';

/** 語言過濾 state — 'all' 表示不篩選 */
type LangFilter = 'all' | Lang;

/** 單一語言版本的指令與參數（對應 StatusLineSettings 的子集） */
interface StatusLineVariant {
  command: string;              // 完整可貼入 settings.json 的指令
  padding?: number;             // 左右 padding
  refreshInterval?: number;     // 重新執行間隔（秒）
}

/** 單一狀態列範本 — 可能有多語言版本 */
interface StatusLineTemplate {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  preview: string;                                  // 範例輸出（靜態示意文字）
  source: TemplateSource;                           // 來源分類（決定卡片徽章顏色）
  needsNetwork?: boolean;                           // 是否需要網路（會在卡片標示）
  variants: Partial<Record<Lang, StatusLineVariant>>; // 各語言版本（非每個都有）
}

// ─── 語言顯示 metadata ────────────────────────────────────
/** 語言顯示名稱與 emoji，UI 與按鈕標示共用 */
const LANG_META: Record<Lang, { label: string; emoji: string }> = {
  python:     { label: 'Python',     emoji: '🐍' },
  powershell: { label: 'PowerShell', emoji: '⚡' },
  shell:      { label: 'Shell',      emoji: '🐚' },
};

// ─── stdin JSON 說明（文件用） ─────────────────────────────
/** Command 模式下 stdin 接收到的 JSON 結構範例 */
const STDIN_DOC = `{
  "model":          { "display_name": "Sonnet" },
  "context_window": { "used_percentage": 12, "context_window_size": 200000 },
  "cost":           { "total_cost_usd": 0.0023, "total_duration_ms": 45000 },
  "workspace":      { "current_dir": "/my/project", "git_worktree": "feat-xyz" },
  "rate_limits":    { "five_hour": { "used_percentage": 23.5 } },
  "vim":            { "mode": "NORMAL" }  // 僅 Vim 模式時存在
}`;

// ─── 12 個範本 × 多語言版本 ────────────────────────────────
// PowerShell 範本統一使用 `('...' -f arg1,arg2)` 格式化，避免內嵌雙引號逸出
// 所有 PowerShell 命令開頭都加 [Console]::OutputEncoding=[Text.Encoding]::UTF8;
// 以確保 emoji 與方塊字符（█ ░ 🤖 ⏱️）在 Windows console 正確顯示
const TEMPLATES: StatusLineTemplate[] = [
  {
    id: 'model-ctx',
    emoji: '📊',
    name: '模型 + Context 使用率',
    desc: '顯示目前模型名稱及 Context 視窗使用百分比',
    preview: '[Sonnet] 12% ctx',
    source: 'official',
    variants: {
      python: {
        command: "py -c \"import json,sys; d=json.load(sys.stdin); m=d['model']['display_name']; p=round(d.get('context_window',{}).get('used_percentage',0)); print(f'[{m}] {p}% ctx')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $p=[math]::Round($d.context_window.used_percentage); Write-Host ('[{0}] {1}% ctx' -f $d.model.display_name,$p)\"",
        padding: 1,
      },
    },
  },
  {
    id: 'model-cost',
    emoji: '💰',
    name: '模型 + 費用追蹤',
    desc: '顯示本 session 累積消耗的 API 費用（美元，4 位小數）',
    preview: '[Sonnet] $0.0023',
    source: 'official',
    variants: {
      python: {
        command: "py -c \"import json,sys; d=json.load(sys.stdin); m=d['model']['display_name']; c=d.get('cost',{}).get('total_cost_usd') or 0; print(f'[{m}] ${c:.4f}')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; Write-Host ('[{0}] ${1:F4}' -f $d.model.display_name,[double]$d.cost.total_cost_usd)\"",
        padding: 1,
      },
    },
  },
  {
    id: 'full-summary',
    emoji: '🗂️',
    name: '完整摘要',
    desc: '模型 + 當前目錄名稱 + Context % + 費用，資訊最豐富',
    preview: '[Sonnet] my-project | 12% | $0.0023',
    source: 'official',
    variants: {
      python: {
        command: "py -c \"import json,sys,os; d=json.load(sys.stdin); m=d['model']['display_name']; p=round(d.get('context_window',{}).get('used_percentage',0)); c=d.get('cost',{}).get('total_cost_usd') or 0; wd=os.path.basename(d.get('workspace',{}).get('current_dir','?')); print(f'[{m}] {wd} | {p}% | ${c:.4f}')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $p=[math]::Round($d.context_window.used_percentage); $w=Split-Path -Leaf $d.workspace.current_dir; Write-Host ('[{0}] {1} | {2}% | ${3:F4}' -f $d.model.display_name,$w,$p,[double]$d.cost.total_cost_usd)\"",
        padding: 1,
      },
    },
  },
  {
    id: 'ctx-bar',
    emoji: '▓',
    name: 'Context 進度條',
    desc: '用方塊字符直覺呈現 Context 使用量（10 格視覺進度條）',
    preview: '[Sonnet] ████░░░░░░ 40%',
    source: 'official',
    variants: {
      python: {
        command: "py -c \"import json,sys; d=json.load(sys.stdin); p=round(d.get('context_window',{}).get('used_percentage',0)); f=int(p/10); b=chr(9608)*f+chr(9617)*(10-f); m=d['model']['display_name']; print(f'[{m}] {b} {p}%')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $p=[math]::Round($d.context_window.used_percentage); $f=[int]($p/10); $b=('█'*$f)+('░'*(10-$f)); Write-Host ('[{0}] {1} {2}%' -f $d.model.display_name,$b,$p)\"",
        padding: 1,
      },
    },
  },
  {
    id: 'git-time',
    emoji: '🌿',
    name: 'Git 分支 + 時間',
    desc: '顯示目前 Git 分支名稱與系統時間（純 shell / PowerShell，無需 Python）',
    preview: '[main] 14:30',
    source: 'official',
    variants: {
      shell: {
        command: "echo \"[$(git branch --show-current 2>/dev/null || echo main)] $(date +%H:%M)\"",
        padding: 0,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $b=(git branch --show-current 2>$null); if(-not $b){$b='main'}; Write-Host ('[{0}] {1}' -f $b,(Get-Date -Format HH:mm))\"",
        padding: 0,
      },
    },
  },
  {
    id: 'rate-limit',
    emoji: '⚡',
    name: '速率限制使用量',
    desc: '顯示 5 小時速率限制已用百分比（Claude.ai Pro/Max 訂閱可用）',
    preview: '[Sonnet] RL: 23%',
    source: 'official',
    variants: {
      python: {
        command: "py -c \"import json,sys; d=json.load(sys.stdin); rl=d.get('rate_limits',{}).get('five_hour',{}); p=round(rl.get('used_percentage',0) if rl else 0); m=d['model']['display_name']; print(f'[{m}] RL: {p}%')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $rl=$d.rate_limits.five_hour; $p=if($rl){[math]::Round($rl.used_percentage)}else{0}; Write-Host ('[{0}] RL: {1}%' -f $d.model.display_name,$p)\"",
        padding: 1,
      },
    },
  },
  // ─── 社群靈感範本 ────────────────────────────────────────
  {
    id: 'emoji-dashboard',
    emoji: '🎨',
    name: 'Emoji 儀表板（豪華版）',
    desc: '靈感來自 Dan Does Code，用 🤖🧠💰📁 emoji 把所有關鍵指標一行顯示',
    preview: '🤖 Sonnet | 🧠 12% | 💰 $0.0023 | 📁 my-app',
    source: 'community',
    variants: {
      python: {
        command: "py -c \"import json,sys,os; d=json.load(sys.stdin); m=d['model']['display_name']; p=round(d.get('context_window',{}).get('used_percentage',0)); c=d.get('cost',{}).get('total_cost_usd') or 0; wd=os.path.basename(d.get('workspace',{}).get('current_dir','?')); print(f'🤖 {m} | 🧠 {p}% | 💰 ${c:.4f} | 📁 {wd}')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $p=[math]::Round($d.context_window.used_percentage); $w=Split-Path -Leaf $d.workspace.current_dir; Write-Host ('🤖 {0} | 🧠 {1}% | 💰 ${2:F4} | 📁 {3}' -f $d.model.display_name,$p,[double]$d.cost.total_cost_usd,$w)\"",
        padding: 1,
      },
    },
  },
  {
    id: 'ctx-color-gradient',
    emoji: '🌈',
    name: '彩色 Context 警示',
    desc: '靈感來自 claudefa.st：Context 百分比按使用量變色，< 50% 綠、50-80% 黃、> 80% 紅（需支援 ANSI 的終端）',
    preview: '[Sonnet] \x1b[32mctx 12%\x1b[0m（綠→黃→紅）',
    source: 'community',
    variants: {
      python: {
        command: "py -c \"import json,sys; d=json.load(sys.stdin); p=round(d.get('context_window',{}).get('used_percentage',0)); c='\\033[32m' if p<50 else '\\033[33m' if p<80 else '\\033[31m'; r='\\033[0m'; m=d['model']['display_name']; print(f'[{m}] {c}ctx {p}%{r}')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $p=[math]::Round($d.context_window.used_percentage); $c=if($p -lt 50){'32'}elseif($p -lt 80){'33'}else{'31'}; $e=[char]27; Write-Host ('[{0}] {1}[{2}mctx {3}%{1}[0m' -f $d.model.display_name,$e,$c,$p)\"",
        padding: 1,
      },
    },
  },
  {
    id: 'block-progress-bar',
    emoji: '⏳',
    name: '5 小時 Block 視覺進度',
    desc: '把 5 小時速率限制畫成 20 格進度條，精細度是普通版的 2 倍',
    preview: '⏳ 5h ████░░░░░░░░░░░░░░░░ 20%',
    source: 'community',
    variants: {
      python: {
        command: "py -c \"import json,sys; d=json.load(sys.stdin); rl=d.get('rate_limits',{}).get('five_hour',{}); p=round(rl.get('used_percentage',0) if rl else 0); f=int(p/5); b=chr(9608)*f+chr(9617)*(20-f); m=d['model']['display_name']; print(f'[{m}] ⏳ {b} {p}%')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $rl=$d.rate_limits.five_hour; $p=if($rl){[math]::Round($rl.used_percentage)}else{0}; $f=[int]($p/5); $b=('█'*$f)+('░'*(20-$f)); Write-Host ('[{0}] ⏳ {1} {2}%' -f $d.model.display_name,$b,$p)\"",
        padding: 1,
      },
    },
  },
  {
    id: 'worktree-dirty',
    emoji: '🌳',
    name: 'Worktree + 分支 + 髒標記',
    desc: '靈感來自 ccstatusline：顯示 git worktree 名 + 分支名，有未 commit 變更時加 * 號提醒',
    preview: '[Sonnet] 🌳 my-app | 🌿 feature/auth*',
    source: 'community',
    variants: {
      python: {
        command: "py -c \"import subprocess,json,sys,os; d=json.load(sys.stdin); m=d['model']['display_name']; wt=d.get('workspace',{}).get('git_worktree') or os.path.basename(d.get('workspace',{}).get('current_dir','?')); b=subprocess.run(['git','branch','--show-current'],capture_output=True,text=True,shell=True).stdout.strip() or '—'; s=subprocess.run(['git','status','--porcelain'],capture_output=True,text=True,shell=True).stdout.strip(); dirty='*' if s else ''; print(f'[{m}] 🌳 {wt} | 🌿 {b}{dirty}')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $wt=if($d.workspace.git_worktree){$d.workspace.git_worktree}else{Split-Path -Leaf $d.workspace.current_dir}; $b=(git branch --show-current 2>$null); if(-not $b){$b='—'}; $s=(git status --porcelain 2>$null); $dirty=if($s){'*'}else{''}; Write-Host ('[{0}] 🌳 {1} | 🌿 {2}{3}' -f $d.model.display_name,$wt,$b,$dirty)\"",
        padding: 1,
      },
    },
  },
  {
    id: 'session-duration',
    emoji: '⏱️',
    name: 'Session 時長計時器',
    desc: '顯示目前 session 累積使用時長（MM:SS 格式），適合想記錄自己 coding 時間的人',
    preview: '[Sonnet] ⏱️ 12:34',
    source: 'community',
    variants: {
      python: {
        command: "py -c \"import json,sys; d=json.load(sys.stdin); m=d['model']['display_name']; ms=d.get('cost',{}).get('total_duration_ms',0); s=ms//1000; print(f'[{m}] ⏱️ {s//60:02d}:{s%60:02d}')\"",
        padding: 1,
      },
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd()|ConvertFrom-Json; $s=[int]($d.cost.total_duration_ms/1000); Write-Host ('[{0}] ⏱️ {1:D2}:{2:D2}' -f $d.model.display_name,[int]($s/60),($s%60))\"",
        padding: 1,
      },
    },
  },
  {
    id: 'weather-wttr',
    emoji: '🌤️',
    name: '即時天氣（wttr.in）',
    desc: '靈感來自 DEV 社群：用 wttr.in 線上 API 顯示當地即時天氣（需網路），PowerShell 附逾時保護',
    preview: '[Sonnet] 🌤️ Partly cloudy +22°C',
    source: 'community',
    needsNetwork: true,
    variants: {
      powershell: {
        command: "pwsh -NoProfile -Command \"[Console]::OutputEncoding=[Text.Encoding]::UTF8; $j=[Console]::In.ReadToEnd()|ConvertFrom-Json; try{$w=(Invoke-RestMethod 'https://wttr.in/?format=%%C+%%t' -TimeoutSec 2).Trim()}catch{$w='—'}; Write-Host ('[{0}] 🌤️ {1}' -f $j.model.display_name,$w)\"",
        padding: 1,
        refreshInterval: 300,
      },
    },
  },
];

// ─── 元件 ─────────────────────────────────────────────────
const StatusLineTab: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();
  /** 記錄最近套用的「範本 id + 語言」組合，用於 2 秒確認動畫 */
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  /** 範本來源過濾：all / official / community */
  const [sourceFilter, setSourceFilter] = useState<'all' | TemplateSource>('all');
  /** 語言過濾：all / python / powershell / shell */
  const [langFilter, setLangFilter] = useState<LangFilter>('all');

  const userSettings: ClaudeSettings = files.user.data ?? {};
  const statusLine: StatusLineSettings = userSettings.statusLine ?? { type: 'command' };

  /**
   * 更新 statusLine 部分欄位並儲存
   * @param patch 要合并的部分 StatusLineSettings
   */
  const update = async (patch: Partial<StatusLineSettings>) => {
    await saveFile('user', files.user.path, {
      ...userSettings,
      statusLine: { ...statusLine, ...patch },
    });
  };

  /**
   * 套用範本特定語言版本 — 整體替換 statusLine
   * 若目前已有 statusLine 設定，跳 confirm 讓使用者確認覆蓋
   * @param tpl 要套用的範本
   * @param lang 要套用的語言版本（必須存在於 tpl.variants）
   */
  const applyTemplate = async (tpl: StatusLineTemplate, lang: Lang) => {
    const variant = tpl.variants[lang];
    if (!variant) return;
    // 只有在「覆蓋既有設定」時才跳確認；首次設定直接套用
    if (userSettings.statusLine?.command) {
      const ok = window.confirm(
        `確定要套用「${tpl.emoji} ${tpl.name}」的 ${LANG_META[lang].label} 版本？\n\n` +
        `這會覆蓋目前的 statusLine 設定。`
      );
      if (!ok) return;
    }
    const next: StatusLineSettings = { type: 'command', ...variant };
    await saveFile('user', files.user.path, { ...userSettings, statusLine: next });
    const key = `${tpl.id}:${lang}`;
    setAppliedKey(key);
    setTimeout(() => setAppliedKey(null), 2000);
  };

  /**
   * 清除 statusLine 設定（移除整個 statusLine key）
   */
  const clear = async () => {
    const { statusLine: _, ...rest } = userSettings;
    void _;
    await saveFile('user', files.user.path, rest);
  };

  const hasConfig = !!userSettings.statusLine;

  /** 依 sourceFilter + langFilter 過濾範本（語言過濾只保留有該語言 variant 的範本） */
  const filteredTemplates = TEMPLATES.filter((t) => {
    if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
    if (langFilter !== 'all' && !t.variants[langFilter]) return false;
    return true;
  });

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">📊 Status Line</h2>
      <p className="tab-desc">
        自訂 Claude Code 底部狀態列（僅支援 command 模式）。Claude Code 執行指定命令，透過 stdin 傳入 session JSON（模型、費用、Context 使用率等），命令的 stdout 輸出即為狀態列顯示內容。
      </p>

      {/* ── 啟用狀態列 ── */}
      <div className="statusline-status-bar">
        <span>
          狀態：
          <strong style={{ color: hasConfig ? 'var(--color-success)' : 'var(--text-muted)' }}>
            {hasConfig ? '已啟用' : '未啟用（設定後即生效）'}
          </strong>
        </span>
        {hasConfig && (
          <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={clear}>
            清除設定
          </button>
        )}
      </div>

      {/* ── Command 輸入（唯一支援的模式）── */}
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <label className="form-label" style={{ paddingTop: 6 }}>Command</label>
        <div style={{ flex: 1 }}>
          <textarea
            rows={3}
            value={statusLine.command ?? ''}
            onChange={(e) => update({ type: 'command', command: e.target.value || undefined })}
            style={{
              width: '100%',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: '8px 12px',
              resize: 'vertical',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="form-hint">
            命令透過 stdin 接收 session JSON；每行 stdout 輸出對應狀態列一行
          </div>
        </div>
      </div>

      {/* ── Padding + Refresh Interval ── */}
      <div className="form-row">
        <label className="form-label">Padding</label>
        <input
          type="number"
          min={0}
          max={20}
          placeholder="0"
          value={statusLine.padding ?? ''}
          onChange={(e) => update({ padding: e.target.value ? Number(e.target.value) : undefined })}
          style={{ width: 80 }}
        />
        <span className="form-hint" style={{ marginRight: 24 }}>左右空白字元數</span>

        <label className="form-label" style={{ minWidth: 120, marginLeft: 8 }}>Refresh Interval</label>
        <input
          type="number"
          min={1}
          max={3600}
          placeholder="不重整"
          value={statusLine.refreshInterval ?? ''}
          onChange={(e) =>
            update({ refreshInterval: e.target.value ? Number(e.target.value) : undefined })
          }
          style={{ width: 80 }}
        />
        <span className="form-hint">秒（定期重新執行命令）</span>
      </div>

      <hr className="divider" />

      {/* ── 範本套用區：標題 + 雙過濾器 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
        <p className="section-title" style={{ margin: 0 }}>範本（可直接套用）</p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 來源過濾 */}
          <div className="resource-toolbar__filter">
            {(['all', 'official', 'community'] as const).map((s) => (
              <button
                key={s}
                className={`resource-chip${sourceFilter === s ? ' resource-chip--active' : ''}`}
                onClick={() => setSourceFilter(s)}
              >
                {s === 'all' ? `全部 (${TEMPLATES.length})` : s === 'official' ? `🏢 官方` : `🌐 社群`}
              </button>
            ))}
          </div>
          {/* 語言過濾 */}
          <div className="resource-toolbar__filter">
            {(['all', 'python', 'powershell', 'shell'] as const).map((l) => (
              <button
                key={l}
                className={`resource-chip${langFilter === l ? ' resource-chip--active' : ''}`}
                onClick={() => setLangFilter(l)}
                title={l === 'all' ? '不限語言' : `僅顯示有 ${LANG_META[l].label} 版本的範本`}
              >
                {l === 'all' ? '全部語言' : `${LANG_META[l].emoji} ${LANG_META[l].label}`}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="tab-desc" style={{ marginBottom: 16, fontSize: 12 }}>
        點擊語言按鈕即可將該語言版本寫入 User 設定。PowerShell 範本適合 Windows 環境；Python 範本跨平台；Shell 範本最輕量（僅 POSIX 相容系統）。
      </p>

      <div className="statusline-templates-grid">
        {filteredTemplates.map((tpl) => {
          // 此範本支援的語言列表，langFilter 若非 all 則只顯示該語言
          const availableLangs = (Object.keys(tpl.variants) as Lang[]).filter(
            (l) => langFilter === 'all' || l === langFilter
          );
          return (
            <div key={tpl.id} className="statusline-template-card">
              <div className="statusline-template-header">
                <span className="statusline-template-emoji">{tpl.emoji}</span>
                <span className="statusline-template-name">{tpl.name}</span>
              </div>

              {/* 來源 / 網路需求 / 語言徽章列 */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                <span className={`hook-tag hook-tag--source-${tpl.source}`}>
                  {tpl.source === 'official' ? '🏢 官方' : '🌐 社群'}
                </span>
                {tpl.needsNetwork && (
                  <span className="hook-tag hook-tag--network">📡 需網路</span>
                )}
                {(Object.keys(tpl.variants) as Lang[]).map((l) => (
                  <span key={l} className="hook-tag" title={`支援 ${LANG_META[l].label}`}>
                    {LANG_META[l].emoji} {LANG_META[l].label}
                  </span>
                ))}
              </div>

              <div className="statusline-template-desc">{tpl.desc}</div>
              <div className="statusline-template-preview">
                <span className="statusline-preview-label">預覽輸出</span>
                <code className="statusline-preview-text">{tpl.preview}</code>
              </div>

              {/* 套用按鈕：每個可用語言一個按鈕 */}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {availableLangs.map((lang) => {
                  const key = `${tpl.id}:${lang}`;
                  const isApplied = appliedKey === key;
                  return (
                    <button
                      key={lang}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 12,
                        padding: '5px 8px',
                        background: isApplied ? 'var(--color-success)' : undefined,
                        color: isApplied ? '#fff' : undefined,
                        transition: 'background 0.3s',
                      }}
                      onClick={() => applyTemplate(tpl, lang)}
                      title={`套用 ${LANG_META[lang].label} 版本`}
                    >
                      {isApplied ? `✓ 已套用` : `${LANG_META[lang].emoji} ${LANG_META[lang].label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <p className="tab-desc" style={{ textAlign: 'center', padding: 40 }}>
          目前篩選條件下沒有範本。請放寬來源或語言過濾。
        </p>
      )}

      <hr className="divider" />

      {/* ── stdin JSON 欄位說明 ── */}
      <p className="section-title">Command stdin 可用的 JSON 欄位</p>
      <p className="tab-desc" style={{ marginBottom: 8, fontSize: 12 }}>
        Claude Code 執行命令前會將以下結構序列化後透過 stdin 傳入，可用 Python / PowerShell / jq 等工具讀取。
      </p>
      <pre className="statusline-stdin-doc">{STDIN_DOC}</pre>
    </div>
  );
};

export default StatusLineTab;
