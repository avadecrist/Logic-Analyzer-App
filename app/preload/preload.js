const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  sendCommand: (command) => ipcRenderer.invoke('board:command', command),
});
