import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { autoUpdater } = require('electron-updater')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
  
  win = new BrowserWindow({
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff',
      height: 35
    },
    backgroundColor: '#1a1a1a',
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

import fs from 'node:fs'

const projectsPath = path.join(app.getPath('userData'), 'projects.json')

ipcMain.handle('save-projects', (_, projects) => {
  fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2))
})

ipcMain.handle('load-projects', () => {
  if (fs.existsSync(projectsPath)) {
    return JSON.parse(fs.readFileSync(projectsPath, 'utf-8'))
  }
  return []
})

app.whenReady().then(() => {
  createWindow()
  autoUpdater.checkForUpdatesAndNotify()
})

// Auto-updater events
autoUpdater.on('update-available', () => {
  win?.webContents.send('update-available')
})

autoUpdater.on('update-downloaded', () => {
  win?.webContents.send('update-downloaded')
})

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall()
})
