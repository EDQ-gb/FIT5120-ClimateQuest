/**
 * Daily task card artwork (public/images/task-cards/*).
 * Keys match server TASKS ids; filenames follow the uploaded image stems.
 */
export const TASK_CARD_IMAGE_BY_ID = {
  1: '/images/task-cards/walkingbike.png',
  2: '/images/task-cards/bus.png',
  3: '/images/task-cards/cup.png',
  4: '/images/task-cards/standby.png',
  5: '/images/task-cards/meal.png',
  6: '/images/task-cards/shortartical.png',
  7: '/images/task-cards/recycle.png',
  8: '/images/task-cards/seansonal_food.png',
  9: '/images/task-cards/SavingEnergy.png',
}

export function taskCardImageUrl(taskId) {
  return TASK_CARD_IMAGE_BY_ID[taskId] || null
}

/** Wide/tall artwork where cover clips important detail — use contain + tinted panel */
const CONTAIN_FIT_IDS = new Set([9])

export function taskCardUsesContainFit(taskId) {
  return CONTAIN_FIT_IDS.has(Number(taskId))
}

/** CSS class on .task-media so letterboxing matches the image (not UI grey) */
export function taskCardMediaTintClass(taskId) {
  const id = Number(taskId)
  if (id === 9) return 'task-media--tint-energy-tip'
  return ''
}
