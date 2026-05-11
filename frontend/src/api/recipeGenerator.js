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
const LEAFY_GREENS = new Set(['lettuce', 'spinach', 'cabbage'])

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
  const seasoningText = joinList(seasonings.length ? seasonings : ['olive oil', 'lemon juice'])

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
