<script setup>
const steps = [
  { n: 1, label: 'Temperature', icon: '🌡️' },
  { n: 2, label: 'Sea Level', icon: '🌊' },
  { n: 3, label: 'Emissions', icon: '🏭' },
  { n: 4, label: 'Per Person', icon: '👥' },
  { n: 5, label: 'Forests', icon: '🌲' },
]
</script>

<template>
  <nav class="css" aria-label="Climate data story steps">
    <ol class="css-track">
      <li v-for="(s, i) in steps" :key="s.n" class="css-step">
        <div class="css-step-inner">
          <span class="css-icon" aria-hidden="true">{{ s.icon }}</span>
          <span class="css-num">{{ s.n }}</span>
          <span class="css-label">{{ s.label }}</span>
        </div>
        <span v-if="i < steps.length - 1" class="css-chev" aria-hidden="true">›</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.css {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 4px 0 8px;
  scrollbar-width: thin;
}
.css-track {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: stretch;
  gap: 0;
  min-width: min-content;
}
.css-step {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.css-step-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 14px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.35);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 0 20px rgba(0, 242, 255, 0.06);
  min-width: 92px;
}
.css-icon {
  font-size: 1.25rem;
  line-height: 1;
  filter: drop-shadow(0 0 8px rgba(82, 212, 150, 0.35));
}
.css-num {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(0, 242, 255, 0.75);
}
.css-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.88);
  text-align: center;
  white-space: nowrap;
}
.css-chev {
  padding: 0 6px;
  font-size: 1.1rem;
  font-weight: 300;
  color: rgba(0, 242, 255, 0.35);
  user-select: none;
}
</style>
