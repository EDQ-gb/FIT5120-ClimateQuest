<template>
  <div class="sb-root" :class="themeClass">
    <!-- TOP BAR -->
    <div class="topbar">
      <span class="brand-ico">🌍</span>
      <h1>ClimateQuest</h1>
      <span class="topbar-info">Grid 20×20 · Kenney Nature Kit</span>

      <div class="topbar-right">
        <button class="btn subtle" type="button" @click="$emit('back')">Dashboard</button>
        <button class="btn subtle" type="button" @click="openPanel('tasks')">Daily Tasks</button>
        <button class="btn subtle" type="button" @click="openPanel('quiz')">Daily Quiz</button>
        <span class="pill">🪙 {{ coins.toLocaleString() }}</span>
        <span class="pill">🔥 {{ streak }}d</span>
        <button class="btn danger" type="button" @click="$emit('logout')">Logout</button>
      </div>
    </div>

    <!-- MAIN -->
    <div class="main">
      <!-- LEFT PALETTE -->
      <div class="palette">
        <div class="mode-row">
          <div class="mode-btn" :class="{ active: mode === 'place' }" @click="setMode('place')">✏️ Place</div>
          <div class="mode-btn del" :class="{ active: mode === 'delete' }" @click="setMode('delete')">✕ Del</div>
        </div>

        <div class="palette-header">Objects · Click to Select</div>
        <div class="palette-scroll">
          <div v-for="cat in paletteCats" :key="cat.key">
            <div class="category-label">
              <div>{{ cat.label }}</div>
              <div class="category-cost">🪙 {{ kindCost(cat.key) }}</div>
            </div>
            <div class="tile-grid">
              <button
                v-for="it in cat.items"
                :key="it.id"
                class="tile-btn"
                type="button"
                :class="{ selected: selectedItemId === it.id }"
                @click="selectItem(it.id)"
              >
                <img :src="it.src" :alt="it.label" />
                <div class="tile-name">{{ it.label }}</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- CANVAS -->
      <div class="canvas-area">
        <canvas ref="gameCanvas"></canvas>
        <!-- minimap removed (too big/noisy); can be re-added later -->
        <div class="tooltip" :class="{ show: tooltip.show }" :style="tooltipStyle">{{ tooltip.text }}</div>
      </div>
    </div>

    <!-- STATUS BAR -->
    <div class="statusbar">
      <span>Mode: <b>{{ modeLabel }}</b></span>
      <span>Selected: <b>{{ selectedLabel }}</b></span>
      <span>Objects: <b>{{ objectCount }}</b></span>
      <span>Grid: <b>{{ gridPosLabel }}</b></span>
    </div>

    <div v-if="panelOpen" class="panel-overlay" @click.self="closePanel">
      <div class="panel">
        <div class="panel-top">
          <div class="panel-title">{{ panelTitle }}</div>
          <button class="btn" type="button" @click="closePanel">Close</button>
        </div>
        <div class="panel-body">
          <AppTasks v-if="activePanel === 'tasks'" :user="user" @coins-updated="onActivityUpdated" />
          <AppQuiz v-else-if="activePanel === 'quiz'" :user="user" @coins-updated="onActivityUpdated" />
          <div v-else class="panel-empty">Coming soon.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { getTheme, getItemById, getItemByIdAnyTheme } from '../../game/assets/catalog.js'
import { createSceneBuilderCore } from '../../game/iso/sceneBuilderCore.js'
import AppTasks from '../AppTasks.vue'
import AppQuiz from '../AppQuiz.vue'

const props = defineProps({
  user: { type: Object, default: null },
  themeType: { type: String, default: 'forest' },
  coins: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  placements: { type: Object, default: null }, // { items: [...] }
})

const emit = defineEmits(['back', 'reset', 'logout', 'place', 'move', 'remove', 'refresh', 'activity'])

const gameCanvas = ref(null)
const minimapCanvas = ref(null)
let core = null

const mode = ref('place') // place|delete
const selectedItemId = ref('')
const gridPos = reactive({ col: null, row: null })

const tooltip = reactive({ show: false, x: 0, y: 0, text: '' })
const tooltipStyle = computed(() => ({ left: `${tooltip.x}px`, top: `${tooltip.y}px` }))

const theme = computed(() => getTheme(props.themeType))

const paletteCats = computed(() => {
  const items = theme.value.items || []
  const groups = [
    { key: 'tree', label: '🌳 Trees' },
    { key: 'ground', label: '🌿 Ground' },
    { key: 'flower', label: '🌸 Flora' },
    { key: 'ice', label: '🧊 Ice' },
    { key: 'decor', label: '✨ Decor' },
  ]
  return groups
    .map((g) => ({ ...g, items: items.filter((x) => x.kind === g.key) }))
    .filter((g) => g.items.length > 0)
})

function kindCost(kind) {
  if (kind === 'tree') return 40
  if (kind === 'ground') return 8
  if (kind === 'flower') return 12
  if (kind === 'ice') return 35
  if (kind === 'decor') return 15
  return 0
}

function setMode(m) {
  mode.value = m
}

function selectItem(id) {
  selectedItemId.value = id
}

const selectedLabel = computed(() => {
  const it = selectedItemId.value ? getItemById(props.themeType, selectedItemId.value) : null
  return it?.id ? it.id : 'none'
})
const modeLabel = computed(() => (mode.value === 'delete' ? 'Delete' : mode.value === 'move' ? 'Move' : 'Place'))

const objectCount = computed(() => (Array.isArray(props.placements?.items) ? props.placements.items.length : 0))
const gridPosLabel = computed(() => (gridPos.col == null ? '-' : `${gridPos.col},${gridPos.row}`))

const themeClass = computed(() => `theme-${props.themeType}`)

const panelOpen = ref(false)
const activePanel = ref('tasks') // tasks|quiz
const panelTitle = computed(() => (activePanel.value === 'quiz' ? 'Daily Quiz' : 'Daily Tasks'))

function openPanel(key) {
  activePanel.value = key
  panelOpen.value = true
}
function closePanel() {
  panelOpen.value = false
}
async function onActivityUpdated(payload) {
  // Optimistic UI update (coins/streak) + authoritative refresh (coins/placements/decay).
  emit('activity', payload || null)
  emit('refresh')
}

// For now, the visual shell is wired; the isometric draw/interaction core will be implemented in the next todo.
function resizeCanvas() {
  // sizing is handled by the core (using DOM bounding box)
}

onMounted(async () => {
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
    getPlacements: () => props.placements || { items: [] },
    setGridPos: (col, row) => {
      gridPos.col = col
      gridPos.row = row
    },
    setTooltip: ({ show, x, y, text }) => {
      tooltip.show = !!show
      tooltip.x = x || 0
      tooltip.y = y || 0
      tooltip.text = text || ''
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
</script>

<style scoped>
* {
  box-sizing: border-box;
}
.sb-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e8f5ee;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: #0f1a12;
}

/* ── TOP BAR ── */
.topbar {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  z-index: 100;
}
.topbar h1 {
  font-size: 1.1rem;
  font-weight: 800;
  color: #52d496;
  letter-spacing: -0.5px;
}
.brand-ico {
  font-size: 1.05rem;
}
.topbar-info {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.45);
}
.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.pill {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.78rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}
.btn {
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn.subtle {
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.88);
}
.btn:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.4);
}
.btn.danger {
  background: rgba(224, 82, 82, 0.15);
  border-color: rgba(224, 82, 82, 0.4);
  color: #f09090;
}
.btn.danger:hover {
  background: rgba(224, 82, 82, 0.3);
}

/* ── MAIN LAYOUT ── */
.main {
  display: flex;
  flex: 1;
  overflow: hidden;
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
  background: radial-gradient(ellipse at center bottom, rgba(34, 80, 34, 0.8) 0%, rgba(10, 25, 10, 0.95) 70%);
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

/* ── TOOLTIP ── */
.tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 1000;
  display: none;
}
.tooltip.show {
  display: block;
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

.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  z-index: 2000;
}
.panel {
  width: min(980px, calc(100vw - 28px));
  height: min(78vh, 720px);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.14);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.panel-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.panel-title {
  color: #fff;
  font-weight: 800;
}
.panel-body {
  padding: 14px;
  overflow: auto;
  flex: 1;
}
.panel-empty {
  color: rgba(255, 255, 255, 0.7);
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
  background: radial-gradient(ellipse at center bottom, rgba(14, 48, 20, 0.85) 0%, rgba(7, 16, 9, 0.98) 70%);
}
.theme-glacier {
  background: radial-gradient(ellipse at center bottom, rgba(16, 52, 70, 0.85) 0%, rgba(6, 12, 20, 0.98) 70%);
}
.theme-cityGreen {
  background: radial-gradient(ellipse at center bottom, rgba(14, 44, 30, 0.85) 0%, rgba(6, 12, 10, 0.98) 70%);
}

.theme-forest .topbar h1 {
  color: #52d496;
}
.theme-glacier .topbar h1 {
  color: #7fe9ff;
}
.theme-cityGreen .topbar h1 {
  color: #7cff7c;
}

.theme-glacier .palette {
  background: rgba(0, 0, 0, 0.42);
  border-right-color: rgba(180, 240, 255, 0.14);
}
.theme-glacier .mode-btn.active {
  border-color: rgba(127, 233, 255, 0.9);
  color: rgba(127, 233, 255, 0.95);
  background: rgba(127, 233, 255, 0.14);
}

@media (max-width: 860px) {
  .palette {
    width: 160px;
  }
  .topbar-info {
    display: none;
  }
}
</style>

