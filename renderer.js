const STORAGE_KEY = 'gamenest-library-v1'
const THEME_KEY = 'gamenest-theme'

const coverThemes = [
  'linear-gradient(145deg, #13213d 0%, #275ea3 48%, #d69255 100%)',
  'linear-gradient(145deg, #142c27 0%, #24786b 48%, #d8a65c 100%)',
  'linear-gradient(145deg, #391c2d 0%, #87334e 46%, #e58a60 100%)',
  'linear-gradient(145deg, #19192e 0%, #4c3d88 48%, #b07dda 100%)',
  'linear-gradient(145deg, #302315 0%, #936325 48%, #e6bf61 100%)',
  'linear-gradient(145deg, #152d35 0%, #247f8c 50%, #78c9c4 100%)'
]

const state = {
  games: [],
  filter: 'all',
  query: '',
  sort: 'recent',
  view: 'grid'
}

const elements = {
  grid: document.getElementById('gameGrid'),
  empty: document.getElementById('emptyState'),
  search: document.getElementById('searchInput'),
  sort: document.getElementById('sortSelect'),
  sectionTitle: document.getElementById('sectionTitle'),
  resultText: document.getElementById('resultText'),
  gameModal: document.getElementById('gameModal'),
  detailModal: document.getElementById('detailModal'),
  detailContent: document.getElementById('detailContent'),
  form: document.getElementById('gameForm'),
  title: document.getElementById('gameTitle'),
  genre: document.getElementById('gameGenre'),
  status: document.getElementById('gameStatus'),
  path: document.getElementById('gamePath'),
  notes: document.getElementById('gameNotes'),
  toast: document.getElementById('toast')
}

const filterTitles = {
  all: '全部游戏', playing: '正在玩', completed: '已通关', favorite: '我的收藏',
  recent: '最近游玩', 'not-started': '尚未开始'
}

const statusNames = {
  playing: '正在玩', completed: '已通关', 'not-started': '尚未开始'
}

async function loadGames() {
  if (!window.gameAPI?.loadGames) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  }

  try {
    const result = await window.gameAPI.loadGames()
    if (!result.ok) {
      showToast(result.error || '读取游戏数据失败。')
      return []
    }

    const games = Array.isArray(result.games) ? result.games : []
    const savedGames = games.filter((game) => !String(game?.id || '').startsWith('demo-'))

    // 修复桥接前添加的游戏保存在 localStorage 中。磁盘游戏库为空时自动迁移，避免升级后看起来像“丢失”。
    if (savedGames.length === 0) {
      try {
        const legacyGames = JSON.parse(localStorage.getItem(STORAGE_KEY))
        if (Array.isArray(legacyGames) && legacyGames.length > 0) {
          const migration = await window.gameAPI.saveGames(legacyGames)
          if (migration.ok) {
            localStorage.removeItem(STORAGE_KEY)
            return legacyGames
          }
        }
      } catch {
        // 旧数据损坏时继续使用磁盘游戏库，不影响应用启动。
      }
    }

    return savedGames
  } catch (error) {
    showToast(`读取游戏数据失败：${error.message}`)
    return []
  }
}

async function saveGames() {
  if (!window.gameAPI?.saveGames) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.games))
    return true
  }

  try {
    const result = await window.gameAPI.saveGames(state.games)
    if (!result.ok) {
      showToast(result.error || '保存游戏数据失败。')
      return false
    }

    return true
  } catch (error) {
    showToast(`保存游戏数据失败：${error.message}`)
    return false
  }
}

async function addGame(gameData) {
  const game = {
    id: crypto.randomUUID(),
    title: gameData.title,
    genre: gameData.genre || '未分类',
    status: gameData.status,
    playtime: 0,
    rating: 0,
    favorite: false,
    addedAt: Date.now(),
    lastPlayed: '从未',
    notes: gameData.notes,
    path: gameData.path,
    cover: coverThemes[Math.floor(Math.random() * coverThemes.length)]
  }

  state.games.unshift(game)
  const saved = await saveGames()
  if (!saved) {
    state.games = state.games.filter((item) => item.id !== game.id)
    return null
  }

  return game
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function visibleGames() {
  const query = state.query.trim().toLocaleLowerCase('zh-CN')
  let games = state.games.filter((game) => {
    const matchesSearch = !query || `${game.title} ${game.genre}`.toLocaleLowerCase('zh-CN').includes(query)
    const matchesFilter =
      state.filter === 'all' ||
      (state.filter === 'favorite' && game.favorite) ||
      (state.filter === 'recent' && game.lastPlayed !== '从未') ||
      game.status === state.filter
    return matchesSearch && matchesFilter
  })

  games = [...games].sort((a, b) => {
    if (state.sort === 'title') return a.title.localeCompare(b.title, 'zh-CN')
    if (state.sort === 'playtime') return b.playtime - a.playtime
    if (state.sort === 'rating') return b.rating - a.rating
    return b.addedAt - a.addedAt
  })
  return games
}

function render() {
  const games = visibleGames()
  elements.grid.classList.toggle('hidden', games.length === 0)
  elements.empty.classList.toggle('hidden', games.length > 0)
  elements.grid.classList.toggle('list-view', state.view === 'list')
  elements.sectionTitle.textContent = state.query ? `“${state.query}”的搜索结果` : filterTitles[state.filter]
  elements.resultText.textContent = `${games.length} 款游戏${state.query ? '符合搜索条件' : '显示在这里'}`

  elements.grid.innerHTML = games.map((game) => `
    <article class="game-card" data-id="${escapeHtml(game.id)}">
      <div class="game-cover" style="--cover: ${game.cover}">
        <div class="cover-art"></div>
        <button class="favorite-button ${game.favorite ? 'active' : ''}" data-action="favorite" title="收藏">★</button>
        <div class="cover-title">
          <b>${escapeHtml(game.title)}</b>
          <span>${escapeHtml(game.genre || '未分类')}</span>
        </div>
      </div>
      <div class="card-body">
        <div>
          <h3 class="game-name">${escapeHtml(game.title)}</h3>
          <p class="game-meta">${escapeHtml(game.genre || '未分类')} · ${formatPlaytime(game.playtime)}</p>
        </div>
        <div class="card-footer">
          <span class="status-pill ${game.status}"><i></i>${statusNames[game.status] || '尚未开始'}</span>
          <button class="play-button" data-action="play" title="启动游戏">▶</button>
        </div>
      </div>
    </article>
  `).join('')

  updateStats()
}

function updateStats() {
  const totalHours = state.games.reduce((sum, game) => sum + Number(game.playtime || 0), 0)
  const completed = state.games.filter((game) => game.status === 'completed').length
  document.getElementById('totalGames').textContent = state.games.length
  document.getElementById('totalHours').textContent = `${Math.round(totalHours)}h`
  document.getElementById('completedGames').textContent = completed
  document.getElementById('allCount').textContent = state.games.length
  document.getElementById('storageText').textContent = `${state.games.length} 款游戏`
  document.getElementById('storageBar').style.width = `${Math.min(100, Math.max(7, state.games.length * 4))}%`
}

function formatPlaytime(hours) {
  const value = Number(hours || 0)
  return value > 0 ? `${value.toFixed(value < 10 ? 1 : 0)} 小时` : '尚未游玩'
}

function openAddModal() {
  elements.form.reset()
  elements.gameModal.classList.remove('hidden')
  setTimeout(() => elements.title.focus(), 30)
}

function closeAddModal() {
  elements.gameModal.classList.add('hidden')
}

function showDetail(gameId) {
  const game = state.games.find((item) => item.id === gameId)
  if (!game) return
  const stars = game.rating ? `${'★'.repeat(game.rating)}${'☆'.repeat(5 - game.rating)}` : '尚未评分'
  elements.detailContent.innerHTML = `
    <div class="detail-hero" style="--cover: ${game.cover}">
      <div><h2 id="detailTitle">${escapeHtml(game.title)}</h2><p>${escapeHtml(game.genre || '未分类')}</p></div>
    </div>
    <div class="detail-body">
      <div class="detail-stats">
        <div class="detail-stat"><span>游玩状态</span><strong>${statusNames[game.status]}</strong></div>
        <div class="detail-stat"><span>累计时长</span><strong>${formatPlaytime(game.playtime)}</strong></div>
        <div class="detail-stat"><span>我的评分</span><strong>${stars}</strong></div>
      </div>
      <p class="detail-notes">${escapeHtml(game.notes || '还没有为这款游戏写备注。')}</p>
      <div class="detail-actions">
        <button class="primary-button" data-detail-action="play" data-id="${escapeHtml(game.id)}">▶ 启动游戏</button>
        ${game.path ? `<button class="secondary-button" data-detail-action="folder" data-id="${escapeHtml(game.id)}">打开位置</button>` : ''}
        <button class="ghost-button danger" data-detail-action="delete" data-id="${escapeHtml(game.id)}">删除</button>
      </div>
    </div>
  `
  elements.detailModal.classList.remove('hidden')
}

function showToast(message) {
  elements.toast.textContent = message
  elements.toast.classList.remove('hidden')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => elements.toast.classList.add('hidden'), 2600)
}

async function launchGame(gameId) {
  const game = state.games.find((item) => item.id === gameId)
  if (!game) return
  if (!game.path) {
    showToast('这款游戏还没有设置启动文件。')
    return
  }
  if (!window.gameAPI) {
    showToast('请在 Electron 应用中使用启动功能。')
    return
  }
  const result = await window.gameAPI.launch(game.path)
  if (!result.ok) {
    showToast(result.error || '游戏启动失败，请检查文件路径。')
    return
  }
  game.lastPlayed = '刚刚'
  if (game.status === 'not-started') game.status = 'playing'
  const saved = await saveGames()
  elements.detailModal.classList.add('hidden')
  render()
  if (saved) showToast(`正在启动《${game.title}》`)
}

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'))
    button.classList.add('active')
    state.filter = button.dataset.filter
    render()
  })
})

document.querySelectorAll('.view-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.view-button').forEach((item) => item.classList.remove('active'))
    button.classList.add('active')
    state.view = button.dataset.view
    render()
  })
})

elements.search.addEventListener('input', (event) => {
  state.query = event.target.value
  render()
})

elements.sort.addEventListener('change', (event) => {
  state.sort = event.target.value
  render()
})

elements.grid.addEventListener('click', async (event) => {
  const card = event.target.closest('.game-card')
  if (!card) return
  const action = event.target.closest('[data-action]')?.dataset.action
  if (action === 'favorite') {
    const game = state.games.find((item) => item.id === card.dataset.id)
    game.favorite = !game.favorite
    const saved = await saveGames()
    if (!saved) game.favorite = !game.favorite
    render()
    return
  }
  if (action === 'play') {
    await launchGame(card.dataset.id)
    return
  }
  showDetail(card.dataset.id)
})

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const title = elements.title.value.trim()
  if (!title) return

  const game = await addGame({
    title,
    genre: elements.genre.value.trim() || '未分类',
    status: elements.status.value,
    notes: elements.notes.value.trim(),
    path: elements.path.value
  })
  if (!game) return

  closeAddModal()
  state.filter = 'all'
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.filter === 'all'))
  render()
  showToast(`《${title}》已添加到游戏库`)
})

document.getElementById('pickExecutable').addEventListener('click', async () => {
  if (!window.gameAPI) return showToast('文件选择只能在 Electron 应用中使用。')
  const file = await window.gameAPI.pickExecutable()
  if (!file) return
  elements.path.value = file.path
  if (!elements.title.value.trim()) elements.title.value = file.name
})

elements.detailContent.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-detail-action]')
  if (!button) return
  const game = state.games.find((item) => item.id === button.dataset.id)
  if (!game) return
  if (button.dataset.detailAction === 'play') await launchGame(game.id)
  if (button.dataset.detailAction === 'folder' && window.gameAPI) window.gameAPI.showInFolder(game.path)
  if (button.dataset.detailAction === 'delete' && confirm(`确定从游戏库中删除《${game.title}》吗？\n不会删除电脑里的游戏文件。`)) {
    const previousGames = state.games
    state.games = state.games.filter((item) => item.id !== game.id)
    const saved = await saveGames()
    if (!saved) {
      state.games = previousGames
      return
    }
    elements.detailModal.classList.add('hidden')
    render()
    showToast('游戏已从库中移除')
  }
})

document.getElementById('openAddModal').addEventListener('click', openAddModal)
document.getElementById('emptyAddButton').addEventListener('click', openAddModal)
document.getElementById('closeModal').addEventListener('click', closeAddModal)
document.getElementById('cancelModal').addEventListener('click', closeAddModal)
document.getElementById('closeDetail').addEventListener('click', () => elements.detailModal.classList.add('hidden'))
document.getElementById('settingsButton').addEventListener('click', () => showToast('设置页面会在下一版加入。'))

document.getElementById('closeWindow').addEventListener('click', () => {
  window.close()
})

document.getElementById('themeButton')?.addEventListener('click', () => {
  document.body.classList.toggle('light')
  const isLight = document.body.classList.contains('light')
  localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark')
  document.getElementById('themeButton').textContent = isLight ? '☀' : '☾'
})

elements.gameModal.addEventListener('click', (event) => {
  if (event.target === elements.gameModal) closeAddModal()
})
elements.detailModal.addEventListener('click', (event) => {
  if (event.target === elements.detailModal) elements.detailModal.classList.add('hidden')
})

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    elements.search.focus()
  }
  if (event.key === 'Escape') {
    closeAddModal()
    elements.detailModal.classList.add('hidden')
  }
})

if (localStorage.getItem(THEME_KEY) === 'light') {
  document.body.classList.add('light')
  const themeButton = document.getElementById('themeButton')
  if (themeButton) themeButton.textContent = '☀'
}

const hour = new Date().getHours()
document.querySelector('.hero h1').textContent = hour < 6 ? '夜深了，玩家' : hour < 12 ? '早上好，玩家' : hour < 18 ? '下午好，玩家' : '晚上好，玩家'

async function initializeApp() {
  state.games = await loadGames()
  render()
}

initializeApp()
