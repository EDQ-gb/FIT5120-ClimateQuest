<template>
  <div class="sv-root">
    <div class="sv-topbar">
      <button type="button" class="sv-back" @click="$emit('back')" aria-label="Back">←</button>
      <div class="sv-title">
        <div class="sv-name">{{ viewerName }}</div>
        <div class="sv-sub">{{ errorMsg ? errorMsg : 'Community' }}</div>
      </div>
      <div class="sv-actions">
        <button type="button" class="sv-pill" @click="$emit('toggle-like')" :class="{ active: likedByMe }" aria-label="Like">
          <span class="sv-pill-ico">♥</span>
          <span>{{ likeCount }}</span>
        </button>
        <button type="button" class="sv-pill" @click="commentsOpen = !commentsOpen" aria-label="Comments">
          <span class="sv-pill-ico">💬</span>
          <span>{{ comments.length }}</span>
        </button>
      </div>
    </div>

    <div class="sv-level">
      <div class="sv-level-pill">
        <span class="sv-level-label">Lv {{ level }}</span>
        <span class="sv-level-bar"><i :style="{ width: progressPct + '%' }"></i></span>
        <span class="sv-level-meta">{{ treesPlaced % 5 }}/5</span>
      </div>
    </div>

    <div class="sv-canvas-wrap">
      <canvas ref="gameCanvas" class="sv-canvas" aria-label="Community scene" role="img"></canvas>
    </div>

    <transition name="sv-fade">
      <div v-if="commentsOpen" class="sv-comments" role="dialog" aria-modal="true">
        <div class="sv-comments-top">
          <div class="sv-comments-title">Messages</div>
          <button type="button" class="sv-close" @click="commentsOpen = false" aria-label="Close">×</button>
        </div>
        <div class="sv-comments-list">
          <div v-if="comments.length === 0" class="sv-empty">No messages yet. Be the first to say hi.</div>
          <div v-for="c in comments" :key="c.id" class="sv-comment">
            <div class="sv-comment-meta">
              <span class="sv-comment-author">{{ c.authorDisplayName || c.authorUsername || 'Player' }}</span>
              <span class="sv-comment-time">{{ formatTime(c.createdAt) }}</span>
            </div>
            <div class="sv-comment-body">{{ c.body }}</div>
          </div>
        </div>
        <form class="sv-compose" @submit.prevent="submitComment">
          <input v-model="draft" class="sv-input" maxlength="280" placeholder="Leave a friendly message…" />
          <button type="submit" class="sv-send" :disabled="!canSend">Send</button>
        </form>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { createSceneBuilderCore } from '../../game/iso/sceneBuilderCore.js'
import { getItemById, getItemByIdAnyTheme, getTheme } from '../../game/assets/catalog.js'

const props = defineProps({
  themeType: { type: String, default: 'forest' },
  viewerUser: { type: Object, default: null }, // { username, displayName }
  placements: { type: Object, default: null }, // { items: [...] }
  likeCount: { type: Number, default: 0 },
  likedByMe: { type: Boolean, default: false },
  comments: { type: Array, default: () => [] },
  errorMsg: { type: String, default: '' },
})

const emit = defineEmits(['back', 'toggle-like', 'send-comment'])

const gameCanvas = ref(null)
let core = null

const commentsOpen = ref(false)
const draft = ref('')

const placementItems = computed(() => (Array.isArray(props.placements?.items) ? props.placements.items : []))
const treesPlaced = computed(() => placementItems.value.filter((x) => String(x?.type || '') === 'tree').length)
const level = computed(() => Math.max(1, 1 + Math.floor(treesPlaced.value / 5)))
const progressPct = computed(() => Math.max(0, Math.min(100, Math.round(((treesPlaced.value % 5) / 5) * 100))))

const viewerName = computed(() => props.viewerUser?.displayName || props.viewerUser?.username || 'Community')
const canSend = computed(() => draft.value.trim().length > 0)

function formatTime(iso) {
  const t = Date.parse(String(iso || ''))
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function submitComment() {
  const body = draft.value.trim()
  if (!body) return
  emit('send-comment', { body })
  draft.value = ''
}

function getPlacements() {
  return props.placements || { items: [] }
}

onMounted(async () => {
  await nextTick()
  const canvas = gameCanvas.value
  if (!canvas) return
  core = createSceneBuilderCore({
    canvas,
    gridSize: 26,
    themeBg: getTheme(props.themeType)?.background || props.themeType,
    // Read-only view: always idle.
    getMode: () => 'idle',
    getSelectedItem: () => '',
    getItemDefById: (id) => getItemById(props.themeType, id) || getItemByIdAnyTheme(id),
    getPlacements,
    onPlace: null,
    onRemove: null,
    onMove: null,
    setGridPos: null,
    getDefaultGroundItemId: () => null,
    getPreloadSrcs: () => (getTheme(props.themeType)?.items || []).map((x) => x?.src).filter(Boolean),
  })
  core?.start?.()
})

onUnmounted(() => {
  try {
    core?.stop?.()
  } catch {
    // ignore
  }
  core = null
})

watch(
  () => props.themeType,
  (t) => {
    try {
      core?.setThemeBg?.(t)
    } catch {
      // ignore
    }
  }
)
</script>

<style scoped>
.sv-root {
  position: fixed;
  inset: 0;
  background: transparent;
}

.sv-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 54px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  z-index: 80;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(12, 18, 16, 0.38);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.sv-back {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.sv-title {
  display: grid;
  line-height: 1.05;
}
.sv-name {
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.95);
}
.sv-sub {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.6);
}

.sv-actions {
  margin-left: auto;
  display: flex;
  gap: 10px;
}

.sv-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-weight: 800;
}
.sv-pill.active {
  border-color: rgba(255, 120, 160, 0.28);
  background: rgba(255, 120, 160, 0.12);
}
.sv-pill-ico {
  font-size: 0.95rem;
  transform: translateY(-0.5px);
}

.sv-level {
  position: fixed;
  top: 62px;
  left: 14px;
  z-index: 70;
}

.sv-level-pill {
  width: 220px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(12, 18, 16, 0.34);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.sv-level-label,
.sv-level-meta {
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
  font-weight: 900;
  color: rgba(205, 252, 255, 0.95);
  font-size: 0.74rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.sv-level-meta {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.68rem;
}
.sv-level-bar {
  flex: 1;
  height: 7px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(0, 242, 255, 0.18);
  background: rgba(0, 242, 255, 0.08);
}
.sv-level-bar i {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(0, 242, 255, 0.28), rgba(0, 242, 255, 0.9));
}

.sv-canvas-wrap {
  position: fixed;
  inset: 0;
  top: 54px;
  left: 0;
  right: 0;
  bottom: 0;
  padding-top: 0;
}
.sv-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.sv-comments {
  position: fixed;
  right: 14px;
  bottom: 14px;
  width: min(380px, calc(100vw - 28px));
  max-height: min(62vh, 520px);
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(12, 18, 16, 0.52);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  z-index: 85;
}

.sv-comments-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}
.sv-comments-title {
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(205, 252, 255, 0.95);
}
.sv-close {
  width: 34px;
  height: 34px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  cursor: pointer;
}

.sv-comments-list {
  padding: 12px 14px;
  overflow: auto;
  display: grid;
  gap: 10px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.76rem;
  line-height: 1.45;
}
.sv-empty {
  color: rgba(255, 255, 255, 0.6);
}
.sv-comment {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  padding: 10px 10px;
}
.sv-comment-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.sv-comment-author {
  font-family: 'Fredoka', 'Nunito', system-ui, sans-serif;
  font-weight: 900;
  color: rgba(148, 240, 200, 0.98);
}
.sv-comment-time {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
}
.sv-comment-body {
  white-space: pre-wrap;
  word-break: break-word;
}

.sv-compose {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}
.sv-input {
  flex: 1;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  padding: 0 12px;
  outline: none;
}
.sv-send {
  height: 40px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(0, 242, 255, 0.22);
  background: rgba(0, 242, 255, 0.12);
  color: rgba(205, 252, 255, 0.95);
  font-weight: 900;
  cursor: pointer;
}
.sv-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sv-fade-enter-active,
.sv-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.sv-fade-enter-from,
.sv-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

