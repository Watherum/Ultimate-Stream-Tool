const { app, globalShortcut, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// start the web server
const { serverReady } = require('./server');

if (process.execPath.includes('node_modules')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron.cmd'),
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

let mainWindowRef = null;
const BASE_WIDTH = 890;
const BASE_HEIGHT = 335;

ipcMain.on('set-always-on-top', (event, value) => {
  mainWindowRef?.setAlwaysOnTop(value);
});
ipcMain.on('set-resizable', (event, value) => {
  mainWindowRef?.setResizable(value);
});
ipcMain.on('restore-window-size', () => {
  const isLinux = process.platform === 'linux';
  const adj = isLinux ? 50 : 0;
  mainWindowRef?.setMinimumSize(BASE_WIDTH + adj, BASE_HEIGHT + adj);
  mainWindowRef?.setSize(BASE_WIDTH + adj, BASE_HEIGHT + adj);
});

const createWindow = (port) => {
  const isLinux = process.platform === 'linux';
  const adjustment = isLinux ? 50 : 0;

  const mainWindow = new BrowserWindow({
    width: BASE_WIDTH + adjustment,
    height: BASE_HEIGHT + adjustment,
    resizable: true,
    minWidth: BASE_WIDTH + adjustment,
    minHeight: BASE_HEIGHT + adjustment,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    }
  });



  mainWindowRef = mainWindow;

  // we dont like menus
  mainWindow.removeMenu();

  // load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'), { query: { port: String(port) } });
};

app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  serverReady.then(port => createWindow(port));
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.toggleDevTools();
  });
  globalShortcut.register('CommandOrControl+F5', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.reloadIgnoringCache();
  });
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
