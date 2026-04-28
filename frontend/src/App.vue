<template>
  <!-- ─── ROOT WRAPPER (needed to hold both landing + app pages) ─── -->
  <div class="app-root">
    <!-- ════════════════════════════════════════════════════
         LANDING PAGE  (home view)
    ════════════════════════════════════════════════════ -->
    <AppLandingV2
      v-if="currentView === 'home'"
      :user="user"
      :navLinks="navLinks"
      :loginButtonText="loginButtonText"
      :avatarText="avatarText"
      :avatarBg="avatarBg"
      @navigate="onNavClick"
      @login="onLogin"
      @start="onCta"
    />

    <!-- ════════════════════════════════════════════════════
         THEME SELECT (after landing CTA)
    ════════════════════════════════════════════════════ -->
    <AppThemeSelect
      v-else-if="currentView === 'theme'"
      @selected="onThemeSelected"
      @skip="onThemeSkipped"
      @back-home="onNavigate('home')"
    />

    <SceneBuilderShell
      v-else-if="currentView === 'game'"
      :user="user"
      :themeType="effectiveTheme"
      :coins="game.coins"
      :streak="game.streak"
      :placements="game.placements"
      :toastShow="toast.show"
      :toastText="toast.text"
      @back="onNavigate('home')"
      @navigate="onNavClick"
      @login="onLogin"
      @reset="onResetGame"
      @logout="onLogout"
      @place="onPlace"
      @remove="onRemove"
      @move="onMove"
      @activity="onActivity"
      @refresh="refreshGameState"
    />

    <!-- ════════════════════════════════════════════════════
         APP SHELL  (all other views)
    ════════════════════════════════════════════════════ -->
    <div
      v-else
      class="app-shell"
      :class="{ 'no-sidebar': !showSidebar }"
      :data-theme="effectiveTheme"
    >
      <AppSidebar v-if="showSidebar" :user="user" :currentView="currentView" @navigate="onNavigate" @logout="onLogout" />

      <div class="shell-main">
        <!-- Top bar -->
        <header class="shell-topbar">
          <ul class="shell-nav-links">
            <li v-for="item in navLinks" :key="item.key">
              <button
                type="button"
                class="shell-nav-link"
                :class="{ active: currentView === item.key }"
                @click="onNavClick(item.key)"
              >
                {{ item.label }}
              </button>
            </li>
          </ul>
          <button type="button" class="shell-login-btn" @click="onLogin">
            <span v-if="user" class="shell-avatar" :style="{ background: avatarBg }">{{ avatarText }}</span>
            <span>{{ loginButtonText }}</span>
          </button>
        </header>

        <!-- Page content -->
        <div class="shell-content">
          <AppDashboard
            v-if="currentView === 'dashboard'"
            :user="user"
            @navigate="onNavigate"
            @coins-updated="refreshShellStats"
          />
          <AppTasks
            v-else-if="currentView === 'tasks'"
            :user="user"
            :coins="shellCoins"
            @coins-updated="refreshShellStats"
          />
          <AppScene v-else-if="currentView === 'scene'" :user="user" />
          <AppQuiz
            v-else-if="currentView === 'quiz'"
            :user="user"
            :coins="shellCoins"
            @coins-updated="refreshShellStats"
          />
          <AppLeaderboard v-else-if="currentView === 'leaderboard'" :user="user" />
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════
         AUTH MODALS
    ════════════════════════════════════════════════════ -->

    <!-- Login / Register modal -->
    <Transition name="fade">
      <div v-if="authOpen" class="modal-backdrop" @click.self="closeAuth">
        <Transition name="pop">
          <div class="modal" role="dialog" aria-modal="true" @click.stop>
            <div class="modal-header">
              <div class="modal-title">Register / Sign in (passwordless)</div>
            </div>

            <div class="form">
              <div class="field">
                <label>Display name (optional)</label>
                <input v-model="form.displayName" placeholder="Display name" autocomplete="nickname" />
              </div>

              <div class="field">
                <label>Username</label>
                <input v-model="form.username" placeholder="e.g. jarvis_01" autocomplete="username" />
              </div>

              <div class="form-actions">
                <button
                  type="button"
                  class="outline-btn"
                  :disabled="busy"
                  :style="authSuggested === 'signin' ? { boxShadow: '0 0 0 3px rgba(0,242,255,0.18)' } : null"
                  @click="submitSignin"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  class="link-btn"
                  :disabled="busy"
                  :style="authSuggested === 'register' ? { color: 'rgba(0,242,255,0.95)' } : null"
                  @click="submitRegister"
                >
                  {{ busy ? 'Working...' : 'Register' }}
                </button>
              </div>

              <div class="hint" v-if="!errorMsg">
                Register creates a new account. Sign in uses an existing username.
              </div>
              <div class="error" v-else>{{ errorMsg }}</div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- User menu -->
    <Transition name="fade">
      <div v-if="menuOpen && user" class="modal-backdrop" @click.self="closeMenu">
        <Transition name="pop">
          <div class="user-menu" role="dialog" aria-modal="true" @click.stop>
            <div class="user-menu-header">
              <div class="avatar" :style="{ background: avatarBg }">{{ avatarText }}</div>
              <div class="user-meta">
                <div class="user-name">{{ user.displayName || user.username }}</div>
                <div class="user-handle">@{{ user.username }}</div>
              </div>
            </div>

            <div class="menu-actions">
              <button type="button" class="menu-btn" @click="openUsernameModal">Edit username</button>
              <button type="button" class="menu-btn menu-btn-danger" @click="onLogout">Sign out</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- Edit username modal -->
    <Transition name="fade">
      <div v-if="usernameOpen" class="modal-backdrop" @click.self="closeUsernameModal">
        <Transition name="pop">
          <div class="modal" role="dialog" aria-modal="true" @click.stop>
            <div class="modal-header">
              <div class="modal-title">Edit username</div>
            </div>

            <div class="form">
              <div class="field">
                <label>New username</label>
                <input v-model="newUsername" placeholder="3-32 chars: a-z 0-9 _" autocomplete="username" />
              </div>

              <div class="form-actions">
                <button type="button" class="link-btn" @click="closeUsernameModal">Cancel</button>
                <button type="button" class="primary-btn" :disabled="busy" @click="submitUsername">
                  {{ busy ? 'Working...' : 'Save' }}
                </button>
              </div>

              <div class="error" v-if="usernameError">{{ usernameError }}</div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

import AppSidebar from './components/AppSidebar.vue'
import AppDashboard from './components/AppDashboard.vue'
import AppTasks from './components/AppTasks.vue'
import AppScene from './components/AppScene.vue'
import AppQuiz from './components/AppQuiz.vue'
import AppLeaderboard from './components/AppLeaderboard.vue'
import AppThemeSelect from './components/AppThemeSelect.vue'
import AppLandingV2 from './components/AppLandingV2.vue'
import SceneBuilderShell from './components/game/SceneBuilderShell.vue'
import { getProgress } from './api/features.js'
import { getItemByIdAnyTheme } from './game/assets/catalog.js'

const currentView = ref('home')

const game = reactive({
  // Empty means user hasn't chosen a theme yet (first-time register).
  themeType: '',
  sceneProgress: 0,
  coins: 0,
  streak: 0,
  trees: 0,
  flowers: 0,
  placements: null,
  themeLocked: false,
})

const effectiveTheme = computed(() => (game.themeType ? game.themeType : 'forest'))

function themeKey(username, key) {
  const u = String(username || '').trim()
  return u ? `cq:${u}:${key}` : ''
}

function loadThemeCacheForUser(username) {
  const kTheme = themeKey(username, 'themeType')
  const kLocked = themeKey(username, 'themeLocked')
  if (!kTheme || !kLocked) return
  try {
    const t = localStorage.getItem(kTheme)
    const locked = localStorage.getItem(kLocked)
    if (t) game.themeType = t === 'cityGreen' ? 'forest' : t
    if (locked === '1') game.themeLocked = true
  } catch {
    // ignore
  }
}

function saveThemeCacheForUser(username) {
  const kTheme = themeKey(username, 'themeType')
  const kLocked = themeKey(username, 'themeLocked')
  if (!kTheme || !kLocked) return
  try {
    if (game.themeType) localStorage.setItem(kTheme, String(game.themeType))
    localStorage.setItem(kLocked, game.themeLocked ? '1' : '0')
  } catch {
    // ignore
  }
}

function clearThemeCacheForUser(username) {
  const kTheme = themeKey(username, 'themeType')
  const kLocked = themeKey(username, 'themeLocked')
  if (!kTheme || !kLocked) return
  try {
    localStorage.removeItem(kTheme)
    localStorage.removeItem(kLocked)
  } catch {
    // ignore
  }
}

function resetThemeState() {
  game.themeType = ''
  game.themeLocked = false
}

const toast = reactive({ show: false, text: '', key: 0 })
let toastTimer = 0
function showToast(text) {
  clearTimeout(toastTimer)
  toast.text = String(text || '')
  toast.show = true
  toast.key += 1
  toastTimer = setTimeout(() => {
    toast.show = false
  }, 3200)
}

const tipState = reactive({
  lastTreeMilestone: 0,
})

function kindFromPlacementItem(it) {
  const itemId = it?.itemId ? String(it.itemId) : ''
  if (itemId) return getItemByIdAnyTheme(itemId)?.kind || String(it?.type || '')
  return String(it?.type || '')
}

function isLifePlacement(it) {
  const itemId = it?.itemId ? String(it.itemId) : ''
  if (!itemId) return false
  const def = getItemByIdAnyTheme(itemId)
  return !!def?.tags?.includes('life')
}

function maybeEmitPlacementTips(prevPlacements, nextPlacements, lastPlacedItem) {
  const prevItems = Array.isArray(prevPlacements?.items) ? prevPlacements.items : []
  const nextItems = Array.isArray(nextPlacements?.items) ? nextPlacements.items : []

  const prevTree = prevItems.filter((x) => kindFromPlacementItem(x) === 'tree').length
  const nextTree = nextItems.filter((x) => kindFromPlacementItem(x) === 'tree').length

  const treeMilestone = Math.floor(nextTree / 3) * 3
  if (treeMilestone >= 3 && treeMilestone !== tipState.lastTreeMilestone && treeMilestone > prevTree) {
    tipState.lastTreeMilestone = treeMilestone
    const o2kgPerDay = Math.max(0.5, (treeMilestone * 0.35)).toFixed(1)
    showToast(
      `🌳 You’ve planted ${treeMilestone} trees — estimated oxygen output: ~${o2kgPerDay} kg/day. Climate Action Coins represent real low‑carbon actions.`
    )
    return
  }

  // No ground. Keep animal/life tips.
  if (lastPlacedItem && isLifePlacement(lastPlacedItem)) {
    showToast('🐾 You saved a life — a kinder habitat is taking shape.')
  }
}

// Debug helpers removed (kept app flow clean)

const pageTitles = {
  theme: 'Choose Theme',
  dashboard: 'Dashboard',
  tasks: 'Daily Tasks',
  scene: 'My Scene',
  quiz: 'Climate Quiz',
  leaderboard: 'Leaderboard',
}

const shellCoins = ref(0)
const shellStreak = ref(0)

function syncShellFromGame() {
  shellCoins.value = game.coins || 0
  shellStreak.value = game.streak || 0
}

async function refreshShellStats(payload = null) {
  if (payload && typeof payload.totalCoins === 'number') {
    shellCoins.value = payload.totalCoins
    game.coins = payload.totalCoins
  }
  if (payload && typeof payload.streak === 'number') {
    shellStreak.value = payload.streak
    game.streak = payload.streak
  }
  if (payload && typeof payload.sceneProgress === 'number') {
    game.sceneProgress = payload.sceneProgress
  }

  // Keep one authoritative refresh in background for consistency.
  try {
    const p = await getProgress()
    if (p) {
      shellCoins.value = p.coins || 0
      shellStreak.value = p.streak || 0
      game.coins = p.coins || 0
      game.streak = p.streak || 0
    }
  } catch {
    // ignore
  }
}

async function onNavigate(view) {
  // "My Scene" always enters the interactive scene builder flow.
  if (view === 'scene') {
    if (!user.value) return openAuth()
    const prevThemeLocked = !!game.themeLocked
    // Enter scene with authoritative latest coins/streak/placements.
    await refreshGameState()
    const resolvedThemeLocked = !!game.themeLocked || prevThemeLocked
    currentView.value = resolvedThemeLocked ? 'game' : 'theme'
    syncShellFromGame()
    return
  }
  currentView.value = view
  if (view !== 'home') refreshShellStats()
}

async function refreshGameState() {
  try {
    // Use the shared API helper so auth/session failures don't get silently treated as "no theme locked".
    const gs = await api('/api/game/state', { method: 'GET' })
    if (gs?.themeType) {
      // City theme removed from frontend; fall back safely for existing accounts.
      game.themeType = gs.themeType === 'cityGreen' ? 'forest' : gs.themeType
    }
    if (typeof gs?.sceneProgress === 'number') game.sceneProgress = gs.sceneProgress
    if (typeof gs?.coins === 'number') game.coins = gs.coins
    if (typeof gs?.trees === 'number') game.trees = gs.trees
    if (typeof gs?.flowers === 'number') game.flowers = gs.flowers
    game.placements = gs?.placements || null
    // Only treat as locked when backend explicitly says so.
    // This ensures first-time users still see the Forest/Glacier selection.
    game.themeLocked = !!gs?.themeLocked
    saveThemeCacheForUser(user.value?.username)

    // Initialize tip milestones from existing placements so we don't spam tips
    // when users already have a built scene.
    const items = Array.isArray(game.placements?.items) ? game.placements.items : []
    const treeCount = items.filter((x) => kindFromPlacementItem(x) === 'tree').length
    tipState.lastTreeMilestone = Math.floor(treeCount / 3) * 3
    tipState.lastGroundMilestone = 0

    // Keep using existing progress endpoint for streak/level display
    const prog = await getProgress()
    if (prog) game.streak = prog.streak || 0
    syncShellFromGame()
  } catch (e) {
    // If this fails right after sign-in, we'd otherwise show ThemeSelect by mistake.
    // Keep previous themeLocked instead of forcing it false.
    return null
  }
}

function onActivity(payload) {
  // Keep the topbar feeling responsive; refresh will reconcile any mismatch.
  if (payload && typeof payload.totalCoins === 'number') game.coins = payload.totalCoins
  if (payload && typeof payload.streak === 'number') game.streak = payload.streak
  if (payload && typeof payload.sceneProgress === 'number') game.sceneProgress = payload.sceneProgress
  syncShellFromGame()
}

async function onResetGame() {
  try {
    await fetch('/api/game/reset', { method: 'POST', credentials: 'include' }).then((r) => r.json())
  } catch {
    // ignore
  }
  onNavigate('theme')
}

async function onThemeSelected(type) {
  if (type) game.themeType = type
  game.themeLocked = true
  saveThemeCacheForUser(user.value?.username)
  // ensure theme_locked is reflected before entering game (prevents random bounces)
  await refreshGameState()
  onNavigate('game')
}

function onThemeSkipped() {
  onNavigate('game')
  refreshGameState()
}

async function applyPlacementApi(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || `HTTP_${res.status}`)
    if (data?.placements) game.placements = data.placements
    return data
  } catch {
    return null
  }
}

async function onPlace(p) {
  // Connect coins: buy first, then place on grid
  try {
    const prevPlacements = game.placements
    const itemId = String(p?.itemId || '')
    const type = String(p?.type || '')
    if (!itemId || !type) return

    // Placement rule: flowers occupy tile corners, max 4 per tile.
    if (type === 'flower') {
      const items = Array.isArray(game.placements?.items) ? game.placements.items : []
      const col = Number.isFinite(p?.col) ? p.col : null
      const row = Number.isFinite(p?.row) ? p.row : null
      if (col != null && row != null) {
        const inCell = items.filter((it) => it && it.col === col && it.row === row && kindFromPlacementItem(it) === 'flower')
        if (inCell.length >= 4) {
          showToast('🌸 This tile’s corners are full (max 4 flora per tile).')
          return
        }
      }
    }

    // Placement rule: one tree per tile (tree at center).
    if (type === 'tree') {
      const items = Array.isArray(game.placements?.items) ? game.placements.items : []
      const col = Number.isFinite(p?.col) ? p.col : null
      const row = Number.isFinite(p?.row) ? p.row : null
      if (col != null && row != null) {
        const treesInCell = items.filter((it) => it && it.col === col && it.row === row && kindFromPlacementItem(it) === 'tree')
        if (treesInCell.length >= 1) {
          showToast('🌳 This tile already has a tree (max 1 tree per tile).')
          return
        }
      }
    }
    const buyRes = await fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ item: type, qty: 1, itemId }),
    }).then((r) => r.json())
    if (buyRes?.error) throw new Error(buyRes.error)
    // reflect coins immediately
    if (typeof buyRes?.coins === 'number') {
      game.coins = buyRes.coins
      syncShellFromGame()
    }
    await applyPlacementApi('/api/scene/place', p)
    // Tips: based on placement deltas (trees/ground/life)
    maybeEmitPlacementTips(prevPlacements, game.placements, p)
  } catch (e) {
    const msg = String(e?.message || '')
    if (msg === 'INSUFFICIENT_COINS')
      alert('Not enough Climate Action Coins. Complete Daily Tasks or the Daily Quiz to earn more, then place again.')
    else alert(`Place failed: ${msg || 'unknown'}`)
  }
}

async function onRemove(p) {
  await applyPlacementApi('/api/scene/remove', p)
}

async function onMove(p) {
  await applyPlacementApi('/api/scene/move', p)
}

const navLinks = [
  { label: 'Home', key: 'home' },
  { label: 'Dashboard', key: 'dashboard' },
  { label: 'My Scene', key: 'scene' },
  { label: 'Tasks', key: 'tasks' },
  { label: 'Quiz', key: 'quiz' },
  { label: 'Leaderboard', key: 'leaderboard' },
]

const viewsWithoutSidebar = new Set(['dashboard', 'tasks', 'quiz', 'leaderboard'])
const showSidebar = computed(() => !viewsWithoutSidebar.has(currentView.value))

const titleLines = ['The Climate is Changing', 'So Can You']
const subtitle =
  'Turn Your Daily Choices into a Force of Nature. Restore Glaciers. Regrow Forests. Reclaim the Earth - One Green Action at a Time.'
const ctaText = 'Start Your Quest'

const user = ref(null)
const authOpen = ref(false)
const busy = ref(false)
const errorMsg = ref('')
const menuOpen = ref(false)
const usernameOpen = ref(false)
const newUsername = ref('')
const usernameError = ref('')

const form = reactive({ username: '', displayName: '' })

// Tracks which action the UI should guide users toward when an auth call fails.
// We keep the existing two-button modal, but we can still “switch” intent.
const authSuggested = ref('signin') // signin|register

const loginButtonText = computed(() => {
  if (user.value) return user.value.displayName || user.value.username
  return 'Login'
})

const avatarText = computed(() => {
  const base = (user.value?.displayName || user.value?.username || '').trim()
  const letters = base.replace(/[^a-zA-Z0-9]/g, '')
  return (letters || base || 'U').slice(0, 2).toUpperCase()
})

const avatarBg = computed(() => {
  const s = user.value?.username || 'user'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return `hsla(${h}, 85%, 45%, 0.85)`
})

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP_${res.status}`
    throw new Error(msg)
  }
  return data
}

async function refreshMe() {
  try {
    const data = await api('/api/auth/me', { method: 'GET' })
    user.value = data.user
    if (data.user) {
      resetThemeState()
      loadThemeCacheForUser(data.user?.username)
      await refreshGameState()
      // Do not force users into scene on page refresh.
      // Scene should open only when users explicitly navigate to "My Scene".
      currentView.value = 'home'
      refreshShellStats()
    } else {
      currentView.value = 'home'
    }
  } catch {
    user.value = null
    currentView.value = 'home'
  }
}

function onNavClick(key) {
  if (key === 'home') return onNavigate('home')
  if (!user.value) return openAuth()
  onNavigate(key === 'home' ? 'home' : key === 'scene' ? 'scene' : key)
}

function openAuth() {
  authOpen.value = true
  errorMsg.value = ''
  authSuggested.value = 'signin'
}

function closeAuth() {
  authOpen.value = false
  errorMsg.value = ''
}

async function submitRegister() {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const data = await api('/api/auth/username-register', {
      method: 'POST',
      body: JSON.stringify({ username: form.username, displayName: form.displayName }),
    })
    user.value = data.user
    closeAuth()
    resetThemeState()
    clearThemeCacheForUser(data.user?.username)
    await refreshGameState()
    // Force new accounts to pick a theme (Forest / Glacier)
    onNavigate(game.themeLocked ? 'game' : 'theme')
  } catch (e) {
    const msg = String(e?.message || 'Register failed')
    // English UX requirement:
    // - username already exists → show “already registered”
    if (msg === 'USERNAME_TAKEN') errorMsg.value = 'This username is already registered.'
    else errorMsg.value = msg
    authSuggested.value = 'signin'
  } finally {
    busy.value = false
  }
}

async function submitSignin() {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const data = await api('/api/auth/username-signin', {
      method: 'POST',
      body: JSON.stringify({ username: form.username }),
    })
    user.value = data.user
    closeAuth()
    resetThemeState()
    loadThemeCacheForUser(data.user?.username)
    await refreshGameState()
    onNavigate(game.themeLocked ? 'game' : 'theme')
  } catch (e) {
    const msg = String(e?.message || 'Login failed')
    // UX requirement:
    // - login with non-existent username → guide user to register
    if (msg === 'USER_NOT_FOUND') {
      errorMsg.value = 'Account not found. Please register first.'
      authSuggested.value = 'register'
    } else {
      errorMsg.value = msg
      authSuggested.value = 'signin'
    }
  } finally {
    busy.value = false
  }
}

async function onLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) })
  } catch {
    // ignore
  } finally {
    clearThemeCacheForUser(user.value?.username)
    resetThemeState()
    user.value = null
    menuOpen.value = false
    onNavigate('home')
    shellCoins.value = 0
    shellStreak.value = 0
  }
}

function onLogin() {
  if (user.value) {
    menuOpen.value = !menuOpen.value
    return
  }
  openAuth()
}

function closeMenu() {
  menuOpen.value = false
}

function openUsernameModal() {
  closeMenu()
  usernameError.value = ''
  newUsername.value = user.value?.username || ''
  usernameOpen.value = true
}

function closeUsernameModal() {
  usernameOpen.value = false
  usernameError.value = ''
}

async function submitUsername() {
  if (busy.value) return
  busy.value = true
  usernameError.value = ''
  try {
    const data = await api('/api/auth/username', {
      method: 'POST',
      body: JSON.stringify({ username: newUsername.value }),
    })
    user.value = data.user
    closeUsernameModal()
  } catch (e) {
    usernameError.value = String(e?.message || 'Update failed')
  } finally {
    busy.value = false
  }
}

function onCta() {
  errorMsg.value = ''
  if (user.value) onNavigate(game.themeLocked ? 'game' : 'theme')
  else authOpen.value = true
}

function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (usernameOpen.value) return closeUsernameModal()
  if (menuOpen.value) return closeMenu()
  if (authOpen.value) return closeAuth()
}

onMounted(async () => {
  await refreshMe()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>
