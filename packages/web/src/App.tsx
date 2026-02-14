import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import MainLayout from './components/MainLayout';
import InvitePage from './pages/InvitePage';

export default function App() {
  const { isLoggedIn, mustChangePw } = useAuthStore();

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (mustChangePw) {
    return <ChangePasswordPage />;
  }

  return (
    <Routes>
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route path="/*" element={<MainLayout />} />
    </Routes>
  );
}
