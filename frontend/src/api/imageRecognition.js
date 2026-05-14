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
}

const DEFAULT_MIN_SCORE = 0.45
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
