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
      :themeType="game.themeType"
      :coins="game.coins"
      :streak="game.streak"
      :placements="game.placements"
      @back="onNavigate('dashboard')"
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
    <div v-else class="app-shell">
      <AppSidebar :user="user" :currentView="currentView" @navigate="onNavigate" @logout="onLogout" />

      <div class="shell-main">
        <!-- Top bar -->
        <header class="shell-topbar">
          <div class="shell-page-title">{{ pageTitles[currentView] || 'ClimateQuest' }}</div>
          <div class="shell-topbar-right">
            <button class="topbar-home-btn" @click="onNavigate('home')">← Home</button>
            <span class="topbar-badge gold">🪙 {{ shellCoins.toLocaleString() }}</span>
            <span class="topbar-badge cyan">🔥 {{ shellStreak }}d streak</span>
          </div>
        </header>

        <!-- Page content -->
        <div class="shell-content">
          <AppDashboard
            v-if="currentView === 'dashboard'"
            :user="user"
            @navigate="onNavigate"
            @coins-updated="refreshShellStats"
          />
          <AppTasks v-else-if="currentView === 'tasks'" :user="user" @coins-updated="refreshShellStats" />
          <AppScene v-else-if="currentView === 'scene'" :user="user" />
          <AppQuiz v-else-if="currentView === 'quiz'" :user="user" @coins-updated="refreshShellStats" />
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
})

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

async function refreshShellStats() {
  try {
    const p = await getProgress()
    if (p) {
      shellCoins.value = p.coins || 0
      shellStreak.value = p.streak || 0
    }
  } catch {
    // ignore
  }
}

function onNavigate(view) {
  // "My Scene" always enters the interactive scene builder flow.
  if (view === 'scene') {
    if (!user.value) return openAuth()
    currentView.value = game.themeLocked ? 'game' : 'theme'
    refreshShellStats()
    return
  }
  // Flow guard (stable version):
  // - home stays as-is
  // - after theme is locked, user cannot go back home unless logout
  if (view === 'home' && user.value && game.themeLocked) return
  currentView.value = view
  if (view !== 'home') refreshShellStats()
}

async function refreshGameState() {
  try {
    // Use the shared API helper so auth/session failures don't get silently treated as "no theme locked".
    const gs = await api('/api/game/state', { method: 'GET' })
    if (gs?.themeType) game.themeType = gs.themeType
    if (typeof gs?.sceneProgress === 'number') game.sceneProgress = gs.sceneProgress
    if (typeof gs?.coins === 'number') game.coins = gs.coins
    if (typeof gs?.trees === 'number') game.trees = gs.trees
    if (typeof gs?.flowers === 'number') game.flowers = gs.flowers
    game.placements = gs?.placements || null
    game.themeLocked = !!gs?.themeLocked

    // Keep using existing progress endpoint for streak/level display
    const prog = await getProgress()
    if (prog) game.streak = prog.streak || 0
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
    const itemId = String(p?.itemId || '')
    const type = String(p?.type || '')
    if (!itemId || !type) return
    const buyRes = await fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ item: type, qty: 1, itemId }),
    }).then((r) => r.json())
    if (buyRes?.error) throw new Error(buyRes.error)
    // reflect coins immediately
    if (typeof buyRes?.coins === 'number') game.coins = buyRes.coins
    await applyPlacementApi('/api/scene/place', p)
  } catch (e) {
    const msg = String(e?.message || '')
    if (msg === 'INSUFFICIENT_COINS')
      alert('Not enough coins. Complete Daily Tasks or the Daily Quiz to earn coins, then place items.')
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
  { label: 'My Scene', key: 'scene' },
  { label: 'Tasks', key: 'tasks' },
  { label: 'Quiz', key: 'quiz' },
  { label: 'Leaderboard', key: 'leaderboard' },
]

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
      await refreshGameState()
      // On refresh: if already locked theme, stay in game; otherwise keep home until Start is clicked.
      currentView.value = game.themeLocked ? 'game' : 'home'
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
    await refreshGameState()
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
