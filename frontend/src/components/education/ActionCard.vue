<script setup>
defineProps({
  imageSrc: { type: String, default: '' },
  icon: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="ac">
    <div class="ac-media">
      <img v-if="imageSrc" class="ac-img" :src="imageSrc" :alt="title" loading="lazy" />
      <span v-else class="ac-icon" aria-hidden="true">{{ icon }}</span>
    </div>
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
}
.ac-media {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ac-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ac-icon {
  font-size: 1.5rem;
}
.ac-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
}
.ac-sub {
  margin: 2px 0 0;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.55);
}
</style>
