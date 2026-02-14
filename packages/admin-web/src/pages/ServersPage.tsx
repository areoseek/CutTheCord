import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function ServersPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedServer, setSelectedServer] = useState<any>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newOwnerId, setNewOwnerId] = useState('');

  // Add member form
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('member');

  const load = async () => {
    try {
      const [s, u] = await Promise.all([api.getServers(), api.getUsers()]);
      setServers(s);
      setUsers(u);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createServer({ name: newName, owner_id: newOwnerId });
      setNewName('');
      setNewOwnerId('');
      setShowCreate(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete server "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteServer(id);
      if (selectedServer?.id === id) setSelectedServer(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const viewServer = async (id: string) => {
    try {
      setSelectedServer(await api.getServer(id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer) return;
    try {
      await api.addMember(selectedServer.id, { user_id: addUserId, role: addRole });
      setAddUserId('');
      viewServer(selectedServer.id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handlePromoteAdmin = async (userId: string) => {
    if (!selectedServer) return;
    try {
      await api.assignAdmin({ user_id: userId, server_id: selectedServer.id });
      viewServer(selectedServer.id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Server list */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Servers ({servers.length})</h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-sm font-medium"
          >
            {showCreate ? 'Cancel' : 'Create Server'}
          </button>
        </div>

        {error && <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded mb-4">{error}</div>}

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-gray-800 p-4 rounded mb-4 flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Server Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-48"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Owner</label>
              <select
                value={newOwnerId}
                onChange={e => setNewOwnerId(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-48"
                required
              >
                <option value="">Select user...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm font-medium">
              Create
            </button>
          </form>
        )}

        <div className="space-y-2">
          {servers.map(server => (
            <div
              key={server.id}
              className={`bg-gray-800 rounded p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700/50 transition ${
                selectedServer?.id === server.id ? 'ring-2 ring-indigo-500' : ''
              }`}
              onClick={() => viewServer(server.id)}
            >
              <div>
                <div className="font-medium">{server.name}</div>
                <div className="text-xs text-gray-400">{server.member_count} members</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(server.id, server.name); }}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Server detail */}
      {selectedServer && (
        <div className="w-80 bg-gray-800 rounded p-4">
          <h3 className="font-semibold mb-3">{selectedServer.name}</h3>

          <div className="mb-4">
            <h4 className="text-xs text-gray-400 mb-2 uppercase">Channels ({selectedServer.channels?.length || 0})</h4>
            {selectedServer.channels?.map((ch: any) => (
              <div key={ch.id} className="text-sm py-1 flex items-center gap-2">
                <span className="text-gray-500">{ch.type === 'voice' ? '🔊' : '#'}</span>
                {ch.name}
              </div>
            ))}
          </div>

          <div className="mb-4">
            <h4 className="text-xs text-gray-400 mb-2 uppercase">Members ({selectedServer.members?.length || 0})</h4>
            {selectedServer.members?.map((m: any) => (
              <div key={m.user_id} className="text-sm py-1 flex items-center justify-between">
                <span>
                  {m.username}
                  {m.role === 'admin' && (
                    <span className="ml-1 text-xs bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded">admin</span>
                  )}
                </span>
                {m.role !== 'admin' && (
                  <button
                    onClick={() => handlePromoteAdmin(m.user_id)}
                    className="text-indigo-400 hover:text-indigo-300 text-xs"
                  >
                    Promote
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleAddMember} className="border-t border-gray-700 pt-3">
            <h4 className="text-xs text-gray-400 mb-2 uppercase">Add Member</h4>
            <select
              value={addUserId}
              onChange={e => setAddUserId(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm w-full mb-2"
              required
            >
              <option value="">Select user...</option>
              {users
                .filter(u => !selectedServer.members?.some((m: any) => m.user_id === u.id))
                .map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
            </select>
            <select
              value={addRole}
              onChange={e => setAddRole(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm w-full mb-2"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded text-sm w-full">
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
