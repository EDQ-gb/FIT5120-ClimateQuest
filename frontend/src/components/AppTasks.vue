<template>
  <div class="page">
    <div class="row-between mb12">
      <h3 class="page-h3">Daily Green Actions</h3>
      <span class="sub-text">{{ doneCount }} / {{ tasks.length }} completed</span>
    </div>
    <div class="prog-track mb16"><div class="prog-fill" :style="{ width: pct+'%' }"></div></div>

    <div v-if="loading" class="center-pad"><div class="spin"></div></div>

    <template v-else>
      <div v-for="task in tasks" :key="task.id" class="task-card" :class="{ done: task.completed }">
        <div class="task-icon">{{ task.icon }}</div>
        <div class="task-body">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-desc">{{ task.desc }}</div>
          <div class="badges">
            <span class="badge gold">+{{ task.coins }} coins</span>
            <span class="badge cyan" v-if="task.co2 > 0">{{ task.co2 }}g CO₂ saved</span>
            <span class="badge">{{ task.cat }}</span>
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

    <div class="info-card">
      <div class="info-title">💡 About these tasks</div>
      <p class="info-body">Each task links to real CO₂ savings using the Australian Government's NGA Emission Factors. "Walk or cycle a trip" saves ~340g CO₂ — a scientifically grounded figure, not a gamification estimate.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getTasks, completeTask } from '../api/features.js'

defineProps({ user: Object })
// We emit the *resulting* totals so the shell can update immediately
// without waiting for a separate refresh roundtrip.
const emit = defineEmits(['coins-updated'])

const tasks      = ref([])
const loading    = ref(true)
const completing = ref(null)

const doneCount = computed(() => tasks.value.filter(t => t.completed).length)
const pct       = computed(() => tasks.value.length ? Math.round(doneCount.value/tasks.value.length*100) : 0)

async function complete(id) {
  if (completing.value) return
  completing.value = id
  try {
    const res = await completeTask(id)
    if (!res?.error) {
      tasks.value = tasks.value.map(t => t.id===id ? {...t, completed:true} : t)
      emit('coins-updated', {
        totalCoins: res?.totalCoins,
        streak: res?.streak,
        sceneProgress: res?.sceneProgress,
      })
    }
  } finally { completing.value = null }
}

onMounted(async () => {
  tasks.value = (await getTasks()) || []
  loading.value = false
})
</script>

<style scoped>
.page    { display:flex;flex-direction:column;gap:12px; }
.page-h3 { font-size:1rem;font-weight:700;color:#fff; }
.row-between { display:flex;align-items:center;justify-content:space-between; }
.mb12    { margin-bottom:12px; }
.mb16    { margin-bottom:16px; }
.sub-text { font-size:.8rem;color:rgba(255,255,255,0.4); }
.prog-track { background:rgba(255,255,255,0.1);border-radius:99px;height:7px;overflow:hidden; }
.prog-fill  { height:100%;border-radius:99px;transition:width .6s;background:linear-gradient(90deg,#2d6a4f,#52d496); }
.task-card  { display:flex;align-items:center;gap:14px;padding:16px 18px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:14px;transition:opacity .3s; }
.task-card.done { opacity:.5;border-color:rgba(255,255,255,0.05); }
.task-icon  { width:44px;height:44px;border-radius:10px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0; }
.task-body  { flex:1; }
.task-title { font-size:.95rem;font-weight:600;color:#fff;margin-bottom:3px; }
.task-desc  { font-size:.8rem;color:rgba(255,255,255,0.5); }
.badges     { display:flex;gap:6px;margin-top:6px;flex-wrap:wrap; }
.badge      { font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7); }
.badge.gold { background:rgba(244,196,48,0.15);color:#f4c430; }
.badge.cyan { background:rgba(0,242,255,0.10);color:#00f2ff; }
.act-btn    { padding:9px 18px;border-radius:30px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;transition:all .25s;display:flex;align-items:center;gap:6px;white-space:nowrap; }
.act-btn.todo { background:rgba(0,242,255,0.12);color:#00f2ff;border:1px solid rgba(0,242,255,0.25); }
.act-btn.todo:hover:not(:disabled) { background:rgba(0,242,255,0.22);color:#fff; }
.act-btn.done { background:transparent;color:rgba(255,255,255,0.3);pointer-events:none; }
.act-btn:disabled { opacity:.5;cursor:not-allowed; }
.info-card  { background:rgba(0,242,255,0.04);border:1px solid rgba(0,242,255,0.15);border-radius:14px;padding:18px; }
.info-title { font-size:.9rem;font-weight:700;color:#00f2ff;margin-bottom:8px; }
.info-body  { font-size:.85rem;color:rgba(255,255,255,0.5);line-height:1.55; }
.center-pad { text-align:center;padding:40px; }
.spin       { width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,0.1);border-top-color:#00f2ff;animation:spin .7s linear infinite;margin:auto; }
.spin.sm    { width:14px;height:14px;border-width:2px; }
@keyframes spin { to { transform:rotate(360deg); } }
</style>
