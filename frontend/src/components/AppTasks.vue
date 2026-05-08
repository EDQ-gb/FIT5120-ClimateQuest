<template>
  <div class="page">
    <div class="row-between mb12">
      <h3 class="page-h3">Daily Green Actions</h3>
      <div class="header-right">
        <span class="coins-pill">🪙 {{ coinText }}</span>
        <span class="sub-text">{{ doneCount }} / {{ tasks.length }} completed</span>
      </div>
    </div>
    <div class="prog-track mb16"><div class="prog-fill" :style="{ width: pct+'%' }"></div></div>

    <div class="tasks-guide" role="note">
      <strong>Real science, real loot:</strong>
      each win uses official Aussie carbon math, so your totals mean something — not just made-up points.
      Give a task a minute now, then sprint to My Scene while the win still feels warm.
    </div>

    <div v-if="loading" class="center-pad"><div class="spin"></div></div>

    <template v-else>
      <transition name="celebrate-pop">
        <div v-if="celebration" class="celebrate-toast">
          <div class="celebrate-firework"></div>
          <div class="celebrate-title">🎉 Congratulations!</div>
          <div class="celebrate-text">
            You completed <strong>{{ celebration.title }}</strong> and saved
            <strong>{{ celebration.co2 }}</strong> g CO₂.
          </div>
        </div>
      </transition>
      <div class="tasks-grid">
        <article v-for="task in tasks" :key="task.id" class="task-card" :class="{ done: task.completed }">
          <div class="task-layout">
            <div class="task-media">
              <div class="task-icon">{{ task.icon }}</div>
            </div>
            <div class="task-main">
              <div class="task-title">{{ task.title }}</div>
              <div class="badges">
                <span class="badge gold">+{{ task.coins }} coins</span>
                <span class="badge cyan" v-if="task.co2 > 0">{{ task.co2 }}g CO₂</span>
                <span class="badge">{{ task.cat }}</span>
              </div>
              <div class="task-desc">{{ task.desc }}</div>
            </div>
          </div>
          <button class="act-btn" :class="task.completed ? 'done' : 'todo'"
                  :disabled="task.completed || completing===task.id"
                  @click="complete(task.id)">
            <div v-if="completing===task.id" class="spin sm"></div>
            <span v-else>{{ task.completed ? '✓ Done' : 'Complete' }}</span>
          </button>
        </article>
      </div>
    </template>

    <div class="info-card">
      <div class="info-title">💡 About these tasks</div>
      <p class="info-body">Every mission is hooked to real-world CO₂ vibes (think walk-instead-of-drive ≈ 340 g saved). Numbers come from Australia’s official emission recipe book — not fluff. Need tree money? Knock out a few tasks, spin the quiz if it is open, then spoil your map.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getTasks, completeTask } from '../api/features.js'
// We emit the *resulting* totals so the shell can update immediately
// without waiting for a separate refresh roundtrip.
const emit = defineEmits(['coins-updated'])
const props = defineProps({
  user: Object,
  coins: { type: Number, default: 0 },
})

const tasks      = ref([])
const loading    = ref(true)
const completing = ref(null)
const celebration = ref(null)
let celebrationTimer = 0

const doneCount = computed(() => tasks.value.filter(t => t.completed).length)
const pct       = computed(() => tasks.value.length ? Math.round(doneCount.value/tasks.value.length*100) : 0)
const coinText  = computed(() => Number(props.coins || 0).toLocaleString())

async function complete(id) {
  if (completing.value) return
  completing.value = id
  try {
    const res = await completeTask(id)
    if (!res?.error) {
      tasks.value = tasks.value.map(t => t.id===id ? {...t, completed:true} : t)
      const completedTask = tasks.value.find(t => t.id === id)
      triggerCelebration(completedTask, res)
      emit('coins-updated', {
        totalCoins: res?.totalCoins,
        streak: res?.streak,
        sceneProgress: res?.sceneProgress,
      })
    }
  } finally { completing.value = null }
}

function triggerCelebration(task, res) {
  clearTimeout(celebrationTimer)
  celebration.value = {
    title: task?.title || 'a green task',
    co2: Number(res?.co2Saved || task?.co2 || 0).toLocaleString(),
  }
  celebrationTimer = setTimeout(() => {
    celebration.value = null
  }, 2600)
}

async function loadTasks() {
  loading.value = true
  try {
    tasks.value = (await getTasks()) || []
  } catch {
    tasks.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadTasks)

watch(() => props.user?.id || props.user?.username || null, () => {
  tasks.value = []
  loadTasks()
})
</script>

<style scoped>
.page    { display:flex;flex-direction:column;gap:12px; }
.page-h3 { font-size:1rem;font-weight:700;color:#fff; }
.row-between { display:flex;align-items:center;justify-content:space-between; }
.header-right { display:flex;align-items:center;gap:10px; }
.mb12    { margin-bottom:12px; }
.mb16    { margin-bottom:16px; }
.sub-text { font-size:.8rem;color:rgba(255,255,255,0.4); }
.coins-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: .78rem;
  font-weight: 700;
  color: #f4c430;
  background: rgba(244,196,48,0.14);
  border: 1px solid rgba(244,196,48,0.3);
}
.prog-track { background:rgba(255,255,255,0.1);border-radius:99px;height:7px;overflow:hidden; }
.prog-fill  { height:100%;border-radius:99px;transition:width .6s;background:linear-gradient(90deg,#2d6a4f,#52d496); }
.tasks-guide {
  font-size: .8rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.58);
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(82, 212, 150, 0.2);
  background: rgba(82, 212, 150, 0.06);
  margin-bottom: 4px;
}
.tasks-guide strong {
  display: block;
  font-size: 0.78rem;
  color: rgba(148, 240, 200, 0.95);
  margin-bottom: 6px;
  font-weight: 700;
}

.tasks-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; }
.task-card  { display:flex; flex-direction:column; gap:10px; padding:14px 14px 12px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:14px; transition:opacity .3s; min-height:210px; }
.task-card.done { opacity:.55; border-color:rgba(255,255,255,0.06); }
.task-layout { display:grid; grid-template-columns: 38% 1fr; gap:10px; align-items:stretch; min-height:142px; }
.task-media {
  border-radius:12px;
  border:1px solid rgba(255,255,255,0.14);
  background:rgba(255,255,255,0.08);
  display:flex;
  align-items:center;
  justify-content:center;
}
.task-icon  { width:64px; height:64px; border-radius:14px; background:rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; font-size:2rem; flex-shrink:0; }
.task-main { display:flex; flex-direction:column; gap:8px; }
.task-title { font-size:.9rem; font-weight:700; color:#fff; line-height:1.2; }
.task-desc  { font-size:.74rem; color:rgba(255,255,255,0.56); line-height:1.42; min-height:44px; }
.badges     { display:flex; gap:5px; flex-wrap:wrap; }
.badge      { font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7); }
.badge.gold { background:rgba(244,196,48,0.15);color:#f4c430; }
.badge.cyan { background:rgba(0,242,255,0.10);color:#00f2ff; }
.act-btn    { margin-top:auto; align-self:center; padding:8px 16px; border-radius:30px; font-size:.78rem; font-weight:700; border:none; cursor:pointer; transition:all .25s; display:flex; align-items:center; gap:6px; white-space:nowrap; }
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
.celebrate-toast {
  position: fixed;
  top: 92px;
  right: 22px;
  z-index: 40;
  width: min(360px, calc(100vw - 28px));
  border-radius: 14px;
  border: 1px solid rgba(82,212,150,.35);
  background: rgba(8,28,18,.9);
  padding: 12px 14px;
  box-shadow: 0 14px 30px rgba(0,0,0,.35);
}
.celebrate-title {
  font-size: .9rem;
  font-weight: 800;
  color: #9df7cf;
  margin-bottom: 4px;
}
.celebrate-text {
  font-size: .8rem;
  color: rgba(255,255,255,.88);
  line-height: 1.45;
}
.celebrate-firework {
  position: absolute;
  right: 14px;
  top: 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #52d496;
  box-shadow:
    0 -14px 0 #f4c430, 0 14px 0 #00f2ff, 14px 0 0 #52d496, -14px 0 0 #ff8ad8,
    10px 10px 0 #ffd166, -10px 10px 0 #06d6a0, 10px -10px 0 #7aa2ff, -10px -10px 0 #ff6b6b;
  animation: firework 1.2s ease-in-out infinite;
}
@keyframes firework {
  0%,100% { transform: scale(.8); opacity: .75; }
  50% { transform: scale(1.05); opacity: 1; }
}
.celebrate-pop-enter-active,.celebrate-pop-leave-active{ transition: all .22s ease; }
.celebrate-pop-enter-from,.celebrate-pop-leave-to{ opacity:0; transform: translateY(-8px); }
@media(max-width:1000px){ .tasks-grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
@media(max-width:640px){ .tasks-grid{grid-template-columns:1fr;} .task-layout{grid-template-columns:34% 1fr;} }
</style>
