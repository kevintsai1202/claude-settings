/**
 * McpPluginsTab — MCP 伺服器與插件設定（v3.0）
 * 改為三個區段：
 *   1. MCP Servers 設定（mcpServers 物件逐項顯示 + 新增 / 刪除）
 *   2. MCP 白/黑名單（原本的 allowed / denied / enabled / disabled）
 *   3. Plugins 插件（enabledPlugins 物件逐項 toggle + channel 設定）
 */
import React, { useState } from 'react';
import { Plug, Trash2, Plus } from 'lucide-react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import Toggle from '../ui/Toggle';
import TagArrayInput from '../ui/TagArrayInput';
import CollapsibleSection from '../ui/CollapsibleSection';
import type { ClaudeSettings, McpServerEntry, McpServerType } from '../../types/settings';
import './TabContent.css';

const McpPluginsTab: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  const data: ClaudeSettings = files.user.data ?? {};
  const mcpServers: Record<string, McpServerEntry> = data.mcpServers ?? {};
  const enabledPlugins: Record<string, boolean> = data.enabledPlugins ?? {};

  /** 新增 MCP server 的暫存欄位 */
  const [newServerName, setNewServerName] = useState('');
  const [newServerType, setNewServerType] = useState<McpServerType>('stdio');

  /** 新增 Plugin 的暫存欄位 */
  const [newPluginName, setNewPluginName] = useState('');

  /** 更新 user 層設定並儲存 */
  const update = async (patch: Partial<ClaudeSettings>) => {
    await saveFile('user', files.user.path, { ...data, ...patch });
  };

  /** 新增一個 MCP server 項目 */
  const addMcpServer = async () => {
    const name = newServerName.trim();
    if (!name || mcpServers[name]) return;
    const entry: McpServerEntry = { type: newServerType };
    if (newServerType === 'stdio') entry.command = '';
    else entry.url = '';
    await update({ mcpServers: { ...mcpServers, [name]: entry } });
    setNewServerName('');
  };

  /** 刪除 MCP server 項目 */
  const removeMcpServer = async (name: string) => {
    const next = { ...mcpServers };
    delete next[name];
    await update({
      mcpServers: Object.keys(next).length ? next : undefined,
    });
  };

  /** 更新單一 MCP server 欄位 */
  const updateMcpServer = async (name: string, patch: Partial<McpServerEntry>) => {
    await update({
      mcpServers: {
        ...mcpServers,
        [name]: { ...mcpServers[name], ...patch },
      },
    });
  };

  /** 切換 plugin 啟用狀態 */
  const togglePlugin = async (name: string, enabled: boolean) => {
    await update({ enabledPlugins: { ...enabledPlugins, [name]: enabled } });
  };

  /** 刪除 plugin 項目 */
  const removePlugin = async (name: string) => {
    const next = { ...enabledPlugins };
    delete next[name];
    await update({ enabledPlugins: Object.keys(next).length ? next : undefined });
  };

  /** 新增 plugin（預設為啟用） */
  const addPlugin = async () => {
    const name = newPluginName.trim();
    if (!name || enabledPlugins[name] !== undefined) return;
    await update({ enabledPlugins: { ...enabledPlugins, [name]: true } });
    setNewPluginName('');
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🔌 MCP 與插件設定</h2>
      <p className="tab-desc">管理 MCP Server 定義、白/黑名單，以及插件（Plugin）啟用狀態。</p>

      {/* ── MCP Servers 區段 ── */}
      <CollapsibleSection title={`MCP Servers（${Object.keys(mcpServers).length}）`} defaultOpen={true}>
        {Object.keys(mcpServers).length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
            尚未設定任何 MCP server，請從下方新增。
          </p>
        ) : (
          Object.entries(mcpServers).map(([name, entry]) => (
            <div
              key={name}
              style={{
                padding: 12,
                marginBottom: 10,
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plug size={13} color="var(--color-cyan)" />
                  <strong className="mono">{name}</strong>
                </div>
                <button className="btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => removeMcpServer(name)}>
                  <Trash2 size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                  刪除
                </button>
              </div>

              {/* Type */}
              <div className="form-row" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ minWidth: 80 }}>Type</label>
                <select
                  value={entry.type}
                  onChange={(e) => updateMcpServer(name, { type: e.target.value as McpServerType })}
                  style={{ width: 140 }}
                >
                  <option value="stdio">stdio（本機命令）</option>
                  <option value="sse">sse（Server-Sent Events）</option>
                  <option value="http">http（HTTP endpoint）</option>
                </select>
              </div>

              {/* Command / URL */}
              {entry.type === 'stdio' ? (
                <>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ minWidth: 80 }}>Command</label>
                    <input
                      type="text"
                      placeholder="例如：npx"
                      value={entry.command ?? ''}
                      onChange={(e) => updateMcpServer(name, { command: e.target.value || undefined })}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                    <label className="form-label" style={{ minWidth: 80, paddingTop: 6 }}>Args</label>
                    <div style={{ flex: 1 }}>
                      <TagArrayInput
                        value={entry.args ?? []}
                        onChange={(v) => updateMcpServer(name, { args: v.length ? v : undefined })}
                        placeholder="參數逐一輸入後按 Enter"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ minWidth: 80 }}>URL</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={entry.url ?? ''}
                    onChange={(e) => updateMcpServer(name, { url: e.target.value || undefined })}
                    style={{ flex: 1 }}
                  />
                </div>
              )}

              {/* Env 提示 */}
              {entry.env && Object.keys(entry.env).length > 0 && (
                <div className="form-row" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
                  <label className="form-label" style={{ minWidth: 80, paddingTop: 4 }}>Env</label>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    此 server 有 {Object.keys(entry.env).length} 個環境變數，請透過 JSON Tab 編輯
                  </span>
                </div>
              )}
            </div>
          ))
        )}

        {/* 新增 MCP server */}
        <div className="add-rule-row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <input
            type="text"
            placeholder="Server 名稱（唯一）"
            value={newServerName}
            onChange={(e) => setNewServerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMcpServer()}
            style={{ flex: 1, minWidth: 160 }}
          />
          <select
            value={newServerType}
            onChange={(e) => setNewServerType(e.target.value as McpServerType)}
            style={{ width: 110 }}
          >
            <option value="stdio">stdio</option>
            <option value="sse">sse</option>
            <option value="http">http</option>
          </select>
          <button className="btn-primary" onClick={addMcpServer}>
            <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            新增 Server
          </button>
        </div>
      </CollapsibleSection>

      {/* ── MCP 白/黑名單 ── */}
      <CollapsibleSection title="MCP 白名單 / 黑名單" defaultOpen={false}>
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

        {/* Enabled MCP.json */}
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

        {/* Disabled MCP.json */}
        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Disabled MCP.json Servers</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.disabledMcpjsonServers ?? []}
              onChange={(v) => update({ disabledMcpjsonServers: v.length ? v : undefined })}
              placeholder="輸入 server 名稱後按 Enter"
            />
          </div>
        </div>

        {/* Allowed */}
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

        {/* Denied */}
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
      <CollapsibleSection title={`Plugins（${Object.keys(enabledPlugins).length}）`} defaultOpen={true}>
        {Object.keys(enabledPlugins).length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
            尚未定義任何 plugin，請從下方新增。
          </p>
        ) : (
          Object.entries(enabledPlugins).map(([name, enabled]) => (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 8,
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <span className="mono" style={{ flex: 1, fontSize: 13 }}>{name}</span>
              <Toggle checked={enabled} onChange={(v) => togglePlugin(name, v)} />
              <button
                className="btn-danger"
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => removePlugin(name)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))
        )}

        <div className="add-rule-row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <input
            type="text"
            placeholder="Plugin ID，例如 commit-commands"
            value={newPluginName}
            onChange={(e) => setNewPluginName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlugin()}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={addPlugin}>
            <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            新增 Plugin
          </button>
        </div>

        <hr className="divider" style={{ margin: '16px 0' }} />
        <p className="section-title">Channel 設定</p>

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

        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Allowed Channel Plugins</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.allowedChannelPlugins ?? []}
              onChange={(v) => update({ allowedChannelPlugins: v.length ? v : undefined })}
              placeholder="輸入插件 ID 後按 Enter"
            />
          </div>
        </div>

        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <label className="form-label" style={{ paddingTop: 6 }}>Blocked Marketplaces</label>
          <div style={{ flex: 1 }}>
            <TagArrayInput
              value={data.blockedMarketplaces ?? []}
              onChange={(v) => update({ blockedMarketplaces: v.length ? v : undefined })}
              placeholder="輸入 marketplace URL 後按 Enter"
            />
          </div>
        </div>

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
      </CollapsibleSection>
    </div>
  );
};

export default McpPluginsTab;
