export const PLANT_BASED_INGREDIENTS = [
  'rice',
  'pasta',
  'potato',
  'bread',
  'oats',
  'tofu',
  'beans',
  'chickpeas',
  'lentils',
  'corn',
  'pea',
  'tomato',
  'onion',
  'garlic',
  'bell pepper',
  'mushroom',
  'broccoli',
  'carrot',
  'cabbage',
  'spinach',
  'lettuce',
  'celery',
  'soy sauce',
  'olive oil',
  'lemon juice',
  'chili powder',
  'parsley',
]

const PROTEINS = new Set(['tofu', 'beans', 'chickpeas', 'lentils'])
const CARBS = new Set(['rice', 'pasta', 'potato', 'bread', 'oats'])
const VEGETABLES = new Set([
  'tomato',
  'onion',
  'garlic',
  'bell pepper',
  'mushroom',
  'broccoli',
  'carrot',
  'cabbage',
  'spinach',
  'lettuce',
  'celery',
  'corn',
  'pea',
])
const SEASONINGS = new Set(['soy sauce', 'olive oil', 'lemon juice', 'chili powder', 'parsley'])

function pick(items, fallback) {
  return items.length ? items[0] : fallback
}

function joinList(items) {
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function uniqueSteps(steps) {
  const seen = new Set()
  return steps.filter((step) => {
    const key = step.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function generatePlantBasedRecipe(selectedIngredients) {
  const selected = [...new Set((selectedIngredients || []).map((x) => String(x).trim()).filter(Boolean))]
  const proteins = selected.filter((item) => PROTEINS.has(item))
  const carbs = selected.filter((item) => CARBS.has(item))
  const vegetables = selected.filter((item) => VEGETABLES.has(item))
  const seasonings = selected.filter((item) => SEASONINGS.has(item))

  const mainProtein = pick(proteins, 'beans')
  const mainCarb = pick(carbs, 'rice')
  const mainVegetables = vegetables.slice(0, 4)
  const seasoningText = joinList(seasonings.length ? seasonings : ['olive oil', 'lemon juice'])
  const vegetableText = joinList(mainVegetables.length ? mainVegetables : ['onion', 'garlic'])

  const title = `${mainProtein[0].toUpperCase()}${mainProtein.slice(1)} ${mainCarb} bowl`
  const steps = uniqueSteps([
    `Cook the ${mainCarb} until tender and keep it warm.`,
    `Saute ${vegetableText} with a little ${pick(seasonings, 'olive oil')} until fragrant.`,
    `Add ${mainProtein} and stir until heated through.`,
    `Season with ${seasoningText}, then taste and adjust before serving.`,
    `Serve the mixture over ${mainCarb} with extra ${pick(mainVegetables, 'spinach')} on top.`,
  ])

  return {
    title,
    ingredients: selected,
    steps,
  }
}
