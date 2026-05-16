<template>
  <div class="edu-page page">
    <section class="edu-intro glass-card">
      <StoryHeroBanner
        image-src="/images/education/hero-earth.png"
        title="Explore Climate Data"
        subtitle="Real data. Clear trends. Smarter choices."
      />
      <div class="edu-intro-copy">
        <p class="body-text">
          Do you feel that the weather is getting warmer? That intuition points to a serious, long-term challenge:
          climate change. Open data lets us see clearer trends than day-to-day weather alone — and it shows why faster,
          fairer climate action matters before impacts become even harder to manage.
        </p>
        <p class="body-text">
          We may not feel climate change in an obvious way every day, but datasets help us see the bigger picture. Explore
          temperature, sea level, greenhouse-gas emissions, per-person emissions, and global forest area below.
        </p>
      </div>
    </section>

    <ClimateStorySteps class="edu-steps" />

    <div v-if="loading" class="glass-card center-state">
      <div class="spin" />
      <span class="sub-text">Loading open datasets…</span>
    </div>
    <div v-else-if="loadError" class="glass-card error-state">
      <p class="body-text">{{ loadError }}</p>
    </div>

    <template v-else>
      <!-- Temperature -->
      <DataStoryCard
        hero-image="/images/education/temperature.png"
        story-title="Hotter planet"
        story-subtitle="Global land and ocean temperatures are rising compared with the 1901–2000 baseline."
        takeaway="+1.1°C"
        takeaway-hint="since 1960"
        source-name="NOAA"
        source-url="https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series"
        accent="#ef4444"
      >
        <template #chart>
          <EducationLineChart
            :points="temperature"
            x-key="year"
            y-key="anomaly"
            stroke="#ef4444"
            fill-gradient-id="tempFillRed"
            y-label="°C anomaly"
            :aria-label="tempAria"
            :format-y="(v) => Number(v).toFixed(2)"
            :format-tooltip-y="(v) => `${Number(v).toFixed(2)} °C`"
            :format-tooltip-x="(v) => `Year ${v}`"
          />
        </template>
        <template #details>
          <p class="body-text">
            This chart shows how global temperature has changed over time. Even if some years are higher or lower than
            others, the long-term pattern helps explain why global warming matters.
          </p>
          <div class="insight-box">
            <div class="insight-title">Why this chart matters</div>
            <ul class="insight-list">
              <li>
                <strong>Weather is not climate.</strong> Day-to-day swings hide slow shifts; anomalies compare each year
                to the same long-term baseline.
              </li>
              <li>
                A warmer average strengthens the odds of heat extremes, heavier rain in some regions, and stressed
                ecosystems.
              </li>
            </ul>
          </div>
        </template>
      </DataStoryCard>

      <!-- Sea level -->
      <DataStoryCard
        hero-image="/images/education/sealevel.png"
        story-title="Sea level rising"
        story-subtitle="Satellite and gauge records show global mean sea level climbing since 1993."
        takeaway="+10 cm"
        takeaway-hint="since 1993"
        source-name="NASA"
        source-url="https://sealevel.nasa.gov/understanding-sea-level/key-indicators/global-mean-sea-level/"
        accent="#3b82f6"
      >
        <template #chart>
          <EducationLineChart
            :points="seaLevel"
            x-key="year"
            y-key="gmsl"
            stroke="#3b82f6"
            fill-gradient-id="seaFillBlue"
            y-label="cm (smoothed)"
            :aria-label="seaAria"
            :format-y="(v) => Number(v).toFixed(1)"
            :format-tooltip-y="(v) => `${Number(v).toFixed(1)} cm`"
            :format-tooltip-x="(v) => `Year ${v}`"
          />
        </template>
        <template #details>
          <p class="body-text">
            Rising temperature affects ice sheets and glaciers, which contributes to sea level rise. Focus on the overall
            direction rather than a single year.
          </p>
          <div class="insight-box">
            <div class="insight-title">How warming reaches the coast</div>
            <ul class="insight-list">
              <li>
                <strong>Two big levers:</strong> ocean water expands as it warms, and land ice adds water when it melts
                faster than snow replaces it.
              </li>
              <li>
                Rising mean sea level raises the baseline for storm surge and coastal flooding.
              </li>
            </ul>
          </div>
        </template>
      </DataStoryCard>

      <!-- Merged GHG explorer -->
      <EmissionsExplorerCard :ghg-by-entity="ghgByEntity" :per-capita-by-entity="perCapitaByEntity" />

      <!-- Forest -->
      <DataStoryCard
        hero-image="/images/education/forest.png"
        story-title="Forest area shrinking"
        story-subtitle="World forest land area has trended downward since 1990."
        takeaway="Declining"
        takeaway-hint="since 1990"
        source-name="FAO"
        source-url="https://www.fao.org/faostat/en/#data/RL"
        accent="#4ade80"
      >
        <template #chart>
          <EducationLineChart
            :points="forest"
            x-key="year"
            y-key="millionHa"
            stroke="#4ade80"
            y-label="Million ha"
            :aria-label="forestAria"
            :format-y="(v) => Number(v).toFixed(0)"
            :format-tooltip-y="(v) => `${Number(v).toFixed(1)} M ha`"
            :format-tooltip-x="(v) => `Year ${v}`"
          />
        </template>
        <template #details>
          <p class="body-text">
            Forests absorb CO₂ and support ecosystems. The downward trend reminds us why protecting forests — and the
            tree-planting loop in ClimateQuest — still matters alongside cutting emissions.
          </p>
          <div class="insight-box">
            <div class="insight-title">Forests as climate infrastructure</div>
            <ul class="insight-list">
              <li>
                Living forests store carbon in trunks, roots, and soils; clearing them releases CO₂ and shrinks nature's
                buffer.
              </li>
              <li>
                <strong>Protection + restoration</strong> pair with emissions cuts: preventing loss is usually the fastest
                win.
              </li>
            </ul>
          </div>
        </template>
      </DataStoryCard>

      <section class="edu-why glass-card">
        <h2 class="section-h2">Why it matters</h2>
        <p class="body-text">
          The charts do not mean one person can reverse climate change alone — they show why coordinated, everyday choices
          still matter when millions participate. In ClimateQuest, walking, public transport, saving energy, and growing
          your scene with trees connect these curves to what you can do next.
        </p>
        <ul class="insight-list">
          <li><strong>Temperature</strong> tracks the planetary fever; <strong>sea level</strong> shows one slow consequence.</li>
          <li>
            <strong>Greenhouse-gas totals</strong> explain why the fever keeps rising; <strong>per-capita lines</strong>
            remind us that fairness and lifestyle both shape the path down.
          </li>
          <li><strong>Forest area</strong> highlights the living side of the carbon cycle.</li>
        </ul>
      </section>

      <section class="edu-actions glass-card">
        <h2 class="section-h2">From data to action</h2>
        <div class="edu-actions-grid">
          <ActionCard
            image-src="/images/task-cards/walkingbike.png"
            title="Walk or cycle"
            subtitle="Short trips add up."
          />
          <ActionCard
            image-src="/images/task-cards/bus.png"
            title="Use public transport"
            subtitle="Fewer cars on the road."
          />
          <ActionCard
            image-src="/images/task-cards/SavingEnergy.png"
            title="Save energy"
            subtitle="Cut waste at home."
          />
          <ActionCard
            image-src="/images/education/forest.png"
            title="Grow trees"
            subtitle="Build your scene in-game."
          />
        </div>
        <button type="button" class="edu-tasks-btn" @click="$emit('navigate', 'tasks')">
          Explore more actions
        </button>
      </section>

      <section class="edu-videos">
        <h2 class="section-h2">Study more</h2>
        <div class="edu-videos-grid">
          <VideoResourceCard
            href="https://www.saveourmarinelife.org.au/actions/algalbloom/"
            title="Algal blooms and marine heat"
            source="Save Our Marine Life"
            thumbnail="/images/education/hero-earth.png"
          />
          <VideoResourceCard
            href="https://www.youtube.com/watch?v=6YqmEYlg4IY"
            title="Climate change explained"
            source="YouTube"
            thumbnail="https://img.youtube.com/vi/6YqmEYlg4IY/hqdefault.jpg"
          />
          <VideoResourceCard
            href="https://www.youtube.com/watch?v=VsOJR40M0as"
            title="Understanding sea level rise"
            source="YouTube"
            thumbnail="https://img.youtube.com/vi/VsOJR40M0as/hqdefault.jpg"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ClimateStorySteps from './education/ClimateStorySteps.vue'
import DataStoryCard from './education/DataStoryCard.vue'
import StoryHeroBanner from './education/StoryHeroBanner.vue'
import EducationLineChart from './education/EducationLineChart.vue'
import EmissionsExplorerCard from './education/EmissionsExplorerCard.vue'
import ActionCard from './education/ActionCard.vue'
import VideoResourceCard from './education/VideoResourceCard.vue'
import {
  parseTemperatureCsv,
  parseNasaAnnualCsv,
  parseGhgByEntity,
  parsePerCapitaByEntity,
  parseFaostatForestWorld,
} from '../utils/education/openDataParse.js'

defineEmits(['navigate'])

const DATA_BASE = '/data/education/'

const loading = ref(true)
const loadError = ref('')

const temperature = ref([])
const seaLevel = ref([])
const ghgByEntity = ref(new Map())
const perCapitaByEntity = ref(new Map())
const forest = ref([])

async function fetchCsv(candidates) {
  for (const name of candidates) {
    const r = await fetch(`${DATA_BASE}${name}`)
    if (r.ok) return r.text()
  }
  throw new Error(candidates[0])
}

async function loadAll() {
  loading.value = true
  loadError.value = ''
  try {
    const [tText, nText, gText, pText, fText] = await Promise.all([
      fetchCsv(['TemperatureGlobal.csv']),
      fetchCsv(['NASA_SSH_GMSL_INDICATOR.csv']),
      fetchCsv([
        'newgreenhouse-gas-emissions.csv',
        'new-greenhouse-gas-emissions-country.csv',
        'greenhouse-gas-emissions-country.csv',
      ]),
      fetchCsv([
        'newper-capita-greenhouse-gas-emissions.csv',
        'new-per-capita-greenhouse-gas-emissions.csv',
        'per-capita-greenhouse-gas-emissions.csv',
      ]),
      fetchCsv(['FAOSTAT_data.csv']),
    ])
    temperature.value = parseTemperatureCsv(tText)
    seaLevel.value = parseNasaAnnualCsv(nText)
    ghgByEntity.value = parseGhgByEntity(gText, { minYear: 1970 })
    perCapitaByEntity.value = parsePerCapitaByEntity(pText, { minYear: 1970 })
    forest.value = parseFaostatForestWorld(fText)
  } catch (e) {
    loadError.value = String(e?.message || e || 'Failed to load CSV files.')
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

const tempAria = computed(() => {
  const a = temperature.value
  if (!a.length) return 'Temperature chart'
  return `Temperature anomaly from ${a[0].year} to ${a[a.length - 1].year}`
})
const seaAria = computed(() => {
  const a = seaLevel.value
  if (!a.length) return 'Sea level chart'
  return `Mean sea level from ${a[0].year} to ${a[a.length - 1].year}`
})
const forestAria = computed(() => {
  const a = forest.value
  if (!a.length) return 'Forest area chart'
  return `World forest area from ${a[0].year} to ${a[a.length - 1].year}`
})
</script>

<style scoped>
.edu-page.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 clamp(12px, 3vw, 28px) 32px;
  box-sizing: border-box;
  min-width: 0;
}
.glass-card {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: clamp(14px, 2vw, 20px);
}
.edu-intro {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.edu-intro-copy .body-text {
  margin: 0 0 10px;
}
.edu-intro-copy .body-text:last-child {
  margin-bottom: 0;
}
.body-text {
  font-size: 0.84rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.78);
}
.section-h2 {
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}
.insight-box {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}
.insight-title {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(148, 240, 200, 0.95);
  margin-bottom: 8px;
}
.insight-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.8rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.82);
}
.insight-list strong {
  color: rgba(0, 242, 255, 0.92);
}
.edu-actions-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.edu-tasks-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 22px;
  border-radius: 999px;
  border: 1px solid rgba(82, 212, 150, 0.4);
  background: rgba(82, 212, 150, 0.14);
  color: #e8fff2;
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.edu-tasks-btn:hover {
  background: rgba(82, 212, 150, 0.24);
  transform: translateY(-1px);
}
.edu-videos-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
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
@media (max-width: 900px) {
  .edu-actions-grid,
  .edu-videos-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .edu-actions-grid,
  .edu-videos-grid {
    grid-template-columns: 1fr;
  }
}
</style>
