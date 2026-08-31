const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

// Configure isolated userData directory to avoid Windows %APPDATA% lock collisions
try {
  const customUserData = path.join(app.getPath('appData'), 'KernnSyncBridgeData');
  app.setPath('userData', customUserData);
} catch (_) {}

// Suppress Chromium disk cache locking, shader caches, and stderr noise on Windows
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-size', '1');
app.commandLine.appendSwitch('media-cache-size', '1');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-restore-session-state');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('log-level', '3');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Remove standard menu bar globally
Menu.setApplicationMenu(null);

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch (_) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Kernn Sync Bridge — Hardware Terminal Gateway');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '⚡ Quick Sync Now',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('trigger-quick-sync');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Start on System Boot',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          openAsHidden: true,
        });
        if (mainWindow) {
          mainWindow.webContents.send('autostart-changed', item.checked);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Kernn Bridge',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'Kernn Sync Bridge',
    backgroundColor: '#070b14',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 16 },
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
    icon: path.join(__dirname, 'icon.png'),
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    // Check if launched at startup with --hidden
    const isHidden = process.argv.includes('--hidden');
    if (!isHidden) {
      mainWindow.show();
    }
    mainWindow.webContents.setBackgroundThrottling(false);
  });

  // Minimize to tray on close unless quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon?.({
          title: 'Kernn Sync Bridge',
          content: 'Running silently in the system tray. Background sync is active.',
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-autostart-status', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-autostart-status', (event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    openAsHidden: true,
  });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('minimize-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});

app.whenReady().then(() => {
  createTray();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});
