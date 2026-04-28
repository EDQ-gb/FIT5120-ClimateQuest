/**
 * ClimateQuest — Feature API
 * ─────────────────────────────────────────────────────────────
 * Calls real backend endpoints if they exist.
 * Falls back to localStorage mock if backend returns 404.
 *
 * Backend team: add these endpoints to server/src/index.js:
 *   GET  /api/tasks
 *   POST /api/tasks/:id/complete
 *   GET  /api/scene
 *   POST /api/scene/select        body: { type: 'forest'|'glacier' }
 *   GET  /api/quiz
 *   POST /api/quiz/submit          body: { idx, answer }
 *   GET  /api/progress
 *   GET  /api/leaderboard
 *
 * DB tables needed (add to schema.sql):
 *   task_logs, scenes, quiz_results, coins (or add coins/xp cols to users)
 * ─────────────────────────────────────────────────────────────
 */

// ── Static mock data ──────────────────────────────────────────────────────────

export const TASKS = [
  { id:1, title:'Walk or cycle a trip',      desc:'Replace at least one car trip with walking or cycling today.',   coins:30, co2:340, cat:'transport', icon:'🚶' },
  { id:2, title:'Use public transport',       desc:'Take a bus, tram or train instead of driving.',                  coins:25, co2:280, cat:'transport', icon:'🚌' },
  { id:3, title:'Bring a reusable cup',       desc:'Use your own cup for coffee or drinks — no single-use today.',  coins:20, co2:80,  cat:'habit',     icon:'☕' },
  { id:4, title:'Turn off standby devices',  desc:'Switch off devices fully instead of leaving them on standby.',   coins:20, co2:120, cat:'energy',    icon:'🔌' },
  { id:5, title:'Plant-based meal',           desc:'Have at least one fully plant-based meal today.',                coins:25, co2:500, cat:'food',      icon:'🥗' },
  { id:6, title:'Daily check-in',             desc:'Log in and review your climate impact for today.',               coins:10, co2:0,   cat:'habit',     icon:'✅' },
]

export const QUIZ_BANK = [
  { q:'Which sector contributes most to Melbourne\'s greenhouse gas emissions?',
    opts:['Transport','Energy (electricity & gas)','Waste','Agriculture'], ans:1,
    exp:'Energy (electricity and gas) accounts for ~54% of Melbourne\'s GHG emissions (City of Melbourne data).' },
  { q:'How much CO₂ does walking 2 km save vs driving the same distance?',
    opts:['~100 g','~340 g','~1 kg','~50 g'], ans:1,
    exp:'Based on Australian Government NGA Emission Factors, a 2 km car trip emits ~340 g CO₂.' },
  { q:'What does "net zero" mean?',
    opts:['Zero industrial emissions','Emissions = removals','50% emission cut','No fossil fuels'], ans:1,
    exp:'Net zero means greenhouse gas emissions equal the amount removed from the atmosphere.' },
  { q:'Roughly what % of 18–34 Australians worry about climate change?',
    opts:['40%','60%','80%','95%'], ans:2,
    exp:'NCLS Research (2025): 80% of 18–34 year-olds are at least moderately worried.' },
  { q:'How long can a plastic bag take to decompose?',
    opts:['10 years','50 years','500 years','5,000 years'], ans:2,
    exp:'Plastic bags can take up to 500 years to break down in landfill.' },
  { q:'A plant-based diet produces roughly how much less CO₂ than a high-meat diet?',
    opts:['Same','~1.5× less','~2.5× less','~10× less'], ans:2,
    exp:'Research shows a vegan diet emits ~2.5× less CO₂ than a high-meat diet.' },
  { q:'Iceland generates nearly all its electricity from:',
    opts:['Coal','Natural gas','Nuclear','Renewables (geothermal/hydro)'], ans:3,
    exp:'Iceland generates ~100% of electricity from renewable geothermal and hydro sources.' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0] }
function dayIdx() { return new Date().getDate() % QUIZ_BANK.length }

async function req(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
  })
  if (res.status === 404) throw new Error('NOT_FOUND') // backend route doesn't exist yet → use mock
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `HTTP_${res.status}`)
  return data
}

// ── localStorage mock state ───────────────────────────────────────────────────
const K = {
  completions: 'cq_completions',  // { 'YYYY-MM-DD': [taskId,...] }
  scene:       'cq_scene',        // { type, progress }
  quizLog:     'cq_quiz_log',     // { 'YYYY-MM-DD': true }
  coins:       'cq_coins',        // number
  xp:          'cq_xp',           // number
}

function get(key, def) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def }
  catch { return def }
}
function set(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

function getCompletions() { return get(K.completions, {}) }
function getSceneState()  { return get(K.scene, { type: 'forest', progress: 0 }) }
function getQuizLog()     { return get(K.quizLog, {}) }
function getCoins()       { return get(K.coins, 0) }
function getXp()          { return get(K.xp, 0) }

function calcStreak(completions) {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const k = d.toISOString().split('T')[0]
    if ((completions[k] || []).length > 0) streak++
    else if (i > 0) break
  }
  return streak
}

function calcActivityStreak(completions, quizLog) {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const k = d.toISOString().split('T')[0]
    const hasTask = (completions[k] || []).length > 0
    const hasQuiz = !!quizLog[k]
    if (hasTask || hasQuiz) streak++
    else if (i > 0) break
  }
  return streak
}

function calcTotals(completions) {
  let tasks = 0, co2 = 0
  Object.values(completions).forEach(day => {
    tasks += day.length
    day.forEach(tid => { const t = TASKS.find(x => x.id === tid); if (t) co2 += t.co2 })
  })
  return { tasks, co2 }
}

// ── Public API (try real backend → fall back to mock) ─────────────────────────

export async function getTasks() {
  try {
    return await req('/api/tasks')
  } catch {
    const done = (getCompletions()[today()] || [])
    return TASKS.map(t => ({ ...t, completed: done.includes(t.id) }))
  }
}

export async function completeTask(id) {
  try {
    return await req(`/api/tasks/${id}/complete`, { method: 'POST' })
  } catch {
    const task = TASKS.find(t => t.id === id)
    if (!task) return { error: 'Task not found' }
    const completions = getCompletions()
    if (!completions[today()]) completions[today()] = []
    if (completions[today()].includes(id)) return { error: 'Already completed today' }
    completions[today()].push(id)
    set(K.completions, completions)
    const coins = getCoins() + task.coins
    const xp    = getXp()   + task.coins
    set(K.coins, coins); set(K.xp, xp)
    const scene = getSceneState()
    scene.progress = Math.min(100, scene.progress + 2)
    set(K.scene, scene)
    return { success: true, coinsEarned: task.coins, totalCoins: coins, co2Saved: task.co2, sceneProgress: scene.progress, streak: calcStreak(completions) }
  }
}

export async function getScene() {
  try { return await req('/api/scene') }
  catch { return getSceneState() }
}

export async function selectScene(type) {
  try {
    return await req('/api/scene/select', { method: 'POST', body: JSON.stringify({ type }) })
  } catch {
    const scene = getSceneState(); scene.type = type; set(K.scene, scene); return scene
  }
}

export async function getProgress() {
  try {
    return await req('/api/progress')
  } catch {
    const completions = getCompletions()
    const done  = (completions[today()] || []).length
    const xp    = getXp()
    const coins = getCoins()
    const { tasks, co2 } = calcTotals(completions)
    const week = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const k = d.toISOString().split('T')[0]
      week.push({ date: k, label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], count: (completions[k]||[]).length })
    }
    return { coins, xp, level: Math.floor(xp/200)+1, xpInLevel: xp%200, streak: calcStreak(completions), todayDone: done, totalTasks: TASKS.length, allTimeTasks: tasks, co2Saved: co2, week }
  }
}

export async function getQuiz() {
  try { return await req('/api/quiz') }
  catch {
    const idx = dayIdx()
    const q = { ...QUIZ_BANK[idx] }; delete q.ans; delete q.exp
    return { question: q, completed: !!getQuizLog()[today()], idx }
  }
}

export async function submitQuiz(idx, answer) {
  try {
    return await req('/api/quiz/submit', { method: 'POST', body: JSON.stringify({ idx, answer }) })
  } catch {
    const log = getQuizLog()
    if (log[today()]) return { error: 'Already completed today' }
    log[today()] = true; set(K.quizLog, log)
    const q       = QUIZ_BANK[idx]
    const correct = answer === q.ans
    if (correct) {
      set(K.coins, getCoins() + 25); set(K.xp, getXp() + 25)
      const scene = getSceneState(); scene.progress = Math.min(100, scene.progress+3); set(K.scene, scene)
    }
    const completions = getCompletions()
    return {
      correct,
      correctAnswer: q.ans,
      explanation: q.exp,
      coinsEarned: correct ? 25 : 0,
      totalCoins: getCoins(),
      sceneProgress: getSceneState().progress,
      streak: calcActivityStreak(completions, log),
    }
  }
}

export async function getLeaderboard() {
  try { return await req('/api/leaderboard') }
  catch { return [] } // No mock for leaderboard — needs real backend data
}
