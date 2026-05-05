<template>
  <div v-if="summary" class="home-strip" role="region" aria-label="Daily activity">
    <div class="strip-inner">
      <div class="strip-block">
        <div class="strip-title">Daily check-in</div>
        <button
          type="button"
          class="strip-btn"
          :disabled="summary.checkIn.completedToday || busy"
          @click="doCheckIn"
        >
          {{
            summary.checkIn.completedToday
              ? 'Checked in today'
              : `Check in (+${summary.checkIn.rewardCoins} coins)`
          }}
        </button>
      </div>
      <div class="strip-block grow">
        <div class="strip-title">{{ summary.weeklyChallenge.title }}</div>
        <p class="strip-desc">{{ summary.weeklyChallenge.description }}</p>
        <div class="wc-track">
          <div class="wc-fill" :style="{ width: wcPct + '%' }" />
        </div>
        <div class="strip-meta">
          {{ summary.weeklyChallenge.progress }} / {{ summary.weeklyChallenge.goal }} tasks ·
          {{ summary.weeklyChallenge.weekRangeLabel }}
        </div>
        <div v-if="summary.weeklyChallenge.completed" class="strip-done">
          Weekly bonus claimed. See reward history on the dashboard.
        </div>
      </div>
      <div class="strip-block streak-col">
        <div class="strip-title">Streak</div>
        <div class="streak-num">{{ summary.streak }}<span class="streak-d">d</span></div>
        <div class="milestone-row">
          <span class="mi" :class="{ on: summary.streakMilestones.sevenDay }">7-day</span>
          <span class="mi" :class="{ on: summary.streakMilestones.thirtyDay }">30-day</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getHomeSummary, postCheckIn } from '../api/features.js'

const emit = defineEmits(['updated'])

const summary = ref(null)
const busy = ref(false)

const wcPct = computed(() => {
  const w = summary.value?.weeklyChallenge
  if (!w || !w.goal) return 0
  return Math.min(100, Math.round((w.progress / w.goal) * 100))
})

async function load() {
  try {
    summary.value = await getHomeSummary()
  } catch {
    summary.value = null
  }
}

async function doCheckIn() {
  if (busy.value || summary.value?.checkIn?.completedToday) return
  busy.value = true
  try {
    await postCheckIn()
    await load()
    emit('updated')
  } catch (e) {
    if (String(e?.message || '') === 'ALREADY_CHECKED_IN') await load()
  } finally {
    busy.value = false
  }
}

onMounted(load)

defineExpose({ reload: load })
</script>

<style scoped>
.home-strip {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, rgba(5, 12, 22, 0.92));
  pointer-events: none;
}
.strip-inner {
  pointer-events: auto;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(14px);
}
.strip-block {
  min-width: 140px;
}
.strip-block.grow {
  flex: 1;
  min-width: 220px;
}
.strip-title {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 8px;
}
.strip-btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 242, 255, 0.35);
  background: rgba(0, 242, 255, 0.12);
  color: #00f2ff;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
}
.strip-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.strip-desc {
  margin: 0 0 8px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.35;
}
.wc-track {
  height: 7px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.wc-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #2d6a4f, #52d496);
  transition: width 0.5s ease;
}
.strip-meta {
  margin-top: 6px;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.38);
}
.strip-done {
  margin-top: 8px;
  font-size: 0.72rem;
  color: #52d496;
  font-weight: 600;
}
.streak-col {
  text-align: right;
}
.streak-num {
  font-size: 1.6rem;
  font-weight: 800;
  color: #f4c430;
  line-height: 1;
}
.streak-d {
  font-size: 0.85rem;
  font-weight: 700;
  opacity: 0.6;
  margin-left: 2px;
}
.milestone-row {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 8px;
}
.mi {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.35);
}
.mi.on {
  background: rgba(244, 196, 48, 0.2);
  color: #f4c430;
}
@media (max-width: 720px) {
  .strip-inner {
    flex-direction: column;
  }
  .streak-col {
    text-align: left;
  }
  .milestone-row {
    justify-content: flex-start;
  }
}
</style>
