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
      <div class="scene-stats-row">
        <span class="scene-stats-label">🪙 Climate Coins</span>
        <b class="scene-stats-value">{{ coins.toLocaleString() }}</b>
      </div>
      <div class="scene-stats-row">
        <span class="scene-stats-label">🔥 Hot streak</span>
        <b class="scene-stats-value">{{ streak }} d</b>
      </div>
      <div class="scene-stats-row">
        <span class="scene-stats-label">🗺️ On your map</span>
        <b class="scene-stats-value">{{ objectCount }}</b>
      </div>
      <div class="scene-stats-row">
        <span class="scene-stats-label">🌳 Trees affordable</span>
        <b class="scene-stats-value">{{ affordableTreeCount }}</b>
      </div>
      <div class="scene-stats-chips">
        <span class="scene-chip">🌱 Live</span>
        <span class="scene-chip">⏱️ Synced</span>
      </div>
      <div v-if="decayReminder" class="scene-hint scene-hint--decay">{{ decayReminder }}</div>
      <div v-if="lowCoinsReminder" class="scene-hint scene-hint--coins">{{ lowCoinsReminder }}</div>
      <button
        v-if="!showSceneGuide"
        type="button"
        class="scene-guide-banner__dismiss scene-guide-banner__dismiss--ghost"
        @click="reopenSceneGuide"
      >
        Show tips again
      </button>
    </aside>

    <!-- MAIN -->
    <div class="main">
      <div v-if="showSceneGuide" class="scene-guide-banner" role="region" aria-label="Quick tips">
        <div class="scene-guide-banner__body">
          <div class="scene-guide-banner__title">Your rainforest toolkit</div>
          <ol class="scene-guide-banner__steps">
            <li>Stay on <strong>Place</strong>, tap a buddy in the left drawer, then <strong>tap the ground</strong> where you want them.</li>
            <li>Fancy a new tree? Price tags sit on each row — short on coins? Quest through <strong>Tasks</strong> or <strong>Quiz</strong> up top.</li>
            <li>Switch to <strong>Del</strong> and boop a tile to clear what is sitting on top there.</li>
            <li><strong>Scroll</strong> to zoom in tight or out wide; <strong>right-drag</strong> scoots the whole world.</li>
          </ol>
        </div>
        <button type="button" class="scene-guide-banner__dismiss" @click="dismissSceneGuide">Cool, hide this</button>
      </div>

      <div class="main-inner">
      <!-- LEFT PALETTE -->
      <div class="palette">
        <div class="mode-row">
          <div class="mode-btn" :class="{ active: mode === 'place' }" @click="setMode('place')">Plant</div>
          <div class="mode-btn del" :class="{ active: mode === 'delete' }" @click="setMode('delete')">Remove</div>
        </div>
        <div class="palette-mini-hint">
          Glide over the map — green glow means “this spot is yours.” Tap to plant or tidy up.
        </div>

        <div class="palette-header">Loot · pick your piece</div>
        <div class="palette-scroll">
          <div v-for="cat in paletteCats" :key="cat.key">
            <div class="category-label">
              <div>{{ cat.label }}</div>
              <div class="category-cost">{{ kindCost(cat.key) }} coins</div>
            </div>
            <div class="tile-grid">
              <button
                v-for="it in cat.items"
                :key="it.id"
                class="tile-btn"
                type="button"
                :class="{ selected: selectedItemId === it.id }"
                :aria-label="it.label"
                @click="selectItem(it.id)"
              >
                <img :src="it.src" alt="" decoding="async" draggable="false" />
                <div class="tile-name">{{ it.label }}</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- CANVAS -->
      <div class="canvas-area">
        <canvas
          ref="gameCanvas"
          class="cq-scene-canvas"
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

function sceneGuideKeyForUser(username) {
  const u = String(username || '').trim().toLowerCase() || 'guest'
  return `cq_hideSceneTips:${u}`
}

const gameCanvas = ref(null)
const minimapCanvas = ref(null)
let core = null

const showSceneGuide = ref(true)

function readSceneGuidePref() {
  try {
    const k = sceneGuideKeyForUser(props.user?.username)
    showSceneGuide.value = localStorage.getItem(k) !== '1'
  } catch (_) {
    showSceneGuide.value = true
  }
}

function dismissSceneGuide() {
  showSceneGuide.value = false
  try {
    const k = sceneGuideKeyForUser(props.user?.username)
    localStorage.setItem(k, '1')
  } catch (_) {
    // ignore quota / privacy mode
  }
}

function reopenSceneGuide() {
  showSceneGuide.value = true
  try {
    const k = sceneGuideKeyForUser(props.user?.username)
    localStorage.removeItem(k)
  } catch (_) {
    // ignore quota / privacy mode
  }
}

const mode = ref('place') // place|delete
const selectedItemId = ref('')
const gridPos = reactive({ col: null, row: null })

const theme = computed(() => getTheme(props.themeType))

const paletteCats = computed(() => {
  const items = theme.value.items || []
  const groups = [
    { key: 'tree', label: 'Trees' },
    { key: 'flower', label: 'Flowers' },
    { key: 'decor', label: 'Decor & critters' },
  ]
  return groups
    .map((g) => ({ ...g, items: items.filter((x) => x.kind === g.key) }))
    .filter((g) => g.items.length > 0)
})

const TREE_PRICE = TREE_COINS_COST

function kindCost(kind) {
  if (kind === 'tree') return TREE_PRICE
  if (kind === 'flower') return 12
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
    return 'Heads-up: go three days without playing (tasks or quiz) and nature might nibble your scene — up to a few trees could vanish on the first shake-up. Pop in today to keep the canopy happy.'
  }
  const last = new Date(raw).getTime()
  if (!Number.isFinite(last)) return ''
  const hoursIdle = Math.max(0, (Date.now() - last) / (3600 * 1000))
  if (hoursIdle >= IDLE_HOURS_BEFORE_DECAY) {
    return 'It has been a quiet while! Your jungle might be slimming down — say hi with a Task or Quiz round to wake things up again.'
  }
  const hoursLeft = IDLE_HOURS_BEFORE_DECAY - hoursIdle
  const rough = formatRoughDaysEn(hoursLeft)
  if (!rough) return ''
  return `Roughly ${rough} before that “three sleepy days” timer — after that, storms can roll in and trim a few trees once. Quick Task or Quiz keeps the sunshine on your map.`
})

const lowCoinsReminder = computed(() => {
  if (props.coins >= TREE_PRICE) return ''
  return `Trees need ${TREE_PRICE} coins each right now. Go bag more from Tasks or Quiz, then come back and flex that wallet.`
})

const affordableTreeCount = computed(() => {
  const coins = Number(props.coins || 0)
  if (coins <= 0) return 0
  return Math.floor(coins / TREE_PRICE)
})

function setMode(m) {
  mode.value = m
}

function selectItem(id) {
  selectedItemId.value = id
}

const selectedLabel = computed(() => {
  const it = selectedItemId.value ? getItemById(props.themeType, selectedItemId.value) : null
  return it?.label || it?.id || '— pick one!'
})
const modeLabel = computed(() => (mode.value === 'delete' ? 'Remove' : mode.value === 'move' ? 'Move' : 'Plant'))

const objectCount = computed(() => (Array.isArray(props.placements?.items) ? props.placements.items.length : 0))
const gridPosLabel = computed(() => (gridPos.col == null ? '-' : `${gridPos.col},${gridPos.row}`))

const themeClass = computed(() => `theme-${props.themeType}`)

// For now, the visual shell is wired; the isometric draw/interaction core will be implemented in the next todo.
function resizeCanvas() {
  // sizing is handled by the core (using DOM bounding box)
}

onMounted(async () => {
  readSceneGuidePref()
  if (!selectedItemId.value) {
    const first = theme.value.items?.[0]
    if (first?.id) selectedItemId.value = first.id
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
    getPreloadSrcs: () => (theme.value.items || []).map((x) => x.src).filter(Boolean),
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
})

watch(() => [props.themeType], () => {
  const first = theme.value.items?.[0]
  if (first?.id) selectedItemId.value = first.id
  core?.setThemeBg?.(theme.value.background || 'forest')
  // Layout often changes on view switch; ensure canvas recomputes immediately.
  core?.forceResize?.()
})

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
    readSceneGuidePref()
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
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  top: calc(var(--sb-topbar-h) + 10px);
  right: 14px;
  z-index: 95;
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
}
.scene-stats-value {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.95);
}
.scene-hint {
  grid-column: 1 / -1;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.78);
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
.scene-guide-banner {
  position: absolute;
  top: calc(var(--sb-topbar-h) + 10px);
  left: 212px;
  right: auto;
  width: min(760px, calc(100vw - 560px));
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 14px;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid rgba(82, 212, 150, 0.35);
  background: rgba(8, 22, 16, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
.scene-guide-banner__title {
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(148, 240, 200, 0.98);
  margin-bottom: 6px;
}
.scene-guide-banner__steps {
  margin: 0;
  padding-left: 18px;
  font-size: 0.72rem;
  line-height: 1.48;
  color: rgba(255, 255, 255, 0.82);
  max-width: 100%;
}
.scene-guide-banner__steps li {
  margin-bottom: 4px;
}
.scene-guide-banner__steps strong {
  color: #7fe8bc;
  font-weight: 700;
}
.scene-guide-banner__dismiss {
  flex-shrink: 0;
  align-self: center;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(82, 212, 150, 0.12);
  color: rgba(200, 255, 224, 0.95);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.18s ease;
  pointer-events: auto;
}
.scene-guide-banner__dismiss:hover {
  background: rgba(82, 212, 150, 0.22);
}
.scene-guide-banner__dismiss--ghost {
  width: 100%;
  margin-top: 4px;
  background: rgba(0, 242, 255, 0.12);
  border-color: rgba(0, 242, 255, 0.32);
  color: rgba(205, 252, 255, 0.95);
}
.scene-guide-banner__dismiss--ghost:hover {
  background: rgba(0, 242, 255, 0.2);
}

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
  width: 200px;
  background: rgba(0, 0, 0, 0.45);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
.palette-header {
  padding: 10px 12px 6px;
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
.tile-btn img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
.tile-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(82, 212, 150, 0.4);
  transform: scale(1.05);
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
  background: rgba(0, 0, 0, 0.65);
  text-align: center;
  padding: 1px;
  opacity: 0;
  transition: opacity 0.2s;
}
.tile-btn:hover .tile-name {
  opacity: 1;
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
canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
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

