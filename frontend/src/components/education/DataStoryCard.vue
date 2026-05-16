<script setup>
import StoryHeroBanner from './StoryHeroBanner.vue'
import KeyTakeawayBox from './KeyTakeawayBox.vue'

defineProps({
  heroImage: { type: String, required: true },
  storyTitle: { type: String, required: true },
  storySubtitle: { type: String, required: true },
  takeaway: { type: String, required: true },
  takeawayHint: { type: String, default: '' },
  sourceName: { type: String, required: true },
  sourceUrl: { type: String, default: '' },
  accent: { type: String, default: '#52d496' },
})
</script>

<template>
  <section class="dsc glass-card">
    <StoryHeroBanner :image-src="heroImage" :title="storyTitle" :subtitle="storySubtitle" />

    <div v-if="$slots.controls" class="dsc-controls">
      <slot name="controls" />
    </div>

    <div class="dsc-chart">
      <slot name="chart" />
    </div>

    <KeyTakeawayBox
      class="dsc-ktb"
      :style="{ '--ktb-accent': accent }"
      :headline="takeaway"
      :hint="takeawayHint"
      :source-name="sourceName"
      :source-url="sourceUrl"
    />

    <div v-if="$slots.details" class="dsc-details">
      <slot name="details" />
    </div>

    <a
      v-if="sourceUrl"
      class="dsc-source"
      :href="sourceUrl"
      target="_blank"
      rel="noopener noreferrer"
    >Source: {{ sourceName }}</a>
  </section>
</template>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: clamp(14px, 2vw, 20px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dsc-chart {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.dsc-chart :deep(.elc-wrap) {
  border: none;
}
.dsc-details :deep(.body-text) {
  margin: 0 0 10px;
  font-size: 0.84rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.78);
}
.dsc-details :deep(.insight-box) {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}
.dsc-details :deep(.insight-title) {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(148, 240, 200, 0.95);
  margin-bottom: 8px;
}
.dsc-details :deep(.insight-list) {
  margin: 0;
  padding-left: 18px;
  font-size: 0.8rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.82);
}
.dsc-source {
  font-size: 0.72rem;
  font-weight: 600;
  color: #00f2ff;
  text-decoration: none;
  align-self: flex-start;
}
.dsc-source:hover {
  color: #fff;
}
</style>
