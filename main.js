// 主进程负责窗口，以及网页不能直接使用的系统能力。
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')

let saveQueue = Promise.resolve()

function getGamesFilePath() {
  return path.join(app.getPath('userData'), 'games.json')
}

async function writeGamesFile(games) {
  const gamesFilePath = getGamesFilePath()
  await fs.promises.mkdir(path.dirname(gamesFilePath), { recursive: true })
  await fs.promises.writeFile(gamesFilePath, `${JSON.stringify(games, null, 2)}\n`, 'utf8')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    icon: path.join(__dirname, 'assets', 'gamenest-icon.ico'),

    maximizable: false,
    minimizable: false,
    resizable: false,
    fullscreenable: false,
    manuBarVisible: false,

    backgroundColor: '#0b0d12',
    title: 'GameNest',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.menuBarVisible = false;

  win.loadFile('index.html')
}

ipcMain.handle('game:pick-executable', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择游戏启动程序',
    properties: ['openFile'],
    filters: [
      { name: '应用程序', extensions: ['exe'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  return { path: filePath, name: path.basename(filePath, path.extname(filePath)) }
})

ipcMain.handle('game:launch', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
    return { ok: false, error: '找不到启动文件，请重新添加游戏路径。' }
  }
  const error = await shell.openPath(filePath)
  return error ? { ok: false, error } : { ok: true }
})

ipcMain.handle('game:show-in-folder', (_event, filePath) => {
  if (typeof filePath === 'string' && path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath)
  }
})

ipcMain.handle('games:load', async () => {
  try {
    const gamesFilePath = getGamesFilePath()
    await fs.promises.mkdir(path.dirname(gamesFilePath), { recursive: true })

    if (!fs.existsSync(gamesFilePath)) {
      await writeGamesFile([])
      return { ok: true, games: [] }
    }

    const content = await fs.promises.readFile(gamesFilePath, 'utf8')
    if (!content.trim()) {
      await writeGamesFile([])
      return { ok: true, games: [] }
    }

    const games = JSON.parse(content)
    if (!Array.isArray(games)) throw new Error('games.json 的内容必须是一个数组')

    return { ok: true, games }
  } catch (error) {
    return { ok: false, error: `读取游戏数据失败：${error.message}` }
  }
})

ipcMain.handle('games:save', async (_event, games) => {
  if (!Array.isArray(games)) {
    return { ok: false, error: '游戏数据格式错误' }
  }

  try {
    const snapshot = structuredClone(games)
    saveQueue = saveQueue.then(
      () => writeGamesFile(snapshot),
      () => writeGamesFile(snapshot)
    )
    await saveQueue
    return { ok: true }
  } catch (error) {
    return { ok: false, error: `保存游戏数据失败：${error.message}` }
  }
})

app.whenReady().then(() => {
  app.setAppUserModelId('com.gamenest.app')
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
