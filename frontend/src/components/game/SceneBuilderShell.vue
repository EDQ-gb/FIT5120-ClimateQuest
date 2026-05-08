<template>
  <div class="sb-root" :class="themeClass">
    <!-- TOP BAR -->
    <div class="topbar">
      <ul class="topbar-links">
        <li v-for="item in topNavItems" :key="item.key">
          <button
            class="topbar-link"
            :class="{ active: item.key === 'scene' }"
            type="button"
            @click="$emit('navigate', item.key)"
          >
            {{ item.label }}
          </button>
        </li>
      </ul>

      <div class="topbar-right">
        <button class="topbar-user-btn" type="button" @click="$emit('login')">
          <span class="topbar-avatar" :style="{ background: avatarBg }">{{ avatarText }}</span>
          <span>{{ loginButtonText }}</span>
        </button>
      </div>
    </div>

    <aside class="scene-stats-card" aria-label="Your scene">
      <div class="eco-panel eco-panel--compact" aria-label="Progress">
        <button type="button" class="level-pill" :class="{ open: levelPanelOpen }" @click="toggleLevelPanel">
          <span class="level-pill__label">Lv {{ myLevel }}</span>
          <span class="level-pill__bar"><i :style="{ width: clampPct(((treesPlaced % 5) / 5) * 100) + '%' }"></i></span>
          <span class="level-pill__meta">{{ treesPlaced % 5 }}/5</span>
        </button>

        <div v-if="levelPanelOpen" class="level-expand">
          <div class="eco-row">
            <span class="eco-label">Trees planted</span>
            <span class="eco-val">{{ treesPlaced }}</span>
          </div>
          <div class="eco-row">
            <span class="eco-label">Low-carbon check-ins</span>
            <span class="eco-val">{{ Number(tasksCompleted || 0) }}</span>
          </div>

          <div class="eco-row eco-row--timer">
            <span class="eco-label">Decay timer</span>
            <span class="eco-val">{{ decayTimeLabel }}</span>
          </div>
          <div class="eco-bar eco-bar--timer"><i :style="{ width: decayPct + '%' }"></i></div>

          <div v-if="nextUnlockHint" class="eco-hint">{{ nextUnlockHint }}</div>
        </div>
      </div>
      <div class="scene-stats-row">
        <span class="scene-stats-label scene-stats-label--coins">Climate Coins</span>
        <b class="scene-stats-value">{{ coins.toLocaleString() }}</b>
      </div>
      <div class="scene-stats-row">
        <span class="scene-stats-label scene-stats-label--checkins">Check-ins</span>
        <b class="scene-stats-value">{{ streak }} d</b>
      </div>
      <div class="scene-stats-chips">
        <span class="scene-chip">🌱 Live</span>
        <span class="scene-chip">⏱️ Synced</span>
        <span class="scene-chip scene-chip--lvl">Lv {{ myLevel }}</span>
      </div>
      <div v-if="decayReminder" class="scene-hint scene-hint--decay">{{ decayReminder }}</div>
      <div v-if="lowCoinsReminder" class="scene-hint scene-hint--coins">{{ lowCoinsReminder }}</div>
      <button type="button" class="scene-guide-toggle" @click="toggleTipsPanel">
        {{ tipsPanelOpen ? 'Hide tips' : 'Show tips' }}
      </button>
    </aside>

    <!-- MAIN -->
    <div class="main">
      <div class="main-inner">
      <!-- SIDE DOCK (floating category buttons) -->
      <button type="button" class="dock-btn dock-btn--veg" :class="{ active: shopOpen && shopTab === 'veg' }" @click="openShop('veg')" aria-label="Vegetation">
        <span class="dock-ico">🌿</span>
      </button>
      <button type="button" class="dock-btn dock-btn--decor" :class="{ active: shopOpen && shopTab === 'decor' }" @click="openShop('decor')" aria-label="Decor">
        <span class="dock-ico">🧩</span>
      </button>
      <button type="button" class="dock-btn dock-btn--flowers" :class="{ active: shopOpen && shopTab === 'flowers' }" @click="openShop('flowers')" aria-label="Flowers">
        <span class="dock-ico">🌸</span>
      </button>
      <button type="button" class="dock-btn dock-btn--pets" :class="{ active: shopOpen && shopTab === 'pets' }" @click="openShop('pets')" aria-label="Pets">
        <span class="dock-ico">🐾</span>
      </button>
      <button type="button" class="dock-btn dock-btn--homes" :class="{ active: shopOpen && shopTab === 'homes' }" @click="openShop('homes')" aria-label="Homes">
        <span class="dock-ico">🏠</span>
      </button>

      <button type="button" class="dock-btn dock-btn--del" :class="{ active: mode === 'delete' }" @click="setMode('delete')" aria-label="Remove">
        <span class="dock-ico">🪏</span>
      </button>

      <!-- SHOP PANEL (watch-style glass) -->
      <div v-if="shopOpen" class="shop-panel" role="region" :aria-label="`Shop: ${shopTabLabel}`">
        <div class="shop-panel__top">
          <div class="shop-panel__title">{{ shopTabLabel }}</div>
          <button type="button" class="shop-panel__close" @click="closeShop" aria-label="Close shop">×</button>
        </div>

        <div class="shop-panel__hint">
          Pick an item, then tap the map to place it. Locked tiles show the requirement.
        </div>

        <div class="shop-panel__grid">
          <button
            v-for="it in shopTabItems"
            :key="it.id"
            class="tile-btn"
            type="button"
            :disabled="it.locked"
            :class="[{ selected: selectedItemId === it.id, locked: it.locked }, `kind-${it.kind || 'x'}`]"
            :aria-label="it.label"
            @click="selectItem(it.id)"
          >
            <img :src="it.src" alt="" decoding="async" draggable="false" />
            <div class="tile-name">{{ it.label }}</div>
            <div v-if="Number.isFinite(it.cost)" class="tile-cost">{{ it.cost }}c</div>
            <div v-if="it.locked" class="tile-lock">
              <div class="tile-lock__badge">Locked</div>
              <div class="tile-lock__req">{{ it.lockReason }}</div>
            </div>
          </button>
        </div>
      </div>

      <!-- Tips panel (separate module on the right) -->
      <div v-if="tipsPanelOpen" class="tips-panel" role="region" aria-label="Tips">
        <div class="tips-panel__top">
          <div class="tips-panel__title">Tips</div>
          <button type="button" class="tips-panel__close" @click="tipsPanelOpen = false" aria-label="Close tips">×</button>
        </div>
        <div class="tips-panel__body">
          <div class="tips-panel__welcome">Welcome to the eco-friendly community!</div>
          <ol class="tips-panel__list">
            <li>Tap a category button on the left, pick an item, then tap the map to place it.</li>
            <li>Grow your forest to unlock more — pets & homes unlock at <strong>Lv5 (20 trees)</strong>.</li>
            <li>Need coins? Complete <strong>Tasks</strong> or the <strong>Quiz</strong> up top.</li>
            <li>Scroll to zoom; right-drag to pan.</li>
          </ol>
        </div>
      </div>

      <!-- CANVAS -->
      <div class="canvas-area">
        <transition name="bubble-fade">
          <div v-if="guideBubble.show" class="guide-bubble" role="status" aria-live="polite">
            {{ guideBubble.text }}
          </div>
        </transition>
        <canvas
          ref="gameCanvas"
          class="cq-scene-canvas"
          :class="`cq-cursor-${mode}`"
          title=""
          aria-label="Rainforest map"
          role="img"
        ></canvas>
        <!-- minimap removed (too big/noisy); can be re-added later -->
        <transition name="toast-fade">
          <div
            v-if="toastShow && toastText"
            class="toast-overlay"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="toastTitle ? 'cq-toast-title' : undefined"
            aria-describedby="cq-toast-body"
            @click.self="$emit('toast-dismiss')"
          >
            <div class="toast-card">
              <div v-if="toastTitle" id="cq-toast-title" class="toast-title">{{ toastTitle }}</div>
              <div id="cq-toast-body" class="toast-body" :class="{ 'toast-body--solo': !toastTitle }">{{ toastText }}</div>
              <div v-if="toastActions.length" class="toast-actions">
                <button
                  v-for="a in toastActions"
                  :key="a.key"
                  type="button"
                  class="toast-action"
                  @click="$emit('toast-action', a.key)"
                >
                  {{ a.label }}
                </button>
              </div>
              <button type="button" class="toast-dismiss" @click="$emit('toast-dismiss')">Got it</button>
            </div>
          </div>
        </transition>
      </div>
      </div>
    </div>

    <!-- STATUS BAR -->
    <div class="statusbar">
      <span>Tool: <b>{{ modeLabel }}</b></span>
      <span>Holding: <b>{{ selectedLabel }}</b></span>
      <span>Placed: <b>{{ objectCount }}</b></span>
      <span>Tile: <b>{{ gridPosLabel }}</b></span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { getTheme, getItemById, getItemByIdAnyTheme, TREE_COINS_COST } from '../../game/assets/catalog.js'
import { createSceneBuilderCore } from '../../game/iso/sceneBuilderCore.js'

const props = defineProps({
  user: { type: Object, default: null },
  themeType: { type: String, default: 'forest' },
  coins: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  // Placeholder until backend wires real Task completion stats.
  tasksCompleted: { type: Number, default: 0 },
  /** ISO time from `/api/game/state`; used for idle decay countdown. */
  lastActiveAt: { type: String, default: '' },
  placements: { type: Object, default: null }, // { items: [...] }
  toastShow: { type: Boolean, default: false },
  toastTitle: { type: String, default: '' },
  toastText: { type: String, default: '' },
  toastActions: { type: Array, default: () => [] },
})

const emit = defineEmits(['back', 'reset', 'logout', 'login', 'navigate', 'place', 'move', 'remove', 'refresh', 'activity', 'toast-dismiss', 'toast-action'])

const topNavItems = [
  { key: 'home', label: 'Home' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'scene', label: 'My Scene' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'education', label: 'Education' },
  { key: 'leaderboard', label: 'Leaderboard' },
]

const loginButtonText = computed(() => props.user?.displayName || props.user?.username || 'Login')
const avatarText = computed(() => {
  const base = (props.user?.displayName || props.user?.username || '').trim()
  const letters = base.replace(/[^a-zA-Z0-9]/g, '')
  return (letters || base || 'U').slice(0, 2).toUpperCase()
})
const avatarBg = computed(() => {
  const s = props.user?.username || 'user'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return `hsla(${h}, 85%, 45%, 0.85)`
})

function tipsKeyForUser(username) {
  const u = String(username || '').trim().toLowerCase() || 'guest'
  return `cq_seenMySceneTips:${u}`
}

const gameCanvas = ref(null)
const minimapCanvas = ref(null)
let core = null

const tipsPanelOpen = ref(false)

function toggleTipsPanel() {
  tipsPanelOpen.value = !tipsPanelOpen.value
  if (tipsPanelOpen.value) markTipsSeen()
}

const guideBubble = reactive({ show: false, text: '', key: 0 })
let guideTimer = 0
function hideGuideBubble() {
  clearTimeout(guideTimer)
  guideBubble.show = false
  guideBubble.text = ''
}
function showGuideBubble(text, ms = 5200) {
  clearTimeout(guideTimer)
  guideBubble.text = String(text || '').trim()
  if (!guideBubble.text) return
  guideBubble.show = true
  guideBubble.key += 1
  guideTimer = setTimeout(() => {
    hideGuideBubble()
  }, Math.max(1800, Number(ms) || 5200))
}

function bubbleKeyForUser(username) {
  const u = String(username || '').trim().toLowerCase() || 'guest'
  return `cq_seenMySceneBubbles:${u}`
}

function shouldAutoShowBubbles() {
  try {
    const k = bubbleKeyForUser(props.user?.username)
    return localStorage.getItem(k) !== '1'
  } catch {
    return true
  }
}

function markBubblesSeen() {
  try {
    const k = bubbleKeyForUser(props.user?.username)
    localStorage.setItem(k, '1')
  } catch {
    // ignore
  }
}

function shouldAutoOpenTips() {
  try {
    const k = tipsKeyForUser(props.user?.username)
    return localStorage.getItem(k) !== '1'
  } catch {
    return true
  }
}

function markTipsSeen() {
  try {
    const k = tipsKeyForUser(props.user?.username)
    localStorage.setItem(k, '1')
  } catch (_) {
    // ignore quota / privacy mode
  }
}

function autoOpenTipsOnce() {
  if (!shouldAutoOpenTips()) return
  tipsPanelOpen.value = true
  markTipsSeen()
}

const mode = ref('idle') // idle|place|delete
const selectedItemId = ref('')
const gridPos = reactive({ col: null, row: null })
const shopOpen = ref(false)
const shopTab = ref('veg') // veg|decor|flowers|pets|homes
const levelPanelOpen = ref(false)

function toggleLevelPanel() {
  levelPanelOpen.value = !levelPanelOpen.value
}

function openShop(tab) {
  shopTab.value = tab
  shopOpen.value = true
}

function closeShop() {
  shopOpen.value = false
  // Closing the sidebar exits placement selection and restores normal cursor.
  mode.value = 'idle'
  selectedItemId.value = ''
}

const theme = computed(() => getTheme(props.themeType))

const placementItems = computed(() => (Array.isArray(props.placements?.items) ? props.placements.items : []))

function clampPct(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

const treesPlaced = computed(() => placementItems.value.filter((x) => String(x?.type || '') === 'tree').length)
const uniqueTreeSpecies = computed(() => {
  const set = new Set()
  for (const it of placementItems.value) {
    if (String(it?.type || '') !== 'tree') continue
    const id = String(it?.itemId || '').trim()
    if (id) set.add(id)
  }
  return set.size
})
const lifePlaced = computed(() => {
  let n = 0
  for (const it of placementItems.value) {
    const id = String(it?.itemId || '').trim()
    if (!id) continue
    const def = getItemByIdAnyTheme(id)
    if (def?.tags?.includes('life')) n += 1
  }
  return n
})
const utilityPlaced = computed(() => {
  let n = 0
  for (const it of placementItems.value) {
    const id = String(it?.itemId || '').trim()
    if (!id) continue
    const def = getItemByIdAnyTheme(id)
    if (def?.tags?.includes('utility')) n += 1
  }
  return n
})

// Level curve: +1 level per 5 trees (Lv5 at 20 trees), no cap.
const myLevel = computed(() => Math.max(1, 1 + Math.floor(treesPlaced.value / 5)))

// Eco % metrics removed for now (replaced by concrete counters: trees + task check-ins).

function isUnlocked(def) {
  const need = def?.unlock?.requiresTreesPlaced
  if (need == null) return true
  const req = Number(need)
  if (!Number.isFinite(req)) return true
  return treesPlaced.value >= req
}

function lockReasonFor(def) {
  const need = Number(def?.unlock?.requiresTreesPlaced)
  if (!Number.isFinite(need)) return ''
  const left = Math.max(0, need - treesPlaced.value)
  return `Lv5: Plant ${left} more tree${left === 1 ? '' : 's'} (need ${need}).`
}

const nextUnlockHint = computed(() => {
  const items = theme.value.items || []
  const needs = []
  for (const it of items) {
    const req = Number(it?.unlock?.requiresTreesPlaced)
    if (!Number.isFinite(req)) continue
    if (treesPlaced.value >= req) continue
    needs.push(req)
  }
  if (!needs.length) return ''
  needs.sort((a, b) => a - b)
  const next = needs[0]
  const left = Math.max(0, next - treesPlaced.value)
  return `Next unlock at ${next} trees (plant ${left} more).`
})

// Flowers are removed from the palette for My Scene. Keep existing flower placements rendering,
// but prevent selecting/placing new flowers from this UI.

const shopTabLabel = computed(() => {
  if (shopTab.value === 'veg') return 'Vegetation'
  if (shopTab.value === 'decor') return 'Decor'
  if (shopTab.value === 'flowers') return 'Flowers'
  if (shopTab.value === 'pets') return 'Pets'
  if (shopTab.value === 'homes') return 'Homes'
  return 'Shop'
})

function hasTag(def, tag) {
  return !!def?.tags?.includes(tag)
}

const shopTabItems = computed(() => {
  const items = theme.value.items || []
  const mapped = items
    .filter((x) => !x?.hiddenFromShop)
    .map((x) => ({
    ...x,
    locked: !isUnlocked(x),
    lockReason: lockReasonFor(x),
  }))

  if (shopTab.value === 'veg') return mapped.filter((x) => x.kind === 'tree')
  if (shopTab.value === 'flowers') return mapped.filter((x) => x.kind === 'flower')
  if (shopTab.value === 'pets') return mapped.filter((x) => x.kind === 'decor' && hasTag(x, 'life'))
  if (shopTab.value === 'homes') return mapped.filter((x) => x.kind === 'decor' && (hasTag(x, 'home') || String(x.id || '').includes('cabin')))
  // decor (exclude pets/homes)
  const d = mapped.filter((x) => x.kind === 'decor' && !hasTag(x, 'life') && !hasTag(x, 'home'))
  // If decor ends up empty (tags missing / legacy items), show all decor here too.
  if (d.length === 0) return mapped.filter((x) => x.kind === 'decor')
  return d
})

const TREE_PRICE = TREE_COINS_COST

function kindCost(kind) {
  if (kind === 'tree') return TREE_PRICE
  if (kind === 'decor') return 30
  return 0
}

/** Idle ≥3 days triggers decay; first tick can remove up to 3 trees (server `treesDelta`). */
const IDLE_HOURS_BEFORE_DECAY = 72

function formatRoughDaysEn(hoursLeft) {
  if (hoursLeft <= 0) return null
  if (hoursLeft < 24) return 'less than 1 day'
  const days = Math.ceil(hoursLeft / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

const decayReminder = computed(() => {
  const raw = props.lastActiveAt
  if (!raw) {
    return 'Pop in every few days to keep your community thriving. Skip ~3 days and nature may undo a little progress.'
  }
  const last = new Date(raw).getTime()
  if (!Number.isFinite(last)) return ''
  const hoursIdle = Math.max(0, (Date.now() - last) / (3600 * 1000))
  if (hoursIdle >= IDLE_HOURS_BEFORE_DECAY) {
    return 'Time for a quick check-in — progress can fade if you leave it too long.'
  }
  const hoursLeft = IDLE_HOURS_BEFORE_DECAY - hoursIdle
  const rough = formatRoughDaysEn(hoursLeft)
  if (!rough) return ''
  return `About ${rough} until decay can start. A quick Task or Quiz keeps things stable.`
})

const decayPct = computed(() => {
  const raw = props.lastActiveAt
  if (!raw) return 0
  const last = new Date(raw).getTime()
  if (!Number.isFinite(last)) return 0
  const hoursIdle = Math.max(0, (Date.now() - last) / (3600 * 1000))
  const clamped = Math.max(0, Math.min(IDLE_HOURS_BEFORE_DECAY, hoursIdle))
  return clampPct((clamped / IDLE_HOURS_BEFORE_DECAY) * 100)
})

const decayTimeLabel = computed(() => {
  const raw = props.lastActiveAt
  if (!raw) return '—'
  const last = new Date(raw).getTime()
  if (!Number.isFinite(last)) return '—'
  const hoursIdle = Math.max(0, (Date.now() - last) / (3600 * 1000))
  const hoursLeft = Math.max(0, IDLE_HOURS_BEFORE_DECAY - hoursIdle)
  if (hoursLeft <= 0) return 'Now'
  if (hoursLeft < 24) return `${Math.ceil(hoursLeft)}h`
  const days = Math.ceil(hoursLeft / 24)
  return `${days}d`
})

const lowCoinsReminder = computed(() => {
  if (props.coins >= TREE_PRICE) return ''
  return `Trees need ${TREE_PRICE} coins each right now. Go bag more from Tasks or Quiz, then come back and flex that wallet.`
})

function setMode(m) {
  mode.value = m
  if (m !== 'place') selectedItemId.value = ''
}

function selectItem(id) {
  const def = id ? getItemById(props.themeType, id) || getItemByIdAnyTheme(id) : null
  if (def && !isUnlocked(def)) return
  mode.value = 'place'
  selectedItemId.value = id
}

const selectedLabel = computed(() => {
  const it = selectedItemId.value ? getItemById(props.themeType, selectedItemId.value) : null
  return it?.label || it?.id || '— pick one!'
})
const modeLabel = computed(() => (mode.value === 'delete' ? 'Remove' : mode.value === 'place' ? 'Plant' : 'Idle'))

const objectCount = computed(() => (Array.isArray(props.placements?.items) ? props.placements.items.length : 0))
const gridPosLabel = computed(() => (gridPos.col == null ? '-' : `${gridPos.col},${gridPos.row}`))

const themeClass = computed(() => `theme-${props.themeType}`)

// For now, the visual shell is wired; the isometric draw/interaction core will be implemented in the next todo.
function resizeCanvas() {
  // sizing is handled by the core (using DOM bounding box)
}

onMounted(async () => {
  autoOpenTipsOnce()
  // Lightweight guided bubbles (one-time per user). No expensive rendering.
  if (shouldAutoShowBubbles()) {
    markBubblesSeen()
    setTimeout(() => showGuideBubble('Welcome! Pick 🌿 Vegetation, choose a tree, then tap a tile to plant.'), 650)
    setTimeout(() => showGuideBubble('Keep planting: at 20 trees (Lv5) you unlock Pets 🐾 and Homes 🏠.'), 7200)
    setTimeout(() => showGuideBubble('Need coins? Jump to Tasks ✅ or Quiz 📚 from the top bar.'), 14200)
  }
  if (!selectedItemId.value) {
    const firstUnlocked = (theme.value.items || []).find((x) => x?.id && isUnlocked(x))
    if (firstUnlocked?.id) selectedItemId.value = firstUnlocked.id
  }

  const canvas = gameCanvas.value
  if (!canvas) return
  core = createSceneBuilderCore({
    canvas,
    minimapCanvas: null,
    gridSize: 26,
    themeBg: theme.value.background || 'forest',
    getMode: () => mode.value,
    getSelectedItem: () => selectedItemId.value,
    getItemDefById: (id) => getItemById(props.themeType, id) || getItemByIdAnyTheme(id),
    getDefaultGroundItemId: () => null,
    getPreloadSrcs: () => {
      const out = []
      for (const x of theme.value.items || []) {
        if (x?.src) out.push(x.src)
        if (Array.isArray(x?.srcCandidates)) out.push(...x.srcCandidates)
      }
      return out.filter(Boolean)
    },
    getPlacements: () => props.placements || { items: [] },
    setGridPos: (col, row) => {
      gridPos.col = col
      gridPos.row = row
    },
    onPlace: ({ itemId, col, row }) => {
      const def = getItemById(props.themeType, itemId)
      emit('place', { itemId, type: def?.kind || 'tree', col, row })
    },
    onRemove: ({ itemId, col, row }) => {
      emit('remove', { itemId, col, row })
    },
    onMove: ({ itemId, fromCol, fromRow, toCol, toRow }) => {
      emit('move', { itemId, fromCol, fromRow, toCol, toRow })
    },
  })
  // Ensure layout is settled so the canvas has correct size on first render.
  await nextTick()
  core.start()
  // Some browsers report 0×0 on the first layout pass; one extra tick prevents
  // “existing flowers/trees invisible until click” on initial load.
  setTimeout(() => core?.forceResize?.(), 40)
})

onUnmounted(() => {
  core?.stop?.()
  core = null
  hideGuideBubble()
})

watch(
  () => treesPlaced.value,
  (n, p) => {
    if ((p || 0) === 0 && (n || 0) > 0) {
      showGuideBubble('Nice start! Mix decor 🧩 to make your scene feel alive.', 5200)
    }
    if ((p || 0) < 20 && (n || 0) >= 20) {
      showGuideBubble('Level up! Pets 🐾 and Homes 🏠 are now unlocked in the shop.', 7200)
    }
  }
)

watch(
  () => selectedItemId.value,
  (id, prev) => {
    if (!id || id === prev) return
    if (mode.value === 'delete') return
    showGuideBubble('Tap a tile to place. Switch to 🪏 to remove items.', 5200)
  }
)

watch(() => [props.themeType], () => {
  const first = theme.value.items?.[0]
  if (first?.id) selectedItemId.value = first.id
  core?.setThemeBg?.(theme.value.background || 'forest')
  // Layout often changes on view switch; ensure canvas recomputes immediately.
  core?.forceResize?.()
})

watch(
  () => [treesPlaced.value, props.themeType],
  () => {
    // Ensure selected item remains unlocked when level gates change.
    if (selectedItemId.value) {
      const def = getItemById(props.themeType, selectedItemId.value)
      if (def && !isUnlocked(def)) selectedItemId.value = ''
    }
    if (!selectedItemId.value) {
      const firstUnlocked = (theme.value.items || []).find((x) => x?.id && isUnlocked(x))
      if (firstUnlocked?.id) selectedItemId.value = firstUnlocked.id
    }
  },
  { immediate: true }
)

watch(
  () => props.placements,
  () => {
    // When placements arrive async from API, force a resize to avoid “blank until click”.
    core?.forceResize?.()
  }
)

watch(
  () => props.user?.username || '',
  () => {
    // Auto-open tips for new accounts / first visit.
    autoOpenTipsOnce()
  },
  { immediate: true }
)
</script>

<style scoped>
* {
  box-sizing: border-box;
}
.sb-root {
  --sb-topbar-h: 64px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 1.08rem;
  color: #e8f5ee;
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
  background: #16261b;
}

/* ── TOP BAR ── */
.topbar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--sb-topbar-h);
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  padding: 10px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 100;
}
.topbar-links {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 28px;
}
.topbar-link {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.98rem;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 2px;
  transition: color 0.2s ease;
}
.topbar-link:hover {
  color: #fff;
}
.topbar-link.active {
  color: #fff;
}
.topbar-right {
  position: absolute;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.topbar-user-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  transition: all 0.2s ease;
}
.topbar-user-btn:hover {
  background: rgba(255, 255, 255, 0.11);
}
.topbar-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.85);
}
.scene-stats-card {
  position: fixed;
  top: calc(var(--sb-topbar-h) + 8px);
  left: 14px;
  right: auto;
  z-index: 90;
  min-width: 188px;
  max-width: min(320px, calc(100vw - 28px));
  display: grid;
  gap: 7px;
  padding: 9px 11px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.scene-guide-toggle {
  width: 100%;
  margin-top: 6px;
  padding: 9px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.tips-panel {
  position: fixed;
  top: calc(var(--sb-topbar-h) + 12px);
  left: 50%;
  transform: translateX(-50%);
  right: auto;
  width: min(460px, calc(100vw - 28px));
  z-index: 92;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(12, 18, 16, 0.52);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 18px 50px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.tips-panel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.tips-panel__title {
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(205, 252, 255, 0.95);
}

.tips-panel__close {
  width: 34px;
  height: 34px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.tips-panel__body {
  padding: 12px 14px 14px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.76rem;
  line-height: 1.5;
}

.tips-panel__welcome {
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
  font-weight: 950;
  font-size: 0.92rem;
  color: rgba(148, 240, 200, 0.98);
  margin-bottom: 8px;
}

.tips-panel__list {
  margin: 0;
  padding-left: 18px;
}
.scene-stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.scene-stats-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: 800;
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
}

.scene-stats-label--coins::before,
.scene-stats-label--checkins::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-right: 8px;
  transform: translateY(1px);
}

.scene-stats-label--coins::before {
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.9), rgba(255, 214, 150, 0.85));
  box-shadow: 0 0 0 2px rgba(255, 214, 150, 0.12);
}

.scene-stats-label--checkins::before {
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.85), rgba(148, 240, 200, 0.85));
  box-shadow: 0 0 0 2px rgba(148, 240, 200, 0.12);
}
.scene-stats-value {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 900;
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
}
.scene-hint {
  grid-column: 1 / -1;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.78);
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
  font-weight: 850;
  padding: 8px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 2px;
}
.scene-hint--coins {
  color: rgba(255, 214, 150, 0.95);
  border-top-color: rgba(255, 200, 120, 0.2);
}
.scene-stats-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.scene-chip {
  font-size: 0.64rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(235, 255, 245, 0.9);
}

.scene-chip--lvl {
  border-color: rgba(0, 242, 255, 0.28);
  background: rgba(0, 242, 255, 0.12);
  color: rgba(205, 252, 255, 0.95);
}

.eco-panel {
  display: grid;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.eco-panel--compact {
  gap: 8px;
}

.level-pill {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(12, 18, 16, 0.36);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
}

.level-pill__label {
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(205, 252, 255, 0.95);
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
}

.level-pill__bar {
  flex: 1;
  height: 7px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(0, 242, 255, 0.18);
  background: rgba(0, 242, 255, 0.08);
}

.level-pill__bar i {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(0, 242, 255, 0.28), rgba(0, 242, 255, 0.9));
}

.level-pill__meta {
  font-size: 0.68rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.72);
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
}

.level-expand {
  display: grid;
  gap: 8px;
  padding-top: 6px;
}

.eco-compact-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.eco-compact-title {
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(205, 252, 255, 0.95);
}

.eco-compact-sub {
  font-size: 0.68rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.72);
}

.eco-compact-progress {
  height: 7px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(0, 242, 255, 0.18);
  background: rgba(0, 242, 255, 0.08);
}

.eco-compact-progress i {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(0, 242, 255, 0.28), rgba(0, 242, 255, 0.9));
}

.eco-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.eco-label {
  font-size: 0.66rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.62);
  letter-spacing: 0.2px;
}

.eco-val {
  font-size: 0.66rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.9);
}

.eco-bar {
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.eco-bar i {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(82, 212, 150, 0.35), rgba(82, 212, 150, 0.95));
}

.eco-bar--b i {
  background: linear-gradient(90deg, rgba(140, 170, 255, 0.35), rgba(140, 170, 255, 0.95));
}

.eco-bar--r i {
  background: linear-gradient(90deg, rgba(255, 214, 150, 0.3), rgba(255, 214, 150, 0.95));
}

.eco-bar--timer {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.eco-bar--timer i {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.62));
}

.eco-hint {
  font-size: 0.68rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.7);
  padding-top: 2px;
}

/* ── MAIN LAYOUT ── */
.main {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding-top: 0;
}

/* Float over the canvas so the map keeps the full viewport height (same as before the guide bar). */
/* legacy scene-guide-banner removed (tips are now a single My Scene module) */

.main-inner {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding-top: var(--sb-topbar-h);
}

.palette-mini-hint {
  padding: 6px 10px 8px;
  font-size: 0.62rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.42);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

/* ── LEFT PALETTE ── */
.palette {
  display: none;
}

.dock-btn {
  position: fixed;
  left: 14px;
  z-index: 92;
  width: 46px;
  height: 46px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 18, 16, 0.48);
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 18px 50px rgba(0, 0, 0, 0.28);
}

.dock-btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(82, 212, 150, 0.35);
}

.dock-btn.active {
  background: rgba(82, 212, 150, 0.14);
  border-color: rgba(82, 212, 150, 0.45);
  box-shadow: 0 0 0 3px rgba(82, 212, 150, 0.1);
}

.dock-btn--veg {
  top: calc(var(--sb-topbar-h) + 262px);
}
.dock-btn--decor {
  top: calc(var(--sb-topbar-h) + 320px);
}
.dock-btn--flowers {
  top: calc(var(--sb-topbar-h) + 378px);
}
.dock-btn--pets {
  top: calc(var(--sb-topbar-h) + 436px);
}
.dock-btn--homes {
  top: calc(var(--sb-topbar-h) + 494px);
}
.dock-btn--del {
  top: calc(var(--sb-topbar-h) + 552px);
}

.dock-ico {
  font-size: 1.02rem;
}


.shop-panel {
  position: fixed;
  top: calc(var(--sb-topbar-h) + 12px);
  left: 88px;
  height: calc(100vh - var(--sb-topbar-h) - 88px);
  width: 320px;
  z-index: 91;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(12, 18, 16, 0.52);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 18px 50px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.shop-panel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.shop-panel__title {
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(205, 252, 255, 0.95);
}

.shop-panel__close {
  width: 34px;
  height: 34px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.shop-panel__hint {
  padding: 10px 14px;
  font-size: 0.66rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.58);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.shop-panel__grid {
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  overflow: auto;
}
.shop-panel__grid:has(.kind-flower) {
  grid-template-columns: repeat(3, 1fr);
}
.palette-header,
.palette-toggle,
.palette-fab {
  display: none;
}
.palette-scroll {
  overflow-y: auto;
  flex: 1;
  padding: 8px;
}
.palette-scroll::-webkit-scrollbar {
  width: 4px;
}
.palette-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
.category-label {
  display: grid;
  gap: 2px;
  font-size: 0.66rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.32);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 6px 4px 2px;
}
.category-cost {
  font-size: 0.62rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 0.4px;
  text-transform: none;
}
.tile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}
.tile-btn {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.18s;
  padding: 3px;
  position: relative;
}
.tile-cost {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 0.56rem;
  font-weight: 950;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.92);
}
.tile-btn:disabled {
  cursor: not-allowed;
  opacity: 0.78;
  transform: none;
}
.tile-btn img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
.tile-btn.kind-flower img {
  transform: scale(1.38);
}
.tile-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(82, 212, 150, 0.4);
  transform: scale(1.05);
}
.tile-btn:disabled:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: transparent;
  transform: none;
}
.tile-btn.selected {
  border-color: #52d496;
  background: rgba(82, 212, 150, 0.15);
}
/* tile-cost removed; cost shown on category header line */
.tile-btn .tile-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 0.5rem;
  background: rgba(0, 0, 0, 0.52);
  text-align: center;
  padding: 1px;
  opacity: 0;
  transition: opacity 0.2s;
  color: rgba(255, 255, 255, 0.95);
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.tile-btn:hover .tile-name {
  opacity: 1;
}

.tile-lock {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 4px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.52);
  border-radius: 8px;
}
.tile-lock__badge {
  font-size: 0.58rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 999px;
  border: 1px solid rgba(0, 242, 255, 0.35);
  background: rgba(0, 242, 255, 0.14);
  color: rgba(205, 252, 255, 0.95);
}
.tile-lock__req {
  text-align: center;
  font-size: 0.56rem;
  line-height: 1.25;
  color: rgba(255, 255, 255, 0.78);
}

/* ── MODE BUTTONS ── */
.mode-row {
  padding: 8px;
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.mode-btn {
  flex: 1;
  padding: 6px 4px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  user-select: none;
}
.mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.mode-btn.active {
  background: rgba(82, 212, 150, 0.2);
  border-color: #52d496;
  color: #52d496;
}
.mode-btn.del.active {
  background: rgba(224, 82, 82, 0.2);
  border-color: #e05252;
  color: #e05252;
}
.mode-btn.move.active {
  background: rgba(0, 242, 255, 0.12);
  border-color: #00f2ff;
  color: #00f2ff;
}

/* ── CANVAS AREA ── */
.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at center bottom, rgba(92, 160, 110, 0.55) 0%, rgba(18, 40, 24, 0.92) 72%);
}

.guide-bubble {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 92;
  max-width: min(520px, calc(100vw - 64px));
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.92);
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
  font-weight: 800;
  font-size: 0.86rem;
  letter-spacing: -0.01em;
  line-height: 1.25;
  text-align: center;
  pointer-events: none;
}

.bubble-fade-enter-active,
.bubble-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.bubble-fade-enter-from,
.bubble-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}

.cq-cursor-idle {
  cursor: default;
}
.cq-cursor-place {
  cursor: crosshair;
}
.cq-cursor-delete {
  cursor: not-allowed;
}

.toast-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 12, 10, 0.42);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.toast-card {
  width: min(420px, 100%);
  padding: 20px 22px 18px;
  border-radius: 18px;
  border: 1px solid rgba(82, 212, 150, 0.35);
  background: rgba(255, 255, 255, 0.07);
  box-shadow:
    0 0 0 1px rgba(82, 212, 150, 0.08),
    0 20px 50px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.toast-title {
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: rgba(148, 240, 200, 0.98);
  margin-bottom: 10px;
}

.toast-body {
  font-size: 0.82rem;
  line-height: 1.52;
  color: rgba(255, 255, 255, 0.76);
  white-space: pre-line;
  max-height: min(52vh, 340px);
  overflow-y: auto;
  padding-right: 4px;
}

.toast-body--solo {
  color: rgba(255, 255, 255, 0.85);
}
.toast-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.toast-action {
  border-radius: 999px;
  border: 1px solid rgba(0, 242, 255, 0.32);
  background: rgba(0, 242, 255, 0.12);
  color: rgba(208, 251, 255, 0.95);
  font-size: 0.74rem;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
}

.toast-dismiss {
  margin-top: 16px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(82, 212, 150, 0.45);
  background: rgba(82, 212, 150, 0.12);
  color: rgba(148, 240, 200, 0.98);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.toast-dismiss:hover {
  background: rgba(82, 212, 150, 0.22);
  transform: translateY(-1px);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.22s ease;
}
.toast-fade-enter-active .toast-card,
.toast-fade-leave-active .toast-card {
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
.toast-fade-enter-from .toast-card,
.toast-fade-leave-to .toast-card {
  transform: translateY(10px) scale(0.98);
}

/* ── STATUS BAR ── */
.statusbar {
  background: rgba(0, 0, 0, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 5px 16px;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.45);
  display: flex;
  gap: 20px;
  flex-shrink: 0;
}
.statusbar span b {
  color: rgba(255, 255, 255, 0.75);
}

/* ── MINIMAP ── */
.minimap {
  position: absolute;
  bottom: 14px;
  right: 14px;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  overflow: hidden;
}

/* Theme variants */
.theme-forest {
  background: radial-gradient(ellipse at center bottom, rgba(68, 150, 92, 0.55) 0%, rgba(18, 40, 24, 0.94) 72%);
}

@media (max-width: 860px) {
  .sb-root {
    --sb-topbar-h: 56px;
  }
  .topbar {
    justify-content: flex-start;
    padding: 8px 10px;
  }
  .topbar-links {
    gap: 12px;
    overflow-x: auto;
    padding-right: 160px;
  }
  .topbar-link {
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .topbar-right {
    right: 10px;
    gap: 6px;
  }
  .topbar-user-btn {
    padding: 6px 10px;
  }
  .scene-stats-card {
    top: calc(var(--sb-topbar-h) + 8px);
    right: 10px;
    min-width: min(200px, calc(100vw - 92px));
    max-width: min(320px, calc(100vw - 20px));
    gap: 6px;
    padding: 8px 10px;
  }
  .scene-guide-banner {
    top: calc(var(--sb-topbar-h) + 8px);
    left: 164px;
    width: calc(100vw - 172px);
    max-height: 108px;
    overflow: auto;
  }
  .scene-stats-label {
    font-size: 0.68rem;
  }
  .scene-stats-value {
    font-size: 0.76rem;
  }
  .palette {
    width: 160px;
  }
}
</style>

