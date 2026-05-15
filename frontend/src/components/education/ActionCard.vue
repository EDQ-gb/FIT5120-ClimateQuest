<script setup>
defineProps({
  icon: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="ac">
    <span class="ac-icon" aria-hidden="true">{{ icon }}</span>
    <div class="ac-text">
      <div class="ac-title">{{ title }}</div>
      <p v-if="subtitle" class="ac-sub">{{ subtitle }}</p>
    </div>
  </div>
</template>

<style scoped>
.ac {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}
.ac:hover {
  border-color: rgba(0, 242, 255, 0.22);
  background: rgba(0, 242, 255, 0.06);
  transform: translateY(-1px);
}
.ac-icon {
  font-size: 1.65rem;
  line-height: 1;
  filter: drop-shadow(0 0 10px rgba(0, 242, 255, 0.25));
}
.ac-text {
  min-width: 0;
}
.ac-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0.02em;
}
.ac-sub {
  margin: 2px 0 0;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgba(200, 230, 220, 0.62);
}
</style>
