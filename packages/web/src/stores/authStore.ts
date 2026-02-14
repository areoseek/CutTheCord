import { create } from 'zustand';
import type { User } from '@ctc/shared';

interface AuthState {
  token: string | null;
  user: User | null;
  mustChangePw: boolean;
  isLoggedIn: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setMustChangePw: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('ctc_token'),
  user: JSON.parse(localStorage.getItem('ctc_user') || 'null'),
  mustChangePw: JSON.parse(localStorage.getItem('ctc_must_change_pw') || 'false'),
  isLoggedIn: !!localStorage.getItem('ctc_token'),

  login: (token, user) => {
    localStorage.setItem('ctc_token', token);
    localStorage.setItem('ctc_user', JSON.stringify(user));
    localStorage.setItem('ctc_must_change_pw', JSON.stringify(user.must_change_pw));
    set({ token, user, mustChangePw: user.must_change_pw, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem('ctc_token');
    localStorage.removeItem('ctc_user');
    localStorage.removeItem('ctc_must_change_pw');
    set({ token: null, user: null, mustChangePw: false, isLoggedIn: false });
  },

  setUser: (user) => {
    localStorage.setItem('ctc_user', JSON.stringify(user));
    set({ user });
  },

  setMustChangePw: (val) => {
    localStorage.setItem('ctc_must_change_pw', JSON.stringify(val));
    set({ mustChangePw: val });
  },
}));
