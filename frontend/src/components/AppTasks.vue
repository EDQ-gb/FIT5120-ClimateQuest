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
            <strong>{{ celebration.co2 }}</strong> g CO₂e
          </div>
        </div>
      </transition>
      <div class="tasks-grid">
        <article v-for="task in tasks" :key="task.id" class="task-card" :class="{ done: task.completed }">
          <div class="task-layout">
            <div class="task-media" :class="taskCardMediaTintClass(task.id)">
              <div class="task-icon" :class="{ 'task-icon--emoji': !taskCardImageUrl(task.id) }">
                <img
                  v-if="taskCardImageUrl(task.id)"
                  class="task-card-img"
                  :class="{ 'task-card-img--contain': taskCardUsesContainFit(task.id) }"
                  :src="taskCardImageUrl(task.id)"
                  :alt="task.title"
                  loading="lazy"
                />
                <span v-else class="task-icon-fallback" aria-hidden="true">{{ task.icon }}</span>
              </div>
            </div>
            <div class="task-main">
              <div class="task-title">{{ task.title }}</div>
              <div class="badges">
                <span class="badge gold">+{{ task.coins }} coins</span>
                <span class="badge cyan" v-if="task.co2 > 0">{{ task.co2 }}g CO2e</span>
                <span class="badge">{{ task.cat }}</span>
              </div>
              <div class="task-desc">{{ task.desc }}</div>
              <div v-if="isEnergyTipTask(task)" class="edu-tip-link-wrap">
                <button type="button" class="edu-tip-link-btn" @click="emit('navigate', 'education')">
                  Open Education page to learn
                </button>
              </div>
              <section v-if="isAiVisionTask(task)" class="vision-helper" aria-label="AI image verification">
                <div class="vision-helper__head">
                  <span class="vision-helper__title">AI image verification</span>
                  <span class="vision-helper__status" :class="{ ok: aiState(task.id).verified }">
                    {{ aiState(task.id).verified ? 'AI verified' : 'Awaiting proof' }}
                  </span>
                </div>
                <div class="vision-helper__hint">{{ aiHint(task) }}</div>
                <div v-if="isRecycleTask(task)" class="recycle-proof">
                  <div class="recycle-step">
                    <div class="recycle-step__head">
                      <strong>Step 1</strong>
                      <span :class="['recycle-step__status', { ok: aiState(task.id).recycle.bin.verified }]">
                        {{ aiState(task.id).recycle.bin.verified ? 'Passed' : 'Pending' }}
                      </span>
                    </div>
                    <label class="vision-upload">
                      <input
                        class="vision-upload__input"
                        type="file"
                        accept="image/*"
                        :disabled="task.completed || aiState(task.id).recycle.bin.analyzing || completing===task.id"
                        @change="onRecycleBinFileChange(task, $event)"
                      />
                      <span class="vision-upload__btn">Upload bin photo</span>
                      <span class="vision-upload__name">{{ aiState(task.id).recycle.bin.fileName || 'No file selected' }}</span>
                    </label>
                    <div v-if="aiState(task.id).recycle.bin.previewUrl" class="vision-preview-wrap">
                      <img class="vision-preview" :src="aiState(task.id).recycle.bin.previewUrl" :alt="`${task.title} bin proof`" />
                    </div>
                    <div v-if="aiState(task.id).recycle.bin.analyzing" class="vision-note">Checking yellow-bin color...</div>
                    <div v-if="aiState(task.id).recycle.bin.message" class="vision-ok">{{ aiState(task.id).recycle.bin.message }}</div>
                    <div v-if="aiState(task.id).recycle.bin.error" class="vision-error">{{ aiState(task.id).recycle.bin.error }}</div>
                  </div>

                  <div class="recycle-step">
                    <div class="recycle-step__head">
                      <strong>Step 2</strong>
                      <span :class="['recycle-step__status', { ok: aiState(task.id).recycle.item.verified }]">
                        {{ aiState(task.id).recycle.item.verified ? 'Passed' : 'Pending' }}
                      </span>
                    </div>
                    <label class="vision-upload">
                      <input
                        class="vision-upload__input"
                        type="file"
                        accept="image/*"
                        :disabled="task.completed || aiState(task.id).recycle.item.analyzing || completing===task.id"
                        @change="onRecycleItemFileChange(task, $event)"
                      />
                      <span class="vision-upload__btn">Upload recyclable photo</span>
                      <span class="vision-upload__name">{{ aiState(task.id).recycle.item.fileName || 'No file selected' }}</span>
                    </label>
                    <div v-if="aiState(task.id).recycle.item.previewUrl" class="vision-preview-wrap">
                      <img class="vision-preview" :src="aiState(task.id).recycle.item.previewUrl" :alt="`${task.title} recyclable proof`" />
                    </div>
                    <div v-if="aiState(task.id).recycle.item.analyzing" class="vision-note">Detecting recyclable item...</div>
                    <div v-if="aiState(task.id).recycle.item.matchedLabel" class="vision-note">
                      Detected: {{ aiState(task.id).recycle.item.matchedLabel }} ({{ formatConfidence(aiState(task.id).recycle.item.matchedScore) }})
                    </div>
                    <div v-if="aiState(task.id).recycle.item.predictions.length" class="vision-preds">
                      <span
                        v-for="(pred, idx) in aiState(task.id).recycle.item.predictions.slice(0, 3)"
                        :key="`${task.id}-recycle-pred-${idx}-${pred.label}`"
                        class="vision-pill"
                      >
                        {{ pred.label }} {{ formatConfidence(pred.score) }}
                      </span>
                    </div>
                    <div v-if="aiState(task.id).recycle.item.message" class="vision-ok">{{ aiState(task.id).recycle.item.message }}</div>
                    <div v-if="aiState(task.id).recycle.item.error" class="vision-error">{{ aiState(task.id).recycle.item.error }}</div>
                  </div>
                </div>
                <template v-else>
                  <label class="vision-upload">
                    <input
                      class="vision-upload__input"
                      type="file"
                      accept="image/*"
                      :disabled="task.completed || aiState(task.id).analyzing || completing===task.id"
                      @change="onAiFileChange(task, $event)"
                    />
                    <span class="vision-upload__btn">Upload photo</span>
                    <span class="vision-upload__name">{{ aiState(task.id).fileName || 'No file selected' }}</span>
                  </label>
                  <div v-if="aiState(task.id).previewUrl" class="vision-preview-wrap">
                    <img class="vision-preview" :src="aiState(task.id).previewUrl" :alt="`${task.title} evidence`" />
                  </div>
                  <div v-if="aiState(task.id).analyzing" class="vision-note">AI is analysing your image...</div>
                  <div v-else-if="aiState(task.id).matchedLabel" class="vision-note">
                    Detected: {{ aiState(task.id).matchedLabel }} ({{ formatConfidence(aiState(task.id).matchedScore) }})
                  </div>
                  <div v-if="aiState(task.id).predictions.length" class="vision-preds">
                    <span v-for="(pred, idx) in aiState(task.id).predictions.slice(0, 3)" :key="`${task.id}-pred-${idx}-${pred.label}`" class="vision-pill">
                      {{ pred.label }} {{ formatConfidence(pred.score) }}
                    </span>
                  </div>
                  <div v-if="isClimateArticleTask(task) && aiState(task.id).matchedKeywords.length" class="vision-note">
                    Matched keywords: {{ aiState(task.id).matchedKeywords.join(', ') }}
                  </div>
                  <div v-if="isClimateArticleTask(task) && aiState(task.id).textPreview" class="vision-ocr-preview">
                    OCR preview: {{ aiState(task.id).textPreview }}
                  </div>
                  <div v-if="isStandbyTask(task) && aiState(task.id).standbyStats" class="vision-note">
                    Brightness: {{ Math.round(aiState(task.id).standbyStats.avgLuma) }} / 255, Hot pixels: {{ Math.round(aiState(task.id).standbyStats.hotRatio * 100) }}%
                  </div>
                </template>
                <div v-if="aiState(task.id).message && !isRecycleTask(task)" class="vision-ok">{{ aiState(task.id).message }}</div>
                <div v-if="aiState(task.id).error && !isRecycleTask(task)" class="vision-error">{{ aiState(task.id).error }}</div>
                <div v-if="isRecycleTask(task) && aiState(task.id).message" class="vision-ok">{{ aiState(task.id).message }}</div>
                <div v-if="isRecycleTask(task) && aiState(task.id).error" class="vision-error">{{ aiState(task.id).error }}</div>
              </section>
              <section v-if="isPlantMealTask(task) && mealBuilderTaskId === task.id" class="recipe-helper" aria-label="Light emission meal helper">
                <div class="recipe-helper__head">
                  <span class="recipe-helper__title">Choose 3-5 ingredients</span>
                  <button class="recipe-helper__generate" type="button" @click="refreshIngredientOptions">
                    New 10
                  </button>
                </div>
                <div class="recipe-helper__hint">{{ ingredientSelectionHint }}</div>
                <div class="ingredient-picker">
                  <button
                    v-for="ingredient in visibleIngredients"
                    :key="ingredient"
                    type="button"
                    class="ingredient-chip"
                    :class="{ selected: selectedIngredients.includes(ingredient) }"
                    @click="toggleIngredient(ingredient)"
                  >
                    {{ ingredient }}
                  </button>
                </div>
                <button
                  class="recipe-action"
                  type="button"
                  :disabled="!canGenerateRecipe || recipeLoading"
                  @click="generateRecipe"
                >
                  {{ recipeLoading ? 'Generating...' : 'Generate meal idea' }}
                </button>
                <div v-if="recipeError && !recipeLoading" class="recipe-error">{{ recipeError }}</div>
                <div v-if="recipe" class="recipe-result">
                  <div class="recipe-result__title">{{ recipe.title }}</div>
                  <div class="recipe-result__source">{{ recipe.sourceLabel }}</div>
                  <ol>
                    <li v-for="step in recipe.steps" :key="step">{{ step }}</li>
                  </ol>
                  <p v-if="recipe.seasoningNote" class="recipe-result__seasoning">{{ recipe.seasoningNote }}</p>
                  <button class="recipe-action primary" type="button" @click="complete(task.id, { force: true })">
                    Complete task
                  </button>
                </div>
              </section>
            </div>
          </div>
          <button class="act-btn" :class="task.completed ? 'done' : 'todo'"
                  :disabled="task.completed || completing===task.id || (isAiVisionTask(task) && !aiState(task.id).verified)"
                  @click="complete(task.id)">
            <div v-if="completing===task.id" class="spin sm"></div>
            <span v-else>{{ actionLabel(task) }}</span>
          </button>
        </article>
      </div>
    </template>

    <div class="info-card">
      <div class="info-title">💡 About these tasks</div>
      <p class="info-body">Every mission is hooked to real-world CO₂e vibes (think walk-instead-of-drive ≈ 340 g saved). Numbers come from Australia's official emission recipe book — not fluff. Need tree money? Knock out a few tasks, spin the quiz if it is open, then spoil your map.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getTasks, completeTask, generateRecipeFromModel } from '../api/features.js'
import { recipeGenerationUserMessage } from '../utils/recipeErrorSanitize.js'
import { createRecipeRequestId } from '../utils/recipeRequestId.js'
import {
  getBalancedIngredientBatch,
  generatePlantBasedRecipe,
  sanitizeModelSteps,
  augmentModelStepsIfNeeded,
  buildSeasoningGuidance,
} from '../api/recipeGenerator.js'
import {
  taskCardImageUrl,
  taskCardUsesContainFit,
  taskCardMediaTintClass,
} from '../utils/taskCardImages.js'
import {
  aiTaskHint,
  isAiVisionTask as isAiVisionTaskId,
  verifyClimateArticlePhoto,
  verifyProducePhoto,
  verifyRecycleBinPhoto,
  verifyRecycleItemPhoto,
  verifyReusableCupPhoto,
  verifyStandbyDevicePhoto,
  verifyTaskImage,
} from '../api/imageRecognition.js'
// We emit the *resulting* totals so the shell can update immediately
// without waiting for a separate refresh roundtrip.
const emit = defineEmits(['coins-updated', 'navigate'])
const props = defineProps({
  user: Object,
  coins: { type: Number, default: 0 },
})

const tasks      = ref([])
const loading    = ref(true)
const completing = ref(null)
const celebration = ref(null)
const visibleIngredients = ref([])
const selectedIngredients = ref([])
const mealBuilderTaskId = ref(null)
const recipe = ref(null)
const recipeLoading = ref(false)
const recipeError = ref('')
const aiChecks = ref({})
let ingredientWindow = 0
let celebrationTimer = 0
let recipeGenerationSeq = 0
/** Monotonic id for the active UI request; stale HTTP responses are ignored. */
let recipeActiveRequestId = 0

// TODO(final): set to false and remove buildTemplateFallbackRecipe() once model-only UX ships.
const RECIPE_USE_TEMPLATE_FALLBACK = false

function logRecipeUi(message) {
  // eslint-disable-next-line no-console
  console.log(message)
}

const doneCount = computed(() => tasks.value.filter(t => t.completed).length)
const pct       = computed(() => tasks.value.length ? Math.round(doneCount.value/tasks.value.length*100) : 0)
const coinText  = computed(() => Number(props.coins || 0).toLocaleString())
const canGenerateRecipe = computed(() => selectedIngredients.value.length >= 3 && selectedIngredients.value.length <= 5)
const ingredientSelectionHint = computed(() => {
  const count = selectedIngredients.value.length
  if (count < 3) return `Pick ${3 - count} more to generate.`
  if (count === 5) return '5 selected — more ingredients can take longer to generate.'
  return `${count} selected. You can add ${5 - count} more.`
})

function resetRecipeGenerationFeedback({ clearRecipe = false } = {}) {
  recipeError.value = ''
  if (clearRecipe) recipe.value = null
}

watch(
  selectedIngredients,
  () => {
    recipeGenerationSeq += 1
    recipeActiveRequestId += 1
    recipeLoading.value = false
    resetRecipeGenerationFeedback({ clearRecipe: true })
    logRecipeUi('[recipe-ui] error cleared (ingredients changed)')
  },
  { deep: true },
)

function isPlantMealTask(task) {
  return Number(task?.id) === 5 || String(task?.title || '').toLowerCase() === 'light emission meal'
}

function isAiVisionTask(task) {
  return isAiVisionTaskId(Number(task?.id))
}

function isRecycleTask(task) {
  return Number(task?.id) === 7
}

function isClimateArticleTask(task) {
  return Number(task?.id) === 6
}

function isStandbyTask(task) {
  return Number(task?.id) === 4
}

function isEnergyTipTask(task) {
  return Number(task?.id) === 9
}

function isProduceTask(task) {
  return Number(task?.id) === 8
}

function createAiState() {
  return {
    analyzing: false,
    verified: false,
    matchedLabel: '',
    matchedScore: 0,
    predictions: [],
    previewUrl: '',
    fileName: '',
    message: '',
    error: '',
    matchedKeywords: [],
    textPreview: '',
    standbyStats: null,
    recycle: {
      bin: {
        analyzing: false,
        verified: false,
        previewUrl: '',
        fileName: '',
        message: '',
        error: '',
        yellowRatio: 0,
      },
      item: {
        analyzing: false,
        verified: false,
        previewUrl: '',
        fileName: '',
        predictions: [],
        matchedLabel: '',
        matchedScore: 0,
        message: '',
        error: '',
      },
    },
  }
}

function getAiState(taskId) {
  const id = Number(taskId)
  if (!aiChecks.value[id]) aiChecks.value[id] = createAiState()
  return aiChecks.value[id]
}

function aiState(taskId) {
  return getAiState(taskId)
}

function clearAiPreview(state) {
  if (state?.previewUrl) URL.revokeObjectURL(state.previewUrl)
  if (state?.recycle?.bin?.previewUrl) URL.revokeObjectURL(state.recycle.bin.previewUrl)
  if (state?.recycle?.item?.previewUrl) URL.revokeObjectURL(state.recycle.item.previewUrl)
}

function resetAiStates() {
  Object.values(aiChecks.value).forEach((state) => clearAiPreview(state))
  aiChecks.value = {}
}

function aiHint(task) {
  if (isRecycleTask(task)) {
    return 'Step 1: upload a yellow recycle-bin photo. Step 2: upload a recyclable-item photo.'
  }
  return aiTaskHint(task?.id) || 'Upload a photo as proof for AI verification.'
}

function formatConfidence(score) {
  return `${Math.round(Number(score || 0) * 100)}%`
}

async function onAiFileChange(task, event) {
  const id = Number(task?.id)
  const file = event?.target?.files?.[0]
  if (!file || !isAiVisionTaskId(id)) return

  const state = getAiState(id)
  clearAiPreview(state)
  state.previewUrl = URL.createObjectURL(file)
  state.fileName = String(file?.name || '')
  state.analyzing = true
  state.verified = false
  state.matchedLabel = ''
  state.matchedScore = 0
  state.predictions = []
  state.message = ''
  state.error = ''
  state.matchedKeywords = []
  state.textPreview = ''
  state.standbyStats = null

  try {
    if (id === 6) {
      const result = await verifyClimateArticlePhoto(file, { minHits: 1 })
      state.verified = Boolean(result?.verified)
      state.matchedKeywords = result?.matchedKeywords || []
      state.textPreview = result?.textPreview || ''
      state.message = state.verified
        ? `AI verified: climate article detected (keyword: ${state.matchedKeywords[0]}).`
        : ''
      if (!state.verified) {
        state.error = 'No climate keyword found. Try a clearer screenshot with visible article text.'
      }
    } else if (id === 3) {
      const result = await verifyReusableCupPhoto(file, { minScore: 0.45, disposableThreshold: 0.43 })
      state.predictions = result?.predictions || []
      state.verified = Boolean(result?.verified)
      state.matchedLabel = result?.matchedLabel || ''
      state.matchedScore = Number(result?.matchedScore || 0)
      if (state.verified) {
        state.message = result?.message || 'AI verified: cup detected and no disposable-cup evidence found.'
      } else {
        state.error = result?.message || 'Disposable-looking cup detected.'
      }
    } else if (id === 4) {
      const result = await verifyStandbyDevicePhoto(file)
      state.predictions = result?.predictions || []
      state.verified = Boolean(result?.verified)
      state.standbyStats = {
        avgLuma: Number(result?.avgLuma || 0),
        hotRatio: Number(result?.hotRatio || 0),
      }
      state.message = state.verified
        ? `${result?.message || 'AI verified: device appears switched off.'} (${result?.deviceLabel || 'device'})`
        : ''
      if (!state.verified) state.error = result?.message || 'Device still appears active.'
    } else if (id === 8) {
      const result = await verifyProducePhoto(file, { minScore: 0.45 })
      state.predictions = result?.predictions || []
      state.verified = Boolean(result?.verified)
      state.matchedLabel = result?.matchedLabel || ''
      state.matchedScore = Number(result?.matchedScore || 0)
      if (state.verified) {
        state.message = `AI verified: produce detected (${state.matchedLabel}).`
      } else {
        state.error = 'No produce detected. Try a clearer photo with fruit or vegetables.'
      }
    } else {
      const result = await verifyTaskImage(id, file, { minScore: 0.45 })
      state.predictions = result.predictions || []
      state.verified = Boolean(result?.match?.verified)
      state.matchedLabel = result?.match?.matchedLabel || ''
      state.matchedScore = Number(result?.match?.matchedScore || 0)
      if (state.verified) {
        state.message = `AI verified: detected ${state.matchedLabel} (${formatConfidence(state.matchedScore)}).`
      } else {
        const target = (result?.match?.expectedLabels || []).join(' / ')
        state.error = `No matching object found. Expected: ${target || 'target object'}.`
      }
    }
  } catch (e) {
    state.error = `AI detection failed: ${String(e?.message || 'Unknown error')}`
  } finally {
    state.analyzing = false
    if (event?.target) event.target.value = ''
  }
}

function recomputeRecycleVerified(state) {
  const binOk = Boolean(state?.recycle?.bin?.verified)
  const itemOk = Boolean(state?.recycle?.item?.verified)
  state.verified = binOk && itemOk
  if (state.verified) state.message = 'AI verified: bin and recyclable item checks passed.'
  else state.message = ''
}

async function onRecycleBinFileChange(task, event) {
  const id = Number(task?.id)
  const file = event?.target?.files?.[0]
  if (!file || id !== 7) return

  const state = getAiState(id)
  const binState = state.recycle.bin
  if (binState.previewUrl) URL.revokeObjectURL(binState.previewUrl)
  binState.previewUrl = URL.createObjectURL(file)
  binState.fileName = String(file?.name || '')
  binState.analyzing = true
  binState.verified = false
  binState.message = ''
  binState.error = ''
  binState.yellowRatio = 0
  state.error = ''

  try {
    const res = await verifyRecycleBinPhoto(file, { yellowRatioThreshold: 0.12 })
    binState.verified = Boolean(res?.verified)
    binState.yellowRatio = Number(res?.yellowRatio || 0)
    if (binState.verified) binState.message = res?.message || 'Bin verified.'
    else binState.error = res?.message || 'Bin check failed. Try another photo.'
  } catch (e) {
    binState.error = `Bin check failed: ${String(e?.message || 'Unknown error')}`
  } finally {
    binState.analyzing = false
    recomputeRecycleVerified(state)
    if (event?.target) event.target.value = ''
  }
}

async function onRecycleItemFileChange(task, event) {
  const id = Number(task?.id)
  const file = event?.target?.files?.[0]
  if (!file || id !== 7) return

  const state = getAiState(id)
  const itemState = state.recycle.item
  if (itemState.previewUrl) URL.revokeObjectURL(itemState.previewUrl)
  itemState.previewUrl = URL.createObjectURL(file)
  itemState.fileName = String(file?.name || '')
  itemState.analyzing = true
  itemState.verified = false
  itemState.predictions = []
  itemState.matchedLabel = ''
  itemState.matchedScore = 0
  itemState.message = ''
  itemState.error = ''
  state.error = ''

  try {
    const res = await verifyRecycleItemPhoto(file, { minScore: 0.45 })
    itemState.predictions = res?.predictions || []
    itemState.verified = Boolean(res?.verified)
    itemState.matchedLabel = res?.matchedLabel || ''
    itemState.matchedScore = Number(res?.matchedScore || 0)
    if (itemState.verified) {
      itemState.message = `Recyclable item verified (${itemState.matchedLabel}, ${formatConfidence(itemState.matchedScore)}).`
    } else {
      itemState.error = `No recyclable item found. Expected: ${(res?.expectedLabels || []).join(' / ')}.`
    }
  } catch (e) {
    itemState.error = `Item check failed: ${String(e?.message || 'Unknown error')}`
  } finally {
    itemState.analyzing = false
    recomputeRecycleVerified(state)
    if (event?.target) event.target.value = ''
  }
}

function normalizeTask(task) {
  if (Number(task?.id) !== 5) return task
  return {
    ...task,
    title: 'Light emission meal',
    desc: 'Have one meal with selected ingredients, which emits lower carbon.',
  }
}

function actionLabel(task) {
  if (task.completed) return 'Done'
  if (isAiVisionTask(task)) {
    return 'Complete task'
  }
  if (!isPlantMealTask(task)) return 'Complete'
  if (mealBuilderTaskId.value !== task.id) return 'Choose ingredients'
  return recipe.value ? 'Complete task' : 'Pick ingredients'
}

function refreshIngredientOptions() {
  const nextBatch = getBalancedIngredientBatch(ingredientWindow)
  visibleIngredients.value = nextBatch
  selectedIngredients.value = selectedIngredients.value.filter(item => visibleIngredients.value.includes(item))
  recipeGenerationSeq += 1
  resetRecipeGenerationFeedback({ clearRecipe: selectedIngredients.value.length < 3 })
  ingredientWindow += 1
}

function openMealBuilder(taskId) {
  mealBuilderTaskId.value = taskId
  selectedIngredients.value = []
  recipeGenerationSeq += 1
  resetRecipeGenerationFeedback({ clearRecipe: true })
  refreshIngredientOptions()
}

function toggleIngredient(ingredient) {
  const current = selectedIngredients.value
  if (current.includes(ingredient)) {
    selectedIngredients.value = current.filter(item => item !== ingredient)
  } else {
    if (current.length >= 5) return
    selectedIngredients.value = [...current, ingredient]
  }
}

/** Test-only escape hatch. Final version should not return template fallback. */
function buildTemplateFallbackRecipe(sourceLabel = 'Template fallback') {
  const base = generatePlantBasedRecipe(selectedIngredients.value)
  return {
    ...base,
    seasoningNote: buildSeasoningGuidance(selectedIngredients.value),
    sourceLabel,
  }
}

async function generateRecipe() {
  if (!canGenerateRecipe.value) return
  if (recipeLoading.value) {
    logRecipeUi('[recipe-ui] generate ignored (loading=true, duplicate click blocked)')
    return
  }
  const requestId = createRecipeRequestId()
  const uiToken = ++recipeActiveRequestId
  const seq = ++recipeGenerationSeq
  logRecipeUi(`[recipe-ui] generate clicked requestId=${requestId}`)
  recipeLoading.value = true
  resetRecipeGenerationFeedback({ clearRecipe: true })
  logRecipeUi(`[recipe-ui] error cleared requestId=${requestId}`)
  try {
    const modelRecipe = await generateRecipeFromModel(selectedIngredients.value, requestId)
    if (uiToken !== recipeActiveRequestId || seq !== recipeGenerationSeq) {
      logRecipeUi(`[recipe-ui] stale response ignored requestId=${requestId}`)
      return
    }
    const rawSteps = Array.isArray(modelRecipe?.steps) && modelRecipe.steps.length
      ? modelRecipe.steps
      : String(modelRecipe?.text || '').split('.').map(s => s.trim()).filter(Boolean)
    const sanitizedSteps = sanitizeModelSteps(rawSteps, selectedIngredients.value)
    const { steps: finalSteps, augmented } = augmentModelStepsIfNeeded(
      sanitizedSteps,
      selectedIngredients.value,
    )
    recipe.value = {
      title: modelRecipe?.title || 'Model-generated meal',
      ingredients: modelRecipe?.ingredients || selectedIngredients.value,
      steps: finalSteps,
      seasoningNote: buildSeasoningGuidance(selectedIngredients.value),
      sourceLabel: augmented ? 'Transformer model · clarity edits' : 'Transformer model',
    }
    recipeError.value = ''
    logRecipeUi(`[recipe-ui] request completed requestId=${requestId}`)
  } catch (e) {
    if (uiToken !== recipeActiveRequestId || seq !== recipeGenerationSeq) {
      logRecipeUi(`[recipe-ui] stale failure ignored requestId=${requestId}`)
      return
    }
    if (RECIPE_USE_TEMPLATE_FALLBACK) {
      recipe.value = buildTemplateFallbackRecipe()
    } else {
      recipe.value = null
    }
    recipeError.value = recipeGenerationUserMessage(e)
    logRecipeUi(
      `[recipe-ui] request failed requestId=${requestId} status=${e?.status || '?'} code=${e?.reason || '?'}`,
    )
  } finally {
    recipeLoading.value = false
    logRecipeUi(`[recipe-ui] loading false requestId=${requestId}`)
  }
}

async function complete(id, options = {}) {
  if (completing.value) return
  const task = tasks.value.find(t => t.id === id)
  if (isPlantMealTask(task) && !options.force) {
    if (mealBuilderTaskId.value !== id) {
      openMealBuilder(id)
      return
    }
    if (!recipe.value) {
      await generateRecipe()
      return
    }
  }
  if (isAiVisionTask(task) && !options.forceAi) {
    const state = getAiState(id)
    if (!state.verified) {
      if (isRecycleTask(task)) {
        const missing = []
        if (!state.recycle.bin.verified) missing.push('yellow bin photo')
        if (!state.recycle.item.verified) missing.push('recyclable item photo')
        state.error = `Verification incomplete: please pass ${missing.join(' and ')}.`
      } else if (isClimateArticleTask(task)) {
        state.error = 'Please upload a climate article screenshot and run AI analysis first.'
      } else if (isStandbyTask(task)) {
        state.error = 'Please upload an off-state device photo and pass AI verification first.'
      } else if (isProduceTask(task)) {
        state.error = 'Please upload a produce photo and pass AI verification first.'
      } else {
        state.error = 'Please upload an image and pass AI verification first.'
      }
      return
    }
  }
  completing.value = id
  try {
    const res = await completeTask(id)
    if (!res?.error) {
      tasks.value = tasks.value.map(t => t.id===id ? {...t, completed:true} : t)
      if (isAiVisionTask(task)) {
        const state = getAiState(id)
        state.message = 'AI verified and task completed.'
        state.error = ''
      }
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
    tasks.value = ((await getTasks()) || []).map(normalizeTask)
  } catch {
    tasks.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadTasks)

onUnmounted(() => {
  clearTimeout(celebrationTimer)
  resetAiStates()
})

watch(() => props.user?.id || props.user?.username || null, () => {
  tasks.value = []
  resetAiStates()
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
.task-layout { display:grid; grid-template-columns: 38% 1fr; gap:10px; align-items:stretch; min-height:142px; min-width:0; }
.task-media {
  border-radius:12px;
  border:1px solid rgba(255,255,255,0.14);
  overflow:hidden;
  min-height:0;
  min-width:0;
  display:flex;
  flex-direction:column;
  height: 132px;
}
.task-media--tint-energy-tip {
  /* energy-saving infographic — pale green field */
  background: #dcedc8;
  border-color: rgba(0, 0, 0, 0.08);
}
.task-icon {
  flex:1;
  width:100%;
  min-height:0;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}
.task-icon--emoji {
  border-radius:12px;
  background:rgba(255,255,255,0.12);
  font-size:2rem;
}
.task-card-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
  background: rgba(0, 0, 0, 0.16);
}
.task-card-img--contain { object-fit:contain; }
.task-icon-fallback { line-height:1; }
.task-main { display:flex; flex-direction:column; gap:8px; }
.task-title { font-size:.9rem; font-weight:700; color:#fff; line-height:1.2; }
.task-desc  { font-size:.74rem; color:rgba(255,255,255,0.56); line-height:1.42; min-height:44px; }
.edu-tip-link-wrap { margin-top: 2px; }
.edu-tip-link-btn {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(0, 242, 255, 0.28);
  background: rgba(0, 242, 255, 0.1);
  color: #d8fdff;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
}
.edu-tip-link-btn:hover {
  background: rgba(0, 242, 255, 0.18);
}
.badges     { display:flex; gap:5px; flex-wrap:wrap; }
.badge      { font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7); }
.badge.gold { background:rgba(244,196,48,0.15);color:#f4c430; }
.badge.cyan { background:rgba(0,242,255,0.10);color:#00f2ff; }
.vision-helper {
  margin-top: 4px;
  padding: 10px;
  border: 1px solid rgba(0, 242, 255, 0.2);
  border-radius: 10px;
  background: rgba(0, 242, 255, 0.06);
  overflow: hidden;
}
.vision-helper__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}
.vision-helper__title {
  font-size: .72rem;
  font-weight: 800;
  color: rgba(165, 247, 255, .95);
}
.vision-helper__status {
  font-size: .62rem;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid rgba(255, 255, 255, .15);
  color: rgba(255, 255, 255, .64);
}
.vision-helper__status.ok {
  color: #9df7cf;
  border-color: rgba(82, 212, 150, .35);
  background: rgba(82, 212, 150, .12);
}
.vision-helper__hint {
  font-size: .66rem;
  color: rgba(255, 255, 255, .52);
  line-height: 1.4;
  margin-bottom: 8px;
}
.recycle-proof {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.recycle-step {
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px;
  padding: 8px;
  background: rgba(255,255,255,.03);
}
.recycle-step__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
  font-size: .66rem;
  color: rgba(255,255,255,.82);
}
.recycle-step__status {
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 999px;
  padding: 2px 7px;
  color: rgba(255,255,255,.62);
}
.recycle-step__status.ok {
  color: #9df7cf;
  border-color: rgba(82,212,150,.4);
  background: rgba(82,212,150,.12);
}
.vision-upload {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  width: 100%;
  font-size: .64rem;
  color: rgba(255,255,255,.7);
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 10px;
  padding: 6px 8px;
  cursor: pointer;
  box-sizing: border-box;
}
.vision-upload__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.vision-upload__btn {
  border: 1px solid rgba(0,242,255,.24);
  background: rgba(0,242,255,.12);
  color: rgba(159,248,255,.96);
  border-radius: 999px;
  font-size: .62rem;
  font-weight: 700;
  padding: 4px 8px;
  white-space: nowrap;
}
.vision-upload__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255,255,255,.65);
}
.vision-preview-wrap {
  margin-top: 8px;
}
.vision-preview {
  width: 100%;
  height: 96px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(0, 0, 0, 0.18);
}
.vision-note {
  margin-top: 8px;
  font-size: .66rem;
  color: rgba(255,255,255,.72);
}
.vision-ocr-preview {
  margin-top: 7px;
  padding: 7px 8px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px;
  font-size: .62rem;
  line-height: 1.35;
  color: rgba(255,255,255,.62);
  background: rgba(255,255,255,.03);
  max-height: 84px;
  overflow: auto;
}
.vision-preds {
  margin-top: 7px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.vision-pill {
  font-size: .62rem;
  color: rgba(255,255,255,.72);
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 999px;
  padding: 2px 7px;
}
.vision-ok {
  margin-top: 7px;
  font-size: .66rem;
  color: #9df7cf;
}
.vision-error {
  margin-top: 7px;
  font-size: .66rem;
  color: #ffd8a8;
  line-height: 1.35;
}
.recipe-helper {
  margin-top: 4px;
  padding: 10px;
  border: 1px solid rgba(82,212,150,.18);
  border-radius: 10px;
  background: rgba(82,212,150,.055);
}
.recipe-helper__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.recipe-helper__title {
  font-size: .72rem;
  font-weight: 800;
  color: rgba(148,240,200,.95);
}
.recipe-helper__hint {
  font-size: .68rem;
  color: rgba(255,255,255,.48);
  line-height: 1.35;
  margin-bottom: 8px;
}
.recipe-helper__generate {
  border: 1px solid rgba(82,212,150,.3);
  background: rgba(82,212,150,.12);
  color: #9df7cf;
  border-radius: 999px;
  font-size: .68rem;
  font-weight: 800;
  padding: 4px 9px;
  cursor: pointer;
}
.ingredient-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-right: 2px;
}
.ingredient-chip {
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.07);
  color: rgba(255,255,255,.68);
  border-radius: 999px;
  font-size: .66rem;
  font-weight: 700;
  padding: 3px 8px;
  cursor: pointer;
}
.ingredient-chip.selected {
  color: #081c12;
  background: #9df7cf;
  border-color: #9df7cf;
}
.recipe-action {
  width: 100%;
  margin-top: 9px;
  border: 1px solid rgba(0,242,255,.24);
  background: rgba(0,242,255,.1);
  color: #9ff8ff;
  border-radius: 999px;
  font-size: .7rem;
  font-weight: 800;
  padding: 6px 10px;
  cursor: pointer;
}
.recipe-action.primary {
  border-color: rgba(82,212,150,.42);
  background: rgba(82,212,150,.2);
  color: #b9ffdc;
}
.recipe-action:disabled {
  cursor: not-allowed;
  opacity: .45;
}
.recipe-result {
  margin-top: 9px;
  font-size: .7rem;
  color: rgba(255,255,255,.68);
  line-height: 1.35;
}
.recipe-result__title {
  font-size: .72rem;
  font-weight: 800;
  color: #fff;
  margin-bottom: 5px;
}
.recipe-result__source {
  font-size: .64rem;
  color: rgba(148,240,200,.72);
  margin-bottom: 6px;
}
.recipe-error {
  margin-top: 7px;
  font-size: .66rem;
  color: rgba(255,210,120,.9);
  line-height: 1.35;
}
.recipe-result ol {
  margin: 0;
  padding-left: 16px;
}
.recipe-result li + li {
  margin-top: 3px;
}
.recipe-result__seasoning {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: .65rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(82, 212, 150, 0.08);
  border: 1px solid rgba(82, 212, 150, 0.2);
}
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
