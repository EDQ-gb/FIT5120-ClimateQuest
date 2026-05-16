<template>
  <div class="page">
    <div class="row-between mb20">
      <h3 class="page-h3">Top Eco-Champions</h3>
      <span class="sub-text">Ranked by trees planted</span>
    </div>

    <div v-if="user && user.profilePublic === false" class="privacy-banner">
      Your profile is private, so you are not shown on this leaderboard. Turn visibility on from the account menu to
      participate publicly.
    </div>

    <div v-if="loading" class="center-pad">
      <div class="spin"></div>
    </div>

    <div v-else-if="board.length === 0" class="glass-card center-pad">
      <div style="font-size:2.2rem;margin-bottom:12px;">🌱</div>
      <div class="fw7 white">Be the first on the board!</div>
      <div class="sub-text mt8">Plant trees in My Scene to climb the board. The number on each row is your tree count — the same value used for ranking.<br>If it stays quiet, double-check your connection — the scoreboard loves good Wi-Fi.</div>
    </div>

    <template v-else>
      <div class="lb-list">
        <div
          v-for="u in pagedBoard"
          :key="u.rank"
          class="lb-row"
          :class="{ you: u.isYou }"
        >
          <div class="lb-rank" :class="'r' + u.rank">
            <span v-if="u.rank === 1">🥇</span>
            <span v-else-if="u.rank === 2">🥈</span>
            <span v-else-if="u.rank === 3">🥉</span>
            <span v-else>#{{ u.rank }}</span>
          </div>
          <div class="lb-avatar" :style="{ background: avatarBg(u.username) }">
            {{ (u.displayName || u.username || '?').slice(0, 2).toUpperCase() }}
          </div>
          <div class="lb-name">
            <span class="lb-name-text">{{ u.displayName || u.username }}</span>
            <span v-if="u.isYou" class="you-tag">You</span>
            <div class="lb-honors" aria-label="Honors and badges">
              <template v-if="u.honors?.coinKing">
                <span
                  class="lb-honor-chip lb-honor-chip--meta"
                  :class="'chip-' + u.honors.coinKing.badgeClass"
                >
                  <span class="lb-badge-dot" :class="u.honors.coinKing.badgeClass" aria-hidden="true"></span>
                  <span class="lb-honor-text">{{ u.honors.coinKing.title }}</span>
                </span>
              </template>
              <template v-if="u.honors?.levelKing">
                <span
                  class="lb-honor-chip lb-honor-chip--meta"
                  :class="'chip-' + u.honors.levelKing.badgeClass"
                >
                  <span class="lb-badge-dot" :class="u.honors.levelKing.badgeClass" aria-hidden="true"></span>
                  <span class="lb-honor-text">{{ u.honors.levelKing.title }}</span>
                </span>
              </template>
              <template v-if="u.honors?.activityStreakKing">
                <span
                  class="lb-honor-chip lb-honor-chip--meta"
                  :class="'chip-' + u.honors.activityStreakKing.badgeClass"
                >
                  <span class="lb-badge-dot" :class="u.honors.activityStreakKing.badgeClass" aria-hidden="true"></span>
                  <span class="lb-honor-text">{{ u.honors.activityStreakKing.title }}</span>
                </span>
              </template>
              <template v-if="u.honors?.streak">
                <span class="lb-honor-chip lb-honor-chip--task">
                  <span class="lb-badge-dot" :class="u.honors.streak.badgeClass" aria-hidden="true"></span>
                  <span class="lb-honor-text">{{ u.honors.streak.title }}</span>
                </span>
              </template>
              <template v-if="u.honors?.decoration">
                <span class="lb-honor-chip lb-honor-chip--task">
                  <span class="lb-badge-dot" :class="u.honors.decoration.badgeClass" aria-hidden="true"></span>
                  <span class="lb-honor-text">{{ u.honors.decoration.title }}</span>
                </span>
              </template>
            </div>
          </div>
          <span class="badge" style="font-size:.7rem;">Lv {{ u.level || 1 }}</span>
          <span class="cyan text-sm" style="min-width:58px;text-align:right;">🔥 {{ u.streak || 0 }}d</span>
          <span class="fw7 text-sm lb-tree-col" title="Trees planted in My Scene">🌳 {{ (u.trees || 0).toLocaleString() }}</span>
        </div>
      </div>

      <div class="lb-pagination">
        <button type="button" class="page-btn" :disabled="page <= 1" @click="prevPage">Previous</button>
        <span class="sub-text">Page {{ page }} / {{ totalPages }}</span>
        <button type="button" class="page-btn" :disabled="page >= totalPages" @click="nextPage">Next</button>
      </div>
    </template>

    <div class="info-card mt20">
      <div class="info-title gold">🏆 How to climb the board</div>
      <p class="sub-text">
        The list is ordered by <strong>trees planted</strong> in My Scene. The number on the right is that same tree
        count. Ties are broken on the server using coins, then other stored stats. Badges below appear next to names for
        everyone on this list. Only public profiles are ranked here.
      </p>

      <div class="legend-divider" />

      <div class="info-title gold legend-subtitle">✨ Badges &amp; titles</div>
      <p class="sub-text legend-lead">
        English titles; ties share the same badge. Rows are ranked by <strong>trees</strong>. <strong>Activity
        streak</strong> is the 🔥 day count (tasks, quiz, or check-in each day).
      </p>

      <div class="legend-section-label">Leaderboard supremacy</div>
      <ul class="legend-list">
        <li v-for="row in legendSupremacy" :key="row.title" class="legend-item">
          <span class="lb-badge-dot legend-dot" :class="row.badgeClass" aria-hidden="true"></span>
          <div class="legend-copy">
            <span class="legend-name">{{ row.title }}</span>
            <span class="legend-rule">{{ row.rule }}</span>
          </div>
        </li>
      </ul>

      <div class="legend-section-label">Task commitment streak</div>
      <ul class="legend-list">
        <li v-for="row in legendTaskStreak" :key="row.title" class="legend-item">
          <span class="lb-badge-dot legend-dot" :class="row.badgeClass" aria-hidden="true"></span>
          <div class="legend-copy">
            <span class="legend-name">{{ row.title }}</span>
            <span class="legend-rule">{{ row.rule }}</span>
          </div>
        </li>
      </ul>

      <div class="legend-section-label">Scene mastery</div>
      <ul class="legend-list">
        <li v-for="row in legendScene" :key="row.title" class="legend-item">
          <span class="lb-badge-dot legend-dot" :class="row.badgeClass" aria-hidden="true"></span>
          <div class="legend-copy">
            <span class="legend-name">{{ row.title }}</span>
            <span class="legend-rule">{{ row.rule }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getLeaderboard } from '../api/features.js'

const props = defineProps({
  user: { type: Object, default: null },
})

/** Keep in sync with server/src/index.js LEADERBOARD_* constants. */
const legendSupremacy = [
  {
    badgeClass: 'meta-coins',
    title: 'Treasury Titan',
    rule: 'Most coins among all users shown on this leaderboard.',
  },
  {
    badgeClass: 'meta-level',
    title: 'Summit Sentinel',
    rule: 'Highest scene level (Lv) on the board — earned from trees placed in your scene. Awarded only when the top level is 2 or higher.',
  },
  {
    badgeClass: 'meta-streak',
    title: 'Unbroken Flame',
    rule: 'Longest activity streak (🔥) on the board — consecutive days with at least one task, quiz, or check-in.',
  },
]

const legendTaskStreak = [
  {
    badgeClass: 'streak-t1',
    title: 'Daily Spark',
    rule: '3+ consecutive calendar days with at least one task completed.',
  },
  {
    badgeClass: 'streak-t2',
    title: 'Week Warrior',
    rule: '7+ consecutive task days.',
  },
  {
    badgeClass: 'streak-t3',
    title: 'Monthly Marathoner',
    rule: '30+ consecutive task days.',
  },
  {
    badgeClass: 'streak-t4',
    title: 'Evergreen Legend',
    rule: '365+ consecutive task days.',
  },
]

const legendScene = [
  {
    badgeClass: 'decor-tree',
    title: 'Canopy Champion',
    rule: 'Most tree placements among everyone on this leaderboard.',
  },
  {
    badgeClass: 'decor-flower',
    title: 'Bloom Sovereign',
    rule: 'Most flower placements on this leaderboard.',
  },
  {
    badgeClass: 'decor-ground',
    title: 'Groundwork Guru',
    rule: 'Most ground / path tiles on this leaderboard.',
  },
  {
    badgeClass: 'decor-decor',
    title: 'Curator Supreme',
    rule: 'Most décor pieces on this leaderboard.',
  },
]

const board = ref([])
const loading = ref(true)
const page = ref(1)
const pageSize = 10

const totalPages = computed(() => Math.max(1, Math.ceil(board.value.length / pageSize)))
const pagedBoard = computed(() => {
  const start = (page.value - 1) * pageSize
  return board.value.slice(start, start + pageSize)
})

function avatarBg(username) {
  const s = username || 'user'
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return `hsla(${h},70%,42%,0.9)`
}

function prevPage() {
  if (page.value > 1) page.value -= 1
}

function nextPage() {
  if (page.value < totalPages.value) page.value += 1
}

watch(board, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
  if (page.value < 1) page.value = 1
})

function jumpToCurrentUserPage() {
  const meIdx = board.value.findIndex((u) => !!u?.isYou)
  if (meIdx < 0) {
    page.value = 1
    return
  }
  page.value = Math.floor(meIdx / pageSize) + 1
}

onMounted(async () => {
  loading.value = true
  try {
    board.value = (await getLeaderboard()) || []
    jumpToCurrentUserPage()
  } catch {
    board.value = []
    page.value = 1
  } finally {
    loading.value = false
  }
})

watch(
  () => props.user?.id || props.user?.username || null,
  async () => {
    loading.value = true
    try {
      board.value = (await getLeaderboard()) || []
      jumpToCurrentUserPage()
    } catch {
      board.value = []
      page.value = 1
    } finally {
      loading.value = false
    }
  }
)
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.page-h3 {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.mb20 {
  margin-bottom: 20px;
}

.privacy-banner {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(0, 242, 255, 0.08);
  border: 1px solid rgba(0, 242, 255, 0.22);
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.45;
}

.mt8 {
  margin-top: 8px;
}

.mt20 {
  margin-top: 20px;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sub-text {
  font-size: .8rem;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.5;
}

.fw7 {
  font-weight: 700;
}

.white {
  color: #fff;
}

.cyan {
  color: #00f2ff;
}

.gold {
  color: #f4c430;
}

.text-sm {
  font-size: .88rem;
}

.lb-tree-col {
  min-width: 72px;
  text-align: right;
  flex-shrink: 0;
  color: #6ee7b7;
}

.glass-card {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 20px;
}

.badge {
  font-size: .68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.lb-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: border-color .2s;
}


.lb-list {
  display: grid;
  gap: 10px;
  max-height: min(56vh, 520px);
  overflow-y: auto;
  padding-right: 4px;
}

.lb-list::-webkit-scrollbar {
  width: 6px;
}

.lb-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
}

.lb-row.you {
  border-color: #00f2ff;
  background: rgba(0, 242, 255, 0.05);
}

.lb-rank {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: .88rem;
  background: rgba(255, 255, 255, 0.06);
}

.lb-rank.r1 {
  background: rgba(244, 196, 48, 0.18);
  color: #f4c430;
}

.lb-rank.r2 {
  background: rgba(180, 180, 200, 0.18);
  color: #bbbbd4;
}

.lb-rank.r3 {
  background: rgba(200, 120, 40, 0.18);
  color: #e08840;
}

.lb-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .78rem;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.lb-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: min(42vw, 240px);
}

.lb-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: .92rem;
  color: #fff;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.lb-honors {
  flex: 1 1 160px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  flex-wrap: wrap;
}

.lb-honor-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.lb-honor-chip--meta {
  padding: 4px 11px 4px 9px;
  border-radius: 999px;
  background: rgba(6, 10, 16, 0.72);
  backdrop-filter: blur(8px);
}

.lb-honor-chip--meta.chip-meta-coins {
  border: 1px solid rgba(255, 215, 120, 0.5);
  box-shadow:
    0 0 22px rgba(255, 190, 60, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.lb-honor-chip--meta.chip-meta-level {
  border: 1px solid rgba(52, 211, 153, 0.48);
  box-shadow:
    0 0 22px rgba(16, 185, 129, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.lb-honor-chip--meta.chip-meta-streak {
  border: 1px solid rgba(251, 146, 60, 0.52);
  box-shadow:
    0 0 22px rgba(249, 115, 22, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.lb-honor-chip--meta .lb-honor-text {
  font-size: .73rem;
  letter-spacing: 0.04em;
  text-shadow: 0 0 14px rgba(255, 230, 160, 0.35);
}

.lb-honor-chip--meta.chip-meta-level .lb-honor-text {
  text-shadow: 0 0 14px rgba(110, 231, 183, 0.35);
}

.lb-honor-chip--meta.chip-meta-streak .lb-honor-text {
  text-shadow: 0 0 14px rgba(253, 186, 116, 0.4);
}

.lb-honor-chip--task {
  padding: 3px 10px 3px 8px;
  border-radius: 999px;
  background: rgba(0, 242, 255, 0.06);
  border: 1px solid rgba(0, 242, 255, 0.2);
  box-shadow: 0 0 14px rgba(0, 242, 255, 0.08);
}

.lb-honor-text {
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.88);
  text-transform: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lb-badge-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px rgba(0, 242, 255, 0.35);
}

.lb-badge-dot.streak-t1 {
  background: linear-gradient(145deg, #00c8cc, #007a7d);
  box-shadow: 0 0 10px rgba(0, 242, 255, 0.45);
}

.lb-badge-dot.streak-t2 {
  background: linear-gradient(145deg, #00f2ff, #0099aa);
  animation: honorPulse 2.2s ease-in-out infinite;
}

.lb-badge-dot.streak-t3 {
  background: linear-gradient(145deg, #ffd700, #ff8c00);
  box-shadow: 0 0 14px rgba(255, 200, 80, 0.65), 0 0 4px rgba(0, 242, 255, 0.5);
}

.lb-badge-dot.streak-t4 {
  background: conic-gradient(from 220deg, #ff00aa, #ffd700, #00f2ff, #a855f7, #ff00aa);
  box-shadow: 0 0 16px rgba(255, 215, 0, 0.75), 0 0 8px rgba(0, 242, 255, 0.55);
  animation: honorSpin 5s linear infinite;
}

.lb-badge-dot.decor-tree {
  background: linear-gradient(145deg, #22c55e, #166534);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.55);
}

.lb-badge-dot.decor-flower {
  background: linear-gradient(145deg, #f472b6, #be185d);
  box-shadow: 0 0 10px rgba(244, 114, 182, 0.55);
}

.lb-badge-dot.decor-ground {
  background: linear-gradient(145deg, #a8a29e, #57534e);
  box-shadow: 0 0 10px rgba(168, 162, 158, 0.45);
}

.lb-badge-dot.decor-decor {
  background: linear-gradient(145deg, #a855f7, #6366f1);
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.55);
}

.lb-badge-dot.meta-coins {
  width: 11px;
  height: 11px;
  background: linear-gradient(145deg, #fff8dc, #ffd700 40%, #b8860b);
  box-shadow:
    0 0 16px rgba(255, 215, 0, 0.85),
    0 0 4px rgba(255, 255, 255, 0.45);
  animation: honorPulse 2.6s ease-in-out infinite;
}

.lb-badge-dot.meta-level {
  width: 11px;
  height: 11px;
  background: linear-gradient(145deg, #6ee7b7, #059669 55%, #34d399);
  box-shadow: 0 0 16px rgba(52, 211, 153, 0.65);
}

.lb-badge-dot.meta-streak {
  width: 11px;
  height: 11px;
  background: linear-gradient(145deg, #fdba74, #ea580c 45%, #fb923c);
  box-shadow: 0 0 16px rgba(251, 146, 60, 0.72);
  animation: honorPulse 2s ease-in-out infinite;
}

@keyframes honorPulse {
  0%,
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.08);
    filter: brightness(1.15);
  }
}

@keyframes honorSpin {
  to {
    filter: hue-rotate(360deg);
  }
}

.you-tag {
  font-size: .66rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 99px;
  background: rgba(0, 242, 255, 0.12);
  color: #00f2ff;
}

.center-pad {
  text-align: center;
  padding: 40px 20px;
}

.spin {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #00f2ff;
  animation: spin .7s linear infinite;
  margin: auto;
}

.info-card {
  background: rgba(244, 196, 48, 0.03);
  border: 1px solid rgba(244, 196, 48, 0.15);
  border-radius: 14px;
  padding: 18px;
}

.info-title {
  font-size: .9rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.legend-subtitle {
  margin-top: 4px;
}

.legend-lead {
  margin-bottom: 14px;
}

.legend-divider {
  height: 1px;
  margin: 16px 0 14px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(244, 196, 48, 0.35) 20%,
    rgba(244, 196, 48, 0.35) 80%,
    transparent
  );
}

.legend-section-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(244, 196, 48, 0.75);
  margin: 14px 0 8px;
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.legend-dot {
  width: 12px;
  height: 12px;
  margin-top: 3px;
  flex-shrink: 0;
}

.legend-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.legend-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.legend-rule {
  font-size: 0.76rem;
  color: rgba(255, 255, 255, 0.48);
  line-height: 1.45;
}

.lb-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.page-btn {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: .78rem;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
