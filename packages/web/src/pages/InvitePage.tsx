import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import * as api from '../api';

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (!code) return;
    api.getInvite(code)
      .then(setInvite)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  const handleAccept = async () => {
    if (!code) return;
    setAccepting(true);
    try {
      await api.acceptInvite(code);
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!code) return;
    setDeclining(true);
    try {
      await api.declineInvite(code);
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#313338]">
      <div className="bg-[#1e1f22] p-8 rounded-lg w-full max-w-md shadow-xl text-center">
        {loading ? (
          <p className="text-[#b5bac1]">Loading invite...</p>
        ) : error ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Invalid Invite</h1>
            <p className="text-red-400">{error}</p>
            <button onClick={() => navigate('/')} className="mt-4 text-indigo-400 hover:text-indigo-300">
              Go Home
            </button>
          </>
        ) : invite ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">You've been invited to</h1>
            <div className="text-2xl font-bold text-white mb-6">{invite.server_name}</div>

            {!isLoggedIn ? (
              <>
                <p className="text-[#b5bac1] mb-4">You need an account to join this server.</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigate(`/signup?redirect=/invite/${code}`)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded transition"
                  >
                    Sign Up
                  </button>
                  <button
                    onClick={() => navigate(`/?redirect=/invite/${code}`)}
                    className="bg-[#383a40] hover:bg-[#43454b] text-white font-medium px-6 py-2.5 rounded transition"
                  >
                    Log In
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded transition disabled:opacity-50"
                >
                  {accepting ? 'Joining...' : 'Accept Invite'}
                </button>
                <button
                  onClick={handleDecline}
                  disabled={declining}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2.5 rounded transition disabled:opacity-50"
                >
                  {declining ? 'Declining...' : 'Decline'}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
