export const ThemeId = {
  forest: 'forest',
  glacier: 'glacier',

}

// Minimal curated Kenney sprite set (Iteration 1).
// Paths are served from /public → accessible at runtime via `/assets/...`
export const Catalog = {
  themes: {
    forest: {
      id: ThemeId.forest,
      label: 'Rainforest',
      background: 'forest',
      items: [
        { id: 'forest_tree_a', kind: 'tree', label: 'Tree A', cost: 40, src: '/assets/kenney/Isometric/tree_default_NE.png' },
        { id: 'forest_tree_b', kind: 'tree', label: 'Tree B', cost: 40, src: '/assets/kenney/Isometric/tree_pineRoundA_NE.png' },
        // Bigger trees (nature kit isometric)
        { id: 'forest_tree_tall_a', kind: 'tree', label: 'Tall Pine', cost: 40, src: '/assets/kenney/Isometric/tree_pineTallA_NE.png' },
        { id: 'forest_tree_tall_b', kind: 'tree', label: 'Tall Pine B', cost: 40, src: '/assets/kenney/Isometric/tree_pineTallB_NE.png' },
        { id: 'forest_tree_fat', kind: 'tree', label: 'Big Oak', cost: 40, src: '/assets/kenney/Isometric/tree_fat_NE.png' },
        // More trees (same kit, natural proportions)
        { id: 'forest_tree_oak', kind: 'tree', label: 'Oak', cost: 40, src: '/assets/kenney/Isometric/tree_oak_NE.png' },
        { id: 'forest_tree_detailed', kind: 'tree', label: 'Tree (Detailed)', cost: 40, src: '/assets/kenney/Isometric/tree_detailed_NE.png' },
        { id: 'forest_tree_round_c', kind: 'tree', label: 'Pine Round C', cost: 40, src: '/assets/kenney/Isometric/tree_pineRoundC_NE.png' },
        { id: 'forest_flower_a', kind: 'flower', label: 'Flower A', cost: 12, src: '/assets/kenney/Isometric/flower_redA_NE.png' },
        { id: 'forest_flower_b', kind: 'flower', label: 'Flower B', cost: 12, src: '/assets/kenney/Isometric/flower_yellowA_NE.png' },
        // More flora
        { id: 'forest_flower_purple_a', kind: 'flower', label: 'Flower (Purple)', cost: 12, src: '/assets/kenney/Isometric/flower_purpleA_NE.png' },
        { id: 'forest_flower_red_c', kind: 'flower', label: 'Flower (Red C)', cost: 12, src: '/assets/kenney/Isometric/flower_redC_NE.png' },
        // Decor + pets (placed on tile center)
      
        { id: 'forest_pet_dog', kind: 'decor', label: 'Dog', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-dog.png', tags: ['life'] },
        { id: 'forest_pet_fox', kind: 'decor', label: 'Fox', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-fox.png', tags: ['life'] },
        { id: 'forest_pet_cow', kind: 'decor', label: 'Cow', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-cow.png', tags: ['life'] },
        { id: 'forest_pet_bunny', kind: 'decor', label: 'Bunny', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-bunny.png', tags: ['life'] },
        { id: 'forest_pet_beaver', kind: 'decor', label: 'Beaver', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-beaver.png', tags: ['life'] },
        { id: 'forest_pet_elephant', kind: 'decor', label: 'Elephant', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-elephant.png', tags: ['life'] },
        // "Moose" isn't in this pack; Deer is the closest match.
        { id: 'forest_pet_moose', kind: 'decor', label: 'Moose', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-deer.png', tags: ['life'] },
        { id: 'forest_pet_tiger', kind: 'decor', label: 'Tiger', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-tiger.png', tags: ['life'] },
      ],
    },
    glacier: {
      id: ThemeId.glacier,
      label: 'Glacier',
      background: 'glacier',
      // Glacier: avoid trees; use ice/snow/holiday items instead.
      items: [
        // Ice blocks (center placement, counted as "trees" for progress/oxygen tips)
        { id: 'glacier_ice_rocks_large', kind: 'tree', label: 'Ice Block (Large)', cost: 40, src: '/assets/kenney_kits/holiday_v2/Previews/rocks-large.png', tint: '#d7f3ff' },
        { id: 'glacier_ice_rocks_medium', kind: 'tree', label: 'Ice Block', cost: 40, src: '/assets/kenney_kits/holiday_v2/Previews/rocks-medium.png', tint: '#d7f3ff' },
        { id: 'glacier_ice_rocks_small', kind: 'tree', label: 'Ice Block (Small)', cost: 40, src: '/assets/kenney_kits/holiday_v2/Previews/rocks-small.png', tint: '#d7f3ff' },

        // Corner flora (light tint)
        { id: 'glacier_flower_purple', kind: 'flower', label: 'Ice Flower', cost: 12, src: '/assets/kenney/Isometric/flower_purpleA_NE.png', tint: '#cfefff' },

        // Holiday decor
        { id: 'glacier_tree_christmas', kind: 'tree', label: 'Christmas Tree', cost: 40, src: '/assets/kenney_kits/holiday_v2/Previews/tree-decorated-snow.png' },
        { id: 'glacier_decor_sled', kind: 'decor', label: 'Sled', cost: 30, src: '/assets/kenney_kits/holiday_v2/Previews/sled.png' },
        { id: 'glacier_decor_sled_long', kind: 'decor', label: 'Sled (Long)', cost: 30, src: '/assets/kenney_kits/holiday_v2/Previews/sled-long.png' },
        { id: 'glacier_decor_present_a', kind: 'decor', label: 'Present', cost: 20, src: '/assets/kenney_kits/holiday_v2/Previews/present-a-cube.png' },
        { id: 'glacier_decor_present_b', kind: 'decor', label: 'Present (Alt)', cost: 20, src: '/assets/kenney_kits/holiday_v2/Previews/present-b-cube.png' },
        { id: 'glacier_decor_wreath', kind: 'decor', label: 'Wreath', cost: 18, src: '/assets/kenney_kits/holiday_v2/Previews/wreath-decorated.png' },
        { id: 'glacier_decor_snowman', kind: 'decor', label: 'Snowman', cost: 22, src: '/assets/kenney_kits/holiday_v2/Previews/snowman.png', tags: ['life'] },
        { id: 'glacier_decor_reindeer', kind: 'decor', label: 'Reindeer', cost: 30, src: '/assets/kenney_kits/holiday_v2/Previews/reindeer.png', tags: ['life'] },
        { id: 'glacier_decor_snow_pile', kind: 'decor', label: 'Snow Pile', cost: 16, src: '/assets/kenney_kits/holiday_v2/Previews/snow-pile.png' },
        { id: 'glacier_decor_snow_bunker', kind: 'decor', label: 'Snow Bunker', cost: 16, src: '/assets/kenney_kits/holiday_v2/Previews/snow-bunker.png' },

        { id: 'glacier_pet_penguin', kind: 'decor', label: 'Penguin', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-penguin.png', tags: ['life'] },
        { id: 'glacier_pet_polar_bear', kind: 'decor', label: 'Polar Bear', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-polar.png', tags: ['life'] },
      ],
    },
    
  },
}

export function getTheme(themeType) {
  return Catalog.themes[themeType] || Catalog.themes.forest
}

export function getItemById(themeType, itemId) {
  const t = getTheme(themeType)
  return t.items.find((x) => x.id === itemId) || null
}

export function getItemByIdAnyTheme(itemId) {
  for (const t of Object.values(Catalog.themes)) {
    const found = t.items.find((x) => x.id === itemId)
    if (found) return found
  }
  return null
}

