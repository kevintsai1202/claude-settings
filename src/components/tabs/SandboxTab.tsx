/**
 * SandboxTab — 沙箱設定表單
 * 讀寫 files.user.data.sandbox（SandboxSettings）
 * 分為基本設定、Filesystem、Network 三個可折疊區段
 */
import React from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import Toggle from '../ui/Toggle';
import TagArrayInput from '../ui/TagArrayInput';
import CollapsibleSection from '../ui/CollapsibleSection';
import type { ClaudeSettings, SandboxSettings, SandboxFilesystem, SandboxNetwork } from '../../types/settings';
import './TabContent.css';

const SandboxTab: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  /** 以 user 層為主要編輯對象 */
  const data: ClaudeSettings = files.user.data ?? {};
  /** 目前沙箱設定（可能為空物件） */
  const sandbox: SandboxSettings = data.sandbox ?? {};
  /** 檔案系統規則 */
  const fs: SandboxFilesystem = sandbox.filesystem ?? {};
  /** 網路規則 */
  const net: SandboxNetwork = sandbox.network ?? {};

  /**
   * 更新 sandbox 頂層欄位並儲存
   * @param patch 要合并的部分 SandboxSettings
   */
  const updateSandbox = async (patch: Partial<SandboxSettings>) => {
    await saveFile('user', files.user.path, {
      ...data,
      sandbox: { ...sandbox, ...patch },
    });
  };

  /**
   * 更新 sandbox.filesystem 並儲存
   * @param patch 要合并的部分 SandboxFilesystem
   */
  const updateFs = async (patch: Partial<SandboxFilesystem>) => {
    await saveFile('user', files.user.path, {
      ...data,
      sandbox: { ...sandbox, filesystem: { ...fs, ...patch } },
    });
  };

  /**
   * 更新 sandbox.network 並儲存
   * @param patch 要合并的部分 SandboxNetwork
   */
  const updateNet = async (patch: Partial<SandboxNetwork>) => {
    await saveFile('user', files.user.path, {
      ...data,
      sandbox: { ...sandbox, network: { ...net, ...patch } },
    });
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🛡️ Sandbox 設定</h2>
      <p className="tab-desc">設定沙箱執行環境，限制 Bash 工具的檔案系統與網路存取範圍。</p>

      {/* ── 基本設定區段 ── */}
      <CollapsibleSection title="基本設定" defaultOpen={true}>

        {/* 啟用沙箱 */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Enabled</div>
            <div className="form-hint">啟用沙箱隔離，限制命令執行環境</div>
          </div>
          <Toggle
            checked={sandbox.enabled ?? false}
            onChange={(v) => updateSandbox({ enabled: v })}
          />
        </div>

        {/* 沙箱不可用時報錯 */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Fail If Unavailable</div>
            <div className="form-hint">沙箱環境不可用時直接報錯，而非降級執行</div>
          </div>
          <Toggle
            checked={sandbox.failIfUnavailable ?? false}
            onChange={(v) => updateSandbox({ failIfUnavailable: v })}
          />
        </div>

        {/* 沙箱環境自動允許 Bash */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Auto Allow Bash If Sandboxed</div>
            <div className="form-hint">在沙箱環境中自動允許所有 Bash 命令</div>
          </div>
          <Toggle
            checked={sandbox.autoAllowBashIfSandboxed ?? false}
            onChange={(v) => updateSandbox({ autoAllowBashIfSandboxed: v })}
          />
        </div>

        {/* 排除的命令清單 */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Excluded Commands</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={sandbox.excludedCommands ?? []}
              onChange={(v) => updateSandbox({ excludedCommands: v.length ? v : undefined })}
              placeholder="輸入命令後按 Enter，例如 git"
            />
            <div className="form-hint">這些命令將從沙箱中排除，不受沙箱限制</div>
          </div>
        </div>

        {/* 允許不沙箱化的命令 */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Allow Unsandboxed Commands</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={sandbox.allowUnsandboxedCommands ?? []}
              onChange={(v) => updateSandbox({ allowUnsandboxedCommands: v.length ? v : undefined })}
              placeholder="輸入命令後按 Enter"
            />
            <div className="form-hint">允許在沙箱外執行的命令清單</div>
          </div>
        </div>

        {/* 較寬鬆的嵌套沙箱 */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Enable Weaker Nested Sandbox</div>
            <div className="form-hint">允許嵌套沙箱使用較寬鬆的限制（用於特殊工具）</div>
          </div>
          <Toggle
            checked={sandbox.enableWeakerNestedSandbox ?? false}
            onChange={(v) => updateSandbox({ enableWeakerNestedSandbox: v })}
          />
        </div>

        {/* 較寬鬆的網路隔離 */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Enable Weaker Network Isolation</div>
            <div className="form-hint">使用較寬鬆的網路隔離策略（適用於開發環境）</div>
          </div>
          <Toggle
            checked={sandbox.enableWeakerNetworkIsolation ?? false}
            onChange={(v) => updateSandbox({ enableWeakerNetworkIsolation: v })}
          />
        </div>

      </CollapsibleSection>

      {/* ── Filesystem 區段（預設關閉） ── */}
      <CollapsibleSection title="Filesystem 檔案系統規則" defaultOpen={false}>

        {/* 允許寫入的路徑 */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Allow Write</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={fs.allowWrite ?? []}
              onChange={(v) => updateFs({ allowWrite: v.length ? v : undefined })}
              placeholder="路徑，例如 /tmp"
            />
            <div className="form-hint">允許寫入的路徑清單（glob 或絕對路徑）</div>
          </div>
        </div>

        {/* 拒絕寫入的路徑 */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Deny Write</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={fs.denyWrite ?? []}
              onChange={(v) => updateFs({ denyWrite: v.length ? v : undefined })}
              placeholder="路徑，例如 /etc"
            />
            <div className="form-hint">明確拒絕寫入的路徑（優先於 Allow Write）</div>
          </div>
        </div>

        {/* 拒絕讀取的路徑 */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Deny Read</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={fs.denyRead ?? []}
              onChange={(v) => updateFs({ denyRead: v.length ? v : undefined })}
              placeholder="路徑，例如 ~/.ssh"
            />
            <div className="form-hint">明確拒絕讀取的敏感路徑</div>
          </div>
        </div>

        {/* 允許讀取的路徑 */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Allow Read</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={fs.allowRead ?? []}
              onChange={(v) => updateFs({ allowRead: v.length ? v : undefined })}
              placeholder="路徑，例如 /usr/share"
            />
            <div className="form-hint">額外允許讀取的路徑</div>
          </div>
        </div>

        {/* 僅允許 managed 定義的讀取路徑 */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Allow Managed Read Paths Only</div>
            <div className="form-hint">僅允許由 managed 設定層定義的讀取路徑</div>
          </div>
          <Toggle
            checked={fs.allowManagedReadPathsOnly ?? false}
            onChange={(v) => updateFs({ allowManagedReadPathsOnly: v })}
          />
        </div>

      </CollapsibleSection>

      {/* ── Network 區段（預設關閉） ── */}
      <CollapsibleSection title="Network 網路規則" defaultOpen={false}>

        {/* 允許 Unix socket */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Allow Unix Sockets</div>
            <div className="form-hint">允許通過 Unix domain socket 進行本機通訊</div>
          </div>
          <Toggle
            checked={net.allowUnixSockets ?? false}
            onChange={(v) => updateNet({ allowUnixSockets: v })}
          />
        </div>

        {/* 允許所有 Unix socket */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Allow All Unix Sockets</div>
            <div className="form-hint">允許所有 Unix socket 連線（較寬鬆）</div>
          </div>
          <Toggle
            checked={net.allowAllUnixSockets ?? false}
            onChange={(v) => updateNet({ allowAllUnixSockets: v })}
          />
        </div>

        {/* 允許本機端口綁定 */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Allow Local Binding</div>
            <div className="form-hint">允許綁定本機 localhost 端口（開發伺服器用）</div>
          </div>
          <Toggle
            checked={net.allowLocalBinding ?? false}
            onChange={(v) => updateNet({ allowLocalBinding: v })}
          />
        </div>

        {/* 允許的網域清單 */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Allowed Domains</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={net.allowedDomains ?? []}
              onChange={(v) => updateNet({ allowedDomains: v.length ? v : undefined })}
              placeholder="例如 api.example.com"
            />
            <div className="form-hint">允許對外連線的網域白名單</div>
          </div>
        </div>

        {/* 僅允許 managed 定義的網域 */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Allow Managed Domains Only</div>
            <div className="form-hint">僅允許由 managed 設定層定義的網域</div>
          </div>
          <Toggle
            checked={net.allowManagedDomainsOnly ?? false}
            onChange={(v) => updateNet({ allowManagedDomainsOnly: v })}
          />
        </div>

        {/* HTTP proxy 端口 */}
        <div className="form-row">
          <label className="form-label">HTTP Proxy Port</label>
          <input
            type="number"
            min={1}
            max={65535}
            placeholder="例如 8080"
            value={net.httpProxyPort ?? ''}
            onChange={(e) => updateNet({ httpProxyPort: e.target.value ? Number(e.target.value) : undefined })}
            style={{ width: 120 }}
          />
          <span className="form-hint">HTTP Proxy 端口號（1–65535）</span>
        </div>

        {/* SOCKS proxy 端口 */}
        <div className="form-row">
          <label className="form-label">SOCKS Proxy Port</label>
          <input
            type="number"
            min={1}
            max={65535}
            placeholder="例如 1080"
            value={net.socksProxyPort ?? ''}
            onChange={(e) => updateNet({ socksProxyPort: e.target.value ? Number(e.target.value) : undefined })}
            style={{ width: 120 }}
          />
          <span className="form-hint">SOCKS Proxy 端口號（1–65535）</span>
        </div>

      </CollapsibleSection>
    </div>
  );
};

export default SandboxTab;
