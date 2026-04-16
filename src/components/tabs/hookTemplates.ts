/**
 * Claude Code Hook 範本庫
 * 每個範本可透過 UI 一鍵套用，自動新增為對應事件下的 HookEntry
 * 以 Windows 環境為主（使用 py / powershell），跨平台項目會在 desc 標註
 */
import type { HookEvent } from '../../types/settings';

/** 範本來源：官方建議風格 or 社群創意應用 */
export type HookTemplateSource = 'official' | 'community';

/** 單一 Hook 範本定義 */
export interface HookTemplate {
  id: string;
  emoji: string;
  name: string;              // 範本顯示名稱
  desc: string;              // 用途描述（中文）
  event: HookEvent;          // 要套用到哪個事件
  matcher?: string;          // 工具匹配條件（僅 PreToolUse/PostToolUse 有效）
  command: string;           // 要執行的命令（type=command 固定）
  timeout?: number;          // ms，預設 60000
  platform: 'windows' | 'unix' | 'cross';  // 支援平台標示
  source: HookTemplateSource; // 來源分類
  needsNetwork?: boolean;    // 是否需要網路（卡片標示用）
  needsSetup?: string;       // 需要額外設定的提示（如 Webhook URL）
  preview: string;           // 一句話預覽效果（UI 顯示）
}

// ─── 範本集合 ────────────────────────────────────────────────
export const HOOK_TEMPLATES: HookTemplate[] = [
  // ── PreToolUse：安全阻擋類 ──
  {
    id: 'block-dangerous-bash',
    emoji: '🛡️',
    name: '阻擋危險 Bash 命令',
    desc: '在命令執行前檢查是否包含 rm -rf /、format c:、sudo rm 等危險操作，命中則 exit 2 阻止執行',
    event: 'PreToolUse',
    matcher: 'Bash',
    platform: 'cross',
    source: 'official',
    preview: '攔截 rm -rf / format c: / sudo rm 等毀滅性命令',
    command: `py -c "import json,sys; d=json.load(sys.stdin); cmd=d.get('tool_input',{}).get('command','').lower(); danger=['rm -rf /','rm -rf ~','sudo rm','format c:','del /f /s /q c:','chmod -R 000','mkfs']; hit=[p for p in danger if p in cmd]; print(f'Hook 阻擋：偵測到危險命令 \\"{hit[0]}\\"',file=sys.stderr) if hit else None; sys.exit(2 if hit else 0)"`,
    timeout: 5000,
  },
  {
    id: 'protect-sensitive-files',
    emoji: '🧹',
    name: '禁止編輯敏感檔',
    desc: '保護 .env、secrets.json、credentials、.pem、.key 等敏感檔案不被 Write/Edit 修改',
    event: 'PreToolUse',
    matcher: 'Write|Edit|MultiEdit',
    platform: 'cross',
    source: 'official',
    preview: '阻擋 .env / secrets / *.pem / *.key 的編輯',
    command: `py -c "import json,sys; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path','').lower(); protected=['.env','secrets.json','credentials','.pem','.key','id_rsa']; hit=[p for p in protected if p in fp]; print(f'Hook 阻擋：{fp} 為敏感檔案，禁止編輯',file=sys.stderr) if hit else None; sys.exit(2 if hit else 0)"`,
    timeout: 5000,
  },

  // ── PostToolUse：自動格式化 / 日誌 ──
  {
    id: 'prettier-format',
    emoji: '✨',
    name: 'Prettier 自動格式化',
    desc: '當 Claude 編輯 .ts/.tsx/.js/.jsx/.json/.md/.css 時自動執行 prettier --write',
    event: 'PostToolUse',
    matcher: 'Write|Edit|MultiEdit',
    platform: 'cross',
    source: 'official',
    preview: '每次寫入後自動跑 npx prettier --write <file>',
    command: `py -c "import json,sys,subprocess; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); exts=('.ts','.tsx','.js','.jsx','.json','.md','.css','.scss'); fp.endswith(exts) and subprocess.run(['npx','prettier','--write',fp],shell=True,capture_output=True)"`,
    timeout: 30000,
  },
  {
    id: 'ruff-format',
    emoji: '🐍',
    name: 'Python Ruff 格式化',
    desc: '當 Claude 編輯 .py 檔時自動執行 ruff format（需先安裝 ruff: pip install ruff）',
    event: 'PostToolUse',
    matcher: 'Write|Edit|MultiEdit',
    platform: 'cross',
    source: 'official',
    preview: 'Python 檔寫入後執行 ruff format <file>',
    command: `py -c "import json,sys,subprocess; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); fp.endswith('.py') and subprocess.run(['ruff','format',fp],shell=True,capture_output=True)"`,
    timeout: 15000,
  },
  {
    id: 'bash-log',
    emoji: '📝',
    name: 'Bash 命令日誌',
    desc: '將每條執行的 Bash 命令記錄到 .claude/bash-log.txt（含時間戳），方便稽核',
    event: 'PostToolUse',
    matcher: 'Bash',
    platform: 'cross',
    source: 'official',
    preview: '→ .claude/bash-log.txt：[2026-04-16 14:23:05] git status',
    command: `py -c "import json,sys,os,datetime; d=json.load(sys.stdin); cmd=d.get('tool_input',{}).get('command',''); os.makedirs('.claude',exist_ok=True); open('.claude/bash-log.txt','a',encoding='utf-8').write(f'[{datetime.datetime.now():%Y-%m-%d %H:%M:%S}] {cmd}\\n')"`,
    timeout: 5000,
  },

  // ── UserPromptSubmit：Context 注入 ──
  {
    id: 'inject-git-branch',
    emoji: '🌿',
    name: '自動注入 Git 分支',
    desc: '每次送出 Prompt 時，自動把目前 Git 分支名稱加進 context，讓 Claude 知道工作分支',
    event: 'UserPromptSubmit',
    platform: 'cross',
    source: 'official',
    preview: '附加到 context：[Git Branch: main]',
    command: `py -c "import subprocess,json; b=subprocess.run(['git','branch','--show-current'],capture_output=True,text=True,shell=True).stdout.strip(); b and print(json.dumps({'hookSpecificOutput':{'hookEventName':'UserPromptSubmit','additionalContext':f'[Git Branch: {b}]'}}))"`,
    timeout: 5000,
  },

  // ── SessionStart：工作狀態注入 ──
  {
    id: 'session-start-git-status',
    emoji: '🔖',
    name: 'Session 開始印 Git 狀態',
    desc: '啟動 session 時自動收集 git status --short 與未推送的 commit 清單，注入到 Claude 的 context',
    event: 'SessionStart',
    platform: 'cross',
    source: 'official',
    preview: '附加到 context：[Working Tree] M src/... / [未推送] 2 commits',
    command: `py -c "import subprocess,json; s=subprocess.run(['git','status','--short'],capture_output=True,text=True,shell=True).stdout.strip() or '(clean)'; u=subprocess.run(['git','log','@{u}..HEAD','--oneline'],capture_output=True,text=True,shell=True).stdout.strip() or '(none)'; print(json.dumps({'hookSpecificOutput':{'hookEventName':'SessionStart','additionalContext':f'[Working Tree]\\n{s}\\n[未推送]\\n{u}'}}))"`,
    timeout: 10000,
  },

  // ── Stop：完成音效 ──
  {
    id: 'stop-beep',
    emoji: '🎵',
    name: '完成音效（Windows）',
    desc: '當 Claude 回應結束時播放短音提示，可同時使用電腦去做別的事再回來處理',
    event: 'Stop',
    platform: 'windows',
    source: 'official',
    preview: 'powershell [console]::beep 發出兩聲高低音',
    command: `powershell -NoProfile -Command "[console]::beep(800,150); [console]::beep(1200,200)"`,
    timeout: 3000,
  },

  // ═══════════════════════════════════════════════════════════
  // ── 社群靈感範本（awesome-claude-code / dev.to / disler）──
  // ═══════════════════════════════════════════════════════════

  {
    id: 'tts-voice-complete',
    emoji: '🔊',
    name: 'TTS 完成語音（Windows SAPI）',
    desc: '靈感來自 disler/claude-code-hooks-mastery：用 Windows 內建 SAPI 語音合成器唸出「Task complete」，專注其他事時不看畫面也能知道完成了',
    event: 'Stop',
    platform: 'windows',
    source: 'community',
    preview: '🗣️ 說話：「Task complete」',
    command: `powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate=2; $s.Speak('Task complete')"`,
    timeout: 10000,
  },

  {
    id: 'auto-allow-safe-reads',
    emoji: '✅',
    name: '自動允許安全讀取操作',
    desc: '靈感來自 dev.to：Read/Glob/Grep 這些純讀取工具永遠安全，透過 hook 回傳 {decision:"allow"} 讓 Claude 自動通過，省去每次確認',
    event: 'PreToolUse',
    matcher: 'Read|Glob|Grep',
    platform: 'cross',
    source: 'community',
    preview: '所有 Read/Glob/Grep 操作自動通過，不再跳確認',
    command: `py -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow','permissionDecisionReason':'Safe read-only operation'}}))"`,
    timeout: 3000,
  },

  {
    id: 'discord-webhook-notify',
    emoji: '💬',
    name: 'Discord Webhook 完成通知',
    desc: '靈感來自社群整合：Claude 回應結束時發訊息到 Discord 頻道（團隊協作 / 個人手機通知用），需先到 Discord 伺服器設定 Webhook 並把 URL 貼進命令',
    event: 'Stop',
    platform: 'cross',
    source: 'community',
    needsNetwork: true,
    needsSetup: '需替換命令中的 YOUR_WEBHOOK_URL（Discord 頻道設定 → 整合 → Webhooks）',
    preview: '→ Discord：「Claude completed at 14:30」',
    command: `py -c "import urllib.request,json,datetime; url='https://discord.com/api/webhooks/YOUR_WEBHOOK_URL'; msg={'content':f'🤖 Claude completed at {datetime.datetime.now():%H:%M:%S}'}; urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(msg).encode(),headers={'Content-Type':'application/json'}),timeout=3)"`,
    timeout: 8000,
  },

  {
    id: 'mcp-audit-log',
    emoji: '📊',
    name: 'MCP 操作稽核日誌',
    desc: '靈感來自 dev.to：記錄所有 MCP 工具呼叫（mcp__* matcher）到 .claude/mcp-audit.log，追蹤外部服務使用模式',
    event: 'PostToolUse',
    matcher: 'mcp__.*',
    platform: 'cross',
    source: 'community',
    preview: '→ .claude/mcp-audit.log：[14:30] mcp__slack__send_message',
    command: `py -c "import json,sys,os,datetime; d=json.load(sys.stdin); tool=d.get('tool_name',''); os.makedirs('.claude',exist_ok=True); open('.claude/mcp-audit.log','a',encoding='utf-8').write(f'[{datetime.datetime.now():%Y-%m-%d %H:%M:%S}] {tool}\\n')"`,
    timeout: 3000,
  },

  {
    id: 'auto-run-test-file',
    emoji: '🧪',
    name: '測試檔變動後自動跑',
    desc: '靈感來自 dev.to：Claude 編輯 .test.* 或 .spec.* 檔時，非阻塞地背景執行 vitest 對該檔，立即看到綠燈/紅燈回饋',
    event: 'PostToolUse',
    matcher: 'Write|Edit|MultiEdit',
    platform: 'cross',
    source: 'community',
    preview: '編輯 foo.test.ts 後自動跑 npx vitest run foo.test.ts',
    command: `py -c "import json,sys,subprocess; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); any(p in fp for p in ['.test.','.spec.']) and subprocess.Popen(['npx','vitest','run',fp],shell=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)"`,
    timeout: 5000,
  },

  {
    id: 'offline-mode',
    emoji: '🚫',
    name: '離線模式（阻擋網路工具）',
    desc: '靈感來自 dev.to：強制執行「離線專案模式」— Claude 想用 WebFetch/WebSearch 時自動被拒，避免 context 被外部資訊干擾',
    event: 'PreToolUse',
    matcher: 'WebFetch|WebSearch',
    platform: 'cross',
    source: 'community',
    preview: '阻擋所有 WebFetch / WebSearch',
    command: `py -c "import sys; print('離線模式已啟用，本專案禁用 WebFetch/WebSearch',file=sys.stderr); sys.exit(2)"`,
    timeout: 3000,
  },
];

/** 依事件分組範本 */
export const groupTemplatesByEvent = (): Record<HookEvent, HookTemplate[]> => {
  const result = {} as Record<HookEvent, HookTemplate[]>;
  for (const tpl of HOOK_TEMPLATES) {
    if (!result[tpl.event]) result[tpl.event] = [];
    result[tpl.event].push(tpl);
  }
  return result;
};
