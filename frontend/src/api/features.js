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
 *   POST /api/scene/select        body: { type: 'forest' }
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
  { id: 1, title: 'Walk or cycle a trip', desc: 'Replace at least one car trip with walking or cycling today.', coins: 30, co2: 340, cat: 'transport', icon: '🚶' },
  { id: 2, title: 'Use public transport', desc: 'Take a bus, tram or train instead of driving.', coins: 25, co2: 280, cat: 'transport', icon: '🚌' },
  { id: 3, title: 'Bring a reusable cup', desc: 'Use your own cup for coffee or drinks — no single-use today.', coins: 20, co2: 80, cat: 'habit', icon: '☕' },
  { id: 4, title: 'Turn off standby devices', desc: 'Switch off devices fully instead of leaving them on standby.', coins: 20, co2: 120, cat: 'energy', icon: '🔌' },
  { id: 5, title: 'Plant-based meal', desc: 'Have at least one fully plant-based meal today.', coins: 25, co2: 500, cat: 'food', icon: '🥗' },
  { id: 6, title: 'Read a short climate article', desc: 'Spend three minutes reading any trusted climate or sustainability article.', coins: 12, co2: 0, cat: 'learning', icon: '📰' },
  { id: 7, title: 'Recycle sorted materials', desc: 'Sort and place recyclables in the correct bin today.', coins: 18, co2: 150, cat: 'lifestyle', icon: '♻️' },
  { id: 8, title: 'Choose local or seasonal food', desc: 'Prepare one meal using local or seasonal ingredients.', coins: 22, co2: 320, cat: 'food', icon: '🥕' },
  { id: 9, title: 'Learn one energy-saving tip', desc: 'Watch or read one practical tip to reduce home energy use.', coins: 14, co2: 0, cat: 'learning', icon: '💡' },
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
  { q:'Which home habit usually cuts electricity waste fastest?',
    opts:['Leaving chargers plugged in','Turning off standby devices','Opening windows all day','Using brighter bulbs'], ans:1,
    exp:'Turning devices fully off (not standby) avoids continuous background electricity use.' },
  { q:'Why does using a reusable cup help climate action?',
    opts:['It always keeps drinks hotter','It reduces single-use production and waste','It makes coffee cheaper everywhere','It removes all transport emissions'], ans:1,
    exp:'Reusable cups help lower demand for single-use products and related emissions across production and disposal.' },
  { q:'Which option is generally lower-carbon for a short urban trip?',
    opts:['Solo driving','Walking or cycling','Ride-hailing detour','Idling in traffic'], ans:1,
    exp:'Walking and cycling avoid direct fuel emissions for short trips.' },
  { q:'What is a practical way to reduce food-related emissions?',
    opts:['Waste more leftovers','Choose local and seasonal produce more often','Only buy imported out-of-season food','Cook with single-use items every meal'], ans:1,
    exp:'Local and seasonal choices can reduce transport/storage impacts and usually support lower-footprint meals.' },
  { q:'What does daily climate action mostly rely on?',
    opts:['One perfect day','Consistent small habits over time','Only large donations','Ignoring personal behavior'], ans:1,
    exp:'Sustained small actions compound into meaningful long-term impact.' },
  { q:'If a quiz answer is wrong in ClimateQuest, what still happens?',
    opts:['No record is saved','The quiz completion is still recorded for the day','Your account is reset','You lose all coins'], ans:1,
    exp:'The attempt is still recorded, and you get learning feedback even without coin rewards.' },
  { q:'Which statement best matches "climate literacy"?',
    opts:['Memorizing only one statistic','Understanding causes, impacts, and practical actions','Following trends without evidence','Avoiding all discussions'], ans:1,
    exp:'Climate literacy means understanding systems and being able to act on reliable information.' },
  { q:'What is the main purpose of the Leaderboard in this project?',
    opts:['Punish low scores','Visualize and motivate climate contribution progress','Replace all education content','Track private browser tabs'], ans:1,
    exp:'The leaderboard is a motivation tool to visualize progress and encourage ongoing climate-friendly actions.' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0] }
function dayIdx() {
  const day = today()
  let hash = 0
  for (let i = 0; i < day.length; i++) hash = (hash * 33 + day.charCodeAt(i)) >>> 0
  return hash % QUIZ_BANK.length
}

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
  quizResult:  'cq_quiz_result',  // { 'YYYY-MM-DD': { correct, correctAnswer, explanation, selectedAnswer, coinsEarned } }
  coins:       'cq_coins',        // number
  xp:          'cq_xp',           // number
}

<<<<<<< HEAD
let activeStorageUser = ''

function storageScope() {
  const u = String(activeStorageUser || '').trim().toLowerCase()
  return u ? `cq:${u}:features` : 'cq:guest:features'
}

function scopedKey(key) {
  return `${storageScope()}:${key}`
}

export function setFeatureStorageUser(username) {
  activeStorageUser = String(username || '').trim().toLowerCase()
}

export function clearLegacyFeatureStorage() {
  try {
    Object.values(K).forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
}

function get(key, def) {
  try { return JSON.parse(localStorage.getItem(scopedKey(key)) ?? 'null') ?? def }
  catch { return def }
}
function set(key, val) { localStorage.setItem(scopedKey(key), JSON.stringify(val)) }
=======
function currentMockScope() {
  try {
    const raw = localStorage.getItem('cq_user_scope')
    const v = String(raw || 'guest').trim().toLowerCase()
    return v || 'guest'
  } catch {
    return 'guest'
  }
}

function scopedKey(baseKey) {
  return `${baseKey}::${currentMockScope()}`
}

function get(key, def) {
  const sk = scopedKey(key)
  try {
    const raw = localStorage.getItem(sk)
    return JSON.parse(raw ?? 'null') ?? def
  }
  catch { return def }
}
function set(key, val) {
  try {
    localStorage.setItem(scopedKey(key), JSON.stringify(val))
  } catch {
    // ignore storage quota/privacy mode issues in mock fallback
  }
}
>>>>>>> origin/main

function getCompletions() { return get(K.completions, {}) }
function getSceneState()  { return get(K.scene, { type: 'forest', progress: 0 }) }
function getQuizLog()     { return get(K.quizLog, {}) }
function getQuizResultLog(){ return get(K.quizResult, {}) }
function getCoins()       { return get(K.coins, 120) }
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
  } catch (e) {
    // Only fall back when the backend route truly doesn't exist.
    // For auth/network/server errors we should surface the failure so users don't
    // "earn" coins that never reach the database.
    if (String(e?.message || '') !== 'NOT_FOUND') throw e
    const done = (getCompletions()[today()] || [])
    return TASKS.map(t => ({ ...t, completed: done.includes(t.id) }))
  }
}

export async function completeTask(id) {
  try {
    return await req(`/api/tasks/${id}/complete`, { method: 'POST' })
  } catch (e) {
    if (String(e?.message || '') !== 'NOT_FOUND') throw e
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
  catch (e) {
    if (String(e?.message || '') !== 'NOT_FOUND') throw e
    return getSceneState()
  }
}

export async function getProgress() {
  try {
    return await req('/api/progress')
  } catch (e) {
    if (String(e?.message || '') !== 'NOT_FOUND') throw e
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
    return {
      coins,
      xp,
      level: Math.floor(xp / 200) + 1,
      xpInLevel: xp % 200,
      streak: calcStreak(completions),
      streakMilestones: { sevenDay: calcStreak(completions) >= 7, thirtyDay: calcStreak(completions) >= 30 },
      todayDone: done,
      totalTasks: TASKS.length,
      allTimeTasks: tasks,
      co2Saved: co2,
      week,
      weekSummaries: [],
    }
  }
}

export async function getQuiz() {
  try { return await req('/api/quiz') }
  catch (e) {
    if (String(e?.message || '') !== 'NOT_FOUND') throw e
    const idx = dayIdx()
    const q = { ...QUIZ_BANK[idx] }; delete q.ans; delete q.exp
    const completed = !!getQuizLog()[today()]
    const completedResult = completed ? (getQuizResultLog()[today()] || null) : null
    return { question: q, completed, idx, completedResult }
  }
}

export async function submitQuiz(idx, answer) {
  try {
    return await req('/api/quiz/submit', { method: 'POST', body: JSON.stringify({ idx, answer }) })
  } catch (e) {
    if (String(e?.message || '') !== 'NOT_FOUND') throw e
    const log = getQuizLog()
    if (log[today()]) return { error: 'Already completed today' }
    log[today()] = true; set(K.quizLog, log)
    const q       = QUIZ_BANK[idx]
    const correct = answer === q.ans
    const quizResultLog = getQuizResultLog()
    quizResultLog[today()] = {
      correct,
      correctAnswer: q.ans,
      explanation: q.exp,
      selectedAnswer: answer,
      coinsEarned: correct ? 25 : 0,
    }
    set(K.quizResult, quizResultLog)
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
  catch (e) {
    if (String(e?.message || '') !== 'NOT_FOUND') throw e
    return [] // No mock for leaderboard — needs real backend data
  }
}

export async function getHomeSummary() {
  return await req('/api/home/summary')
}

export async function postCheckIn() {
  return await req('/api/check-in', { method: 'POST', body: JSON.stringify({}) })
}

export async function patchProfile({ profilePublic }) {
  return await req('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ profilePublic }),
  })
}

export async function getRewardHistory(limit = 80) {
  return await req(`/api/rewards/history?limit=${encodeURIComponent(limit)}`)
}

export async function getQuickActionsCatalog() {
  return await req('/api/quick-actions/catalog')
}

export async function logQuickAction(actionKey) {
  return await req('/api/quick-actions/log', {
    method: 'POST',
    body: JSON.stringify({ actionKey }),
  })
}
