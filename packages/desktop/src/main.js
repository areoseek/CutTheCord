const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const path = require('path');

let store;
let mainWindow;

// Treat the server URL as secure so navigator.mediaDevices works over HTTP (LAN fallback)
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://localhost:3000');

async function init() {
  const { default: Store } = await import('electron-store');

  store = new Store({
    defaults: {
      serverUrl: 'http://localhost:3000',
      windowBounds: { width: 1280, height: 800 },
      audioInputDeviceId: '',
      audioOutputDeviceId: '',
      videoInputDeviceId: '',
      inputVolume: 100,
      outputVolume: 100,
    },
  });

  // IPC handlers for settings
  ipcMain.handle('store-get', (_, key) => store.get(key));
  ipcMain.handle('store-set', (_, key, value) => store.set(key, value));
  ipcMain.handle('get-server-url', () => store.get('serverUrl'));
  ipcMain.handle('set-server-url', (_, url) => {
    store.set('serverUrl', url);
    mainWindow?.loadURL(url);
  });

  // Auto-grant media permissions (mic, camera, screen share)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'display-capture', 'notifications'];
    callback(allowed.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowed = ['media', 'mediaKeySystem', 'display-capture', 'notifications'];
    return allowed.includes(permission);
  });

  // Clear HTTP cache on startup so we always get the latest web build
  session.defaultSession.clearCache();

  createWindow();
}

function createWindow() {
  const { width, height } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 940,
    minHeight: 500,
    title: 'CutTheCord',
    backgroundColor: '#313338',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  Menu.setApplicationMenu(null);

  const serverUrl = store.get('serverUrl');
  mainWindow.loadURL(serverUrl);

  // Ctrl+Shift+I to open DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key === 'I') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('resize', () => {
    const [w, h] = mainWindow.getSize();
    store.set('windowBounds', { width: w, height: h });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(init);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
