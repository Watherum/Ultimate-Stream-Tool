const { app, globalShortcut, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
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
//doubles/crew add rows to the player region, so the window height follows the match
//type exactly - growing for the extra rows and shrinking back so no dead space is left
let currentExtraHeight = 0;

const heightAdjustment = () => (process.platform === 'linux' ? 50 : 0);

function applyWindowHeight(extra) {
  if (!mainWindowRef) return;
  currentExtraHeight = extra;

  const adj = heightAdjustment();
  const wanted = BASE_HEIGHT + adj + extra;
  //lower the minimum first, or the window can't shrink back down
  mainWindowRef.setMinimumSize(BASE_WIDTH + adj, wanted);

  //resizing a maximized window would restore it, so leave it alone
  if (mainWindowRef.isMaximized() || mainWindowRef.isFullScreen()) return;

  const [width, height] = mainWindowRef.getSize();
  if (height !== wanted) mainWindowRef.setSize(width, wanted);
}

ipcMain.on('set-extra-height', (event, extra) => applyWindowHeight(extra || 0));

ipcMain.on('restore-window-size', () => {
  if (!mainWindowRef) return;
  const adj = heightAdjustment();
  //back to the default size for whatever match type is currently up
  mainWindowRef.setSize(BASE_WIDTH + adj, BASE_HEIGHT + adj + currentExtraHeight);
});

// the screen color picker for the bracket editor, the one that can grab colors from
// outside this app. chromium's own eyedropper only ever sees this window's contents,
// so we lay a see through window over every monitor and read that monitor's live feed
let eyedropperWins = [];             // one overlay window per monitor
const eyedropperFeeds = new Map();   // webContents id -> what its monitor is
let eyedropperResolve = null;

// enumerating the screens takes a moment, so it's done ahead of time and only
// redone when the monitors themselves change
let screenSources = [];

function refreshScreenSources() {
  // no thumbnails. generating those was the whole of the wait, and the
  // overlays stream their monitor live rather than looking at a still
  return desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 0, height: 0 }
  }).then(sources => {
    screenSources = sources;
    return sources;
  }).catch(e => {
    console.log("Could not list the screens:", e);
    return screenSources;
  });
}

// pairs every monitor up with its capture source
async function listScreenSources(refresh) {
  const displays = screen.getAllDisplays();
  let sources = refresh || !screenSources.length ? await refreshScreenSources() : screenSources;

  const find = (display) => {
    // display_id is a string on some platforms and missing on others
    let source = sources.find(s => String(s.display_id) == String(display.id));
    if (!source && sources.length == 1) source = sources[0];
    return source;
  };

  // a monitor we have no source for means the list went stale on us
  if (!refresh && displays.some(display => !find(display))) {
    sources = await refreshScreenSources();
  }

  const feeds = [];
  for (const display of displays) {
    const source = find(display);
    if (!source) continue;
    feeds.push({
      display,
      sourceId: source.id,
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor)
    });
  }
  return feeds;
}

// closes every overlay and hands the picked color back to the GUI
function closeEyedropper(hex) {
  const wins = eyedropperWins;
  eyedropperWins = [];
  eyedropperFeeds.clear();
  for (const win of wins) {
    if (!win.isDestroyed()) win.destroy();
  }
  if (eyedropperResolve) {
    eyedropperResolve(hex || null);
    eyedropperResolve = null;
  }
}

ipcMain.handle('pick-screen-color', async () => {
  if (eyedropperWins.length) return null; // already picking

  let feeds;
  try {
    feeds = await listScreenSources();
  } catch (e) {
    console.log("Could not find the screens:", e);
    return null;
  }
  if (!feeds.length) return null;

  for (const feed of feeds) {
    const bounds = feed.display.bounds;
    const overlay = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      // see through, so the user picks off the live screen itself
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false
      }
    });

    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.removeMenu();
    // keep our own loupe out of the feed we read colors from
    overlay.setContentProtection(true);

    eyedropperFeeds.set(overlay.webContents.id, {
      displayId: feed.display.id,
      sourceId: feed.sourceId,
      width: feed.width,
      height: feed.height
    });
    overlay.loadFile(path.join(__dirname, 'eyedropper.html'));

    // if it gets closed some other way, don't leave the GUI waiting
    overlay.on('closed', () => {
      if (eyedropperWins.includes(overlay)) closeEyedropper(null);
    });

    eyedropperWins.push(overlay);
  }

  // the first one gets the keyboard, so Esc works right away
  eyedropperWins[0].focus();

  return new Promise(resolve => { eyedropperResolve = resolve; });
});

// each overlay asking which monitor it's sitting on. if the id we had went
// stale, the overlay asks again and we go get a fresh one
ipcMain.handle('eyedropper-source', async (event, refresh) => {
  const feed = eyedropperFeeds.get(event.sender.id);
  if (!feed) return null;
  if (refresh) {
    const fresh = (await listScreenSources(true)).find(f => f.display.id == feed.displayId);
    if (!fresh) return null;
    feed.sourceId = fresh.sourceId;
  }
  return feed;
});

ipcMain.on('eyedropper-pick', (event, hex) => closeEyedropper(hex));
ipcMain.on('eyedropper-cancel', () => closeEyedropper(null));

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
  // have the screen list ready for the first time the eyedropper is used
  refreshScreenSources();
  screen.on('display-added', () => refreshScreenSources());
  screen.on('display-removed', () => refreshScreenSources());
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
