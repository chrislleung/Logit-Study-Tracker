const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged; // Checks if we are in development mode

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // Allows standard web features
      contextIsolation: false
    },
    // Optional: Add an icon here later
    // icon: path.join(__dirname, 'public/favicon.ico') 
  });

  // Load the app
  if (isDev) {
    // In dev mode, load the running React server
    win.loadURL('http://localhost:3000');
    // Optional: Open DevTools automatically
    // win.webContents.openDevTools(); 
  } else {
    // In production, load the built index.html file
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
  }
}

// App lifecycle hooks
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