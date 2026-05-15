<template>
  <div class="page">
    <div class="page-top">
      <span class="coins-pill">🪙 {{ coinText }}</span>
    </div>
    <div class="grid-2">
      <!-- Quiz panel -->
      <div>
        <div class="row-between mb16">
          <h3 class="page-h3">Daily Climate Quiz</h3>
          <span class="badge cyan" v-if="!quiz.completed">+25 coins</span>
          <span class="badge green" v-else>Completed ✓</span>
        </div>

        <div v-if="loading" class="center-pad"><div class="spin"></div></div>

        <template v-else-if="!quiz.completed">
          <div class="quiz-q">{{ quiz.question?.q }}</div>
          <div class="quiz-opts">
            <button v-for="(opt, i) in quiz.question?.opts" :key="i"
                    type="button"
                    class="quiz-opt" :class="optClass(i)"
                    @click.prevent.stop="select(i)">
              <span class="opt-letter">{{ ['A','B','C','D'][i] }}</span>
              {{ opt }}
            </button>
          </div>
          <button type="button" class="submit-btn" :disabled="selected===null||submitting" @click.prevent.stop="submit">
            <div v-if="submitting" class="spin sm"></div>
            <span v-else>Lock in my pick</span>
          </button>
          <div v-if="result" class="quiz-result" :class="result.correct?'correct':'wrong'">
            <strong>{{ result.correct ? '✓ Correct! +25 coins' : '✗ Not quite' }}</strong><br><br>
            {{ result.explanation }}
          </div>
        </template>

        <div v-else class="glass-card center-pad">
          <div style="font-size:2.4rem;margin-bottom:12px;">✅</div>
          <div class="fw7 green">Today's quiz done!</div>
          <div class="sub-text mt8">Come back tomorrow for a new question.</div>
          <div v-if="result" class="quiz-result mt8" :class="result.correct?'correct':'wrong'">
            <strong>{{ result.correct ? '✓ Correct! +25 coins' : '✗ Not quite this time' }}</strong><br><br>
            <div v-if="result.correctAnswer !== undefined" style="margin-bottom:8px;">
              Correct answer: <strong>{{ ['A','B','C','D'][result.correctAnswer] }}</strong>
            </div>
            {{ result.explanation }}
          </div>
        </div>
      </div>

      <!-- Info panel -->
      <div>
        <p class="quiz-intro-callout mb16">
          One juicy question stands between you and bonus coins + a greener scene today. Peek at each choice — winners walk away smarter for school and Saturday alike.
        </p>
        <h3 class="page-h3 mb16">Why play?</h3>
        <div class="glass-card mb12">
          <div class="info-title green">🧠 Power-up your know-how</div>
          <p class="sub-text">Scenarios sip real Australian climate juice, not random pub-quiz filler.</p>
        </div>
        <div class="glass-card mb12">
          <div class="info-title cyan">🪙 Coin shower</div>
          <p class="sub-text">Nail it for +25 coins and a sweet +3% bump toward your scene’s comeback bar.</p>
        </div>
        <div class="glass-card">
          <div class="info-title gold">📅 Fresh daily</div>
          <p class="sub-text">Seven rotating boss questions — tomorrow always brings a new one.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getQuiz, submitQuiz } from '../api/features.js'

const props = defineProps({
  user: Object,
  coins: { type: Number, default: 0 },
})
const emit = defineEmits(['coins-updated', 'stay-on-quiz'])

const quiz       = ref({ completed: false, question: null, idx: 0 })
const selected   = ref(null)
const submitting = ref(false)
const result     = ref(null)
const loading    = ref(true)
const coinText   = computed(() => Number(props.coins || 0).toLocaleString())
const RESULT_KEY = 'cq_quiz_feedback'

function resultStorageKey() {
  const u = String(props.user?.username || 'guest').trim().toLowerCase() || 'guest'
  const d = new Date().toISOString().split('T')[0]
  return `${RESULT_KEY}:${u}:${d}`
}

function saveResultCache(res) {
  try {
    localStorage.setItem(resultStorageKey(), JSON.stringify(res || null))
  } catch {
    // ignore
  }
}

function loadResultCache() {
  try {
    const raw = localStorage.getItem(resultStorageKey())
    return JSON.parse(raw || 'null')
  } catch {
    return null
  }
}

function select(i) { if (!result.value) selected.value = i }

function optClass(i) {
  if (!result.value) return selected.value === i ? 'selected' : ''
  if (i === result.value.correctAnswer) return 'correct'
  if (i === selected.value && !result.value.correct) return 'wrong'
  return ''
}

async function submit() {
  if (selected.value === null || submitting.value) return
  submitting.value = true
  try {
    const res = await submitQuiz(quiz.value.idx, selected.value)
    if (res?.error) return
    result.value = res
    saveResultCache(res)
    quiz.value.completed = true
    emit('stay-on-quiz')
    emit('coins-updated', {
      totalCoins: res?.totalCoins,
      streak: res?.streak,
      sceneProgress: res?.sceneProgress,
    })
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const data = (await getQuiz()) || quiz.value
  quiz.value = data
  if (data?.completedResult) {
    result.value = data.completedResult
    saveResultCache(data.completedResult)
  } else if (data?.completed) {
    result.value = loadResultCache()
  }
  loading.value = false
})
</script>

<style scoped>
.page { display:flex;flex-direction:column;gap:16px; }
.page-top { display:flex;justify-content:flex-end; }
.grid-2 { display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start; }
.quiz-intro-callout {
  font-size: .84rem;
  line-height: 1.52;
  color: rgba(255, 255, 255, 0.72);
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(0, 242, 255, 0.2);
  background: rgba(0, 242, 255, 0.05);
}
.page-h3 { font-size:1rem;font-weight:700;color:#fff; }
.coins-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: .78rem;
  font-weight: 700;
  color: #f4c430;
  background: rgba(244,196,48,0.14);
  border: 1px solid rgba(244,196,48,0.3);
}
.mb12 { margin-bottom:12px; }
.mb16 { margin-bottom:16px; }
.mt8  { margin-top:8px; }
.row-between { display:flex;align-items:center;justify-content:space-between; }
.badge  { font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:99px; }
.badge.cyan  { background:rgba(0,242,255,0.12);color:#00f2ff; }
.badge.green { background:rgba(82,212,150,0.12);color:#52d496; }
.fw7  { font-weight:700; }
.green { color:#52d496; }
.cyan  { color:#00f2ff; }
.sub-text { font-size:.8rem;color:rgba(255,255,255,0.45);line-height:1.5; }
.glass-card { background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:18px; }
.info-title { font-size:.9rem;font-weight:700;margin-bottom:6px; }
.gold { color:#f4c430; }
.quiz-q  { font-size:1rem;font-weight:600;line-height:1.55;margin-bottom:20px;padding:18px 20px;background:rgba(0,242,255,0.04);border-left:3px solid #00f2ff;border-radius:0 10px 10px 0;color:#fff; }
.quiz-opts { display:flex;flex-direction:column;gap:9px; }
.quiz-opt  { display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);cursor:pointer;font-size:.92rem;font-weight:500;color:#fff;text-align:left;transition:all .22s;font-family:inherit; }
.quiz-opt:hover:not(:disabled){ border-color:rgba(0,242,255,0.4); }
.quiz-opt.selected { border-color:#00f2ff;background:rgba(0,242,255,0.08);color:#00f2ff; }
.quiz-opt.correct  { border-color:#52d496;background:rgba(82,212,150,0.1);color:#52d496; }
.quiz-opt.wrong    { border-color:#e05252;background:rgba(224,82,82,0.08);color:#e05252; }
.opt-letter { width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;flex-shrink:0; }
.submit-btn { width:100%;margin-top:16px;padding:13px;background:#00f2ff;color:#000;border:none;border-radius:12px;font-size:.95rem;font-weight:700;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .25s; }
.submit-btn:hover:not(:disabled){ opacity:.9; }
.submit-btn:disabled { opacity:.45;cursor:not-allowed; }
.quiz-result { margin-top:16px;padding:15px 18px;border-radius:12px;font-size:.88rem;line-height:1.55; }
.quiz-result.correct { background:rgba(82,212,150,0.08);border:1px solid rgba(82,212,150,0.22);color:#a8d8b8; }
.quiz-result.wrong   { background:rgba(224,82,82,0.07);border:1px solid rgba(224,82,82,0.18);color:#f09090; }
.center-pad { text-align:center;padding:32px 20px; }
.spin    { width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,0.1);border-top-color:#00f2ff;animation:spin .7s linear infinite;margin:auto; }
.spin.sm { width:14px;height:14px;border-width:2px; }
@keyframes spin { to{ transform:rotate(360deg); } }
@media(max-width:700px){ .grid-2{grid-template-columns:1fr;} }
</style>
