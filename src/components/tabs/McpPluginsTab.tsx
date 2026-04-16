/**
 * McpPluginsTab — MCP 伺服器與插件設定表單
 * 讀寫 files.user.data 的 MCP 與 Plugin 相關欄位
 * 分為 MCP Servers、Plugins 兩個 CollapsibleSection，
 * enabledPlugins（Record<string, boolean>）建議透過 JSON Tab 編輯
 */
import React from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import Toggle from '../ui/Toggle';
import TagArrayInput from '../ui/TagArrayInput';
import CollapsibleSection from '../ui/CollapsibleSection';
import type { ClaudeSettings } from '../../types/settings';
import './TabContent.css';

const McpPluginsTab: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  /** 以 user 層為主要編輯對象 */
  const data: ClaudeSettings = files.user.data ?? {};

  /**
   * 更新 user 層設定並儲存
   * @param patch 要合并的部分 ClaudeSettings
   */
  const update = async (patch: Partial<ClaudeSettings>) => {
    await saveFile('user', files.user.path, { ...data, ...patch });
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🔌 MCP 與插件設定</h2>
      <p className="tab-desc">管理 MCP Server 白/黑名單及插件 Channel 設定。</p>

      {/* ── MCP Servers 區段 ── */}
      <CollapsibleSection title="MCP Servers" defaultOpen={true}>

        {/* 啟用所有專案 MCP Servers */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Enable All Project MCP Servers</div>
            <div className="form-hint">自動啟用專案目錄下所有 MCP server 設定</div>
          </div>
          <Toggle
            checked={data.enableAllProjectMcpServers ?? false}
            onChange={(v) => update({ enableAllProjectMcpServers: v })}
          />
        </div>

        {/* 啟用的 MCP.json Servers */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Enabled MCP.json Servers</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.enabledMcpjsonServers ?? []}
              onChange={(v) => update({ enabledMcpjsonServers: v.length ? v : undefined })}
              placeholder="輸入 server 名稱後按 Enter"
            />
            <div className="form-hint">從 mcp.json 中啟用的 server 名稱清單</div>
          </div>
        </div>

        {/* 停用的 MCP.json Servers */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Disabled MCP.json Servers</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.disabledMcpjsonServers ?? []}
              onChange={(v) => update({ disabledMcpjsonServers: v.length ? v : undefined })}
              placeholder="輸入 server 名稱後按 Enter"
            />
            <div className="form-hint">從 mcp.json 中停用的 server 名稱清單</div>
          </div>
        </div>

        {/* 白名單 MCP Servers */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Allowed MCP Servers</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.allowedMcpServers ?? []}
              onChange={(v) => update({ allowedMcpServers: v.length ? v : undefined })}
              placeholder="輸入 server 名稱後按 Enter"
            />
            <div className="form-hint">明確允許的 MCP server 白名單</div>
          </div>
        </div>

        {/* 黑名單 MCP Servers */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Denied MCP Servers</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.deniedMcpServers ?? []}
              onChange={(v) => update({ deniedMcpServers: v.length ? v : undefined })}
              placeholder="輸入 server 名稱後按 Enter"
            />
            <div className="form-hint">明確封鎖的 MCP server 黑名單</div>
          </div>
        </div>

        {/* 僅允許 managed MCP Servers */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Allow Managed MCP Servers Only</div>
            <div className="form-hint">僅允許由 managed 設定層定義的 MCP server</div>
          </div>
          <Toggle
            checked={data.allowManagedMcpServersOnly ?? false}
            onChange={(v) => update({ allowManagedMcpServersOnly: v })}
          />
        </div>

      </CollapsibleSection>

      {/* ── Plugins 區段 ── */}
      <CollapsibleSection title="Plugins 插件設定" defaultOpen={true}>

        {/* 啟用 Channels */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Channels Enabled</div>
            <div className="form-hint">啟用 Channel 插件功能</div>
          </div>
          <Toggle
            checked={data.channelsEnabled ?? false}
            onChange={(v) => update({ channelsEnabled: v })}
          />
        </div>

        {/* 允許的 Channel 插件 */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Allowed Channel Plugins</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.allowedChannelPlugins ?? []}
              onChange={(v) => update({ allowedChannelPlugins: v.length ? v : undefined })}
              placeholder="輸入插件 ID 後按 Enter"
            />
            <div className="form-hint">允許載入的 Channel 插件 ID 白名單</div>
          </div>
        </div>

        {/* 封鎖的 Marketplace */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Blocked Marketplaces</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.blockedMarketplaces ?? []}
              onChange={(v) => update({ blockedMarketplaces: v.length ? v : undefined })}
              placeholder="輸入 marketplace URL 後按 Enter"
            />
            <div className="form-hint">封鎖的插件 marketplace 清單</div>
          </div>
        </div>

        {/* 僅允許已知 Marketplace */}
        <div className="form-row form-row--toggle">
          <div>
            <div className="form-label">Strict Known Marketplaces</div>
            <div className="form-hint">僅允許從官方已知的 marketplace 安裝插件</div>
          </div>
          <Toggle
            checked={data.strictKnownMarketplaces ?? false}
            onChange={(v) => update({ strictKnownMarketplaces: v })}
          />
        </div>

        {/* enabledPlugins 說明提示 */}
        <div
          style={{
            marginTop: 12,
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="form-label" style={{ marginBottom: 4 }}>Enabled Plugins（Record&lt;string, boolean&gt;）</div>
          <div className="form-hint">
            此欄位為鍵值對格式（插件 ID → 啟用狀態），請切換至 <strong>JSON</strong> Tab 直接編輯
            <code style={{ marginLeft: 4 }}>enabledPlugins</code> 欄位。
          </div>
        </div>

      </CollapsibleSection>
    </div>
  );
};

export default McpPluginsTab;
