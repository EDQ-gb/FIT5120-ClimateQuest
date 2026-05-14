const AI_TASK_TARGETS = {
  1: {
    labels: ['bicycle'],
    hint: 'Upload a photo containing a bicycle.',
  },
  2: {
    labels: ['bus', 'train'],
    hint: 'Upload a photo containing a bus or train.',
  },
  3: {
    labels: ['cup'],
    hint: 'Upload a photo containing a cup.',
  },
  4: {
    labels: [],
    hint: 'Upload a photo of the device in off/standby-off state.',
  },
  6: {
    labels: [],
    hint: 'Upload a screenshot/photo of a climate article.',
  },
  7: {
    labels: ['bottle', 'cup', 'book', 'can'],
    hint: 'Upload a yellow recycle-bin photo and a recyclable-item photo.',
  },
  8: {
    labels: ['banana', 'apple', 'orange', 'broccoli', 'carrot'],
    hint: 'Upload a photo of local or seasonal produce.',
  },
}

export const RECYCLE_ITEM_LABELS = ['bottle', 'cup', 'book', 'can']
export const CLIMATE_KEYWORDS = [
  'climate',
  'global warming',
  'carbon',
  'emission',
  'emissions',
  'greenhouse',
  'sustainability',
  'renewable',
  'net zero',
  'co2',
]
export const PRODUCE_LABELS = ['banana', 'apple', 'orange', 'broccoli', 'carrot']

const DEFAULT_MIN_SCORE = 0.45
const DEFAULT_YELLOW_RATIO = 0.12
let modelPromise = null

function normalizePrediction(prediction) {
  return {
    label: String(prediction?.class || '').trim().toLowerCase(),
    score: Number(prediction?.score || 0),
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

function rgbToHsv(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  const v = max
  return { h, s, v }
}

async function sampleImageColorStats(file) {
  const image = await loadImageFromFile(file)
  const maxSize = 220
  const scale = Math.min(1, maxSize / Math.max(image.width || 1, image.height || 1))
  const width = Math.max(1, Math.round((image.width || 1) * scale))
  const height = Math.max(1, Math.round((image.height || 1) * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('CANVAS_CONTEXT_UNAVAILABLE')

  ctx.drawImage(image, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  let yellow = 0
  let vivid = 0
  let bright = 0

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const { h, s, v } = rgbToHsv(r, g, b)
    if (v > 0.2) bright += 1
    if (s > 0.25 && v > 0.2) {
      vivid += 1
      if (h >= 35 && h <= 70) yellow += 1
    }
  }

  return { yellow, vivid, bright }
}

async function sampleImageLumaStats(file) {
  const image = await loadImageFromFile(file)
  const maxSize = 220
  const scale = Math.min(1, maxSize / Math.max(image.width || 1, image.height || 1))
  const width = Math.max(1, Math.round((image.width || 1) * scale))
  const height = Math.max(1, Math.round((image.height || 1) * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('CANVAS_CONTEXT_UNAVAILABLE')

  ctx.drawImage(image, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  let total = 0
  let lumaSum = 0
  let hot = 0

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lumaSum += luma
    total += 1
    if (Math.max(r, g, b) >= 240 && luma >= 185) hot += 1
  }

  return {
    avgLuma: total > 0 ? lumaSum / total : 0,
    hotRatio: total > 0 ? hot / total : 0,
  }
}

function normalizeOcrText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findMatchedKeywords(text, keywords) {
  return keywords.filter((kw) => text.includes(kw))
}

export function isAiVisionTask(taskId) {
  return Object.prototype.hasOwnProperty.call(AI_TASK_TARGETS, Number(taskId))
}

export function aiTaskHint(taskId) {
  return AI_TASK_TARGETS[Number(taskId)]?.hint || ''
}

export async function loadDetectionModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs')
      await tf.ready()
      const cocoSsd = await import('@tensorflow-models/coco-ssd')
      return cocoSsd.load({ base: 'lite_mobilenet_v2' })
    })()
  }
  return modelPromise
}

export async function detectObjectsInFile(file, maxPredictions = 8) {
  if (!file) throw new Error('MISSING_IMAGE_FILE')
  const model = await loadDetectionModel()
  const image = await loadImageFromFile(file)
  const predictions = await model.detect(image, maxPredictions)
  return (predictions || []).map(normalizePrediction).sort((a, b) => b.score - a.score)
}

export function matchTaskByPredictions(taskId, predictions, minScore = DEFAULT_MIN_SCORE) {
  const target = AI_TASK_TARGETS[Number(taskId)]
  if (!target) {
    return {
      verified: false,
      matchedLabel: '',
      matchedScore: 0,
      expectedLabels: [],
      threshold: minScore,
    }
  }
  const hit = (predictions || []).find(
    (item) => target.labels.includes(item.label) && Number(item.score || 0) >= minScore
  )
  return {
    verified: Boolean(hit),
    matchedLabel: hit?.label || '',
    matchedScore: Number(hit?.score || 0),
    expectedLabels: [...target.labels],
    threshold: minScore,
  }
}

export async function verifyTaskImage(taskId, file, options = {}) {
  const minScore = Number(options?.minScore || DEFAULT_MIN_SCORE)
  const predictions = await detectObjectsInFile(file, options?.maxPredictions || 8)
  const match = matchTaskByPredictions(taskId, predictions, minScore)
  return { predictions, match }
}

export async function verifyRecycleBinPhoto(file, options = {}) {
  if (!file) throw new Error('MISSING_IMAGE_FILE')
  const stats = await sampleImageColorStats(file)
  const denominator = stats.vivid > 0 ? stats.vivid : stats.bright || 1
  const yellowRatio = stats.yellow / denominator
  const threshold = Number(options?.yellowRatioThreshold || DEFAULT_YELLOW_RATIO)
  const verified = yellowRatio >= threshold
  return {
    verified,
    yellowRatio,
    threshold,
    message: verified
      ? `Bin verified (yellow ${Math.round(yellowRatio * 100)}%).`
      : `Yellow bin not clear enough (${Math.round(yellowRatio * 100)}%). Try a brighter close-up photo.`,
  }
}

export async function verifyRecycleItemPhoto(file, options = {}) {
  const minScore = Number(options?.minScore || DEFAULT_MIN_SCORE)
  const predictions = await detectObjectsInFile(file, options?.maxPredictions || 8)
  const hit = predictions.find(
    (item) => RECYCLE_ITEM_LABELS.includes(item.label) && Number(item.score || 0) >= minScore
  )
  return {
    verified: Boolean(hit),
    matchedLabel: hit?.label || '',
    matchedScore: Number(hit?.score || 0),
    threshold: minScore,
    predictions,
    expectedLabels: [...RECYCLE_ITEM_LABELS],
  }
}

export async function verifyClimateArticlePhoto(file, options = {}) {
  if (!file) throw new Error('MISSING_IMAGE_FILE')
  const keywordPool = Array.isArray(options?.keywords) && options.keywords.length
    ? options.keywords.map((k) => String(k).toLowerCase())
    : CLIMATE_KEYWORDS
  const minHits = Math.max(1, Number(options?.minHits || 1))

  const tesseract = await import('tesseract.js')
  const ocrResult = await tesseract.recognize(file, 'eng')
  const rawText = ocrResult?.data?.text || ''
  const normalized = normalizeOcrText(rawText)
  const matchedKeywords = findMatchedKeywords(normalized, keywordPool)
  const verified = matchedKeywords.length >= minHits
  const textPreview = normalized.slice(0, 220)

  return {
    verified,
    matchedKeywords,
    minHits,
    textPreview,
    rawLength: normalized.length,
  }
}

export async function verifyStandbyDevicePhoto(file, options = {}) {
  if (!file) throw new Error('MISSING_IMAGE_FILE')
  const stats = await sampleImageLumaStats(file)
  const maxAvgLuma = Number(options?.maxAvgLuma || 90)
  const maxHotRatio = Number(options?.maxHotRatio || 0.02)
  const verified = stats.avgLuma <= maxAvgLuma && stats.hotRatio <= maxHotRatio

  return {
    verified,
    avgLuma: stats.avgLuma,
    hotRatio: stats.hotRatio,
    maxAvgLuma,
    maxHotRatio,
    message: verified
      ? 'AI verified: device appears switched off.'
      : 'Device still appears active. Try a darker screen photo with no bright indicator lights.',
  }
}

export async function verifyProducePhoto(file, options = {}) {
  const minScore = Number(options?.minScore || DEFAULT_MIN_SCORE)
  const predictions = await detectObjectsInFile(file, options?.maxPredictions || 8)
  const hit = predictions.find(
    (item) => PRODUCE_LABELS.includes(item.label) && Number(item.score || 0) >= minScore
  )
  return {
    verified: Boolean(hit),
    matchedLabel: hit?.label || '',
    matchedScore: Number(hit?.score || 0),
    threshold: minScore,
    predictions,
    expectedLabels: [...PRODUCE_LABELS],
  }
}
