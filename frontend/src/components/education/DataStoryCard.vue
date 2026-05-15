<script setup>
import { computed } from 'vue'
import KeyTakeawayBox from './KeyTakeawayBox.vue'

const props = defineProps({
  accent: {
    type: String,
    required: true,
    validator: (v) => ['orange', 'cyan', 'purple', 'yellow', 'green'].includes(v),
  },
  icon: { type: String, default: '📊' },
  storyTitle: { type: String, required: true },
  storySubtitle: { type: String, required: true },
  takeaway: { type: String, required: true },
  takeawayHint: { type: String, default: '' },
  sourceName: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
})

const accentVars = {
  orange: { c: '#ff8c42', rgb: '255, 140, 66' },
  cyan: { c: '#2dd4ef', rgb: '45, 212, 239' },
  purple: { c: '#c084fc', rgb: '192, 132, 252' },
  yellow: { c: '#facc15', rgb: '250, 204, 21' },
  green: { c: '#4ade80', rgb: '74, 222, 128' },
}

const tone = computed(() => accentVars[props.accent] || accentVars.green)
</script>

<template>
  <section
    class="dsc"
    :style="{
      '--dsc-accent': tone.c,
      '--dsc-accent-rgb': tone.rgb,
    }"
  >
    <div class="dsc-grid">
      <div class="dsc-left">
        <div class="dsc-icon-wrap" aria-hidden="true">{{ icon }}</div>
        <div class="dsc-text-block">
          <h2 class="dsc-title">{{ storyTitle }}</h2>
          <p class="dsc-sub">{{ storySubtitle }}</p>
        </div>
      </div>

      <div class="dsc-mid">
        <div v-if="$slots.controls" class="dsc-controls">
          <slot name="controls" />
        </div>
        <div class="dsc-chart">
          <slot name="chart" />
        </div>
      </div>

      <div class="dsc-right">
        <KeyTakeawayBox
          class="dsc-ktb"
          :headline="takeaway"
          :hint="takeawayHint"
          :source-name="sourceName"
          :source-url="sourceUrl"
        />
      </div>
    </div>

    <details v-if="$slots.moreDetails" class="dsc-more">
      <summary class="dsc-more-btn">More details</summary>
      <div class="dsc-more-body">
        <slot name="moreDetails" />
      </div>
    </details>
  </section>
</template>

<style scoped>
.dsc {
  border-radius: 18px;
  padding: clamp(14px, 2.2vw, 22px);
  border: 1px solid rgba(var(--dsc-accent-rgb), 0.28);
  background: linear-gradient(
    145deg,
    rgba(0, 0, 0, 0.42) 0%,
    rgba(var(--dsc-accent-rgb), 0.07) 55%,
    rgba(0, 0, 0, 0.38) 100%
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 12px 40px rgba(0, 0, 0, 0.35),
    0 0 36px rgba(var(--dsc-accent-rgb), 0.12);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
}

.dsc-grid {
  display: grid;
  grid-template-columns: minmax(120px, 200px) minmax(0, 1fr) minmax(150px, 220px);
  gap: clamp(14px, 2.4vw, 28px);
  align-items: start;
}

.dsc-left {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.dsc-text-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dsc-icon-wrap {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  font-size: 1.55rem;
  border: 1px solid rgba(var(--dsc-accent-rgb), 0.35);
  background: rgba(var(--dsc-accent-rgb), 0.12);
  box-shadow: 0 0 24px rgba(var(--dsc-accent-rgb), 0.2);
}

.dsc-title {
  margin: 0;
  font-size: clamp(1.05rem, 2vw, 1.25rem);
  font-weight: 800;
  line-height: 1.2;
  color: #fff;
  letter-spacing: 0.02em;
}

.dsc-sub {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
  color: rgba(220, 240, 232, 0.78);
}

.dsc-mid {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dsc-controls :deep(.toggle-row) {
  margin-top: 0;
}

.dsc-chart {
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.dsc-chart :deep(.chart-wrap) {
  margin-top: 0;
  border: none;
  border-radius: 0;
}

.dsc-right {
  min-width: 0;
}

.dsc-ktb {
  --ktb-accent: var(--dsc-accent);
}

.dsc-more {
  margin-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
}

.dsc-more-btn {
  cursor: pointer;
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 242, 255, 0.22);
  background: rgba(0, 242, 255, 0.08);
  font-size: 0.78rem;
  font-weight: 700;
  color: rgba(154, 246, 255, 0.95);
  user-select: none;
}

.dsc-more-btn::-webkit-details-marker {
  display: none;
}

.dsc-more[open] .dsc-more-btn {
  background: rgba(0, 242, 255, 0.14);
  border-color: rgba(0, 242, 255, 0.35);
}

.dsc-more-body {
  margin-top: 12px;
  padding-top: 4px;
  animation: dscFade 0.2s ease;
}

.dsc-more-body :deep(.body-text) {
  margin-top: 0;
}

@keyframes dscFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (min-width: 961px) {
  .dsc-left {
    flex-direction: column;
    gap: 10px;
  }

  .dsc-icon-wrap {
    margin-bottom: 0;
  }
}

@media (max-width: 960px) {
  .dsc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
