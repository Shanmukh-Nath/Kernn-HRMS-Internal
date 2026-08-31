const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

// Configure isolated userData directory to avoid Windows %APPDATA% lock collisions
try {
  const customUserData = path.join(app.getPath('appData'), 'KernnSyncBridgeData');
  app.setPath('userData', customUserData);
} catch (_) {}

// Low-End Spec PC Performance & RAM Optimization Flags
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128'); // Cap V8 heap to 128MB RAM
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-size', '1');
app.commandLine.appendSwitch('media-cache-size', '1');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-zero-copy'); // Low GPU memory bus utilization
app.commandLine.appendSwitch('enable-low-res-tiling'); // Smooth render on slow integrated graphics
app.commandLine.appendSwitch('disable-restore-session-state');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,TranslateUI,AutofillServerCommunication');
app.commandLine.appendSwitch('log-level', '3');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Remove standard menu bar globally
Menu.setApplicationMenu(null);

function createTray() {
  const iconPath = path.join(__dirname, 'app-icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
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
    frame: false, // Fully frameless, immersive design with custom window controls
    transparent: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
    icon: path.join(__dirname, 'app-icon.png'),
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    const isHidden = process.argv.includes('--hidden');
    if (!isHidden) {
      mainWindow.show();
    }
    mainWindow.webContents.setBackgroundThrottling(false);
  });

  // Track maximize state to toggle window control icon
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-state', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-state', false);
  });

  // Minimize to tray on close unless explicitly quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon?.({
          title: 'Kernn Sync Bridge',
          content: 'Running silently in the background. Double-click tray icon to open.',
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    if (!isQuitting) {
      mainWindow.hide();
    } else {
      app.quit();
    }
  }
});

// Auto-start IPC Handlers
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
