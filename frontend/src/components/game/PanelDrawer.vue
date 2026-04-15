<template>
  <div class="drawer" :class="{ open }">
    <div class="drawer-header">
      <div class="drawer-title">{{ title }}</div>
      <button type="button" class="drawer-close" @click="$emit('close')">✕</button>
    </div>
    <div class="drawer-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: true },
  title: { type: String, default: '' },
})
defineEmits(['close'])
</script>

<style scoped>
.drawer {
  position: fixed;
  right: 18px;
  top: 92px;
  bottom: 18px;
  width: min(520px, calc(100vw - 36px));
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 18px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateX(calc(100% + 18px));
  opacity: 0;
  pointer-events: none;
  transition: transform 220ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 180ms ease;
  z-index: 40;
}

.drawer.open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.drawer-title {
  color: #fff;
  font-weight: 800;
  letter-spacing: -0.2px;
}

.drawer-close {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.drawer-close:hover {
  background: rgba(255, 255, 255, 0.12);
}

.drawer-body {
  padding: 16px;
  overflow: auto;
}

@media (max-width: 900px) {
  .drawer {
    left: 18px;
    right: 18px;
    width: auto;
  }
}
</style>

