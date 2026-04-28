<template>
  <div class="panel">
    <div class="row">
      <div class="hint">Spend Climate Action Coins to improve your environment.</div>
      <div class="coins">🪙 {{ coins.toLocaleString() }}</div>
    </div>

    <div class="grid">
      <button
        v-for="it in items"
        :key="it.id"
        class="shop-item"
        type="button"
        :disabled="busy || coins < it.cost"
        @click="buy(it)"
      >
        <div class="thumb">
          <img :src="it.src" :alt="it.label" />
        </div>
        <div class="meta">
          <div class="name">{{ it.label }}</div>
          <div class="sub">
            <span class="badge">+{{ it.kind }}</span>
            <span class="badge gold">🪙 {{ it.cost }}</span>
          </div>
        </div>
      </button>
    </div>

    <div class="status" v-if="errorMsg">{{ errorMsg }}</div>
    <div class="status" v-else-if="busy">Working…</div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { getTheme } from '../../../game/assets/catalog.js'

const props = defineProps({
  themeType: { type: String, default: 'forest' },
  coins: { type: Number, default: 0 },
})
const emit = defineEmits(['changed'])

const busy = ref(false)
const errorMsg = ref('')

const items = computed(() => getTheme(props.themeType).items)

async function buy(it) {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const res = await fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ item: it.kind, qty: 1, itemId: it.id }),
    }).then((r) => r.json())

    if (res?.error) throw new Error(res.error)
    emit('changed')
  } catch (e) {
    errorMsg.value = String(e?.message || 'Failed')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.hint {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.9rem;
}
.coins {
  color: #fff;
  font-weight: 800;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.shop-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}
.shop-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(0, 242, 255, 0.35);
  transform: translateY(-1px);
}
.shop-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.thumb {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
.meta {
  display: grid;
  gap: 4px;
  flex: 1;
}
.name {
  color: #fff;
  font-weight: 800;
  font-size: 0.92rem;
}
.sub {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
.badge {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.badge.gold {
  background: rgba(244, 196, 48, 0.12);
  border-color: rgba(244, 196, 48, 0.22);
  color: #f4c430;
}
.status {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}
@media (max-width: 500px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>

