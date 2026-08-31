const { app, BrowserWindow, session } = require('electron');
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
app.commandLine.appendSwitch('log-level', '3'); // Suppress non-fatal Chromium console warnings/cache errors

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'Kernn Sync Bridge',
    backgroundColor: '#080c17',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 16 },
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
    icon: path.join(__dirname, 'icon.png'),
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.webContents.setBackgroundThrottling(false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
