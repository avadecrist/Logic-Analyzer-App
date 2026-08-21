const { app, BrowserWindow } = require('electron')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  win.loadFile('renderer/index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

/* play around with once serial port is working

const { ipcMain } = require('electron');
const serial = require('./serial');

ipcMain.handle('serial:listPorts', async () => {
    return serial.listPorts();
});

ipcMain.handle('serial:connect', async (event, options) => {
    return serial.connect(options);
});

ipcMain.handle('serial:disconnect', async () => {
    return serial.disconnect();
});

ipcMain.handle('serial:command', async (event, command) => {
    return serial.sendCommand(command);
});
*/
