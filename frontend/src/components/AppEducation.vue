<template>
  <div class="page">
    <div class="row-between mb12">
      <h3 class="page-h3">Climate Education</h3>
      <span class="sub-text">Short lessons, real-world impact</span>
    </div>

    <section class="glass-card">
      <div class="card-title">Why your actions matter</div>
      <p class="body-text">
        ClimateQuest links daily behavior to climate outcomes. Small changes like active transport, smarter food choices,
        and energy-saving habits reduce emissions over time.
      </p>
    </section>

    <section class="lesson-grid">
      <article class="lesson-card">
        <div class="lesson-title">🚶 Transport</div>
        <p class="body-text">Walking, cycling, and public transport usually produce lower emissions than solo car trips.</p>
      </article>
      <article class="lesson-card">
        <div class="lesson-title">🥗 Food</div>
        <p class="body-text">Plant-forward and local-seasonal meals often reduce food-related carbon footprints.</p>
      </article>
      <article class="lesson-card">
        <div class="lesson-title">🔌 Home Energy</div>
        <p class="body-text">Switching off standby devices and using electricity efficiently lowers avoidable energy waste.</p>
      </article>
      <article class="lesson-card">
        <div class="lesson-title">♻️ Circular habits</div>
        <p class="body-text">Reusing and sorting recyclables supports material recovery and reduces landfill pressure.</p>
      </article>
    </section>

    <section class="glass-card">
      <div class="card-title">Use this page with the game loop</div>
      <ol class="steps">
        <li>Pick one practical behavior from a lesson above.</li>
        <li>Complete the matching Daily Task or Daily Quiz.</li>
        <li>Apply earned coins in My Scene to visualize your progress.</li>
      </ol>
    </section>
  </div>
</template>

<script setup>
</script>

<style scoped>
.page { display:flex; flex-direction:column; gap:14px; }
.row-between { display:flex; align-items:center; justify-content:space-between; }
.mb12 { margin-bottom:12px; }
.page-h3 { font-size:1rem; font-weight:700; color:#fff; }
.sub-text { font-size:.8rem; color:rgba(255,255,255,.45); }
.glass-card {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 16px;
}
.card-title {
  font-size: .74rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: rgba(148, 240, 200, 0.95);
  margin-bottom: 8px;
}
.body-text {
  margin: 0;
  font-size: .84rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.78);
}
.lesson-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.lesson-card {
  background: rgba(0, 242, 255, 0.04);
  border: 1px solid rgba(0, 242, 255, 0.18);
  border-radius: 12px;
  padding: 14px;
}
.lesson-title {
  font-size: .86rem;
  font-weight: 700;
  color: #9af6ff;
  margin-bottom: 6px;
}
.steps {
  margin: 0;
  padding-left: 18px;
  font-size: .82rem;
  line-height: 1.52;
  color: rgba(255, 255, 255, 0.8);
}
@media(max-width:780px){ .lesson-grid{grid-template-columns:1fr;} }
</style>
