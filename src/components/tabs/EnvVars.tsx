/**
 * EnvVars Tab — 環境變數鍵值對編輯器
 */
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/settingsStore';
import { useFileManager } from '../../hooks/useFileManager';
import type { EnvEntry } from '../../types/settings';
import './TabContent.css';

const EnvVars: React.FC = () => {
  const { files } = useAppStore();
  const { saveFile } = useFileManager();

  const userSettings = files.user.data ?? {};
  // 將 env 物件轉為有 id 的陣列以便管理
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [newKey, setNewKey]   = useState('');
  const [newVal, setNewVal]   = useState('');

  // 初始化時從 store 載入
  useEffect(() => {
    const env = userSettings.env ?? {};
    setEntries(
      Object.entries(env).map(([key, value]) => ({
        id: crypto.randomUUID(),
        key,
        value,
      }))
    );
  }, [files.user.data]);

  /** 儲存到設定檔 */
  const save = async (list: EnvEntry[]) => {
    const env: Record<string, string> = {};
    list.forEach(({ key, value }) => { if (key.trim()) env[key.trim()] = value; });
    await saveFile('user', files.user.path, { ...userSettings, env });
  };

  /** 新增條目 */
  const add = () => {
    if (!newKey.trim()) return;
    const updated = [...entries, { id: crypto.randomUUID(), key: newKey.trim(), value: newVal }];
    setEntries(updated);
    save(updated);
    setNewKey('');
    setNewVal('');
  };

  /** 刪除條目 */
  const remove = (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    save(updated);
  };

  /** 更新條目的 key 或 value */
  const updateEntry = (id: string, field: 'key' | 'value', val: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, [field]: val } : e));
    setEntries(updated);
    save(updated);
  };

  return (
    <div className="tab-content scroll-area">
      <h2 className="tab-title">🔑 環境變數</h2>
      <p className="tab-desc">設定傳遞給 Claude Code 的環境變數（User 層）</p>

      <table className="kv-table">
        <thead>
          <tr>
            <th style={{ width: '40%' }}>KEY</th>
            <th style={{ width: '50%' }}>VALUE</th>
            <th style={{ width: '10%' }}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ id, key, value }) => (
            <tr key={id}>
              <td>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => updateEntry(id, 'key', e.target.value)}
                  className="mono"
                  placeholder="ENV_KEY"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateEntry(id, 'value', e.target.value)}
                  className="mono"
                  placeholder="value"
                />
              </td>
              <td>
                <button className="btn-danger" onClick={() => remove(id)}>✕</button>
              </td>
            </tr>
          ))}
          {/* 新增行 */}
          <tr>
            <td>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="新增 KEY"
                className="mono"
              />
            </td>
            <td>
              <input
                type="text"
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="VALUE"
                className="mono"
              />
            </td>
            <td>
              <button className="btn-primary" onClick={add} style={{ padding: '5px 12px' }}>+</button>
            </td>
          </tr>
        </tbody>
      </table>

      {entries.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 16 }}>
          尚無環境變數設定。在下方新增第一個變數。
        </p>
      )}
    </div>
  );
};

export default EnvVars;
