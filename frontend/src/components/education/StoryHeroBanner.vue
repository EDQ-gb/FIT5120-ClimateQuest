<script setup>
defineProps({
  imageSrc: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  tone: { type: String, default: 'dark' },
})
</script>

<template>
  <div
    class="shb"
    :class="`shb--${tone}`"
    :style="{ backgroundImage: `url(${imageSrc})` }"
    role="img"
    :aria-label="title"
  >
    <div class="shb-overlay">
      <h2 class="shb-title">{{ title }}</h2>
      <p v-if="subtitle" class="shb-sub">{{ subtitle }}</p>
    </div>
  </div>
</template>

<style scoped>
.shb {
  position: relative;
  min-height: clamp(140px, 22vw, 200px);
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.shb-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: clamp(14px, 2.5vw, 22px) clamp(16px, 3vw, 28px);
  max-width: min(92%, 520px);
  background: linear-gradient(
    90deg,
    rgba(8, 14, 22, 0.82) 0%,
    rgba(8, 14, 22, 0.55) 55%,
    rgba(8, 14, 22, 0.08) 100%
  );
}
.shb--light .shb-overlay {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.88) 0%,
    rgba(255, 255, 255, 0.62) 55%,
    rgba(255, 255, 255, 0.12) 100%
  );
}
.shb-title {
  margin: 0;
  font-size: clamp(1.05rem, 2.4vw, 1.35rem);
  font-weight: 800;
  line-height: 1.2;
  color: #fff;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.45);
}
.shb--light .shb-title {
  color: #0f172a;
  text-shadow: none;
}
.shb-sub {
  margin: 8px 0 0;
  font-size: 0.84rem;
  line-height: 1.5;
  color: rgba(240, 248, 255, 0.92);
}
.shb--light .shb-sub {
  color: rgba(15, 23, 42, 0.82);
}
</style>
