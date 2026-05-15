<template>
  <div class="page">
    <header class="hero glass-card">
      <p class="hook-lead">
        Do you feel that the weather is getting warmer? That intuition points to a serious, long-term challenge: climate
        change. Open data lets us see clearer trends than day-to-day weather alone — and it shows why faster, fairer
        climate action matters before impacts become even harder to manage.
      </p>
      <p class="hook-lead hook-lead--muted">
        We may not feel climate change in an obvious way every day, but datasets help us see the bigger picture. In this
        section you can explore real figures for temperature, sea level, greenhouse-gas emissions, per-person emissions,
        and global forest area.
      </p>
      <button type="button" class="explore-btn" @click="toggleExplore">
        {{ exploreOpen ? 'Hide data explorer' : 'Explore more' }}
      </button>
    </header>

    <div v-if="!exploreOpen" class="glass-card hint-card">
      <div class="card-title">Tip</div>
      <p class="body-text">
        Tap <strong>Explore more</strong> to reveal charts built from your course CSV files (temperature, sea level,
        greenhouse gases, per-capita emissions, and global forest area). Everything runs locally in the browser.
      </p>
    </div>

    <template v-else>
      <div v-if="loading" class="glass-card center-state">
        <div class="spin"></div>
        <span class="sub-text">Loading open datasets…</span>
      </div>
      <div v-else-if="loadError" class="glass-card error-state">
        <div class="card-title">Could not load data</div>
        <p class="body-text">{{ loadError }}</p>
      </div>

      <template v-else>
        <!-- 1 Temperature -->
        <section class="data-section glass-card">
          <div class="section-head">
            <div>
              <div class="card-title">Global temperature trend</div>
              <h4 class="section-h4">Land & ocean temperature anomaly</h4>
            </div>
            <a
              class="source-link"
              href="https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series"
              target="_blank"
              rel="noopener noreferrer"
            >Data source (NOAA)</a>
          </div>
          <p class="body-text">
            This chart shows how global temperature has changed over time (°C vs 1901–2000 baseline). Even if some years
            are higher or lower than others, the long-term pattern helps explain why global warming matters.
          </p>
          <div class="chart-wrap" role="img" :aria-label="tempAria">
            <svg class="chart-svg" viewBox="0 0 880 260" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(0,242,255,0.35)" />
                  <stop offset="100%" stop-color="rgba(0,242,255,0)" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="880" height="260" fill="rgba(0,0,0,0.15)" rx="12" />
              <g v-if="tempScale" class="axis-y-grid">
                <line
                  v-for="(tk, i) in tempScale.ticks"
                  :key="'tg' + i"
                  class="grid-line"
                  :x1="PAD"
                  :y1="chartYToSvg(tk, tempScale.yMin, tempScale.yMax, CHART_H, PAD)"
                  :x2="CHART_W - PAD"
                  :y2="chartYToSvg(tk, tempScale.yMin, tempScale.yMax, CHART_H, PAD)"
                />
              </g>
              <text x="72" y="36" class="axis-label">°C anomaly</text>
              <polyline v-if="tempFillPoints" :points="tempFillPoints" fill="url(#tempFill)" stroke="none" />
              <polyline v-if="tempLinePoints" :points="tempLinePoints" fill="none" stroke="#00f2ff" stroke-width="2.5" />
              <g v-if="tempScale" class="axis-y-labels">
                <text
                  v-for="(tk, i) in tempScale.ticks"
                  :key="'tyl' + i"
                  class="ytick-label"
                  x="46"
                  text-anchor="end"
                  :y="chartYToSvg(tk, tempScale.yMin, tempScale.yMax, CHART_H, PAD) + 4"
                >{{ formatYTick(tk, 'temp') }}</text>
              </g>
              <text x="52" y="236" class="tick-label">{{ tempYearStart }}</text>
              <text x="828" y="236" class="tick-label" text-anchor="end">{{ tempYearEnd }}</text>
            </svg>
          </div>
          <div class="insight-box">
            <div class="insight-title">Why this chart matters</div>
            <ul class="insight-list">
              <li>
                <strong>Weather is not climate.</strong> Day-to-day swings hide slow shifts; anomalies compare each year
                to the same long-term baseline so the warming signal is easier to see.
              </li>
              <li>
                A warmer average strengthens the odds of heat extremes, heavier rain in some regions, and stressed
                ecosystems — even when your local week still feels “normal”.
              </li>
              <li>
                Most extra heat ends up in the ocean first; land+ocean curves therefore track the planetary energy
                imbalance that greenhouse gases help sustain.
              </li>
            </ul>
          </div>
        </section>

        <!-- 2 Sea level -->
        <section class="data-section glass-card">
          <div class="section-head">
            <div>
              <div class="card-title">Sea level change</div>
              <h4 class="section-h4">Global mean sea level (annual mean of NASA smoothed series)</h4>
            </div>
            <a
              class="source-link"
              href="https://sealevel.nasa.gov/understanding-sea-level/key-indicators/global-mean-sea-level/"
              target="_blank"
              rel="noopener noreferrer"
            >Data source (NASA)</a>
          </div>
          <p class="body-text">
            Rising temperature can affect ice sheets and glaciers, which may contribute to sea level rise. The curve can
            wiggle year to year — focus on the overall direction rather than a single point.
          </p>
          <div class="chart-wrap" role="img" :aria-label="seaAria">
            <svg class="chart-svg" viewBox="0 0 880 260" preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="0" width="880" height="260" fill="rgba(0,0,0,0.15)" rx="12" />
              <g v-if="seaScale" class="axis-y-grid">
                <line
                  v-for="(tk, i) in seaScale.ticks"
                  :key="'sg' + i"
                  class="grid-line"
                  :x1="PAD"
                  :y1="chartYToSvg(tk, seaScale.yMin, seaScale.yMax, CHART_H, PAD)"
                  :x2="CHART_W - PAD"
                  :y2="chartYToSvg(tk, seaScale.yMin, seaScale.yMax, CHART_H, PAD)"
                />
              </g>
              <text x="72" y="36" class="axis-label">cm (smoothed)</text>
              <polyline v-if="seaLinePoints" :points="seaLinePoints" fill="none" stroke="#52d496" stroke-width="2.5" />
              <g v-if="seaScale" class="axis-y-labels">
                <text
                  v-for="(tk, i) in seaScale.ticks"
                  :key="'syl' + i"
                  class="ytick-label"
                  x="46"
                  text-anchor="end"
                  :y="chartYToSvg(tk, seaScale.yMin, seaScale.yMax, CHART_H, PAD) + 4"
                >{{ formatYTick(tk, 'sea') }}</text>
              </g>
              <text x="52" y="236" class="tick-label">{{ seaYearStart }}</text>
              <text x="828" y="236" class="tick-label" text-anchor="end">{{ seaYearEnd }}</text>
            </svg>
          </div>
          <div class="insight-box">
            <div class="insight-title">How warming reaches the coast</div>
            <ul class="insight-list">
              <li>
                <strong>Two big levers:</strong> ocean water expands as it warms, and land ice (glaciers, ice sheets)
                adds water to the ocean when it melts faster than snow replaces it.
              </li>
              <li>
                Satellites and tide gauges blend many measurements; smoothed curves highlight the multi-decade climb
                instead of short noise from storms like El Niño.
              </li>
              <li>
                Rising mean sea level raises the baseline for storm surge and coastal flooding — a risk multiplier for
                cities, farms, and freshwater aquifers near the shore.
              </li>
            </ul>
          </div>
        </section>

        <!-- 3 Total GHG -->
        <section class="data-section glass-card">
          <div class="section-head">
            <div>
              <div class="card-title">Greenhouse gas emissions</div>
              <h4 class="section-h4">Total emissions by region / country (Gt CO₂e)</h4>
            </div>
            <a
              class="source-link"
              href="https://ourworldindata.org/co2-and-greenhouse-gas-emissions"
              target="_blank"
              rel="noopener noreferrer"
            >Data source (Our World in Data)</a>
          </div>
          <p class="body-text">
            Compare who emits how much in absolute terms. Some places can stabilise or lower emissions per person while
            totals stay high — population, industry, and energy all play a role.
          </p>
          <div class="toggle-row">
            <label v-for="ent in ghgEntities" :key="ent" class="toggle">
              <input v-model="ghgOn[ent]" type="checkbox" />
              <span class="swatch" :style="{ background: entityColors[ent] }"></span>
              {{ ent }}
            </label>
          </div>
          <div class="chart-wrap" role="img" aria-label="Greenhouse gas totals chart">
            <svg class="chart-svg" viewBox="0 0 880 260" preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="0" width="880" height="260" fill="rgba(0,0,0,0.15)" rx="12" />
              <g v-if="ghgScale" class="axis-y-grid">
                <line
                  v-for="(tk, i) in ghgScale.ticks"
                  :key="'gg' + i"
                  class="grid-line"
                  :x1="PAD"
                  :y1="chartYToSvg(tk, ghgScale.yMin, ghgScale.yMax, CHART_H, PAD)"
                  :x2="CHART_W - PAD"
                  :y2="chartYToSvg(tk, ghgScale.yMin, ghgScale.yMax, CHART_H, PAD)"
                />
              </g>
              <text x="72" y="36" class="axis-label">Gt CO₂e</text>
              <polyline
                v-for="line in ghgLines"
                :key="line.entity"
                :points="line.points"
                fill="none"
                :stroke="line.color"
                stroke-width="2.2"
              />
              <g v-if="ghgScale" class="axis-y-labels">
                <text
                  v-for="(tk, i) in ghgScale.ticks"
                  :key="'gyl' + i"
                  class="ytick-label"
                  x="46"
                  text-anchor="end"
                  :y="chartYToSvg(tk, ghgScale.yMin, ghgScale.yMax, CHART_H, PAD) + 4"
                >{{ formatYTick(tk, 'gt') }}</text>
              </g>
              <text x="52" y="236" class="tick-label">{{ emYearStart }}</text>
              <text x="828" y="236" class="tick-label" text-anchor="end">{{ emYearEnd }}</text>
            </svg>
          </div>
          <div class="insight-box">
            <div class="insight-title">Reading total greenhouse-gas emissions</div>
            <ul class="insight-list">
              <li>
                “Greenhouse gases” usually means the whole basket (for example CO₂, methane, nitrous oxide) counted in
                <strong>CO₂-equivalent</strong> so gases with different strengths sit on one axis.
              </li>
              <li>
                National and regional totals track energy systems, industry, transport, land use, and waste — useful for
                spotting structural change (fuel switching, efficiency, policy) versus one-off weather events.
              </li>
              <li>
                The <strong>World</strong> line is the atmosphere’s “pressure gauge”: even when some economies slow
                their growth in emissions, the planet still feels the accumulated stock of gases already emitted.
              </li>
            </ul>
          </div>
        </section>

        <!-- 4 Per capita -->
        <section class="data-section glass-card">
          <div class="section-head">
            <div>
              <div class="card-title">Emissions per person</div>
              <h4 class="section-h4">Per-capita greenhouse gas emissions (t CO₂e)</h4>
            </div>
            <a
              class="source-link"
              href="https://ourworldindata.org/co2-and-greenhouse-gas-emissions"
              target="_blank"
              rel="noopener noreferrer"
            >Data source (Our World in Data)</a>
          </div>
          <p class="body-text">
            Totals show the overall amount released; per-person values show the average pressure in a region. Toggle
            lines to see whether personal footprints rise, fall, or hold steady.
          </p>
          <div class="toggle-row">
            <label v-for="ent in ghgEntities" :key="'pc-' + ent" class="toggle">
              <input v-model="pcOn[ent]" type="checkbox" />
              <span class="swatch" :style="{ background: entityColors[ent] }"></span>
              {{ ent }}
            </label>
          </div>
          <div class="chart-wrap" role="img" aria-label="Per capita emissions chart">
            <svg class="chart-svg" viewBox="0 0 880 260" preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="0" width="880" height="260" fill="rgba(0,0,0,0.15)" rx="12" />
              <g v-if="pcScale" class="axis-y-grid">
                <line
                  v-for="(tk, i) in pcScale.ticks"
                  :key="'pg' + i"
                  class="grid-line"
                  :x1="PAD"
                  :y1="chartYToSvg(tk, pcScale.yMin, pcScale.yMax, CHART_H, PAD)"
                  :x2="CHART_W - PAD"
                  :y2="chartYToSvg(tk, pcScale.yMin, pcScale.yMax, CHART_H, PAD)"
                />
              </g>
              <text x="72" y="36" class="axis-label">t CO₂e / person</text>
              <polyline
                v-for="line in pcLines"
                :key="line.entity"
                :points="line.points"
                fill="none"
                :stroke="line.color"
                stroke-width="2.2"
              />
              <g v-if="pcScale" class="axis-y-labels">
                <text
                  v-for="(tk, i) in pcScale.ticks"
                  :key="'pyl' + i"
                  class="ytick-label"
                  x="46"
                  text-anchor="end"
                  :y="chartYToSvg(tk, pcScale.yMin, pcScale.yMax, CHART_H, PAD) + 4"
                >{{ formatYTick(tk, 'tpc') }}</text>
              </g>
              <text x="52" y="236" class="tick-label">{{ emYearStart }}</text>
              <text x="828" y="236" class="tick-label" text-anchor="end">{{ emYearEnd }}</text>
            </svg>
          </div>
          <div class="insight-box">
            <div class="insight-title">Per person vs total — both stories are real</div>
            <ul class="insight-list">
              <li>
                <strong>Per-capita emissions</strong> tell you about typical lifestyles, efficiency of infrastructure,
                and how carbon-intense consumption is for an average resident.
              </li>
              <li>
                A country can improve efficiency (falling per-person line) while totals still rise if population,
                economic activity, or energy demand grows quickly.
              </li>
              <li>
                Equity matters in climate diplomacy: many high-emitting countries also bear historical responsibility,
                while low-lying and tropical regions often face outsized impacts.
              </li>
              <li>
                That is why ClimateQuest still rewards everyday shifts — many modest actions add up when millions of
                people repeat them.
              </li>
            </ul>
          </div>
        </section>

        <!-- 5 Forest -->
        <section class="data-section glass-card">
          <div class="section-head">
            <div>
              <div class="card-title">Forest area change</div>
              <h4 class="section-h4">World forest land (FAOSTAT, million hectares)</h4>
            </div>
            <a
              class="source-link"
              href="https://www.fao.org/faostat/en/#data/RL"
              target="_blank"
              rel="noopener noreferrer"
            >Data source (FAO)</a>
          </div>
          <p class="body-text">
            Forests absorb CO₂ and support ecosystems. The downward trend reminds us why protecting forests — and the
            tree-planting loop in ClimateQuest — still matters alongside cutting emissions.
          </p>
          <div class="chart-wrap" role="img" :aria-label="forestAria">
            <svg class="chart-svg" viewBox="0 0 880 260" preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="0" width="880" height="260" fill="rgba(0,0,0,0.15)" rx="12" />
              <g v-if="forestScale" class="axis-y-grid">
                <line
                  v-for="(tk, i) in forestScale.ticks"
                  :key="'fg' + i"
                  class="grid-line"
                  :x1="PAD"
                  :y1="chartYToSvg(tk, forestScale.yMin, forestScale.yMax, CHART_H, PAD)"
                  :x2="CHART_W - PAD"
                  :y2="chartYToSvg(tk, forestScale.yMin, forestScale.yMax, CHART_H, PAD)"
                />
              </g>
              <text x="72" y="36" class="axis-label">Million ha</text>
              <polyline v-if="forestLinePoints" :points="forestLinePoints" fill="none" stroke="#94f0c8" stroke-width="2.5" />
              <g v-if="forestScale" class="axis-y-labels">
                <text
                  v-for="(tk, i) in forestScale.ticks"
                  :key="'fyl' + i"
                  class="ytick-label"
                  x="46"
                  text-anchor="end"
                  :y="chartYToSvg(tk, forestScale.yMin, forestScale.yMax, CHART_H, PAD) + 4"
                >{{ formatYTick(tk, 'forest') }}</text>
              </g>
              <text x="52" y="236" class="tick-label">{{ forestYearStart }}</text>
              <text x="828" y="236" class="tick-label" text-anchor="end">{{ forestYearEnd }}</text>
            </svg>
          </div>
          <div class="insight-box">
            <div class="insight-title">Forests as climate infrastructure</div>
            <ul class="insight-list">
              <li>
                Living forests store carbon in trunks, roots, and soils; clearing or degrading them releases CO₂ and
                shrinks nature’s buffer while biodiversity and water cycles suffer.
              </li>
              <li>
                The FAOSTAT series here tracks <strong>forest land area</strong> — useful for spotting long-run pressure
                from agriculture, logging, and urban expansion even when planting campaigns exist elsewhere.
              </li>
              <li>
                <strong>Protection + restoration</strong> pair with emissions cuts: new trees take decades to match a
                mature forest’s storage, so preventing loss is usually the fastest win.
              </li>
              <li>
                That logic is why ClimateQuest links your progress to trees: the game loop nudges you to value carbon
                sinks the same way you value turning off waste energy.
              </li>
            </ul>
          </div>
        </section>

        <!-- Summary -->
        <section class="data-section glass-card summary-card">
          <div class="card-title">From data to action</div>
          <p class="body-text">
            The charts do not mean one person can reverse climate change alone — they show why coordinated, everyday
            choices still matter when millions participate. In ClimateQuest, walking, public transport, saving energy, and
            growing your scene with trees are all nudges that connect these curves to what you can do next.
          </p>
          <div class="insight-box insight-box--summary">
            <div class="insight-title">How the story lines up</div>
            <ul class="insight-list">
              <li>
                <strong>Temperature</strong> tracks the planetary fever; <strong>sea level</strong> shows one slow
                consequence that coastal communities cannot ignore.
              </li>
              <li>
                <strong>Greenhouse-gas totals</strong> explain why the fever keeps rising; <strong>per-capita lines</strong>
                remind us that fairness and lifestyle both shape the path down.
              </li>
              <li>
                <strong>Forest area</strong> highlights the living side of the carbon cycle — sinks shrink when land-use
                pressure wins, which makes cuts in fossil emissions even more urgent.
              </li>
            </ul>
          </div>
          <ul class="action-list">
            <li>Use <strong>Daily Tasks</strong> and the <strong>Quiz</strong> to turn insight into habits.</li>
            <li>Spend coins in <strong>My Scene</strong> to visualise progress.</li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import {
  parseTemperatureCsv,
  parseNasaAnnualCsv,
  parseGhgByEntity,
  parsePerCapitaByEntity,
  parseFaostatForestWorld,
  toSvgPolyline,
  extentYs,
  extentXs,
  chartYToSvg,
  buildLinearYTicks,
} from '../utils/education/openDataParse.js'

const DATA_BASE = '/data/education/'

const exploreOpen = ref(false)
const loading = ref(false)
const loadError = ref('')

const temperature = ref([])
const seaLevel = ref([])
const ghgByEntity = ref(new Map())
const perCapitaByEntity = ref(new Map())
const forest = ref([])

const ghgEntities = ['World', 'Asia', 'China', 'India']
const entityColors = {
  World: '#52d496',
  Asia: '#7aa2ff',
  China: '#f4c430',
  India: '#ff8ad8',
}

const ghgOn = reactive(Object.fromEntries(ghgEntities.map((e) => [e, true])))
const pcOn = reactive(Object.fromEntries(ghgEntities.map((e) => [e, true])))

const CHART_W = 880
const CHART_H = 260
const PAD = 52

const emYearStart = 1970
const emYearEnd = 2022

function formatYTick(v, mode) {
  const x = Number(v)
  if (!Number.isFinite(x)) return ''
  if (mode === 'temp') return x.toFixed(2)
  if (mode === 'sea') return x.toFixed(1)
  if (mode === 'gt') return x.toFixed(2)
  if (mode === 'tpc') return x.toFixed(1)
  if (mode === 'forest') return x.toFixed(0)
  return String(x)
}

function emissionsYScale(getPoints, toggles) {
  const active = ghgEntities.filter((e) => toggles[e])
  if (!active.length) return null
  let yMin = Infinity
  let yMax = -Infinity
  for (const ent of active) {
    for (const p of getPoints(ent)) {
      yMin = Math.min(yMin, p.y)
      yMax = Math.max(yMax, p.y)
    }
  }
  if (!Number.isFinite(yMin)) return null
  const padY = (yMax - yMin) * 0.08 || 0.1
  yMin -= padY
  yMax += padY
  return { yMin, yMax, ticks: buildLinearYTicks(yMin, yMax) }
}

function toggleExplore() {
  exploreOpen.value = !exploreOpen.value
  if (exploreOpen.value && !temperature.value.length && !loading.value && !loadError.value) {
    loadAll()
  }
}

async function loadAll() {
  loading.value = true
  loadError.value = ''
  try {
    const [tText, nText, gText, pText, fText] = await Promise.all([
      fetch(`${DATA_BASE}TemperatureGlobal.csv`).then((r) => {
        if (!r.ok) throw new Error('TemperatureGlobal.csv')
        return r.text()
      }),
      fetch(`${DATA_BASE}NASA_SSH_GMSL_INDICATOR.csv`).then((r) => {
        if (!r.ok) throw new Error('NASA_SSH_GMSL_INDICATOR.csv')
        return r.text()
      }),
      fetch(`${DATA_BASE}greenhouse-gas-emissions-country.csv`).then((r) => {
        if (!r.ok) throw new Error('greenhouse-gas-emissions-country.csv')
        return r.text()
      }),
      fetch(`${DATA_BASE}per-capita-greenhouse-gas-emissions.csv`).then((r) => {
        if (!r.ok) throw new Error('per-capita-greenhouse-gas-emissions.csv')
        return r.text()
      }),
      fetch(`${DATA_BASE}FAOSTAT_data.csv`).then((r) => {
        if (!r.ok) throw new Error('FAOSTAT_data.csv')
        return r.text()
      }),
    ])
    temperature.value = parseTemperatureCsv(tText)
    seaLevel.value = parseNasaAnnualCsv(nText)
    ghgByEntity.value = parseGhgByEntity(gText)
    perCapitaByEntity.value = parsePerCapitaByEntity(pText)
    forest.value = parseFaostatForestWorld(fText)
  } catch (e) {
    loadError.value = String(e?.message || e || 'Failed to load CSV files.')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (exploreOpen.value) loadAll()
})

/* —— Temperature chart —— */
const tempYearStart = computed(() => temperature.value[0]?.year ?? '')
const tempYearEnd = computed(() => temperature.value[temperature.value.length - 1]?.year ?? '')
const tempAria = computed(
  () => `Temperature anomaly from ${tempYearStart.value} to ${tempYearEnd.value}`,
)

const tempLinePoints = computed(() => {
  const pts = temperature.value
  if (!pts.length) return ''
  const xs = extentXs(pts, 'year')
  const ys = extentYs(pts, 'anomaly')
  return toSvgPolyline(pts, CHART_W, CHART_H, PAD, 'year', 'anomaly', xs[0], xs[1], ys[0], ys[1])
})

const tempFillPoints = computed(() => {
  const pts = temperature.value
  if (!pts.length) return ''
  const xs = extentXs(pts, 'year')
  const ys = extentYs(pts, 'anomaly')
  const baseline = Math.min(0, ys[0], ...pts.map((p) => p.anomaly))
  const pts2 = [
    ...pts,
    { year: pts[pts.length - 1].year, anomaly: baseline },
    { year: pts[0].year, anomaly: baseline },
  ]
  const yLo = Math.min(ys[0], baseline)
  const yHi = ys[1]
  return toSvgPolyline(pts2, CHART_W, CHART_H, PAD, 'year', 'anomaly', xs[0], xs[1], yLo, yHi)
})

const tempScale = computed(() => {
  const pts = temperature.value
  if (!pts.length) return null
  const ys = extentYs(pts, 'anomaly')
  return { yMin: ys[0], yMax: ys[1], ticks: buildLinearYTicks(ys[0], ys[1]) }
})

/* —— Sea level —— */
const seaYearStart = computed(() => seaLevel.value[0]?.year ?? '')
const seaYearEnd = computed(() => seaLevel.value[seaLevel.value.length - 1]?.year ?? '')
const seaAria = computed(() => `Mean sea level from ${seaYearStart.value} to ${seaYearEnd.value}`)

const seaLinePoints = computed(() => {
  const pts = seaLevel.value
  if (!pts.length) return ''
  const xs = extentXs(pts, 'year')
  const ys = extentYs(pts, 'gmsl')
  return toSvgPolyline(pts, CHART_W, CHART_H, PAD, 'year', 'gmsl', xs[0], xs[1], ys[0], ys[1])
})

const seaScale = computed(() => {
  const pts = seaLevel.value
  if (!pts.length) return null
  const ys = extentYs(pts, 'gmsl')
  return { yMin: ys[0], yMax: ys[1], ticks: buildLinearYTicks(ys[0], ys[1]) }
})

/* —— Emissions helpers —— */
function pointsForGhg(entity) {
  const arr = ghgByEntity.value.get(entity)
  if (!arr) return []
  return arr
    .filter((p) => p.year >= emYearStart && p.year <= emYearEnd)
    .map((p) => ({ year: p.year, y: p.value / 1e12 }))
}

function pointsForPc(entity) {
  const arr = perCapitaByEntity.value.get(entity)
  if (!arr) return []
  return arr.filter((p) => p.year >= emYearStart && p.year <= emYearEnd).map((p) => ({ year: p.year, y: p.value }))
}

function multiLinePoints(getPoints, toggles) {
  const active = ghgEntities.filter((e) => toggles[e])
  if (!active.length) return []
  let yMin = Infinity
  let yMax = -Infinity
  for (const ent of active) {
    for (const p of getPoints(ent)) {
      yMin = Math.min(yMin, p.y)
      yMax = Math.max(yMax, p.y)
    }
  }
  if (!Number.isFinite(yMin)) return []
  const padY = (yMax - yMin) * 0.08 || 0.1
  yMin -= padY
  yMax += padY
  const xMin = emYearStart
  const xMax = emYearEnd
  return active.map((entity) => ({
    entity,
    color: entityColors[entity],
    points: toSvgPolyline(getPoints(entity), CHART_W, CHART_H, PAD, 'year', 'y', xMin, xMax, yMin, yMax),
  }))
}

const ghgLines = computed(() => multiLinePoints(pointsForGhg, ghgOn))
const pcLines = computed(() => multiLinePoints(pointsForPc, pcOn))

const ghgScale = computed(() => emissionsYScale(pointsForGhg, ghgOn))
const pcScale = computed(() => emissionsYScale(pointsForPc, pcOn))

/* —— Forest —— */
const forestYearStart = computed(() => forest.value[0]?.year ?? '')
const forestYearEnd = computed(() => forest.value[forest.value.length - 1]?.year ?? '')
const forestAria = computed(
  () => `World forest area from ${forestYearStart.value} to ${forestYearEnd.value}`,
)

const forestLinePoints = computed(() => {
  const pts = forest.value
  if (!pts.length) return ''
  const xs = extentXs(pts, 'year')
  const ys = extentYs(pts, 'millionHa')
  return toSvgPolyline(pts, CHART_W, CHART_H, PAD, 'year', 'millionHa', xs[0], xs[1], ys[0], ys[1])
})

const forestScale = computed(() => {
  const pts = forest.value
  if (!pts.length) return null
  const ys = extentYs(pts, 'millionHa')
  return { yMin: ys[0], yMax: ys[1], ticks: buildLinearYTicks(ys[0], ys[1]) }
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hero.glass-card {
  background: linear-gradient(135deg, rgba(0, 242, 255, 0.08), rgba(82, 212, 150, 0.06));
  border: 1px solid rgba(0, 242, 255, 0.22);
}
.hook-lead {
  margin: 0 0 12px;
  font-size: 0.88rem;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.88);
}
.hook-lead--muted {
  margin-bottom: 16px;
  font-size: 0.82rem;
  line-height: 1.58;
  color: rgba(255, 255, 255, 0.62);
}
.explore-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 22px;
  border-radius: 999px;
  border: 1px solid rgba(0, 242, 255, 0.35);
  background: rgba(0, 242, 255, 0.14);
  color: #9af6ff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.explore-btn:hover {
  background: rgba(0, 242, 255, 0.24);
  color: #fff;
  border-color: rgba(0, 242, 255, 0.55);
}
.glass-card {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 16px;
}
.hint-card .card-title {
  margin-bottom: 8px;
}
.card-title {
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148, 240, 200, 0.95);
  margin-bottom: 4px;
}
.section-h4 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
}
.body-text {
  margin: 10px 0 0;
  font-size: 0.84rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.78);
}
.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.source-link {
  font-size: 0.72rem;
  font-weight: 600;
  color: #00f2ff;
  text-decoration: none;
  border-bottom: 1px solid rgba(0, 242, 255, 0.35);
  white-space: nowrap;
}
.source-link:hover {
  color: #fff;
  border-bottom-color: rgba(255, 255, 255, 0.45);
}
.data-section {
  border-color: rgba(0, 242, 255, 0.12);
  background: rgba(0, 242, 255, 0.03);
}
.chart-wrap {
  margin-top: 14px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.chart-svg {
  display: block;
  width: 100%;
  height: auto;
  min-height: 200px;
}
.grid-line {
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 1;
}
.ytick-label {
  fill: rgba(255, 255, 255, 0.48);
  font-size: 11px;
  pointer-events: none;
}
.insight-box {
  margin-top: 14px;
  padding: 12px 14px 2px;
  border-radius: 12px;
  border: 1px solid rgba(148, 240, 200, 0.22);
  background: rgba(8, 28, 18, 0.35);
}
.insight-box--summary {
  border-color: rgba(82, 212, 150, 0.35);
  background: rgba(0, 0, 0, 0.2);
}
.insight-title {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(148, 240, 200, 0.98);
  margin-bottom: 8px;
}
.insight-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.8rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.82);
}
.insight-list li {
  margin-bottom: 8px;
}
.insight-list li:last-child {
  margin-bottom: 4px;
}
.insight-list strong {
  color: rgba(0, 242, 255, 0.92);
  font-weight: 700;
}
.axis-label {
  fill: rgba(255, 255, 255, 0.45);
  font-size: 13px;
}
.tick-label {
  fill: rgba(255, 255, 255, 0.38);
  font-size: 12px;
}
.toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin-top: 12px;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  user-select: none;
}
.toggle input {
  accent-color: #00f2ff;
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.summary-card {
  background: rgba(82, 212, 150, 0.06);
  border-color: rgba(82, 212, 150, 0.25);
}
.action-list {
  margin: 14px 0 0;
  padding-left: 18px;
  font-size: 0.82rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.82);
}
.center-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px;
}
.spin {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #00f2ff;
  animation: spin 0.75s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.sub-text {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}
.error-state .body-text {
  color: #ffb4b4;
}
</style>
