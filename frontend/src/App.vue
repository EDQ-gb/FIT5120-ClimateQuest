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
      :toastActions="toast.actions"
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
      @toast-action="onToastAction"
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
            :key="`dash-${user?.id || user?.username || 'guest'}-${userViewNonce}`"
            :user="user"
            @navigate="onNavigate"
            @coins-updated="refreshShellStats"
          />
          <AppTasks
            v-else-if="currentView === 'tasks'"
            :key="`tasks-${user?.id || user?.username || 'guest'}-${userViewNonce}`"
            :user="user"
            :coins="shellCoins"
            @coins-updated="refreshShellStats"
          />
          <AppScene v-else-if="currentView === 'scene'" :user="user" />
          <AppQuiz
            v-else-if="currentView === 'quiz'"
            :key="`quiz-${user?.id || user?.username || 'guest'}-${userViewNonce}`"
            :user="user"
            :coins="shellCoins"
            @coins-updated="refreshShellStats"
            @stay-on-quiz="onStayOnQuiz"
          />
          <AppLeaderboard v-else-if="currentView === 'leaderboard'" :user="user" />
          <AppEducation v-else-if="currentView === 'education'" />
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

            <div class="menu-privacy">
              <label class="menu-check">
                <input v-model="profilePublicLocal" type="checkbox" @change="onProfileVisibilityChange" />
                <span>Appear on the public leaderboard</span>
              </label>
              <p class="menu-hint">When off, your profile is hidden from the Top Champions list.</p>
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import AppSidebar from './components/AppSidebar.vue'
import AppDashboard from './components/AppDashboard.vue'
import AppTasks from './components/AppTasks.vue'
import AppScene from './components/AppScene.vue'
import AppQuiz from './components/AppQuiz.vue'
import AppLeaderboard from './components/AppLeaderboard.vue'
import AppEducation from './components/AppEducation.vue'
import AppLandingV2 from './components/AppLandingV2.vue'
import SceneBuilderShell from './components/game/SceneBuilderShell.vue'
import { getProgress } from './api/features.js'
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

function setMockUserScope(username) {
  const scope = String(username || '').trim().toLowerCase() || 'guest'
  try {
    localStorage.setItem('cq_user_scope', scope)
  } catch {
    // ignore
  }
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

const toast = reactive({ show: false, title: '', text: '', key: 0, actions: [] })
let toastTimer = 0
function dismissToast() {
  clearTimeout(toastTimer)
  toast.show = false
  toast.title = ''
  toast.actions = []
}

function showToast(text, title = '', durationMs = 4200, actions = []) {
  clearTimeout(toastTimer)
  toast.text = String(text || '')
  toast.title = typeof title === 'string' ? title : ''
  toast.actions = Array.isArray(actions) ? actions : []
  toast.show = true
  toast.key += 1
  const ms = typeof durationMs === 'number' && durationMs >= 1200 ? durationMs : 4200
  toastTimer = setTimeout(() => {
    dismissToast()
  }, ms)
}

function onToastAction(actionKey) {
  dismissToast()
  if (actionKey === 'go-tasks') onNavigate('tasks')
  if (actionKey === 'go-quiz') onNavigate('quiz')
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

function isHomeItemId(itemId) {
  const id = String(itemId || '').trim()
  if (!id) return false
  const def = getItemByIdAnyTheme(id)
  if (def?.tags?.includes('home')) return true
  // fallback: suburban house ids
  if (id.startsWith('my_scene_house_')) return true
  return false
}

function footprintForItemId(itemId) {
  const id = String(itemId || '').trim()
  if (!id) return { w: 1, h: 1 }
  const def = getItemByIdAnyTheme(id)
  const w = Number(def?.footprint?.w || 1)
  const h = Number(def?.footprint?.h || 1)
  if (!Number.isFinite(w) || !Number.isFinite(h)) return { w: 1, h: 1 }
  return { w: Math.max(1, Math.min(3, Math.round(w))), h: Math.max(1, Math.min(3, Math.round(h))) }
}

function cellsForFootprint(col, row, fp) {
  const out = []
  const w = Number(fp?.w || 1)
  const h = Number(fp?.h || 1)
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      out.push({ col: col + dx, row: row + dy })
    }
  }
  return out
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
      'Forest level up',
      9200
    )
    return
  }

  // No ground. Keep animal/life tips.
  if (lastPlacedItem && isLifePlacement(lastPlacedItem)) {
    showToast('Look at that — your patch just got louder with life!', 'Wild friend added', 6800)
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
  education: 'Education',
}
const validViews = new Set(['home', 'dashboard', 'scene', 'game', 'tasks', 'quiz', 'education', 'leaderboard'])
let navReqId = 0

const shellCoins = ref(0)
const shellStreak = ref(0)
const userViewNonce = ref(0)
const stickyView = ref('')

function bumpUserViewNonce() {
  userViewNonce.value += 1
}

function syncShellFromGame() {
  shellCoins.value = game.coins || 0
  shellStreak.value = game.streak || 0
}

function toFiniteNumberOrNull(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function onProfileVisibilityChange() {
  if (!user.value) return
  const prev = user.value.profilePublic !== false
  try {
    const data = await api('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ profilePublic: profilePublicLocal.value }),
    })
    user.value = data.user
  } catch {
    profilePublicLocal.value = prev
  }
}

async function refreshShellStats(payload = null) {
  /** Task/quiz responses already include the new balance; do not let a same-tick /game/state read overwrite with stale data. */
  const payloadCoins = toFiniteNumberOrNull(payload?.totalCoins)
  const payloadStreak = toFiniteNumberOrNull(payload?.streak)
  const payloadSceneProgress = toFiniteNumberOrNull(payload?.sceneProgress)
  const trustPayloadCoins = payloadCoins != null

  if (trustPayloadCoins) {
    shellCoins.value = payloadCoins
    game.coins = payloadCoins
  }
  if (payloadStreak != null) {
    shellStreak.value = payloadStreak
    game.streak = payloadStreak
  }
  if (payloadSceneProgress != null) {
    game.sceneProgress = payloadSceneProgress
  }

  /** True when `/api/game/state` returned usable coin balance for this refresh. */
  let coinsSyncedFromGameState = false

  try {
    if (user.value) {
      try {
        const gs = await api('/api/game/state', { method: 'GET' })
        const gsCoins = toFiniteNumberOrNull(gs?.coins)
        const gsSceneProgress = toFiniteNumberOrNull(gs?.sceneProgress)
        if (gsCoins != null && !trustPayloadCoins) {
          game.coins = gsCoins
          shellCoins.value = gsCoins
          coinsSyncedFromGameState = true
        }
        if (gsSceneProgress != null) game.sceneProgress = gsSceneProgress
      } catch {
        // keep optimistic / payload totals; avoids localStorage mock zeroing logged-in balances
      }
    }

    const p = await getProgress()
    const pStreak = toFiniteNumberOrNull(p?.streak)
    if (pStreak != null) {
      shellStreak.value = pStreak
      game.streak = pStreak
    }

    /** Only merge mock/offline `/api/progress` coins when we did not sync from the server wallet. */
    const pCoins = toFiniteNumberOrNull(p?.coins)
    if (pCoins != null && !coinsSyncedFromGameState && !trustPayloadCoins) {
      game.coins = pCoins
      shellCoins.value = pCoins
    }
  } catch {
    // ignore — never overwrite with bogus zeros here
  }

  syncShellFromGame()
}

async function onNavigate(view, options = {}) {
  const userAction = !!options.userAction
  if (!validViews.has(view)) return
  if (
    stickyView.value === 'quiz' &&
    !!user.value &&
    currentView.value === 'quiz' &&
    view !== 'quiz' &&
    !userAction
  ) return
  if (userAction && view !== 'quiz') stickyView.value = ''
  const reqId = ++navReqId
  // Scene builder ("My Scene" from nav or landing CTA as `game`): single forest biome only.
  if (view === 'scene' || view === 'game') {
    if (!user.value) return openAuth()
    // Open Scene immediately, then refresh data in background.
    currentView.value = 'game'
    syncShellFromGame()
    await refreshGameState()
    if (reqId !== navReqId) return
    syncShellFromGame()
    return
  }
  currentView.value = view
  if (view !== 'home') await refreshShellStats()
}

async function refreshGameState(options = {}) {
  try {
    const gs = await api('/api/game/state', { method: 'GET' })
    game.themeType = 'forest'
    const gsSceneProgress = toFiniteNumberOrNull(gs?.sceneProgress)
    const gsCoins = toFiniteNumberOrNull(gs?.coins)
    if (gsSceneProgress != null) game.sceneProgress = gsSceneProgress
    if (gsCoins != null) game.coins = gsCoins
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
  const payloadCoins = toFiniteNumberOrNull(payload?.totalCoins)
  const payloadStreak = toFiniteNumberOrNull(payload?.streak)
  const payloadSceneProgress = toFiniteNumberOrNull(payload?.sceneProgress)
  if (payloadCoins != null) game.coins = payloadCoins
  if (payloadStreak != null) game.streak = payloadStreak
  if (payloadSceneProgress != null) game.sceneProgress = payloadSceneProgress
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

    const col0 = Number.isFinite(p?.col) ? p.col : null
    const row0 = Number.isFinite(p?.row) ? p.row : null
    const items0 = Array.isArray(game.placements?.items) ? game.placements.items : []
    const inCell0 = col0 != null && row0 != null ? items0.filter((it) => it && it.col === col0 && it.row === row0) : []
    const cellHasTree = inCell0.some((it) => kindFromPlacementItem(it) === 'tree')
    const cellHasHome = inCell0.some((it) => isHomeItemId(it?.itemId))
    const placingHome = isHomeItemId(itemId)

    // Footprint-aware rule: homes occupy 2–3 tiles; any tile covered by a home is blocked for others.
    if (col0 != null && row0 != null) {
      if (placingHome) {
        const fp = footprintForItemId(itemId)
        const cells = cellsForFootprint(col0, row0, fp)
        // require all covered cells to be empty (no trees/decor/flowers) and in bounds
        const occupied = cells.some(({ col, row }) => {
          if (col < 0 || row < 0 || col >= 26 || row >= 26) return true
          return items0.some((it) => it && it.col === col && it.row === row)
        })
        if (occupied) {
          showToast('Homes need a clear 2–3 tile space. Try an emptier patch.')
          return
        }
      } else {
        // If any home footprint covers this cell, block placement.
        const blockedByHome = items0.some((it) => {
          if (!isHomeItemId(it?.itemId)) return false
          const fp = footprintForItemId(it.itemId)
          const cells = cellsForFootprint(Number(it.col || 0), Number(it.row || 0), fp)
          return cells.some((c) => c.col === col0 && c.row === row0)
        })
        if (blockedByHome) {
          showToast('That tile is reserved for a home. Pick a free tile.')
          return
        }
        if (type === 'tree' && cellHasTree) {
          showToast('Spot taken — only one centerpiece tree fits here.')
          return
        }
      }
    }

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
    const col = col0
    const row = row0
    const optimisticId = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const optimisticItem = { itemId, type, col, row, at: new Date().toISOString(), _optimistic: optimisticId }
    const optimisticCost = getItemCostForPlacement(itemId, type)

    const prevCoins = Number(game.coins || 0)
    const prevItemsSnapshot = Array.isArray(game.placements.items) ? [...game.placements.items] : []
    if (optimisticCost > 0 && prevCoins < optimisticCost) {
      showToast(
        'Coin pouch too light for that splurge — swing by Daily Tasks or the Quiz for a refill, then plant away.',
        'Need more coins',
        6200,
        [
          { key: 'go-tasks', label: 'Go to Tasks' },
          { key: 'go-quiz', label: 'Go to Quiz' },
        ]
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
      const buyCoins = toFiniteNumberOrNull(buyRes?.coins)
      if (buyCoins != null) {
        game.coins = buyCoins
        syncShellFromGame()
      }
      const placed = await applyPlacementApi('/api/scene/place', p)
      if (!placed) throw new Error('PLACE_FAILED')
      if (placed?.toast?.text) {
        showToast(String(placed.toast.text), String(placed.toast.title || ''), 8400)
      }
    } else {
      const placed = await applyPlacementApi('/api/scene/place', p)
      if (!placed) throw new Error('PLACE_FAILED')
      if (placed?.toast?.text) {
        showToast(String(placed.toast.text), String(placed.toast.title || ''), 8400)
      }
    }
    // Tips: compare snapshots — game.placements is mutated in place during optimistic UX,
    // so use prevItemsSnapshot (items before this place) vs authoritative server placements.
    maybeEmitPlacementTips({ items: prevItemsSnapshot }, game.placements, p)
  } catch (e) {
    rollback?.()
    const msg = String(e?.message || '')
    if (msg === 'INSUFFICIENT_COINS') {
      showToast(
        'Still short on coins — bag a few from Tasks or the Quiz, then swing back.',
        'Need more coins',
        6200,
        [
          { key: 'go-tasks', label: 'Go to Tasks' },
          { key: 'go-quiz', label: 'Go to Quiz' },
        ]
      )
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
  { label: 'Education', key: 'education' },
  { label: 'Leaderboard', key: 'leaderboard' },
]

const viewsWithoutSidebar = new Set(['dashboard', 'tasks', 'quiz', 'leaderboard', 'education'])
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
const profilePublicLocal = ref(true)

watch(
  () => user.value,
  (u) => {
    if (u && typeof u.profilePublic === 'boolean') profilePublicLocal.value = u.profilePublic
    else if (!u) profilePublicLocal.value = true
  },
  { immediate: true }
)

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
  const prevIdentity = user.value?.id || user.value?.username || null
  try {
    const data = await api('/api/auth/me', { method: 'GET' })
    user.value = data.user
    setMockUserScope(data?.user?.username || 'guest')
    const nextIdentity = user.value?.id || user.value?.username || null
    if (prevIdentity !== nextIdentity) bumpUserViewNonce()
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
    setMockUserScope('guest')
    if (prevIdentity !== null) bumpUserViewNonce()
    currentView.value = 'home'
  }
}

function onNavClick(key) {
  if (!validViews.has(key)) return
  if (key === 'home') return onNavigate('home', { userAction: true })
  if (!user.value) return openAuth()
  onNavigate(key, { userAction: true })
}

function onStayOnQuiz() {
  stickyView.value = 'quiz'
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
    setMockUserScope(data?.user?.username || 'guest')
    bumpUserViewNonce()
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
    setMockUserScope(data?.user?.username || 'guest')
    bumpUserViewNonce()
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
    resetThemeState()
    user.value = null
    setMockUserScope('guest')
    bumpUserViewNonce()
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

let liveSyncTimer = 0

function stopLiveSync() {
  if (liveSyncTimer) {
    clearInterval(liveSyncTimer)
    liveSyncTimer = 0
  }
}

function runLiveSyncNow() {
  if (!user.value) return
  if (currentView.value === 'home') return
  if (currentView.value === 'game') {
    refreshGameState({ skipForestEnsure: true })
    return
  }
  refreshShellStats()
}

function startLiveSync() {
  stopLiveSync()
  if (!user.value) return
  if (currentView.value === 'home') return
  liveSyncTimer = window.setInterval(() => {
    if (document.hidden) return
    runLiveSyncNow()
  }, 8000)
}

function onVisibilityChange() {
  if (!document.hidden) runLiveSyncNow()
}

watch(
  () => [user.value?.id || user.value?.username || null, currentView.value],
  () => {
    startLiveSync()
  },
  { immediate: true }
)

onMounted(async () => {
  await refreshMe()
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  stopLiveSync()
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>
