export const ThemeId = {
  forest: 'forest',
  glacier: 'glacier',
  cityGreen: 'cityGreen',
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
        { id: 'forest_flower_a', kind: 'flower', label: 'Flower A', cost: 12, src: '/assets/kenney/Isometric/flower_redA_NE.png' },
        { id: 'forest_flower_b', kind: 'flower', label: 'Flower B', cost: 12, src: '/assets/kenney/Isometric/flower_yellowA_NE.png' },
        { id: 'forest_grass_a', kind: 'ground', label: 'Grass', cost: 8, src: '/assets/kenney/Isometric/ground_grass_NE.png' },
        { id: 'forest_grass_b', kind: 'ground', label: 'Path', cost: 8, src: '/assets/kenney/Isometric/ground_pathStraight_NE.png' },
        // Fun decorations (platformer kit)
        { id: 'forest_barrel', kind: 'decor', label: 'Barrel', cost: 18, src: '/assets/kenney_kits/platformer/Previews/barrel.png' },
        { id: 'forest_arrow_sign', kind: 'decor', label: 'Arrow Sign', cost: 14, src: '/assets/kenney_kits/platformer/Previews/arrow.png' },
        { id: 'forest_crate', kind: 'decor', label: 'Crate', cost: 16, src: '/assets/kenney_kits/platformer/Previews/crate.png' },
        { id: 'forest_crate_strong', kind: 'decor', label: 'Crate (Strong)', cost: 20, src: '/assets/kenney_kits/platformer/Previews/crate-strong.png' },
        { id: 'forest_tree_platformer', kind: 'decor', label: 'Big Tree (Alt)', cost: 26, src: '/assets/kenney_kits/platformer/Previews/tree.png' },
      ],
    },
    glacier: {
      id: ThemeId.glacier,
      label: 'Glacier',
      background: 'glacier',
      // Nature kit doesn't ship explicit ice blocks; we use stone cliffs with a cool tint.
      items: [
        { id: 'glacier_ice_a', kind: 'ice', label: 'Ice Block A', cost: 35, src: '/assets/kenney/Isometric/cliff_block_stone_NE.png', tint: '#9be7ff' },
        { id: 'glacier_ice_b', kind: 'ice', label: 'Ice Block B', cost: 35, src: '/assets/kenney/Isometric/cliff_cornerTop_stone_NE.png', tint: '#6bd0ff' },
        { id: 'glacier_snow_a', kind: 'ground', label: 'Snow Ground', cost: 8, src: '/assets/kenney/Isometric/ground_pathBendBank_NE.png', tint: '#cfefff' },
        { id: 'glacier_snow_b', kind: 'ground', label: 'Snow Path', cost: 8, src: '/assets/kenney/Isometric/ground_pathStraight_NE.png', tint: '#bfe7ff' },
        // Holiday kit decorations
        { id: 'glacier_bench', kind: 'decor', label: 'Bench', cost: 16, src: '/assets/kenney_kits/holiday/Previews/bench.png' },
        { id: 'glacier_candy_cane', kind: 'decor', label: 'Candy Cane', cost: 10, src: '/assets/kenney_kits/holiday/Previews/candy-cane-red.png' },
        { id: 'glacier_cabin_wall', kind: 'decor', label: 'Cabin Wall', cost: 28, src: '/assets/kenney_kits/holiday/Previews/cabin-wall.png' },
        { id: 'glacier_cabin_roof_snow', kind: 'decor', label: 'Snow Roof', cost: 30, src: '/assets/kenney_kits/holiday/Previews/cabin-roof-snow.png' },
      ],
    },
    cityGreen: {
      id: ThemeId.cityGreen,
      label: 'City Green',
      background: 'city',
      items: [
        { id: 'city_pave_a', kind: 'ground', label: 'Pavement', cost: 8, src: '/assets/kenney/Isometric/ground_pathStraight_NE.png' },
        { id: 'city_pave_b', kind: 'ground', label: 'Corner', cost: 8, src: '/assets/kenney/Isometric/ground_pathBend_NE.png' },
        { id: 'city_tree_a', kind: 'tree', label: 'Street Tree', cost: 40, src: '/assets/kenney/Isometric/tree_oak_NE.png' },
        { id: 'city_tree_b', kind: 'tree', label: 'Street Tree B', cost: 40, src: '/assets/kenney/Isometric/tree_simple_NE.png' },
        { id: 'city_flower_a', kind: 'flower', label: 'Planter A', cost: 12, src: '/assets/kenney/Isometric/flower_purpleA_NE.png' },
        { id: 'city_flower_b', kind: 'flower', label: 'Planter B', cost: 12, src: '/assets/kenney/Isometric/flower_redA_NE.png' },
        // Train kit (public transport vibes)
        { id: 'city_rail_curve', kind: 'decor', label: 'Rail Curve', cost: 22, src: '/assets/kenney_kits/train/Previews/railroad-rail-curve.png' },
        { id: 'city_rail_straight', kind: 'decor', label: 'Rail Straight', cost: 20, src: '/assets/kenney_kits/train/Previews/railroad-rail-straight.png' },
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

