<template>
  <div class="theme-page">
    <nav class="navbar">
      <div class="theme-brand">
        <span class="brand-icon">🌍</span>
        <span class="brand-text">ClimateQuest</span>
      </div>
      <button type="button" class="topbar-home-btn" @click="$emit('back-home')">← Home</button>
    </nav>

    <div class="theme-main">
      <h1 class="theme-title">Choose your theme</h1>
      <p class="theme-subtitle">This sets your personal scene. You can reset later if you want to re-choose.</p>

      <div class="theme-grid">
        <button class="theme-card" type="button" @click="pick('forest')" :disabled="busy">
          <div class="card-icon">🌲</div>
          <div class="card-name">Rainforest</div>
          <div class="card-desc">Regrow lost rainforest with daily actions.</div>
        </button>

        <button class="theme-card" type="button" @click="pick('glacier')" :disabled="busy">
          <div class="card-icon">❄️</div>
          <div class="card-name">Glacier</div>
          <div class="card-desc">Restore polar ice through consistent progress.</div>
        </button>

        <button class="theme-card" type="button" @click="pick('cityGreen')" :disabled="busy">
          <div class="card-icon">🏙️</div>
          <div class="card-name">City Green</div>
          <div class="card-desc">Turn a grey city into a greener place with small actions.</div>
        </button>
      </div>

      <div class="theme-actions">
        <button class="link-btn" type="button" @click="$emit('skip')" :disabled="busy">Skip for now →</button>
        <div class="theme-hint" v-if="busy">Saving…</div>
        <div class="theme-error" v-else-if="errorMsg">{{ errorMsg }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { selectScene } from '../api/features.js'

const emit = defineEmits(['selected', 'skip', 'back-home'])

const busy = ref(false)
const errorMsg = ref('')

async function pick(type) {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    await selectScene(type)
    emit('selected', type)
  } catch (e) {
    errorMsg.value = String(e?.message || 'Failed to save theme')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.theme-page {
  width: 100%;
  min-height: 100vh;
  background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.82) 100%),
    url("/img1.jpg");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
}

.navbar {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.theme-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.brand-icon {
  font-size: 1.2rem;
}
.brand-text {
  color: #fff;
  font-weight: 800;
  letter-spacing: -0.2px;
}

.theme-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.theme-title {
  color: #fff;
  font-size: 2.4rem;
  font-weight: 800;
  letter-spacing: -0.8px;
  margin-bottom: 10px;
}
.theme-subtitle {
  color: rgba(255, 255, 255, 0.78);
  font-size: 1.02rem;
  line-height: 1.6;
  max-width: 720px;
  margin-bottom: 26px;
}

.theme-grid {
  width: min(980px, 100%);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.theme-card {
  border-radius: 18px;
  padding: 18px 18px 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  cursor: pointer;
  text-align: left;
  transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;
  color: rgba(255, 255, 255, 0.9);
}

.theme-card:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: rgba(0, 242, 255, 0.35);
  background: rgba(0, 242, 255, 0.06);
}

.theme-card:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 1.6rem;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.12);
  margin-bottom: 12px;
}

.card-name {
  font-weight: 800;
  color: #fff;
  font-size: 1.05rem;
  letter-spacing: -0.2px;
  margin-bottom: 6px;
}
.card-desc {
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.92rem;
  line-height: 1.55;
}

.theme-actions {
  margin-top: 18px;
  display: grid;
  gap: 10px;
  align-items: center;
  justify-items: center;
}

.theme-hint {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}
.theme-error {
  color: #ffd0d0;
  font-size: 0.9rem;
}

@media (max-width: 900px) {
  .theme-grid {
    grid-template-columns: 1fr;
  }
  .theme-title {
    font-size: 2rem;
  }
}
</style>

