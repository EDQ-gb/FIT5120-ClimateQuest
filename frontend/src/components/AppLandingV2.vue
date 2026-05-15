<template>
  <div class="landing2">
    <canvas ref="bg" class="landing2-canvas" aria-hidden="true"></canvas>

    <!-- Keep existing top nav behavior (feature links + login) -->
    <nav class="landing2-nav">
      <ul class="landing2-links">
        <li v-for="item in navLinks" :key="item.key">
          <button
            type="button"
            class="landing2-link"
            :class="{ active: item.key === 'home' }"
            @click="$emit('navigate', item.key)"
          >
            {{ item.label }}
          </button>
        </li>
      </ul>

      <button type="button" class="landing2-login" @click="$emit('login')">
        <span v-if="user" class="landing2-avatar" :style="{ background: avatarBg }">{{ avatarText }}</span>
        <span>{{ loginButtonText }}</span>
      </button>
    </nav>

    <div class="landing2-inner">
      <div class="landing2-top land-in-0">
        <div class="landing2-hero-narrow">
          <div class="landing2-hero-grid">
            <div class="landing2-hero-left">
              <div class="landing2-title" aria-label="ClimateQuest">
                <span class="word-climate">CLIMATE</span>
                <span class="word-quest">QUEST</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="landing2-bottom land-in-1">
        <div class="landing2-hero-tagline" aria-label="The climate is changing, so can you">
          <p class="landing2-hero-tagline-main">
            <span class="landing2-hero-tagline-line">THE CLIMATE IS CHANGING</span>
            <span class="landing2-hero-tagline-line">SO CAN YOU</span>
          </p>
          <p class="landing2-hero-tagline-sub">your daily actions can move the planet forward</p>
        </div>
        <div class="landing2-cta-row">
          <button type="button" class="landing2-ghost-pill landing2-ghost-pill--start" @click="$emit('start')">
            start your quest
          </button>
          <button
            v-if="!showGuidePanel"
            type="button"
            class="landing2-ghost-pill landing2-ghost-pill--glass"
            @click="reopenGuidePanel"
          >
            how to use this site
          </button>
        </div>
      </div>
    </div>

    <template v-if="showGuidePanel">
      <aside
        v-for="card in guideCornerCards"
        v-show="card.step <= guideRevealCount"
        :key="card.step"
        class="home-guide-corner"
        :class="[
          `home-guide-corner--${card.pos}`,
          {
            'home-guide-corner--completed': card.step < guideRevealCount,
            'home-guide-corner--active': card.step === guideRevealCount,
          },
        ]"
        :style="{ zIndex: 10 + card.step }"
        role="note"
        :aria-label="card.aria"
      >
        <div class="home-guide-corner-body">
          <div class="home-guide-corner-head">
            <h2 class="home-guide-corner-title">{{ card.title }}</h2>
            <p class="home-guide-corner-text">{{ card.body }}</p>
          </div>
        </div>
        <div v-if="card.step === guideRevealCount" class="home-guide-corner-footer">
          <div class="home-guide-corner-footer-main">
            <button
              type="button"
              class="landing2-ghost-pill landing2-ghost-pill--glass home-guide-corner-pill--primary"
              @click="advanceGuideTour"
            >
              {{ guideRevealCount < 4 ? 'next step' : 'done' }}
            </button>
          </div>
          <div class="home-guide-corner-footer-dismiss-wrap">
            <button type="button" class="home-guide-corner-dismiss" @click="dismissGuidePanel">hide tips</button>
          </div>
        </div>
      </aside>
    </template>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

defineProps({
  user: { type: Object, default: null },
  navLinks: { type: Array, default: () => [] },
  loginButtonText: { type: String, default: 'Login' },
  avatarText: { type: String, default: 'U' },
  avatarBg: { type: String, default: 'rgba(255,255,255,0.2)' },
})

defineEmits(['start', 'login', 'navigate'])

const bg = ref(null)
const showGuidePanel = ref(true)
/** How many corner cards are visible (1–4); increases with “next step”; all hide on “done” or hide tips. */
const guideRevealCount = ref(1)
let raf = 0

/** Ordered tour: corners advance with “Next step” only (no in-card navigation). */
const guideCornerCards = [
  {
    step: 1,
    pos: 'tl',
    aria: 'Step 1: Dashboard — start your quest',
    title: 'start your quest',
    body: 'Open your Dashboard to track progress. Small low-carbon choices add up in real life.',
  },
  {
    step: 2,
    pos: 'tr',
    aria: 'Step 2: earn coins',
    title: 'earn coins',
    body: 'Complete Daily Tasks and the Daily Quiz to collect rewards for your journey.',
  },
  {
    step: 3,
    pos: 'bl',
    aria: 'Step 3: My Scene',
    title: 'grow your world',
    body: 'Spend coins in My Scene to place trees and goodies and watch your map thrive.',
  },
  {
    step: 4,
    pos: 'br',
    aria: 'Step 4: Leaderboard',
    title: 'compare progress',
    body: 'Check the Leaderboard to see how your climate contribution compares with others.',
  },
]

function advanceGuideTour() {
  if (guideRevealCount.value < 4) {
    guideRevealCount.value += 1
  } else {
    dismissGuidePanel()
  }
}

function dismissGuidePanel() {
  showGuidePanel.value = false
  guideRevealCount.value = 1
  try {
    localStorage.setItem('cq_home_guide_hidden', '1')
  } catch {
    // ignore
  }
}

function reopenGuidePanel() {
  guideRevealCount.value = 1
  showGuidePanel.value = true
  try {
    localStorage.removeItem('cq_home_guide_hidden')
  } catch {
    // ignore
  }
}

// Low‑poly globe landing (ported from climatequest_v2.html).
// The globe is drawn onto the same full‑screen canvas as the starfield, and
// it animates in from scale 0.3 → 1.0.
function buildGlobeMeshes() {
  const TRIS = []
  const lats = [-80, -60, -40, -20, 0, 20, 40, 60, 80]
  const LSTEP = 36
  for (let li = 0; li < lats.length - 1; li++) {
    for (let lo = 0; lo < 360; lo += LSTEP) {
      const la1 = lats[li]
      const la2 = lats[li + 1]
      const lo2 = lo + LSTEP
      const ml = (la1 + la2) / 2
      const mlo = (((lo + lo2) / 2 + 360) % 360)
      let type = 'ocean'
      if (ml > 15 && ml < 65 && mlo > 230 && mlo < 295) type = 'land'
      if (ml > -15 && ml < 15 && mlo > 285 && mlo < 340) type = 'land'
      if (ml > -50 && ml < -5 && mlo > 295 && mlo < 360) type = 'land'
      if (ml > 35 && ml < 70 && mlo > 340) type = 'land'
      if (ml > 40 && ml < 65 && mlo < 15) type = 'land'
      if (ml > 5 && ml < 60 && mlo > 25 && mlo < 60) type = 'land'
      if (ml > 10 && ml < 55 && mlo > 60 && mlo < 140) type = 'land'
      if (ml > -40 && ml < -5 && mlo > 115 && mlo < 160) type = 'land'
      if (ml > 10 && ml < 40 && mlo > 155 && mlo < 225) type = 'land'
      if (Math.abs(ml) > 65) type = 'ice'
      TRIS.push({ la1, lo1: lo, la2, lo2, type, idx: TRIS.length, flip: false })
      TRIS.push({ la1: la2, lo1: lo, la2, lo2, type, idx: TRIS.length, flip: true })
    }
  }
  for (let lo = 0; lo < 360; lo += LSTEP) {
    TRIS.push({ la1: 80, lo1: lo, la2: 90, lo2: lo + LSTEP, type: 'ice', idx: TRIS.length, cap: 'n' })
    TRIS.push({ la1: -80, lo1: lo, la2: -90, lo2: lo + LSTEP, type: 'ice', idx: TRIS.length, cap: 's' })
  }
  const FCOLS = {
    ocean: ['#1e5a9a', '#1a4e88', '#2260a8', '#174478', '#1c5290', '#204fa0'],
    land: ['#3a8040', '#2e7234', '#428a44', '#356838', '#4a9050', '#337038'],
    ice: ['#c5e8dc', '#b8dcd0', '#d0ede4', '#bfe0d5', '#caeae0'],
  }
  const STARS = {
    build: (SW, SH) => [
      ...Array.from({ length: 200 }, () => ({
        x: Math.random() * SW,
        y: Math.random() * SH,
        r: Math.random() * 0.7 + 0.15,
        tw: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.007 + 0.002,
        drift: (Math.random() - 0.5) * 0.008,
        layer: 0,
      })),
      ...Array.from({ length: 160 }, () => ({
        x: Math.random() * SW,
        y: Math.random() * SH,
        r: Math.random() * 0.9 + 0.35,
        tw: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.013 + 0.004,
        drift: (Math.random() - 0.5) * 0.014,
        layer: 1,
      })),
      ...Array.from({ length: 55 }, () => ({
        x: Math.random() * SW,
        y: Math.random() * SH,
        r: Math.random() * 0.8 + 1.0,
        tw: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.02 + 0.008,
        drift: (Math.random() - 0.5) * 0.022,
        layer: 2,
      })),
    ],
  }
  return { TRIS, FCOLS, STARS }
}

function fitCanvas(canvas) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  const w = Math.floor(window.innerWidth)
  const h = Math.floor(window.innerHeight)
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

onMounted(() => {
  try {
    showGuidePanel.value = localStorage.getItem('cq_home_guide_hidden') !== '1'
  } catch {
    showGuidePanel.value = true
  }
  guideRevealCount.value = 1
  const canvas = bg.value
  if (!canvas) return

  const { TRIS, FCOLS, STARS } = buildGlobeMeshes()
  const TREES = [
    { lat: 30, lon: 250 },
    { lat: 42, lon: 258 },
    { lat: 22, lon: 242 },
    { lat: 35, lon: 268 },
    { lat: 38, lon: 55 },
    { lat: 48, lon: 65 },
    { lat: 28, lon: 72 },
    { lat: 15, lon: 100 },
    { lat: 5, lon: 115 },
    { lat: -15, lon: 135 },
  ]
  const TURBINES = [
    { lat: 50, lon: 8 },
    { lat: 52, lon: 4 },
    { lat: 48, lon: 350 },
  ]
  const CLOUDS = Array.from({ length: 8 }, (_, i) => ({
    lat: -25 + Math.random() * 50,
    lon: i * (360 / 8) + Math.random() * 25,
    spd: 0.22 + Math.random() * 0.18,
    sz: 12 + Math.random() * 10,
    elev: 14 + Math.random() * 10,
    rainProgress: 0,
  }))

  const sph = (lat, lon, r) => {
    const phi = (90 - lat) * Math.PI / 180
    const th = ((((lon % 360) + 360) % 360) * Math.PI) / 180
    return [r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)]
  }
  const rY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
  const rX = (p, a) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]

  let ctx = null
  let SW = 0
  let SH = 0
  let stars = []

  // Globe config (match climatequest_v2.html)
  const GR = 155
  let gcx = 0
  let gcy = 0
  let angle = 0
  const BASE_TILT = 0.22
  let globeScale = 0.3

  // Mouse tilt
  let mouseX = 0
  let mouseY = 0
  let targetTiltX = 0
  let targetTiltY = 0
  let currentTiltX = 0
  let currentTiltY = 0

  function resize() {
    const r = fitCanvas(canvas)
    ctx = r.ctx
    SW = r.w
    SH = r.h
    gcx = SW / 2
    gcy = SH * 0.52
    mouseX = gcx
    mouseY = gcy
    stars = STARS.build(SW, SH)
  }

  function proj(p) {
    return [gcx + p[0], gcy - p[1]]
  }

  function drawFrame(t) {
    if (!ctx) return

    // Background gradient
    ctx.clearRect(0, 0, SW, SH)
    const bg = ctx.createLinearGradient(0, 0, 0, SH)
    bg.addColorStop(0, '#0e1822')
    bg.addColorStop(0.5, '#121e2c')
    bg.addColorStop(1, '#1a2c3a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, SW, SH)

    // Vignette
    const vig = ctx.createRadialGradient(SW / 2, SH / 2, SH * 0.2, SW / 2, SH / 2, SH * 0.85)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(0,0,0,0.52)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, SW, SH)

    // Stars (twinkle + slight drift)
    stars.forEach((s) => {
      s.tw += s.sp
      s.x += s.drift
      if (s.x > SW) s.x = 0
      if (s.x < 0) s.x = SW

      if (s.layer === 0) {
        const a = 0.1 + 0.1 * Math.sin(s.tw)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * 0.45, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(190,215,205,${a})`
        ctx.fill()
      } else if (s.layer === 1) {
        const a = 0.2 + 0.22 * Math.sin(s.tw)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(210,230,218,${a})`
        ctx.fill()
      } else {
        const a = 0.4 + 0.45 * Math.sin(s.tw)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(230,245,235,${a})`
        ctx.fill()
        if (s.r > 1.35) {
          ctx.strokeStyle = `rgba(230,245,235,${a * 0.28})`
          ctx.lineWidth = 0.5
          const L = s.r * 3
          ctx.beginPath()
          ctx.moveTo(s.x - L, s.y)
          ctx.lineTo(s.x + L, s.y)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(s.x, s.y - L)
          ctx.lineTo(s.x, s.y + L)
          ctx.stroke()
        }
      }
    })

    // Tilt interpolation
    currentTiltX += (targetTiltX - currentTiltX) * 0.08
    currentTiltY += (targetTiltY - currentTiltY) * 0.08
    const TILT = BASE_TILT + currentTiltX
    const totalAngle = angle + currentTiltY

    // Globe scale in (0.3 → 1.0)
    globeScale += (1 - globeScale) * 0.035
    const scaledR = GR * globeScale

    // Outer glow
    const ag = ctx.createRadialGradient(gcx, gcy, scaledR, gcx, gcy, scaledR * 1.32)
    // Original HTML uses 0.13; keep slightly softer but close.
    ag.addColorStop(0, 'rgba(82,212,150,.10)')
    ag.addColorStop(1, 'rgba(82,212,150,0)')
    ctx.beginPath()
    ctx.arc(gcx, gcy, scaledR * 1.32, 0, Math.PI * 2)
    ctx.fillStyle = ag
    ctx.fill()

    // Ocean base
    ctx.beginPath()
    ctx.arc(gcx, gcy, scaledR, 0, Math.PI * 2)
    ctx.fillStyle = '#1a4e88'
    ctx.fill()

    // Sort & draw triangles
    const rendered = TRIS.map((tri) => {
      let p1, p2, p3
      if (tri.cap === 'n') {
        p1 = sph(tri.la1, tri.lo1, scaledR)
        p2 = sph(tri.la1, tri.lo2, scaledR)
        p3 = sph(90, (tri.lo1 + tri.lo2) / 2, scaledR)
      } else if (tri.cap === 's') {
        p1 = sph(tri.la1, tri.lo1, scaledR)
        p2 = sph(tri.la1, tri.lo2, scaledR)
        p3 = sph(-90, (tri.lo1 + tri.lo2) / 2, scaledR)
      } else if (tri.flip) {
        p1 = sph(tri.la1, tri.lo2, scaledR)
        p2 = sph(tri.la2, tri.lo1, scaledR)
        p3 = sph(tri.la2, tri.lo2, scaledR)
      } else {
        p1 = sph(tri.la1, tri.lo1, scaledR)
        p2 = sph(tri.la2, tri.lo1, scaledR)
        p3 = sph(tri.la1, tri.lo2, scaledR)
      }
      const r1 = rY(rX(p1, TILT), totalAngle)
      const r2 = rY(rX(p2, TILT), totalAngle)
      const r3 = rY(rX(p3, TILT), totalAngle)
      return { r1, r2, r3, avgZ: (r1[2] + r2[2] + r3[2]) / 3, type: tri.type, idx: tri.idx }
    }).sort((a, b) => a.avgZ - b.avgZ)

    ctx.save()
    ctx.beginPath()
    ctx.arc(gcx, gcy, scaledR, 0, Math.PI * 2)
    ctx.clip()
    rendered.forEach((tri) => {
      if (tri.avgZ < -GR * 0.05) return
      const p1 = proj(tri.r1)
      const p2 = proj(tri.r2)
      const p3 = proj(tri.r3)
      ctx.beginPath()
      ctx.moveTo(p1[0], p1[1])
      ctx.lineTo(p2[0], p2[1])
      ctx.lineTo(p3[0], p3[1])
      ctx.closePath()
      const cols = FCOLS[tri.type]
      ctx.fillStyle = cols[tri.idx % cols.length]
      const light = 0.78 + 0.22 * (((tri.r1[0] + tri.r2[0] + tri.r3[0]) / (3 * GR)) * -0.4 + 0.4)
      ctx.globalAlpha = Math.max(0.55, Math.min(1, light))
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,.16)'
      ctx.lineWidth = 0.7
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // Clouds with rain interaction (ported to match climatequest_v2.html).
    CLOUDS.forEach((cl, ci) => {
      cl.lon += cl.spd * 0.045
      const raw = sph(cl.lat, cl.lon, scaledR + cl.elev)
      const rp = rY(rX(raw, TILT), totalAngle)
      if (rp[2] < -5) return
      const sp = proj(rp)
      const ds = Math.max(0.28, 0.5 + 0.5 * (rp[2] / scaledR))
      const alpha = Math.max(0, Math.min(0.94, (rp[2] / GR + 0.25) * 1.3))

      const dx = sp[0] - mouseX
      const dy = sp[1] - mouseY
      const hovered = Math.sqrt(dx * dx + dy * dy) < cl.sz * ds * 3
      cl.rainProgress += hovered ? 0.06 : -0.04
      cl.rainProgress = Math.max(0, Math.min(1, cl.rainProgress))

      const cg = Math.round(221 - cl.rainProgress * 38)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(sp[0], sp[1])
      ctx.scale(ds, ds)

      // Cloud puffs
      ctx.fillStyle = `rgb(${cg + 14},${cg + 14},${cg + 14})`
      ctx.beginPath()
      ctx.arc(0, 0, cl.sz, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cl.sz * 0.85, cl.sz * 0.15, cl.sz * 0.72, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(-cl.sz * 0.8, cl.sz * 0.15, cl.sz * 0.65, 0, Math.PI * 2)
      ctx.fill()

      // Rain drops
      if (cl.rainProgress > 0.05) {
        const t2 = Date.now() / 420
        const nd = Math.round(3 + cl.rainProgress * 3)
        for (let i = 0; i < nd; i++) {
          const phase = (t2 + i * 0.38) % 1
          const rx = -cl.sz * 0.7 + i * (cl.sz * 1.4 / (nd - 1 || 1))
          const ry = cl.sz * 0.85 + phase * cl.sz * 2.2
          const da = cl.rainProgress * (1 - Math.abs(phase - 0.5) * 1.2) * 0.85
          if (da <= 0) continue
          ctx.fillStyle = `rgba(100,170,220,${da})`
          ctx.beginPath()
          ctx.ellipse(rx, ry, 1.4, 3.5 + cl.rainProgress * 1.5, 0.1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      ctx.restore()
    })

    // Tiny trees + turbines (front faces only)
    TREES.forEach((tr) => {
      const rp = rY(rX(sph(tr.lat, tr.lon, scaledR), TILT), totalAngle)
      if (rp[2] < 18) return
      const sp = proj(rp)
      const sc = 0.5 + 0.5 * (rp[2] / scaledR)
      ctx.save()
      ctx.translate(sp[0], sp[1])
      ctx.scale(sc, sc)
      ctx.fillStyle = '#3a2010'
      ctx.fillRect(-1.5, -10, 3, 7)
      ctx.fillStyle = '#2a6e2a'
      ctx.beginPath()
      ctx.moveTo(0, -20)
      ctx.lineTo(-7, -8)
      ctx.lineTo(7, -8)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#359535'
      ctx.beginPath()
      ctx.moveTo(0, -27)
      ctx.lineTo(-5, -15)
      ctx.lineTo(5, -15)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    })

    TURBINES.forEach((tb) => {
      const rp = rY(rX(sph(tb.lat, tb.lon, scaledR), TILT), totalAngle)
      if (rp[2] < 22) return
      const sp = proj(rp)
      const sc = 0.5 + 0.5 * (rp[2] / scaledR)
      ctx.save()
      ctx.translate(sp[0], sp[1])
      ctx.scale(sc, sc)
      ctx.strokeStyle = '#b0ccbc'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -18)
      ctx.stroke()
      const ba = angle * 9
      for (let b = 0; b < 3; b++) {
        const a = ba + b * (Math.PI * 2 / 3)
        ctx.strokeStyle = '#90b8a0'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, -18)
        ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8 - 18)
        ctx.stroke()
      }
      ctx.restore()
    })
    ctx.restore()

    // Atmosphere rim + highlight + shadow
    const rim = ctx.createRadialGradient(gcx, gcy, scaledR * 0.87, gcx, gcy, scaledR)
    rim.addColorStop(0, 'rgba(82,212,150,0)')
    rim.addColorStop(0.6, 'rgba(82,212,150,.07)')
    rim.addColorStop(1, 'rgba(100,220,170,.3)')
    ctx.beginPath()
    ctx.arc(gcx, gcy, scaledR, 0, Math.PI * 2)
    ctx.fillStyle = rim
    ctx.fill()

    const hl = ctx.createRadialGradient(gcx - scaledR * 0.38, gcy - scaledR * 0.38, 0, gcx - scaledR * 0.12, gcy - scaledR * 0.12, scaledR * 0.6)
    hl.addColorStop(0, 'rgba(255,255,255,.17)')
    hl.addColorStop(0.4, 'rgba(255,255,255,.04)')
    hl.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    ctx.arc(gcx, gcy, scaledR, 0, Math.PI * 2)
    ctx.fillStyle = hl
    ctx.fill()

    const sh = ctx.createRadialGradient(gcx + scaledR * 0.4, gcy + scaledR * 0.4, 0, gcx + scaledR * 0.18, gcy + scaledR * 0.18, scaledR * 0.82)
    sh.addColorStop(0, 'rgba(0,0,0,.4)')
    sh.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(gcx, gcy, scaledR, 0, Math.PI * 2)
    ctx.fillStyle = sh
    ctx.fill()

    angle += 0.004
  }

  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (SW / rect.width)
    const my = (e.clientY - rect.top) * (SH / rect.height)
    mouseX = mx
    mouseY = my
    const dx = mx - gcx
    const dy = my - gcy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < GR * 2.5) {
      targetTiltY = (dx / GR) * 0.18
      targetTiltX = (dy / GR) * 0.12
    }
  }
  const onLeave = () => {
    mouseX = gcx
    mouseY = gcy
    targetTiltX = 0
    targetTiltY = 0
  }

  resize()
  window.addEventListener('resize', resize)
  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mouseleave', onLeave)

  const loop = (t) => {
    drawFrame(t)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    canvas.removeEventListener('mousemove', onMove)
    canvas.removeEventListener('mouseleave', onLeave)
    if (raf) cancelAnimationFrame(raf)
  })
})
</script>

<style scoped>
.landing2 {
  --landing2-nav-h: 64px;
  /* Frosted panels — landing canvas tones (#0e1822 / mint / cyan) */
  --l2-glass-border: 1px solid rgba(0, 242, 255, 0.16);
  --l2-glass-bg: linear-gradient(
    165deg,
    rgba(255, 255, 255, 0.055) 0%,
    rgba(78, 207, 140, 0.045) 38%,
    rgba(0, 242, 255, 0.045) 100%
  );
  --l2-glass-fill: rgba(14, 24, 34, 0.22);
  --l2-glass-fill-hover: rgba(16, 30, 44, 0.34);
  --l2-glass-blur: blur(22px) saturate(170%);
  --l2-glass-inset: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  --l2-glass-drop: 0 6px 20px rgba(0, 0, 0, 0.18);
  --l2-glass-aura: 0 0 28px rgba(0, 242, 255, 0.08), 0 0 44px rgba(78, 207, 140, 0.06);
  /* Guide panels: same inset from left/right; balanced vertical clearance */
  --guide-edge-inset: clamp(18px, 3.6vw, 32px);
  --guide-top-offset: calc(var(--landing2-nav-h) + clamp(12px, 2vh, 24px));
  --guide-bottom-offset: max(var(--guide-edge-inset), clamp(84px, 12.5vh, 128px));
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #0e1822;
}

.landing2-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  pointer-events: auto;
}

.home-guide-corner {
  position: fixed;
  z-index: 6;
  pointer-events: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: min(340px, calc(100vw - 2 * var(--guide-edge-inset)));
  max-width: calc(100vw - 2 * var(--guide-edge-inset));
  max-height: min(48vh, 420px);
  min-height: 0;
  padding: 14px 17px 12px;
  border-radius: 22px;
  border: var(--l2-glass-border);
  box-shadow: var(--l2-glass-inset), var(--l2-glass-drop), var(--l2-glass-aura);
  background: var(--l2-glass-bg);
  background-color: var(--l2-glass-fill);
  backdrop-filter: var(--l2-glass-blur);
  -webkit-backdrop-filter: var(--l2-glass-blur);
  color: rgba(222, 238, 236, 0.96);
  transition: opacity 0.2s ease, box-shadow 0.2s ease;
}

.home-guide-corner--completed {
  opacity: 0.86;
  box-shadow: var(--l2-glass-inset), 0 4px 14px rgba(0, 0, 0, 0.14);
}

.home-guide-corner--active {
  opacity: 1;
}

.home-guide-corner--tl {
  left: var(--guide-edge-inset);
  top: var(--guide-top-offset);
}

.home-guide-corner--tr {
  right: var(--guide-edge-inset);
  top: var(--guide-top-offset);
}

.home-guide-corner--bl {
  left: var(--guide-edge-inset);
  bottom: var(--guide-bottom-offset);
}

.home-guide-corner--br {
  right: var(--guide-edge-inset);
  bottom: var(--guide-bottom-offset);
}

.home-guide-corner-body {
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.home-guide-corner-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 7px;
}

.home-guide-corner-title {
  margin: 0;
  font-family: var(--font-game, 'Fredoka', 'Nunito', system-ui, sans-serif);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #e8f4ef;
  text-shadow:
    0 1px 10px rgba(0, 0, 0, 0.35),
    0 0 18px rgba(78, 207, 140, 0.15),
    0 0 22px rgba(0, 242, 255, 0.1);
}

.home-guide-corner--completed .home-guide-corner-title {
  color: rgba(210, 232, 224, 0.82);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
}

.home-guide-corner-text {
  margin: 2px 0 0;
  max-width: 34ch;
  font-family: var(--font-game, 'Fredoka', 'Nunito', system-ui, sans-serif);
  font-size: 15px;
  line-height: 1.5;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: rgba(200, 226, 220, 0.92);
  max-height: 8.5em;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.home-guide-corner--completed .home-guide-corner-text {
  color: rgba(188, 212, 206, 0.72);
}

.home-guide-corner-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 242, 255, 0.14);
  gap: 0;
}

.home-guide-corner-footer-main {
  display: flex;
  justify-content: center;
  width: 100%;
}

.home-guide-corner-footer-dismiss-wrap {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-top: 4px;
  padding-right: 1px;
}

.home-guide-corner-dismiss {
  border: none;
  border-radius: 6px;
  padding: 2px 4px;
  margin: 0;
  background: transparent;
  font-family: var(--font-game, 'Fredoka', 'Nunito', system-ui, sans-serif);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  color: rgba(120, 168, 178, 0.72);
  cursor: pointer;
  transition: color 0.18s ease, background 0.18s ease;
}

.home-guide-corner-dismiss:hover {
  color: rgba(183, 248, 255, 0.88);
  background: rgba(0, 242, 255, 0.06);
}
.landing2-nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--landing2-nav-h);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 0 24px;
  z-index: 5;
  /* Match app shell / Dashboard glass strip */
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.12);
}

.landing2-links {
  list-style: none;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 28px;
}

.landing2-link {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.98rem;
  font-weight: 600;
  padding: 8px 2px;
  cursor: pointer;
  transition: color 0.2s ease;
}
.landing2-link:hover {
  color: #fff;
}
.landing2-link.active {
  color: #fff;
}

.landing2-login {
  position: absolute;
  right: 24px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(0, 242, 255, 0.22);
  background: rgba(0, 242, 255, 0.08);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: rgba(230, 252, 255, 0.96);
  cursor: pointer;
  transition: all 0.2s ease;
}
.landing2-login:hover {
  background: rgba(0, 242, 255, 0.14);
  border-color: rgba(0, 242, 255, 0.38);
}

.landing2-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: rgba(0, 0, 0, 0.85);
  font-weight: 800;
  font-size: 0.72rem;
}

.landing2-inner {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  /* More bottom padding so the Start button isn't glued to the bottom edge */
  padding: calc(clamp(18px, 3vh, 44px) + var(--landing2-nav-h)) clamp(16px, 4vw, 36px) clamp(18px, 4vh, 44px);
  pointer-events: none;
}

.landing2-top {
  margin-top: 0;
  width: 100%;
  max-width: min(920px, 100%);
  text-align: center;
  /* Breathing room between logo block and the globe */
  padding-bottom: clamp(6px, 2vh, 28px);
}

.landing2-hero-narrow {
  max-width: min(520px, 100%);
  margin: 0 auto;
  width: 100%;
}

.landing2-hero-grid {
  width: 100%;
}

.landing2-hero-left,
.landing2-hero-right {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.landing2-lead {
  font-family: 'Fredoka', Nunito, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: clamp(15px, 1.55vw, 18px);
  font-weight: 500;
  line-height: 1.72;
  color: rgba(210, 228, 218, 0.82);
  margin: clamp(14px, 2.4vh, 22px) auto 0;
  max-width: 52ch;
  pointer-events: auto;
}

.landing2-pills {
  list-style: none;
  margin: clamp(14px, 2.2vh, 22px) auto 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  pointer-events: auto;
}
.landing2-pills li {
  font-family: 'Fredoka', Nunito, system-ui, sans-serif;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: rgba(78, 207, 140, 0.95);
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(78, 207, 140, 0.35);
  background: rgba(0, 28, 18, 0.35);
}

.landing2-hero-tagline {
  max-width: min(520px, 92vw);
  margin: clamp(16px, 4vh, 40px) auto 0;
  padding-top: clamp(8px, 2vh, 24px);
  text-align: center;
  pointer-events: auto;
}

.landing2-hero-tagline-main {
  font-family: Anton, Nunito, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: clamp(14px, 2.65vw, 22px);
  font-weight: 400;
  line-height: 1.12;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(232, 240, 235, 0.92);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
  margin: 0 0 0.2em;
}

.landing2-hero-tagline-line {
  display: block;
}

.landing2-hero-tagline-line + .landing2-hero-tagline-line {
  margin-top: 0.02em;
}

.landing2-hero-tagline-sub {
  font-family: var(--font-game, 'Fredoka', 'Nunito', system-ui, sans-serif);
  font-size: clamp(11px, 1.45vw, 13.5px);
  font-weight: 500;
  line-height: 1.32;
  letter-spacing: 0.03em;
  text-transform: none;
  color: rgba(200, 220, 212, 0.76);
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.35);
  margin: 0.15em auto 0;
  max-width: 36em;
}

.land-in-lead {
  animation: landFly 0.9s 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.land-in-pills {
  animation: landFly 0.9s 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.landing2-bottom {
  margin-top: clamp(120px, 34vh, 360px);
  margin-bottom: clamp(44px, 8vh, 110px);
}

.landing2-top,
.landing2-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0;
}

.landing2-title {
  font-family: Anton, Nunito, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: clamp(28px, 5.2vw, 64px);
  font-weight: 400;
  line-height: 0.82;
  text-align: center;
  letter-spacing: 4px;
  color: #deeee6;
  text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.35), 6px 6px 0 rgba(0, 0, 0, 0.18),
    0 0 80px rgba(82, 212, 150, 0.08);
}

.landing2-title .word-climate {
  display: block;
  color: #c8ddd5;
  text-shadow: 3px 3px 0 rgba(0, 40, 20, 0.5), 6px 6px 0 rgba(0, 20, 10, 0.28);
}
.landing2-title .word-quest {
  display: block;
  color: #4ecf8c;
  text-shadow: 3px 3px 0 rgba(0, 60, 30, 0.55), 6px 6px 0 rgba(0, 30, 15, 0.3),
    0 0 80px rgba(78, 207, 140, 0.4), 0 0 160px rgba(78, 207, 140, 0.18);
}

.landing2-cta-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  width: max-content;
  max-width: min(520px, 94vw);
  margin-top: clamp(14px, 2.4vh, 22px);
  margin-inline: auto;
  justify-items: stretch;
  pointer-events: auto;
}

/* Both CTAs: same type rhythm (sentence case in markup), slimmer hit area */
.landing2-ghost-pill {
  width: 100%;
  box-sizing: border-box;
  min-height: 38px;
  padding: 7px 16px;
  border-radius: 999px;
  font-family: var(--font-game, 'Fredoka', 'Nunito', system-ui, sans-serif);
  font-size: clamp(0.72rem, 1.5vw, 0.82rem);
  font-weight: 600;
  letter-spacing: 0.045em;
  text-transform: none;
  line-height: 1.25;
  cursor: pointer;
  text-align: center;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.landing2-ghost-pill--start {
  border: 1px solid rgba(0, 242, 255, 0.35);
  background: rgba(0, 242, 255, 0.1);
  color: #b7f8ff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.landing2-ghost-pill--start:hover {
  background: rgba(0, 242, 255, 0.16);
  border-color: rgba(0, 242, 255, 0.55);
  color: #e8fdff;
  transform: translateY(-1px);
}

/* Secondary — frosted glass (same tokens as guide cards + .home-guide-corner) */
.landing2-ghost-pill--glass {
  min-height: 34px;
  padding: 6px 14px;
  font-size: clamp(0.68rem, 1.4vw, 0.76rem);
  border: var(--l2-glass-border);
  background: var(--l2-glass-bg);
  background-color: var(--l2-glass-fill);
  color: rgba(230, 246, 252, 0.88);
  backdrop-filter: var(--l2-glass-blur);
  -webkit-backdrop-filter: var(--l2-glass-blur);
  box-shadow: var(--l2-glass-inset), var(--l2-glass-drop), var(--l2-glass-aura);
}

.landing2-ghost-pill--glass:hover {
  background-color: var(--l2-glass-fill-hover);
  border-color: rgba(0, 242, 255, 0.2);
  color: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
  box-shadow: var(--l2-glass-inset), var(--l2-glass-drop), 0 0 40px rgba(0, 242, 255, 0.09);
}

.landing2-ghost-pill:active {
  transform: translateY(0);
}

.landing2-ghost-pill:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 242, 255, 0.35);
}

.landing2-ghost-pill--glass:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px rgba(0, 242, 255, 0.28),
    var(--l2-glass-inset),
    var(--l2-glass-drop),
    var(--l2-glass-aura);
}

/* Primary guide CTA — compact control; body/title carry readability */
.home-guide-corner-footer-main .landing2-ghost-pill.landing2-ghost-pill--glass.home-guide-corner-pill--primary {
  width: auto;
  min-width: min(156px, 78vw);
  max-width: 88%;
  min-height: 28px;
  padding: 5px 11px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1.26;
  color: rgba(220, 252, 255, 0.96);
}

.land-in-0 {
  animation: landFly 1s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.land-in-1 {
  animation: landFly 1s 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes landFly {
  from {
    opacity: 0;
    transform: translateY(32px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 720px) {
  .landing2 {
    --landing2-nav-h: 58px;
    --guide-edge-inset: clamp(14px, 4.2vw, 22px);
    --guide-top-offset: calc(var(--landing2-nav-h) + clamp(10px, 1.6vh, 18px));
    --guide-bottom-offset: max(var(--guide-edge-inset), clamp(76px, 11vh, 112px));
  }
  .landing2-nav {
    height: var(--landing2-nav-h);
  }
  .landing2-links {
    display: none;
  }
  .landing2-login {
    right: 10px;
    padding: 6px 10px;
  }
  .landing2-pills {
    flex-direction: column;
    align-items: stretch;
    max-width: 280px;
  }
  .landing2-bottom {
    margin-top: clamp(96px, 30vh, 300px);
    margin-bottom: clamp(32px, 7vh, 80px);
  }
  .home-guide-corner {
    width: min(318px, calc(100vw - 2 * var(--guide-edge-inset)));
    max-width: calc(100vw - 2 * var(--guide-edge-inset));
    max-height: min(50vh, 400px);
    padding: 12px 14px 10px;
  }
}

@media (min-width: 980px) {
  .landing2-top {
    max-width: min(960px, 100%);
    text-align: center;
  }
  .landing2-hero-narrow {
    max-width: min(620px, 100%);
  }
  .landing2-hero-grid {
    display: block;
  }
  .landing2-hero-left {
    align-items: center;
  }
}
</style>

