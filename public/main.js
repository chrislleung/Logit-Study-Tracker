const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

// Force Windows to use your icon in the Taskbar
if (process.platform === 'win32') {
  app.setAppUserModelId('com.logit.app');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    // Icon path: In Dev it's in public/, in Prod it's next to main.js in build/
    icon: path.join(__dirname, 'icon.ico'), 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  win.setMenu(null);
  
  if (isDev) {
    // DEV MODE: Load from localhost
    win.loadURL('http://localhost:3000');
    // win.webContents.openDevTools(); 
  } else {
    // PROD MODE: Load from the local file system
    // FIX: Since main.js is inside 'build', we look for index.html in the SAME directory.
    // We removed 'build' from the path.join here.
    win.loadURL(`file://${path.join(__dirname, 'index.html')}`);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});