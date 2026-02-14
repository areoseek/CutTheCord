import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import * as api from '../api';
import { validateFirstName, validateUsername, validatePassword } from '@ctc/shared';

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    const fnErr = validateFirstName(firstName);
    if (fnErr) { setError(fnErr); return; }
    const unErr = validateUsername(username);
    if (unErr) { setError(unErr); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const result = await api.register(firstName, username, password, confirmPassword);
      login(result.token, result.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#313338]">
      <div className="bg-[#1e1f22] p-8 rounded-lg w-full max-w-md shadow-xl">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Create an account</h1>
        <p className="text-[#b5bac1] text-center mb-6">Join CutTheCord today</p>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">First Name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-[#383a40] border-none rounded px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500"
              required
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Username</label>
            <p className="text-[#949ba4] text-xs mb-1">This will also be your display name</p>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#383a40] border-none rounded px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#383a40] border-none rounded px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#383a40] border-none rounded px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-[#949ba4] text-sm mt-4">
          Already have an account?{' '}
          <button onClick={() => navigate('/')} className="text-indigo-400 hover:text-indigo-300 hover:underline">
            Log In
          </button>
        </p>
      </div>
    </div>
  );
}
