<script setup>
defineProps({
  href: { type: String, required: true },
  title: { type: String, required: true },
  source: { type: String, required: true },
  thumbnail: { type: String, required: true },
})
</script>

<template>
  <a class="vrc" :href="href" target="_blank" rel="noopener noreferrer">
    <div class="vrc-thumb" :style="{ backgroundImage: `url(${thumbnail})` }" />
    <div class="vrc-body">
      <h3 class="vrc-title">{{ title }}</h3>
      <p class="vrc-source">{{ source }}</p>
    </div>
  </a>
</template>

<style scoped>
.vrc {
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
  text-decoration: none;
  transition: border-color 0.2s, transform 0.2s;
}
.vrc:hover {
  border-color: rgba(255, 255, 255, 0.22);
  transform: translateY(-2px);
}
.vrc-thumb {
  aspect-ratio: 16 / 9;
  background-size: cover;
  background-position: center;
  background-color: rgba(0, 0, 0, 0.3);
}
.vrc-body {
  padding: 12px 14px 14px;
}
.vrc-title {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.35;
  color: #fff;
}
.vrc-source {
  margin: 6px 0 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.48);
}
</style>
