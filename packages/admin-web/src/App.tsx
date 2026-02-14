import React, { useState } from 'react';
import UsersPage from './pages/UsersPage';
import ServersPage from './pages/ServersPage';

type Tab = 'users' | 'servers';

export default function App() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-6">
        <h1 className="text-xl font-bold text-white">CutTheCord Admin</h1>
        <nav className="flex gap-2">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              tab === 'users' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setTab('servers')}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              tab === 'servers' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Servers
          </button>
        </nav>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {tab === 'users' && <UsersPage />}
        {tab === 'servers' && <ServersPage />}
      </main>
    </div>
  );
}
