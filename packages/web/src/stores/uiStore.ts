import { create } from 'zustand';

type MobilePanel = 'chat' | 'channels' | 'members';

interface UIState {
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  mobilePanel: MobilePanel;
  setMobilePanel: (panel: MobilePanel) => void;
}

export const useUIStore = create<UIState>((set) => ({
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  mobilePanel: 'chat',
  setMobilePanel: (panel) => set({ mobilePanel: panel }),
}));
