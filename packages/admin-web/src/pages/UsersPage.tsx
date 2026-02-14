import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);

  // Create form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  // Reset form
  const [resetPassword, setResetPassword] = useState('');

  const load = async () => {
    try {
      setUsers(await api.getUsers());
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({ username: newUsername, password: newPassword, is_global_admin: newIsAdmin });
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      setShowCreate(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await api.resetPassword(resetTarget, resetPassword);
      setResetTarget(null);
      setResetPassword('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Users ({users.length})</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-sm font-medium"
        >
          {showCreate ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded mb-4">{error}</div>}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-800 p-4 rounded mb-4 flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <input
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-48"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-48"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)} />
            Global Admin
          </label>
          <button type="submit" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm font-medium">
            Create
          </button>
        </form>
      )}

      {resetTarget && (
        <form onSubmit={handleReset} className="bg-gray-800 p-4 rounded mb-4 flex gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              New password for {users.find(u => u.id === resetTarget)?.username}
            </label>
            <input
              type="password"
              value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-48"
              required
            />
          </div>
          <button type="submit" className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded text-sm font-medium">
            Reset
          </button>
          <button type="button" onClick={() => setResetTarget(null)} className="text-gray-400 hover:text-white text-sm">
            Cancel
          </button>
        </form>
      )}

      <div className="bg-gray-800 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Must Change PW</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3 font-medium">{user.username}</td>
                <td className="px-4 py-3">
                  {user.is_global_admin && (
                    <span className="bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded text-xs">Global Admin</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.must_change_pw && <span className="text-yellow-400 text-xs">Yes</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    user.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
                  }`} />
                  {user.status}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => setResetTarget(user.id)}
                    className="text-yellow-400 hover:text-yellow-300 text-xs"
                  >
                    Reset PW
                  </button>
                  <button
                    onClick={() => handleDelete(user.id, user.username)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
