<template>
  <div class="page">
    <div class="row-between mb20">
      <h3 class="page-h3">Top Eco-Champions</h3>
      <span class="sub-text">Ranked by Climate Action Coins</span>
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
      <div class="sub-text mt8">Complete tasks to earn coins and appear here.<br>The leaderboard requires the backend to
        be connected.</div>
    </div>

    <template v-else>
      <div class="lb-list">
        <div v-for="u in pagedBoard" :key="u.rank" class="lb-row" :class="{ you: u.isYou }">
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
            {{ u.displayName || u.username }}
            <span v-if="u.isYou" class="you-tag">You</span>
          </div>
          <span class="badge" style="font-size:.7rem;">Lv {{ u.level || 1 }}</span>
          <span class="cyan text-sm" style="min-width:58px;text-align:right;">🔥 {{ u.streak || 0 }}d</span>
          <span class="gold fw7 text-sm" style="min-width:80px;text-align:right;">🪙 {{ (u.coins || 0).toLocaleString() }}</span>
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
        Complete daily tasks, check in from the home strip, finish the weekly sprint, and answer the quiz for bonus
        coins. Only members who opt in to a public profile are listed here.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getLeaderboard } from '../api/features.js'

defineProps({
  user: { type: Object, default: null },
})

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

onMounted(async () => {
  board.value = (await getLeaderboard()) || []
  page.value = 1
  loading.value = false
})
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

.lb-name {
  flex: 1;
  font-weight: 600;
  font-size: .92rem;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
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
