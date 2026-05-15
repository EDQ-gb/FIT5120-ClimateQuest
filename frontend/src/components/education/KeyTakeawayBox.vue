<script setup>
defineProps({
  headline: { type: String, required: true },
  hint: { type: String, default: '' },
  sourceName: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
})
</script>

<template>
  <div class="ktb">
    <div class="ktb-label">Key takeaway</div>
    <div class="ktb-headline">{{ headline }}</div>
    <p v-if="hint" class="ktb-hint">{{ hint }}</p>
    <div v-if="sourceName" class="ktb-source">
      <span class="ktb-source-prefix">Source:</span>
      <a
        v-if="sourceUrl"
        class="ktb-source-link"
        :href="sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
      >{{ sourceName }}</a>
      <span v-else class="ktb-source-plain">{{ sourceName }}</span>
    </div>
  </div>
</template>

<style scoped>
.ktb {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--ktb-accent, #52d496) 35%, transparent);
  background: linear-gradient(
    165deg,
    rgba(0, 0, 0, 0.45) 0%,
    color-mix(in srgb, var(--ktb-accent, #52d496) 12%, rgba(0, 0, 0, 0.35)) 100%
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 0 24px color-mix(in srgb, var(--ktb-accent, #52d496) 18%, transparent);
}
.ktb-label {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}
.ktb-headline {
  font-size: clamp(1.35rem, 3.5vw, 1.75rem);
  font-weight: 800;
  line-height: 1.1;
  color: #fff;
  text-shadow: 0 0 28px color-mix(in srgb, var(--ktb-accent, #52d496) 45%, transparent);
}
.ktb-hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: rgba(230, 245, 240, 0.72);
}
.ktb-source {
  margin-top: 4px;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}
.ktb-source-prefix {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
}
.ktb-source-link {
  color: var(--ktb-accent, #52d496);
  font-weight: 700;
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--ktb-accent, #52d496) 45%, transparent);
}
.ktb-source-link:hover {
  color: #fff;
  border-bottom-color: rgba(255, 255, 255, 0.45);
}
.ktb-source-plain {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
}
</style>
