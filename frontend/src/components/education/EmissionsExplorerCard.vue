<script setup>
import { ref, computed, watch } from 'vue'
import StoryHeroBanner from './StoryHeroBanner.vue'
import {
  toSvgPolyline,
  chartYToSvg,
  buildLinearYTicks,
} from '../../utils/education/openDataParse.js'

const props = defineProps({
  ghgByEntity: { type: Map, required: true },
  perCapitaByEntity: { type: Map, required: true },
  heroImage: { type: String, default: '/images/education/emissions.png' },
})

const CHART_W = 880
const CHART_H = 260
const PAD = 52
const emYearStart = 1970

const mode = ref('total')
const search = ref('')
const selected = ref(['World', 'China', 'Australia'])
const showResults = ref(false)

const entityColors = {
  World: '#52d496',
  China: '#f4c430',
  India: '#ff8ad8',
  Australia: '#7aa2ff',
  'United States': '#fb923c',
  'United Kingdom': '#c084fc',
}

const activeMap = computed(() =>
  mode.value === 'total' ? props.ghgByEntity : props.perCapitaByEntity,
)

const allEntities = computed(() => [...activeMap.value.keys()].sort((a, b) => a.localeCompare(b)))

const emYearEnd = computed(() => {
  let max = emYearStart
  for (const ent of selected.value) {
    const arr = activeMap.value.get(ent)
    if (!arr?.length) continue
    const last = arr[arr.length - 1].year
    if (last > max) max = last
  }
  return max > emYearStart ? max : 2022
})

const searchResults = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return []
  return allEntities.value
    .filter((e) => e.toLowerCase().includes(q))
    .slice(0, 20)
})

watch(mode, () => {
  selected.value = selected.value.filter((e) => allEntities.value.includes(e))
  if (!selected.value.length) {
    const defaults = ['World', 'China', 'Australia', 'India', 'United States']
    selected.value = defaults.filter((e) => allEntities.value.includes(e)).slice(0, 3)
    if (!selected.value.length && allEntities.value.length) {
      selected.value = [allEntities.value[0]]
    }
  }
})

function colorFor(entity) {
  return entityColors[entity] || `hsl(${(entity.length * 37) % 360}, 65%, 58%)`
}

function pointsFor(entity) {
  const arr = activeMap.value.get(entity) || []
  return arr
    .filter((p) => p.year >= emYearStart && p.year <= emYearEnd.value)
    .map((p) => ({
      year: p.year,
      y: mode.value === 'total' ? p.value / 1e12 : p.value,
    }))
}

const activeEntities = computed(() => selected.value.filter((e) => activeMap.value.has(e)))

const yScale = computed(() => {
  const ents = activeEntities.value
  if (!ents.length) return null
  let yMin = Infinity
  let yMax = -Infinity
  for (const ent of ents) {
    for (const p of pointsFor(ent)) {
      yMin = Math.min(yMin, p.y)
      yMax = Math.max(yMax, p.y)
    }
  }
  if (!Number.isFinite(yMin)) return null
  const padY = (yMax - yMin) * 0.08 || 0.1
  yMin -= padY
  yMax += padY
  return { yMin, yMax, ticks: buildLinearYTicks(yMin, yMax) }
})

const lines = computed(() => {
  if (!yScale.value) return []
  const xMax = emYearEnd.value
  return activeEntities.value.map((entity) => ({
    entity,
    color: colorFor(entity),
    points: toSvgPolyline(
      pointsFor(entity),
      CHART_W,
      CHART_H,
      PAD,
      'year',
      'y',
      emYearStart,
      xMax,
      yScale.value.yMin,
      yScale.value.yMax,
    ),
  }))
})

const yAxisLabel = computed(() =>
  mode.value === 'total'
    ? 'Gt CO₂e (all greenhouse gases)'
    : 't CO₂e / person (all greenhouse gases)',
)

const tooltip = ref({ show: false, x: 0, y: 0, lines: [] })
const wrapRef = ref(null)

function formatY(v) {
  const x = Number(v)
  if (!Number.isFinite(x)) return ''
  return mode.value === 'total' ? x.toFixed(2) : x.toFixed(1)
}

function onChartMove(evt) {
  const ents = activeEntities.value
  if (!ents.length || !wrapRef.value || !yScale.value) return
  const rect = wrapRef.value.getBoundingClientRect()
  const relX = (evt.clientX - rect.left) / rect.width
  const innerW = CHART_W - 2 * PAD
  const chartX = PAD + relX * innerW
  const xMax = emYearEnd.value
  const dx = xMax - emYearStart || 1
  const yearApprox = emYearStart + ((chartX - PAD) / innerW) * dx
  const rows = []
  for (const ent of ents) {
    const pts = pointsFor(ent)
    let best = pts[0]
    let bestDist = Infinity
    for (const p of pts) {
      const d = Math.abs(p.year - yearApprox)
      if (d < bestDist) {
        bestDist = d
        best = p
      }
    }
    if (best) rows.push({ entity: ent, year: best.year, value: formatY(best.y) })
  }
  if (!rows.length) return
  const first = rows[0]
  const svgY = chartYToSvg(
    pointsFor(first.entity).find((p) => p.year === first.year)?.y ?? 0,
    yScale.value.yMin,
    yScale.value.yMax,
    CHART_H,
    PAD,
  )
  tooltip.value = {
    show: true,
    x: relX * rect.width,
    y: (svgY / CHART_H) * rect.height,
    year: first.year,
    lines: rows,
  }
}

function hideTooltip() {
  tooltip.value = { ...tooltip.value, show: false }
}

function removeEntity(ent) {
  if (selected.value.length > 1) {
    selected.value = selected.value.filter((e) => e !== ent)
  }
}

function addEntity(ent) {
  if (!ent || selected.value.includes(ent)) return
  if (selected.value.length >= 6) return
  selected.value = [...selected.value, ent]
  search.value = ''
  showResults.value = false
}

function addFromSearch() {
  const q = search.value.trim()
  if (!q) return
  const exact = allEntities.value.find((e) => e.toLowerCase() === q.toLowerCase())
  addEntity(exact || searchResults.value[0])
}

function onSearchFocus() {
  if (search.value.trim()) showResults.value = true
}

function onSearchInput() {
  showResults.value = Boolean(search.value.trim())
}

function onSearchBlur() {
  window.setTimeout(() => {
    showResults.value = false
  }, 180)
}
</script>

<template>
  <section class="eec glass-card">
    <StoryHeroBanner
      :image-src="heroImage"
      title="Greenhouse gas emissions"
      subtitle="Annual greenhouse gas totals and per-person footprints — all gases in CO₂-equivalent (including land use), not CO₂ alone."
    />

    <div class="eec-toolbar">
      <div class="eec-mode">
        <button type="button" class="eec-mode-btn" :class="{ active: mode === 'total' }" @click="mode = 'total'">
          By country / region
        </button>
        <button type="button" class="eec-mode-btn" :class="{ active: mode === 'perCapita' }" @click="mode = 'perCapita'">
          Per capita
        </button>
      </div>
      <div class="eec-search-wrap">
        <div class="eec-search-row">
          <input
            v-model="search"
            type="search"
            class="eec-search"
            placeholder="Search any country or region…"
            autocomplete="off"
            @focus="onSearchFocus"
            @input="onSearchInput"
            @blur="onSearchBlur"
            @keydown.enter.prevent="addFromSearch"
          />
          <button type="button" class="eec-add-btn" @click="addFromSearch">Add</button>
        </div>
        <ul v-if="showResults && searchResults.length" class="eec-results" role="listbox">
          <li v-for="ent in searchResults" :key="ent">
            <button type="button" class="eec-result-btn" @mousedown.prevent="addEntity(ent)">
              {{ ent }}
            </button>
          </li>
        </ul>
        <p v-else-if="showResults && search.trim()" class="eec-no-match">No match — try another spelling.</p>
      </div>
    </div>

    <div v-if="activeEntities.length" class="eec-chips">
      <span
        v-for="ent in activeEntities"
        :key="ent"
        class="eec-chip"
        :style="{ '--chip-c': colorFor(ent) }"
      >
        <span class="eec-chip-dot" />
        {{ ent }}
        <button
          type="button"
          class="eec-chip-remove"
          :aria-label="`Remove ${ent}`"
          :disabled="activeEntities.length <= 1"
          @click="removeEntity(ent)"
        >×</button>
      </span>
      <span class="eec-chip-hint">{{ activeEntities.length }} / 6 on chart</span>
    </div>

    <div
      ref="wrapRef"
      class="eec-chart"
      role="img"
      aria-label="Greenhouse gas emissions chart"
      @mousemove="onChartMove"
      @mouseleave="hideTooltip"
    >
      <svg class="eec-svg" viewBox="0 0 880 260" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="880" height="260" fill="rgba(0,0,0,0.12)" rx="12" />
        <g v-if="yScale" class="axis-y-grid">
          <line
            v-for="(tk, i) in yScale.ticks"
            :key="'g' + i"
            class="grid-line"
            :x1="PAD"
            :y1="chartYToSvg(tk, yScale.yMin, yScale.yMax, CHART_H, PAD)"
            :x2="CHART_W - PAD"
            :y2="chartYToSvg(tk, yScale.yMin, yScale.yMax, CHART_H, PAD)"
          />
        </g>
        <text x="72" y="36" class="axis-label">{{ yAxisLabel }}</text>
        <polyline
          v-for="line in lines"
          :key="line.entity"
          :points="line.points"
          fill="none"
          :stroke="line.color"
          stroke-width="2.2"
        />
        <g v-if="yScale">
          <text
            v-for="(tk, i) in yScale.ticks"
            :key="'yl' + i"
            class="ytick-label"
            x="46"
            text-anchor="end"
            :y="chartYToSvg(tk, yScale.yMin, yScale.yMax, CHART_H, PAD) + 4"
          >{{ formatY(tk) }}</text>
        </g>
        <text x="52" y="236" class="tick-label">{{ emYearStart }}</text>
        <text x="828" y="236" class="tick-label" text-anchor="end">{{ emYearEnd }}</text>
      </svg>
      <div
        v-if="tooltip.show"
        class="eec-tip"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      >
        <span class="eec-tip-year">{{ tooltip.year }}</span>
        <div v-for="row in tooltip.lines" :key="row.entity" class="eec-tip-row">
          <span>{{ row.entity }}</span>
          <strong>{{ row.value }}</strong>
        </div>
      </div>
    </div>

    <p class="eec-foot body-text">
      {{ allEntities.length }} countries and regions in this dataset. Search to compare any of them — switch between
      national totals and per-person emissions above.
    </p>
    <a
      class="source-link"
      href="https://ourworldindata.org/greenhouse-gas-emissions"
      target="_blank"
      rel="noopener noreferrer"
    >Source: Our World in Data</a>
  </section>
</template>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: clamp(14px, 2vw, 20px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.eec-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}
.eec-mode {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.eec-mode-btn {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.eec-mode-btn.active {
  background: rgba(82, 212, 150, 0.18);
  border-color: rgba(82, 212, 150, 0.45);
  color: #e8fff2;
}
.eec-search-wrap {
  position: relative;
  flex: 1;
  min-width: 220px;
  max-width: 400px;
}
.eec-search-row {
  display: flex;
  gap: 8px;
}
.eec-search {
  flex: 1;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 0.82rem;
}
.eec-add-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 242, 255, 0.3);
  background: rgba(0, 242, 255, 0.12);
  color: #d8fdff;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.eec-results {
  list-style: none;
  margin: 6px 0 0;
  padding: 4px;
  position: absolute;
  left: 0;
  right: 0;
  z-index: 5;
  max-height: 220px;
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 18, 28, 0.97);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}
.eec-result-btn {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.8rem;
  cursor: pointer;
}
.eec-result-btn:hover {
  background: rgba(0, 242, 255, 0.12);
}
.eec-no-match {
  margin: 6px 0 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.45);
}
.eec-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.eec-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--chip-c) 55%, transparent);
  background: color-mix(in srgb, var(--chip-c) 18%, rgba(0, 0, 0, 0.3));
  color: #fff;
  font-size: 0.72rem;
}
.eec-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chip-c);
}
.eec-chip-remove {
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.eec-chip-remove:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.eec-chip-hint {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
}
.eec-chart {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: crosshair;
}
.eec-svg {
  display: block;
  width: 100%;
  height: auto;
  min-height: 200px;
}
.grid-line {
  stroke: rgba(255, 255, 255, 0.1);
}
.axis-label,
.ytick-label,
.tick-label {
  fill: rgba(255, 255, 255, 0.42);
  font-size: 11px;
}
.tick-label {
  font-size: 12px;
}
.eec-tip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
  pointer-events: none;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(12, 18, 28, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.18);
  z-index: 2;
  min-width: 140px;
}
.eec-tip-year {
  display: block;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}
.eec-tip-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
}
.body-text {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.78);
}
.source-link {
  font-size: 0.72rem;
  font-weight: 600;
  color: #00f2ff;
  text-decoration: none;
  align-self: flex-start;
}
.source-link:hover {
  color: #fff;
}
</style>
