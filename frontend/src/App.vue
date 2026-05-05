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

    <SceneBuilderShell
      v-else-if="currentView === 'game'"
      :user="user"
      :themeType="effectiveTheme"
      :coins="game.coins"
      :streak="game.streak"
      :lastActiveAt="game.lastActiveAt || ''"
      :placements="game.placements"
      :toastShow="toast.show"
      :toastTitle="toast.title"
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
      @toast-dismiss="dismissToast"
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
              <div class="modal-title">Join the quest</div>
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
                New here? Hit Register. Returning hero? Sign in with the username you picked last time — no password to forget.
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
                <input v-model="newUsername" placeholder="Letters, numbers, underscores (3–32)" autocomplete="username" />
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'

import AppSidebar from './components/AppSidebar.vue'
import AppDashboard from './components/AppDashboard.vue'
import AppTasks from './components/AppTasks.vue'
import AppScene from './components/AppScene.vue'
import AppQuiz from './components/AppQuiz.vue'
import AppLeaderboard from './components/AppLeaderboard.vue'
import AppLandingV2 from './components/AppLandingV2.vue'
import SceneBuilderShell from './components/game/SceneBuilderShell.vue'
import { clearLegacyFeatureStorage, getProgress, setFeatureStorageUser } from './api/features.js'
import { getItemByIdAnyTheme, TREE_COINS_COST } from './game/assets/catalog.js'

const currentView = ref('home')

const game = reactive({
  themeType: 'forest',
  sceneProgress: 0,
  coins: 0,
  streak: 0,
  trees: 0,
  flowers: 0,
  placements: null,
  themeLocked: false,
  lastActiveAt: '',
})

const effectiveTheme = computed(() => 'forest')

function themeKey(username, key) {
  const u = String(username || '').trim()
  return u ? `cq:${u}:${key}` : ''
}

function loadThemeCacheForUser(username) {
  game.themeType = 'forest'
  const kLocked = themeKey(username, 'themeLocked')
  if (!kLocked) return
  try {
    if (localStorage.getItem(kLocked) === '1') game.themeLocked = true
  } catch {
    // ignore
  }
}

function saveThemeCacheForUser(username) {
  const kTheme = themeKey(username, 'themeType')
  const kLocked = themeKey(username, 'themeLocked')
  if (!kTheme || !kLocked) return
  try {
    localStorage.setItem(kTheme, 'forest')
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
  game.themeType = 'forest'
  game.themeLocked = false
}

const toast = reactive({ show: false, title: '', text: '', key: 0 })
let toastTimer = 0
function dismissToast() {
  clearTimeout(toastTimer)
  toast.show = false
  toast.title = ''
}

function showToast(text, title = '', durationMs = 4200) {
  clearTimeout(toastTimer)
  toast.text = String(text || '')
  toast.title = typeof title === 'string' ? title : ''
  toast.show = true
  toast.key += 1
  const ms = typeof durationMs === 'number' && durationMs >= 1200 ? durationMs : 4200
  toastTimer = setTimeout(() => {
    dismissToast()
  }, ms)
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
    const co2RoughYr = Math.round(treeMilestone * 18)
    showToast(
      `Mega — ${treeMilestone} trees standing tall on your map!\nFun fact: roughly ~${co2RoughYr} kg CO₂ sucked in per year (ballpark vibes, not an audit).`,
      'Forest level up'
    )
    return
  }

  // No ground. Keep animal/life tips.
  if (lastPlacedItem && isLifePlacement(lastPlacedItem)) {
    showToast('Look at that — your patch just got louder with life!', 'Wild friend added')
  }
}

function getItemCostForPlacement(itemId, kind) {
  const def = itemId ? getItemByIdAnyTheme(String(itemId)) : null
  if (def && Number.isFinite(def.cost)) return def.cost
  if (kind === 'tree') return TREE_COINS_COST
  if (kind === 'flower') return 12
  if (kind === 'decor') return 30
  return 0
}

// Debug helpers removed (kept app flow clean)

const pageTitles = {
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
  /** Task/quiz responses already include the new balance; do not let a same-tick /game/state read overwrite with stale data. */
  const trustPayloadCoins = !!(payload && typeof payload.totalCoins === 'number')

  if (trustPayloadCoins) {
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

  /** True when `/api/game/state` returned usable coin balance for this refresh. */
  let coinsSyncedFromGameState = false

  try {
    if (user.value) {
      try {
        const gs = await api('/api/game/state', { method: 'GET' })
        if (typeof gs?.coins === 'number' && !trustPayloadCoins) {
          game.coins = gs.coins
          shellCoins.value = gs.coins
          coinsSyncedFromGameState = true
        }
        if (typeof gs?.sceneProgress === 'number') game.sceneProgress = gs.sceneProgress
      } catch {
        // keep optimistic / payload totals; avoids localStorage mock zeroing logged-in balances
      }
    }

    const p = await getProgress()
    if (p && typeof p.streak === 'number') {
      shellStreak.value = p.streak
      game.streak = p.streak
    }

    /** Only merge mock/offline `/api/progress` coins when we did not sync from the server wallet. */
    if (p && typeof p.coins === 'number' && !coinsSyncedFromGameState && !trustPayloadCoins) {
      game.coins = p.coins
      shellCoins.value = p.coins
    }
  } catch {
    // ignore — never overwrite with bogus zeros here
  }

  syncShellFromGame()
}

async function onNavigate(view) {
  // Scene builder ("My Scene" from nav or landing CTA as `game`): single forest biome only.
  if (view === 'scene' || view === 'game') {
    if (!user.value) return openAuth()
    await refreshGameState()
    currentView.value = 'game'
    syncShellFromGame()
    return
  }
  currentView.value = view
  if (view !== 'home') refreshShellStats()
}

async function refreshGameState(options = {}) {
  try {
    const gs = await api('/api/game/state', { method: 'GET' })
    game.themeType = 'forest'
    if (typeof gs?.sceneProgress === 'number') game.sceneProgress = gs.sceneProgress
    if (typeof gs?.coins === 'number') game.coins = gs.coins
    game.lastActiveAt = typeof gs?.lastActiveAt === 'string' ? gs.lastActiveAt : ''
    if (typeof gs?.trees === 'number') game.trees = gs.trees
    if (typeof gs?.flowers === 'number') game.flowers = gs.flowers
    game.placements = gs?.placements || null
    game.themeLocked = !!gs?.themeLocked

    if (!options.skipForestEnsure && user.value?.username && !game.themeLocked) {
      try {
        await api('/api/scene/select', { method: 'POST', body: JSON.stringify({ type: 'forest' }) })
      } catch {
        // ignore — user may retry; avoids blocking gameplay
      }
      return refreshGameState({ skipForestEnsure: true })
    }

    saveThemeCacheForUser(user.value?.username)

    const items = Array.isArray(game.placements?.items) ? game.placements.items : []
    const treeCount = items.filter((x) => kindFromPlacementItem(x) === 'tree').length
    tipState.lastTreeMilestone = Math.floor(treeCount / 3) * 3
    tipState.lastGroundMilestone = 0

    const prog = await getProgress()
    if (prog) game.streak = prog.streak || 0
    syncShellFromGame()
  } catch {
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
  onNavigate('home')
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
  // Optimistic UX: show placement immediately, then reconcile with backend.
  let rollback = null
  try {
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
          showToast('Whoops — that patch is blooming to the brim (four flowers max). Try the next tile over.')
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
          showToast('Spot taken — only one centerpiece tree fits here. Shuffle to a fresh diamond.')
          return
        }
      }
    }

    // Ensure placements exist so canvas can render instantly
    if (!game.placements || !Array.isArray(game.placements.items)) game.placements = { items: [] }

    // Optimistic placement + local coin deduction
    const col = Number.isFinite(p?.col) ? p.col : null
    const row = Number.isFinite(p?.row) ? p.row : null
    const optimisticId = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const optimisticItem = { itemId, type, col, row, at: new Date().toISOString(), _optimistic: optimisticId }
    const optimisticCost = getItemCostForPlacement(itemId, type)

    const prevCoins = Number(game.coins || 0)
    const prevItemsSnapshot = Array.isArray(game.placements.items) ? [...game.placements.items] : []
    if (optimisticCost > 0 && prevCoins < optimisticCost) {
      showToast(
        'Coin pouch too light for that splurge — swing by Daily Tasks or the Quiz for a refill, then plant away.',
        'Need more coins',
        6200
      )
      return
    }
    rollback = () => {
      if (game.placements && Array.isArray(game.placements.items)) {
        game.placements.items = game.placements.items.filter((it) => it?._optimistic !== optimisticId)
      }
      game.coins = prevCoins
      syncShellFromGame()
    }

    game.placements.items = [...prevItemsSnapshot, optimisticItem]
    if (optimisticCost > 0) {
      game.coins = Math.max(0, prevCoins - optimisticCost)
      syncShellFromGame()
    }
    await nextTick()

    if (optimisticCost > 0) {
      // Keep compatibility with the original backend:
      // 1) buy from shop, 2) place into scene.
      const buyRes = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ item: type, qty: 1, itemId }),
      }).then((r) => r.json())
      if (buyRes?.error) throw new Error(buyRes.error)
      if (typeof buyRes?.coins === 'number') {
        game.coins = buyRes.coins
        syncShellFromGame()
      }
      const placed = await applyPlacementApi('/api/scene/place', p)
      if (!placed) throw new Error('PLACE_FAILED')
    } else {
      const placed = await applyPlacementApi('/api/scene/place', p)
      if (!placed) throw new Error('PLACE_FAILED')
    }
    // Tips: compare snapshots — game.placements is mutated in place during optimistic UX,
    // so use prevItemsSnapshot (items before this place) vs authoritative server placements.
    maybeEmitPlacementTips({ items: prevItemsSnapshot }, game.placements, p)
  } catch (e) {
    rollback?.()
    const msg = String(e?.message || '')
    if (msg === 'INSUFFICIENT_COINS') {
      showToast('Still short on coins — bag a few from Tasks or the Quiz, then swing back.', 'Need more coins', 6200)
    } else {
      showToast(String(msg || 'That plant did not stick — quick retry?'), 'Heads-up')
    }
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
  'Turn Your Daily Choices into a Force of Nature. Regrow Forests and Protect Wildlife. Reclaim the Earth — One Green Action at a Time.'
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
      setFeatureStorageUser(data.user?.username)
      clearLegacyFeatureStorage()
      resetThemeState()
      loadThemeCacheForUser(data.user?.username)
      await refreshGameState()
      // Do not force users into scene on page refresh.
      // Scene should open only when users explicitly navigate to "My Scene".
      currentView.value = 'home'
      refreshShellStats()
    } else {
      setFeatureStorageUser('')
      currentView.value = 'home'
    }
  } catch {
    setFeatureStorageUser('')
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
    setFeatureStorageUser(data.user?.username)
    clearLegacyFeatureStorage()
    closeAuth()
    resetThemeState()
    clearThemeCacheForUser(data.user?.username)
    await refreshGameState()
    onNavigate('dashboard')
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
    setFeatureStorageUser(data.user?.username)
    clearLegacyFeatureStorage()
    closeAuth()
    resetThemeState()
    loadThemeCacheForUser(data.user?.username)
    await refreshGameState()
    onNavigate('dashboard')
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
    setFeatureStorageUser('')
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
  if (user.value) onNavigate('dashboard')
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
