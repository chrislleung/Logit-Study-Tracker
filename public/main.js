const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process'); 
const fs = require('fs');
const isDev = !app.isPackaged;

// Force Windows to use your icon in the Taskbar
if (process.platform === 'win32') {
  app.setAppUserModelId('com.logit.app');
}

let mainWindow;
let pythonProcess = null;

// --- Function to start Python in the background ---
function startPythonScript() {
  if (isDev) {
    // DEV MODE
    const scriptPath = path.join(__dirname, '..', 'src', 'distraction_detector.py');
    pythonProcess = spawn('python', [scriptPath]);
    
  } else {
    // PROD MODE
    const exePath = path.join(process.resourcesPath, 'extraResources', 'distraction_detector.exe');
    
    // SAFEGUARD: Check if the file actually exists
    if (!fs.existsSync(exePath)) {
        dialog.showErrorBox(
            "Missing AI Module", 
            `Could not find the AI script at:\n${exePath}\n\nDid you put it in the extraResources folder before building?`
        );
        return;
    }

    // SAFEGUARD: Spawn it with the correct "Current Working Directory"
    pythonProcess = spawn(exePath, [], {
        cwd: path.dirname(exePath) 
    });

    // SAFEGUARD: Catch crashes instantly
    pythonProcess.on('error', (err) => {
        dialog.showErrorBox("AI Module Error", `Failed to start background AI:\n${err.message}`);
    });
  }

  // Forward Python logs
  pythonProcess.stdout.on('data', (data) => {
    console.log(`[AI Monitor]: ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[AI Error]: ${data.toString().trim()}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'), 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false 
    }
  });
  
  mainWindow.setMenu(null);
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools(); 
  } else {
    mainWindow.loadURL(`file://${path.join(__dirname, 'index.html')}`);
  }
}

app.whenReady().then(() => {
  startPythonScript(); 
  createWindow();
});

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

// Safely and completely kill the PyInstaller Process Tree
app.on('will-quit', () => {
  if (pythonProcess) {
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${pythonProcess.pid} /T /F`, (err) => {
        if (err) console.error("Failed to kill AI Monitor tree:", err);
      });
    } else {
      pythonProcess.kill();
    }
  }
});

// --- Handle Video Popup Window ---
let videoWindow = null;

ipcMain.on('open-video-window', (event, customVideoUrl) => {
  if (videoWindow) {
    videoWindow.focus();
    return;
  }

  videoWindow = new BrowserWindow({
    width: 800,
    height: 600,
    alwaysOnTop: true, 
    frame: false,      
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false 
    }
  });

  let url = isDev 
    ? 'http://localhost:3000/video.html' 
    : `file://${path.join(__dirname, 'video.html')}`;

  if (customVideoUrl) {
    url += `?video=${encodeURIComponent(customVideoUrl)}`;
  }

  videoWindow.loadURL(url);

  videoWindow.on('closed', () => {
    videoWindow = null;
  });
});

ipcMain.on('close-video-window', () => {
  if (videoWindow) {
    videoWindow.close(); 
    videoWindow = null;
  }
});