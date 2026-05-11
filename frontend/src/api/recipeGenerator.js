const SELECTABLE_CARBS = ['rice', 'pasta', 'potato', 'bread', 'oats', 'corn']
const SELECTABLE_PROTEINS = [
  'tofu',
  'beans',
  'chickpeas',
  'lentils',
  'egg',
  'chicken breast',
  'ground beef',
  'pork',
  'tuna',
  'shrimp',
]
const SELECTABLE_VEGETABLES = [
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
]
const PANTRY_STAPLES = ['soy sauce', 'olive oil', 'lemon juice', 'chili powder', 'parsley']

export const PLANT_BASED_INGREDIENTS = [
  ...SELECTABLE_CARBS,
  ...SELECTABLE_PROTEINS,
  ...SELECTABLE_VEGETABLES,
]

const PROTEINS = new Set([
  'tofu',
  'beans',
  'chickpeas',
  'lentils',
  'egg',
  'chicken breast',
  'ground beef',
  'pork',
  'tuna',
  'shrimp',
])
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
const SEASONINGS = new Set(PANTRY_STAPLES)
const LEAFY_GREENS = new Set(['lettuce', 'spinach', 'cabbage'])

function pickCycle(items, start, count) {
  const out = []
  if (!items.length || count <= 0) return out
  for (let i = 0; i < count; i += 1) {
    out.push(items[(start + i) % items.length])
  }
  return out
}

function uniqueList(items) {
  return [...new Set(items)]
}

export function getBalancedIngredientBatch(windowIndex = 0) {
  const base = Math.max(0, Number(windowIndex) || 0)
  const carbs = pickCycle(SELECTABLE_CARBS, base * 2, 3)
  const proteins = pickCycle(SELECTABLE_PROTEINS, base * 3, 3)
  const vegetables = pickCycle(SELECTABLE_VEGETABLES, base * 4, 4)
  return uniqueList([...carbs, ...proteins, ...vegetables]).slice(0, 10)
}

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

function titleCase(text) {
  return text.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
}

function hasAny(items, values) {
  return values.some((value) => items.includes(value))
}

function firstSelected(selected, groups, fallback) {
  for (const group of groups) {
    const found = selected.find((item) => group.has(item))
    if (found) return found
  }
  return selected[0] || fallback
}

function makeContext(selectedIngredients) {
  const selected = [...new Set((selectedIngredients || []).map((x) => String(x).trim()).filter(Boolean))]
  const proteins = selected.filter((item) => PROTEINS.has(item))
  const carbs = selected.filter((item) => CARBS.has(item))
  const vegetables = selected.filter((item) => VEGETABLES.has(item))
  const seasonings = selected.filter((item) => SEASONINGS.has(item))
  const mainProtein = proteins[0] || ''
  const mainCarb = carbs[0] || ''
  const mainVegetable = vegetables[0] || firstSelected(selected, [VEGETABLES, PROTEINS, CARBS], 'vegetables')
  const vegetableText = joinList(vegetables.slice(0, 4))
  const seasoningText = joinList(seasonings.length ? seasonings : PANTRY_STAPLES.slice(0, 2))

  return {
    selected,
    proteins,
    carbs,
    vegetables,
    seasonings,
    mainProtein,
    mainCarb,
    mainVegetable,
    vegetableText,
    seasoningText,
  }
}

function chooseTemplate(ctx) {
  const { selected, proteins, carbs, vegetables, seasonings } = ctx
  if (selected.includes('pasta')) return pastaTemplate
  if (selected.includes('potato')) return potatoTemplate
  if (selected.includes('bread')) return toastTemplate
  if (selected.includes('oats')) return oatCakeTemplate
  if (hasAny(selected, ['lettuce', 'cabbage', 'spinach']) && hasAny(selected, ['lemon juice', 'olive oil'])) return saladTemplate
  if (selected.includes('rice') && selected.includes('soy sauce')) return stirFryTemplate
  if (hasAny(selected, ['lentils', 'beans', 'chickpeas']) && hasAny(selected, ['tomato', 'carrot', 'celery'])) return stewTemplate
  if (carbs.includes('rice') && proteins.length && vegetables.length) return riceBowlTemplate
  if (proteins.length && vegetables.length >= 2) return sauteTemplate
  if (carbs.length) return grainTemplate
  return vegetableTemplate
}

function pastaTemplate(ctx) {
  const protein = ctx.mainProtein
  const veg = ctx.vegetableText || ctx.mainVegetable
  const titleBase = protein ? `${protein} pasta` : `${ctx.mainVegetable} pasta`
  return {
    title: titleCase(titleBase),
    steps: [
      'Cook the pasta until just tender, then reserve a little cooking water.',
      `Saute ${veg} with ${pick(ctx.seasonings, 'olive oil')} until softened.`,
      protein ? `Fold in ${protein} and warm it through.` : 'Add the cooked pasta and toss until coated.',
      `Season with ${ctx.seasoningText}.`,
      'Loosen with a spoonful of pasta water and serve warm.',
    ],
  }
}

function potatoTemplate(ctx) {
  const veg = ctx.vegetableText || ctx.mainVegetable
  const protein = ctx.mainProtein
  return {
    title: titleCase(`${ctx.mainVegetable} potato skillet`),
    steps: [
      'Dice the potato and cook it in a covered pan until nearly tender.',
      `Add ${veg} and saute until the edges start to brown.`,
      protein ? `Stir in ${protein} and cook until hot.` : 'Press the mixture lightly so the potato turns crisp.',
      `Finish with ${ctx.seasoningText}.`,
      'Serve as a warm low-carbon skillet meal.',
    ],
  }
}

function toastTemplate(ctx) {
  const topping = ctx.mainProtein || ctx.mainVegetable
  const veg = ctx.vegetableText || ctx.mainVegetable
  const leafy = ctx.vegetables.filter((item) => LEAFY_GREENS.has(item))
  const cookedVeg = ctx.vegetables.filter((item) => !LEAFY_GREENS.has(item))
  return {
    title: titleCase(`${topping} toast`),
    steps: [
      'Toast the bread until crisp.',
      cookedVeg.length
        ? `Saute ${joinList(cookedVeg)} with a little ${pick(ctx.seasonings, 'olive oil')}.`
        : `Toss ${joinList(leafy.length ? leafy : [veg])} with ${pick(ctx.seasonings, 'lemon juice')}.`,
      `Spoon the warm ${topping} mixture over the toast.`,
      `Season with ${ctx.seasoningText}.`,
      'Top with extra herbs or greens if available.',
    ],
  }
}

function oatCakeTemplate(ctx) {
  const veg = ctx.vegetableText || ctx.mainVegetable
  return {
    title: titleCase(`${ctx.mainVegetable} oat cakes`),
    steps: [
      'Mix oats with a splash of water until they hold together.',
      `Fold in finely chopped ${veg}.`,
      `Season with ${ctx.seasoningText}.`,
      'Shape into small cakes and pan-cook until golden on both sides.',
      'Serve with lemon juice or a simple tomato side.',
    ],
  }
}

function stirFryTemplate(ctx) {
  const protein = ctx.mainProtein || ctx.mainVegetable
  const veg = ctx.vegetableText || ctx.mainVegetable
  return {
    title: titleCase(`${protein} stir-fry`),
    steps: [
      'Cook the rice and keep it warm.',
      `Stir-fry ${veg} over high heat until just tender.`,
      ctx.mainProtein ? `Add ${ctx.mainProtein} and cook until heated through.` : 'Add the rice and toss through the vegetables.',
      `Splash in ${ctx.seasoningText} and toss well.`,
      'Serve immediately while the vegetables are still bright.',
    ],
  }
}

function stewTemplate(ctx) {
  const protein = ctx.mainProtein || 'lentils'
  const veg = ctx.vegetableText || ctx.mainVegetable
  return {
    title: titleCase(`${protein} vegetable stew`),
    steps: [
      `Saute ${veg} in a pot until fragrant.`,
      `Add ${protein} with enough water to barely cover.`,
      `Season with ${ctx.seasoningText}.`,
      'Simmer until the mixture thickens and the vegetables are tender.',
      ctx.mainCarb ? `Serve with ${ctx.mainCarb}.` : 'Serve warm as a simple one-pot meal.',
    ],
  }
}

function saladTemplate(ctx) {
  const protein = ctx.mainProtein
  const greens = ctx.vegetables.filter((item) => ['lettuce', 'cabbage', 'spinach'].includes(item))
  const base = joinList(greens.length ? greens : [ctx.mainVegetable])
  return {
    title: titleCase(`${base} salad`),
    steps: [
      `Slice ${base} into bite-size pieces.`,
      protein ? `Add ${protein} for a more filling meal.` : `Add ${joinList(ctx.vegetables.filter((item) => item !== base).slice(0, 2)) || 'extra vegetables'}.`,
      `Whisk ${ctx.seasoningText} into a quick dressing.`,
      'Toss everything together just before serving.',
      ctx.mainCarb ? `Serve with ${ctx.mainCarb} on the side.` : 'Serve chilled or at room temperature.',
    ],
  }
}

function sauteTemplate(ctx) {
  const protein = ctx.mainProtein
  const veg = ctx.vegetableText || ctx.mainVegetable
  return {
    title: titleCase(`${protein} and ${ctx.mainVegetable} saute`),
    steps: [
      `Chop ${veg} into even pieces.`,
      `Saute the vegetables with ${pick(ctx.seasonings, 'olive oil')} until tender.`,
      `Add ${protein} and stir until warmed through.`,
      `Season with ${ctx.seasoningText}.`,
      ctx.mainCarb ? `Serve with ${ctx.mainCarb}.` : 'Serve as a light low-carbon meal.',
    ],
  }
}

function grainTemplate(ctx) {
  const carb = ctx.mainCarb
  const veg = ctx.vegetableText || ctx.mainVegetable
  return {
    title: titleCase(`${ctx.mainVegetable} ${carb} plate`),
    steps: [
      `Cook the ${carb} until tender.`,
      `Saute ${veg} until softened.`,
      `Combine the ${carb} and vegetables in the pan.`,
      `Season with ${ctx.seasoningText}.`,
      'Serve warm with extra greens if available.',
    ],
  }
}

function riceBowlTemplate(ctx) {
  const protein = ctx.mainProtein
  const veg = ctx.vegetableText || ctx.mainVegetable
  return {
    title: titleCase(`${protein} rice bowl`),
    steps: [
      'Cook the rice until tender and keep it loosely covered.',
      `In a wide pan over medium heat, cook ${protein} in a little ${pick(ctx.seasonings, 'olive oil')} until nearly done.`,
      `Add ${veg} and cook until tender or wilted.`,
      `Fold in the rice, splash in a tablespoon of water if it looks dry, then season with ${ctx.seasoningText}.`,
      'Serve warm.',
    ],
  }
}

function vegetableTemplate(ctx) {
  const veg = ctx.vegetableText || ctx.mainVegetable
  return {
    title: titleCase(`${ctx.mainVegetable} vegetable saute`),
    steps: [
      `Chop ${veg} into bite-size pieces.`,
      `Cook with ${pick(ctx.seasonings, 'olive oil')} until the vegetables soften.`,
      `Season with ${ctx.seasoningText}.`,
      'Cover briefly so the vegetables steam through.',
      'Serve as a light meal or pair with a grain.',
    ],
  }
}

export function generatePlantBasedRecipe(selectedIngredients) {
  const ctx = makeContext(selectedIngredients)
  const template = chooseTemplate(ctx)
  const recipe = template(ctx)

  return {
    title: recipe.title,
    ingredients: ctx.selected,
    steps: uniqueSteps(recipe.steps),
  }
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stepMentions(step, phrase) {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(String(step))
}

function dedupePhraseRepeatsInStep(step) {
  let cleaned = String(step || '').trim()
  cleaned = cleaned.replace(/\b([a-z][a-z ]+?)\s+and\s+\1\b/gi, '$1')
  cleaned = cleaned.replace(/\b(\w+)\s*,\s*\1\b/gi, '$1')
  cleaned = cleaned.replace(/\b(\w+)\s+and\s+\1\b/gi, '$1')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  return cleaned
}

function normalizeModelStepSentence(step) {
  const s = String(step || '').trim().replace(/\s+/g, ' ')
  if (!s) return ''
  const noTrail = s.replace(/[.?!]+$/g, '')
  const capitalized = noTrail.charAt(0).toUpperCase() + noTrail.slice(1)
  return `${capitalized}.`
}

function isGenericCookStep(step) {
  const t = String(step || '').trim()
  if (!t) return true
  const lower = t.toLowerCase().replace(/[.?!]+$/g, '')
  if (/^(cook|simmer|bake|fry|heat)\s+(until\s+)?(it'?s\s+)?done$/.test(lower)) return true
  if (/^cook\s+until\s+done$/.test(lower)) return true
  if (lower === 'cook until done') return true
  if (lower.length < 22 && /\buntil done\b/.test(lower) && /^(cook|simmer)\b/.test(lower)) return true
  return false
}

/**
 * Light cleanup for transformer output: phrase repeats, near-duplicate lines,
 * generic "cook until done", and redundant "add …" steps that repeat ingredients
 * already used earlier.
 */
export function sanitizeModelSteps(rawSteps, selectedIngredients) {
  const selected = [...new Set((selectedIngredients || []).map((x) => String(x).trim()).filter(Boolean))]
  const selectedWords = new Set(selected.map((x) => x.toLowerCase()))
  const input = Array.isArray(rawSteps) ? rawSteps : []
  const cleaned = input
    .map(dedupePhraseRepeatsInStep)
    .map(normalizeModelStepSentence)
    .filter(Boolean)

  const unique = []
  const seen = new Set()
  for (const step of cleaned) {
    const key = step.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(step)
  }

  const mentioned = new Set()
  const filtered = []
  for (const step of unique) {
    if (isGenericCookStep(step)) continue

    const lower = step.toLowerCase()
    const ingInStep = selected.filter((ing) => stepMentions(step, ing))
    if (/\badd\b/.test(lower) && ingInStep.length && ingInStep.every((ing) => mentioned.has(ing.toLowerCase()))) {
      continue
    }

    filtered.push(step)
    for (const ing of selected) {
      if (stepMentions(step, ing)) mentioned.add(ing.toLowerCase())
    }
  }

  if (filtered.length >= 3) {
    const first = filtered[0].toLowerCase()
    if (first.startsWith('wash ') || first.startsWith('wash and ')) {
      const hasIngredientHint = [...selectedWords].some((word) => first.includes(word))
      if (!hasIngredientHint) filtered.shift()
    }
  }

  return filtered
}

function templateStepsForSelection(selectedIngredients) {
  const ctx = makeContext(selectedIngredients)
  const template = chooseTemplate(ctx)
  return template(ctx).steps
}

function avgStepLength(steps) {
  if (!steps.length) return 0
  return steps.reduce((a, s) => a + String(s).length, 0) / steps.length
}

/**
 * When the model returns very short or vague steps, append missing template lines
 * so the user still gets a usable recipe (without retraining the model).
 */
export function augmentModelStepsIfNeeded(modelSteps, selectedIngredients) {
  const safe = (Array.isArray(modelSteps) ? modelSteps : [])
    .map((s) => normalizeModelStepSentence(dedupePhraseRepeatsInStep(s)))
    .filter(Boolean)
    .filter((s) => !isGenericCookStep(s))
  const useful = safe.filter((s) => String(s).length >= 28)
  const blob = safe.join(' ').toLowerCase()
  const tooFew = safe.length < 4 || useful.length < 3 || avgStepLength(safe) < 38

  if (!tooFew) {
    return { steps: safe, augmented: false }
  }

  const extras = templateStepsForSelection(selectedIngredients)
  const additions = extras.filter((line) => {
    const head = String(line)
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 5)
      .join(' ')
    return head.length >= 8 && !blob.includes(head.slice(0, Math.min(24, head.length)))
  })

  const merged = uniqueSteps([...safe, ...additions])
  return { steps: merged, augmented: additions.length > 0 }
}

/**
 * Pantry / seasoning hints (seasonings are not selectable chips — explain that here).
 */
export function buildSeasoningGuidance(selectedIngredients) {
  const ctx = makeContext(selectedIngredients)
  const staples = ctx.seasonings.length ? ctx.seasonings : PANTRY_STAPLES.slice(0, 3)
  const list = joinList(staples)
  let hint =
    ' Start with a little salt, then add acid or aromatics in small amounts and taste as you go.'

  if (ctx.carbs.includes('rice') && ctx.proteins.length) {
    hint =
      ' For rice bowls, soy sauce (or tamari), a neutral oil, and a pinch of pepper usually land well—add soy at the end of cooking so it does not scorch.'
  } else if (ctx.vegetables.some((v) => LEAFY_GREENS.has(v))) {
    hint =
      ' Leafy greens like a little fat (olive oil) plus acid (lemon) or a fresh herb (parsley) so they do not taste flat.'
  }

  return `Pantry & seasoning: try ${list}.${hint} These are suggestions only—use what you already have.`
}
