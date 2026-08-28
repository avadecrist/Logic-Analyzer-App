const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const serial = require('./serial')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js')
    }
  })

  win.loadFile('renderer/index.html')
}

serial.events.on('samples', (data) => {
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('board:samples', data))
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  serial.disconnect()
})

ipcMain.handle('board:command', (event, command) => serial.sendCommand(command))
