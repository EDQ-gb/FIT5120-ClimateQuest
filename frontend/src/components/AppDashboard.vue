<template>
  <div class="page">

    <!-- Stat cards -->
    <div class="grid-4">
      <div class="glass-card">
        <div class="stat-label">Coins</div>
        <div class="stat-num" style="color:#00f2ff;">{{ (p.coins||0).toLocaleString() }}</div>
        <div class="stat-sub">🪙 earned total</div>
      </div>
      <div class="glass-card">
        <div class="stat-label">Streak</div>
        <div class="stat-num" style="color:#f4c430;">{{ p.streak||0 }}</div>
        <div class="stat-sub">🔥 days in a row</div>
      </div>
      <div class="glass-card">
        <div class="stat-label">CO₂ Saved</div>
        <div class="stat-num" style="color:#52d496;">{{ ((p.co2Saved||0)/1000).toFixed(1) }}</div>
        <div class="stat-sub">kg CO₂ reduced</div>
      </div>
      <div class="glass-card">
        <div class="stat-label">Level</div>
        <div class="stat-num" style="color:#c084fc;">{{ p.level||1 }}</div>
        <div class="stat-sub">⭐ {{ p.xpInLevel||0 }} / 200 XP</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Progress -->
      <div class="glass-card">
        <div class="card-title">Level Progress</div>
        <div class="prog-row">
          <span class="prog-label" style="color:#c084fc;">Lv {{ p.level||1 }}</span>
          <div class="prog-track"><div class="prog-fill" :style="{ width: xpPct+'%', background:'linear-gradient(90deg,#7c3aed,#c084fc)' }"></div></div>
          <span class="prog-label" style="color:#c084fc;">Lv {{ (p.level||1)+1 }}</span>
        </div>
        <div class="sub-text">{{ p.xpInLevel||0 }} / 200 XP to next level</div>

        <div class="card-title mt16">Today's Tasks</div>
        <div class="prog-row">
          <div class="prog-track" style="flex:1"><div class="prog-fill" :style="{ width: taskPct+'%' }"></div></div>
          <span class="prog-label green">{{ p.todayDone||0 }} / {{ p.totalTasks||6 }}</span>
        </div>

        <div class="card-title mt16">Scene Restore</div>
        <div class="prog-row">
          <div class="prog-track" style="flex:1"><div class="prog-fill" :style="{ width: scenePct+'%', background:'linear-gradient(90deg,#0080aa,#00f2ff)' }"></div></div>
          <span class="prog-label" style="color:#00f2ff;">{{ scenePct }}%</span>
        </div>
      </div>

      <!-- Week chart -->
      <div class="glass-card">
        <div class="card-title">Activity — Last 7 Days</div>
        <div class="week-chart">
          <div v-for="d in (p.week||[])" :key="d.date" class="week-col">
            <div class="week-bar" :class="{ active: d.count > 0 }"
                 :style="{ height: Math.max(4, (d.count/6)*52) + 'px' }"></div>
            <div class="week-label">{{ d.label }}</div>
          </div>
        </div>
        <div class="sub-text">Bar height = tasks completed that day</div>

        <div class="card-title mt16">All-Time</div>
        <div style="display:flex;gap:16px;margin-top:4px;">
          <span class="green fw7">{{ p.allTimeTasks||0 }} tasks</span>
          <span style="color:rgba(255,255,255,0.3)">·</span>
          <span style="color:#00f2ff;" class="fw7">{{ ((p.co2Saved||0)/1000).toFixed(2) }} kg CO₂</span>
        </div>
      </div>
    </div>

    <!-- Quick tasks -->
    <div class="glass-card">
      <div class="row-between mb12">
        <div class="card-title">Quick Actions</div>
        <button class="link-btn" @click="$emit('navigate', 'tasks')">View all →</button>
      </div>
      <div v-if="taskLoading" class="center-pad"><div class="spin"></div></div>
      <template v-else>
        <div v-for="task in tasks.slice(0,3)" :key="task.id"
             class="task-row" :class="{ done: task.completed }">
          <div class="task-icon">{{ task.icon }}</div>
          <div class="task-info">
            <div class="task-title">{{ task.title }}</div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <span class="badge gold">+{{ task.coins }} coins</span>
              <span class="badge cyan" v-if="task.co2 > 0">{{ task.co2 }}g CO₂</span>
            </div>
          </div>
          <button class="act-btn" :class="task.completed ? 'done' : 'todo'"
                  :disabled="task.completed || completing===task.id"
                  @click="complete(task.id)">
            <div v-if="completing===task.id" class="spin sm"></div>
            <span v-else>{{ task.completed ? '✓ Done' : 'Complete' }}</span>
          </button>
        </div>
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getProgress, getTasks, completeTask, getScene } from '../api/features.js'

const props = defineProps({ user: Object })
const emit  = defineEmits(['navigate', 'coins-updated'])

const p           = ref({})
const tasks       = ref([])
const scene       = ref({ progress: 0 })
const taskLoading = ref(true)
const completing  = ref(null)

const xpPct   = computed(() => Math.round(((p.value.xpInLevel||0)/200)*100))
const taskPct = computed(() => { const d=p.value.todayDone||0, t=p.value.totalTasks||6; return Math.round(d/t*100) })
const scenePct = computed(() => scene.value.progress||0)

async function load() {
  taskLoading.value = true
  const [prog, t, s] = await Promise.all([getProgress(), getTasks(), getScene()])
  p.value     = prog || {}
  tasks.value = t    || []
  scene.value = s    || { progress: 0 }
  taskLoading.value = false
}

async function complete(id) {
  if (completing.value) return
  completing.value = id
  try {
    const res = await completeTask(id)
    if (res?.error) return
    tasks.value = tasks.value.map(t => t.id === id ? { ...t, completed: true } : t)
    p.value.coins     = res.totalCoins
    p.value.streak    = res.streak
    p.value.todayDone = (p.value.todayDone||0) + 1
    scene.value.progress = res.sceneProgress
    emit('coins-updated')
  } finally { completing.value = null }
}

onMounted(load)
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.glass-card {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.14);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 20px;
}
.stat-label { font-size:.7rem;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px; }
.stat-num   { font-size:2.2rem;font-weight:800;line-height:1; }
.stat-sub   { font-size:.72rem;color:rgba(255,255,255,0.4);margin-top:6px; }
.card-title { font-size:.72rem;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px; }
.mt16 { margin-top:16px; }
.mb12 { margin-bottom:12px; }
.sub-text { font-size:.72rem;color:rgba(255,255,255,0.35);margin-top:5px; }
.green  { color:#52d496; }
.fw7    { font-weight:700; }
.row-between { display:flex;align-items:center;justify-content:space-between; }
.prog-row    { display:flex;align-items:center;gap:10px;margin-bottom:5px; }
.prog-label  { font-size:.8rem;font-weight:700;white-space:nowrap; }
.prog-track  { flex:1;background:rgba(255,255,255,0.1);border-radius:99px;height:7px;overflow:hidden; }
.prog-fill   { height:100%;border-radius:99px;transition:width .6s ease;background:linear-gradient(90deg,#2d6a4f,#52d496); }
.week-chart  { display:flex;gap:10px;align-items:flex-end;height:60px;margin-bottom:5px; }
.week-col    { flex:1;display:flex;flex-direction:column;align-items:center;gap:5px; }
.week-bar    { width:100%;border-radius:4px 4px 0 0;min-height:4px;background:rgba(255,255,255,0.12);transition:height .4s; }
.week-bar.active { background:#52d496; }
.week-label  { font-size:.62rem;color:rgba(255,255,255,0.4); }
.task-row    { display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.06);transition:opacity .3s; }
.task-row:last-child { border-bottom:none; }
.task-row.done { opacity:.5; }
.task-icon   { width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0; }
.task-info   { flex:1; }
.task-title  { font-size:.92rem;font-weight:600;color:#fff; }
.badge       { font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:99px; }
.badge.gold  { background:rgba(244,196,48,0.15);color:#f4c430; }
.badge.cyan  { background:rgba(0,242,255,0.10);color:#00f2ff; }
.act-btn     { padding:8px 16px;border-radius:30px;font-size:.8rem;font-weight:700;border:none;cursor:pointer;transition:all .25s;display:flex;align-items:center;gap:6px; }
.act-btn.todo { background:rgba(0,242,255,0.12);color:#00f2ff;border:1px solid rgba(0,242,255,0.25); }
.act-btn.todo:hover:not(:disabled) { background:rgba(0,242,255,0.22);color:#fff; }
.act-btn.done { background:transparent;color:rgba(255,255,255,0.3);pointer-events:none; }
.act-btn:disabled { opacity:.5;cursor:not-allowed; }
.link-btn    { background:transparent;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:.82rem;transition:all .2s; }
.link-btn:hover { color:#fff;border-color:rgba(255,255,255,0.45); }
.center-pad  { text-align:center;padding:24px; }
.spin        { width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,0.1);border-top-color:#00f2ff;animation:spin .7s linear infinite;margin:auto; }
.spin.sm     { width:14px;height:14px;border-width:2px; }
@keyframes spin { to { transform:rotate(360deg); } }
@media(max-width:900px){ .grid-4{grid-template-columns:1fr 1fr;} .grid-2{grid-template-columns:1fr;} }
@media(max-width:480px){ .grid-4{grid-template-columns:1fr 1fr;} }
</style>
