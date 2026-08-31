const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { DevicePuller } = require('./device-puller');

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 720,
    title: 'Kernn Sync Bridge',
    backgroundColor: '#090d16',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    // If user minimizes on Mac/Windows, keep running in tray if desired
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
