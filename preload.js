// 这里是网页界面和电脑系统之间的“安全传话筒”。
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gameAPI', {
  loadGames: () => ipcRenderer.invoke('games:load'),
  saveGames: (games) => ipcRenderer.invoke('games:save', games),
  pickExecutable: () => ipcRenderer.invoke('game:pick-executable'),
  launch: (filePath) => ipcRenderer.invoke('game:launch', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('game:show-in-folder', filePath)
})
