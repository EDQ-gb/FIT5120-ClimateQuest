export const ThemeId = {
  forest: 'forest',
}

/** Placement / shop charged amount for trees (keep in sync with server `SHOP_KIND_DEFAULT_PRICE.tree`). */
export const TREE_COINS_COST = 10

// Rainforest scene catalogue (single playable biome).
export const Catalog = {
  themes: {
    forest: {
      id: ThemeId.forest,
      label: 'Rainforest',
      background: 'forest',
      items: [
        // ── Trees (center tile, max 1 / tile)
        { id: 'forest_tree_a', kind: 'tree', label: 'Tree A', cost: TREE_COINS_COST, src: '/assets/kenney/Isometric/tree_default_NE.png' },
        { id: 'forest_tree_b', kind: 'tree', label: 'Tree B', cost: TREE_COINS_COST, src: '/assets/kenney/Isometric/tree_pineRoundA_NE.png' },
        { id: 'forest_tree_tall_a', kind: 'tree', label: 'Tall Pine', cost: TREE_COINS_COST, src: '/assets/kenney/Isometric/tree_pineTallA_NE.png' },
        { id: 'forest_tree_tall_b', kind: 'tree', label: 'Tall Pine B', cost: TREE_COINS_COST, src: '/assets/kenney/Isometric/tree_pineTallB_NE.png' },
        { id: 'forest_tree_fat', kind: 'tree', label: 'Big Oak', cost: TREE_COINS_COST, src: '/assets/kenney/Isometric/tree_fat_NE.png' },
        { id: 'forest_tree_oak', kind: 'tree', label: 'Oak', cost: TREE_COINS_COST, src: '/assets/kenney/Isometric/tree_oak_NE.png' },
        { id: 'forest_tree_detailed', kind: 'tree', label: 'Tree (Detailed)', cost: TREE_COINS_COST, src: '/assets/kenney/Isometric/tree_detailed_NE.png' },
        { id: 'forest_tree_round_c', kind: 'tree', label: 'Pine Round C', cost: TREE_COINS_COST, src: '/assets/kenney/Isometric/tree_pineRoundC_NE.png' },

        // ── Flora (corners, up to 4 / tile)
        { id: 'forest_flower_a', kind: 'flower', label: 'Flower A', cost: 12, src: '/assets/kenney/Isometric/flower_redA_NE.png' },
        { id: 'forest_flower_b', kind: 'flower', label: 'Flower B', cost: 12, src: '/assets/kenney/Isometric/flower_yellowA_NE.png' },
        { id: 'forest_flower_purple_a', kind: 'flower', label: 'Flower (Purple)', cost: 12, src: '/assets/kenney/Isometric/flower_purpleA_NE.png' },
        { id: 'forest_flower_red_c', kind: 'flower', label: 'Flower (Red C)', cost: 12, src: '/assets/kenney/Isometric/flower_redC_NE.png' },
        { id: 'glacier_flower_purple', kind: 'flower', label: 'Frost Clover', cost: 12, src: '/assets/kenney/Isometric/flower_purpleA_NE.png', tint: '#cfefff' },

        // ── Extra décor / flora (some IDs kept unchanged for older saves)
       
        { id: 'glacier_tree_christmas', kind: 'decor', label: 'Christmas Tree', cost: 40, scale: 0.85, src: '/assets/kenney_kits/holiday_v2/Previews/tree-decorated-snow.png' },
       
        { id: 'glacier_decor_present_a', kind: 'decor', label: 'Present', cost: 20, src: '/assets/kenney_kits/holiday_v2/Previews/present-a-cube.png' },
        { id: 'glacier_decor_present_b', kind: 'decor', label: 'Present (Alt)', cost: 20, src: '/assets/kenney_kits/holiday_v2/Previews/present-b-cube.png' },
        { id: 'glacier_decor_wreath', kind: 'decor', label: 'Wreath', cost: 18, src: '/assets/kenney_kits/holiday_v2/Previews/wreath-decorated.png' },
        { id: 'glacier_decor_snowman', kind: 'decor', label: 'Snowman', cost: 22, src: '/assets/kenney_kits/holiday_v2/Previews/snowman.png', tags: ['life'] },
        { id: 'glacier_decor_reindeer', kind: 'decor', label: 'Reindeer', cost: 30, src: '/assets/kenney_kits/holiday_v2/Previews/reindeer.png', tags: ['life'] },

   
        // ── Wildlife (pets)
        { id: 'forest_pet_dog', kind: 'decor', label: 'Dog', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-dog.png', tags: ['life'] },
        { id: 'forest_pet_fox', kind: 'decor', label: 'Fox', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-fox.png', tags: ['life'] },
        { id: 'forest_pet_cow', kind: 'decor', label: 'Cow', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-cow.png', tags: ['life'] },
        { id: 'forest_pet_bunny', kind: 'decor', label: 'Bunny', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-bunny.png', tags: ['life'] },
        { id: 'forest_pet_beaver', kind: 'decor', label: 'Beaver', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-beaver.png', tags: ['life'] },
        { id: 'forest_pet_elephant', kind: 'decor', label: 'Elephant', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-elephant.png', tags: ['life'] },
        { id: 'forest_pet_moose', kind: 'decor', label: 'Moose', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-deer.png', tags: ['life'] },
        { id: 'forest_pet_tiger', kind: 'decor', label: 'Tiger', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-tiger.png', tags: ['life'] },
        { id: 'glacier_pet_penguin', kind: 'decor', label: 'Penguin', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-penguin.png', tags: ['life'] },
        { id: 'glacier_pet_polar_bear', kind: 'decor', label: 'Polar Bear', cost: 30, src: '/assets/kenney_kits/cube-pets/Previews/animal-polar.png', tags: ['life'] },
      ],
    },
  },
}

/** Forest is the only playable theme — kept for callers that still pass a key. */
export function getTheme(_themeType) {
  return Catalog.themes.forest
}

export function getItemById(_themeType, itemId) {
  return Catalog.themes.forest.items.find((x) => x.id === itemId) || null
}

export function getItemByIdAnyTheme(itemId) {
  return getItemById('forest', itemId)
}
