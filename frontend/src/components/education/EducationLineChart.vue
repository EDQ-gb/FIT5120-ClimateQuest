<script setup>
import { ref, computed } from 'vue'
import {
  toSvgPolyline,
  extentYs,
  extentXs,
  chartYToSvg,
  buildLinearYTicks,
} from '../../utils/education/openDataParse.js'

const props = defineProps({
  points: { type: Array, default: () => [] },
  xKey: { type: String, default: 'year' },
  yKey: { type: String, required: true },
  stroke: { type: String, default: '#52d496' },
  fillGradientId: { type: String, default: '' },
  fillColor: { type: String, default: '' },
  yLabel: { type: String, default: '' },
  ariaLabel: { type: String, default: 'Line chart' },
  formatY: { type: Function, default: (v) => String(v) },
  formatTooltipY: { type: Function, default: null },
  formatTooltipX: { type: Function, default: (v) => String(v) },
  xMin: { type: Number, default: null },
  xMax: { type: Number, default: null },
})

const CHART_W = 880
const CHART_H = 260
const PAD = 52

const tooltip = ref({ show: false, x: 0, y: 0, year: '', value: '' })
const wrapRef = ref(null)

const xs = computed(() => {
  if (props.xMin != null && props.xMax != null) return [props.xMin, props.xMax]
  return extentXs(props.points, props.xKey)
})

const ys = computed(() => extentYs(props.points, props.yKey))

const yScale = computed(() => {
  if (!props.points.length) return null
  const [yMin, yMax] = ys.value
  return { yMin, yMax, ticks: buildLinearYTicks(yMin, yMax) }
})

const linePoints = computed(() => {
  if (!props.points.length || !yScale.value) return ''
  return toSvgPolyline(
    props.points,
    CHART_W,
    CHART_H,
    PAD,
    props.xKey,
    props.yKey,
    xs.value[0],
    xs.value[1],
    yScale.value.yMin,
    yScale.value.yMax,
  )
})

const fillPoints = computed(() => {
  if (!props.fillColor && !props.fillGradientId) return ''
  const pts = props.points
  if (!pts.length || !yScale.value) return ''
  const baseline = Math.min(0, yScale.value.yMin, ...pts.map((p) => p[props.yKey]))
  const pts2 = [
    ...pts,
    { [props.xKey]: pts[pts.length - 1][props.xKey], [props.yKey]: baseline },
    { [props.xKey]: pts[0][props.xKey], [props.yKey]: baseline },
  ]
  const yLo = Math.min(yScale.value.yMin, baseline)
  return toSvgPolyline(
    pts2,
    CHART_W,
    CHART_H,
    PAD,
    props.xKey,
    props.yKey,
    xs.value[0],
    xs.value[1],
    yLo,
    yScale.value.yMax,
  )
})

const yearStart = computed(() => props.points[0]?.[props.xKey] ?? '')
const yearEnd = computed(() => props.points[props.points.length - 1]?.[props.xKey] ?? '')

function fmtTipY(v) {
  return (props.formatTooltipY || props.formatY)(v)
}

function onChartMove(evt) {
  const pts = props.points
  if (!pts.length || !wrapRef.value) return
  const rect = wrapRef.value.getBoundingClientRect()
  const relX = (evt.clientX - rect.left) / rect.width
  const innerW = CHART_W - 2 * PAD
  const chartX = PAD + relX * innerW
  const [xMin, xMax] = xs.value
  const dx = xMax - xMin || 1
  const yearApprox = xMin + ((chartX - PAD) / innerW) * dx
  let best = pts[0]
  let bestDist = Infinity
  for (const p of pts) {
    const d = Math.abs(p[props.xKey] - yearApprox)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  const yVal = best[props.yKey]
  const yMin = yScale.value.yMin
  const yMax = yScale.value.yMax
  const svgY = chartYToSvg(yVal, yMin, yMax, CHART_H, PAD)
  const pxY = (svgY / CHART_H) * rect.height
  const pxX = ((best[props.xKey] - xMin) / dx) * innerW + PAD
  const pxXRel = (pxX / CHART_W) * rect.width
  tooltip.value = {
    show: true,
    x: pxXRel,
    y: pxY,
    year: props.formatTooltipX(best[props.xKey]),
    value: fmtTipY(yVal),
  }
}

function hideTooltip() {
  tooltip.value = { ...tooltip.value, show: false }
}
</script>

<template>
  <div
    ref="wrapRef"
    class="elc-wrap"
    role="img"
    :aria-label="ariaLabel"
    @mousemove="onChartMove"
    @mouseleave="hideTooltip"
  >
    <svg class="elc-svg" viewBox="0 0 880 260" preserveAspectRatio="xMidYMid meet">
      <defs v-if="fillGradientId">
        <linearGradient :id="fillGradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="stroke" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="stroke" stop-opacity="0" />
        </linearGradient>
      </defs>
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
      <text v-if="yLabel" x="72" y="36" class="axis-label">{{ yLabel }}</text>
      <polyline
        v-if="fillPoints && fillGradientId"
        :points="fillPoints"
        :fill="`url(#${fillGradientId})`"
        stroke="none"
      />
      <polyline v-if="linePoints" :points="linePoints" fill="none" :stroke="stroke" stroke-width="2.5" />
      <g v-if="yScale" class="axis-y-labels">
        <text
          v-for="(tk, i) in yScale.ticks"
          :key="'yl' + i"
          class="ytick-label"
          x="46"
          text-anchor="end"
          :y="chartYToSvg(tk, yScale.yMin, yScale.yMax, CHART_H, PAD) + 4"
        >{{ formatY(tk) }}</text>
      </g>
      <text x="52" y="236" class="tick-label">{{ yearStart }}</text>
      <text x="828" y="236" class="tick-label" text-anchor="end">{{ yearEnd }}</text>
    </svg>
    <div
      v-if="tooltip.show"
      class="elc-tip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <span class="elc-tip-year">{{ tooltip.year }}</span>
      <span class="elc-tip-val">{{ tooltip.value }}</span>
    </div>
  </div>
</template>

<style scoped>
.elc-wrap {
  position: relative;
  cursor: crosshair;
}
.elc-svg {
  display: block;
  width: 100%;
  height: auto;
  min-height: 200px;
}
.grid-line {
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 1;
}
.axis-label {
  fill: rgba(255, 255, 255, 0.45);
  font-size: 13px;
}
.ytick-label,
.tick-label {
  fill: rgba(255, 255, 255, 0.42);
  font-size: 11px;
}
.tick-label {
  font-size: 12px;
}
.elc-tip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
  pointer-events: none;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(12, 18, 28, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: nowrap;
  z-index: 2;
}
.elc-tip-year {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.55);
}
.elc-tip-val {
  font-size: 0.82rem;
  font-weight: 700;
  color: #fff;
}
</style>
