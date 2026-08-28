const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  sendCommand: (command) => ipcRenderer.invoke('board:command', command),
  
  // fires once per SAMPLES packet forwarded from main.js; returns an unsubscribe function
  onSamples: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('board:samples', listener);
    return () => ipcRenderer.removeListener('board:samples', listener);
  },
});
