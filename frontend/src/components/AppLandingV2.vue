<template>
  <div class="landing2">
    <canvas ref="bg" class="landing2-canvas" aria-hidden="true"></canvas>

    <!-- Keep existing top nav behavior (feature links + login) -->
    <nav class="landing2-nav">
      <ul class="landing2-links">
        <li v-for="item in navLinks" :key="item.key">
          <button type="button" class="landing2-link" @click="$emit('navigate', item.key)">{{ item.label }}</button>
        </li>
      </ul>

      <button type="button" class="landing2-login" @click="$emit('login')">
        <span v-if="user" class="landing2-avatar" :style="{ background: avatarBg }">{{ avatarText }}</span>
        <span>{{ loginButtonText }}</span>
      </button>
    </nav>

    <div class="landing2-inner">
      <div class="landing2-top land-in-0">
        <div class="landing2-title" aria-label="ClimateQuest">
          <span class="word-climate">CLIMATE</span>
          <span class="word-quest">QUEST</span>
        </div>
      </div>

      <div class="landing2-bottom land-in-1">
        <div class="landing2-sub">Build · Protect · Restore Your World</div>
        <button type="button" class="btn-start" @click="$emit('start')">Start Your Trail →</button>
      </div>
    </div>
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
let raf = 0

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
}

.landing2-nav {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 0 18px;
  z-index: 5;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.landing2-links {
  list-style: none;
  display: flex;
  gap: 22px;
}

.landing2-link {
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9rem;
  padding: 7px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: 0.2s;
}
.landing2-link:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
}

.landing2-login {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: 0.2s;
}
.landing2-login:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.28);
}

.landing2-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: rgba(0, 0, 0, 0.9);
  font-weight: 900;
  font-size: 0.75rem;
}

.landing2-inner {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  /* More bottom padding so the Start button isn't glued to the bottom edge */
  padding: clamp(18px, 3vh, 44px) 0 clamp(18px, 4vh, 44px);
  pointer-events: none;
}

.landing2-top {
  /* prevent overlap with the nav (which is positioned absolute) */
  margin-top: 56px;
}

.landing2-bottom {
  /* Keep CTA under the globe without touching it */
  margin-bottom: clamp(58px, 10vh, 140px);
}

.landing2-top,
.landing2-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0;
}

.landing2-eyebrow {
  font-family: 'DM Sans', Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: clamp(10px, 1vw, 12px);
  font-weight: 300;
  letter-spacing: 10px;
  text-transform: uppercase;
  color: rgba(180, 210, 200, 0.38);
  margin-bottom: 4px;
}

.landing2-title {
  font-family: Anton, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: clamp(38px, 7.0vw, 88px);
  font-weight: 400;
  line-height: 0.82;
  text-align: center;
  letter-spacing: 5px;
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

.landing2-sub {
  font-family: 'DM Sans', Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: clamp(10px, 1.0vw, 12px);
  font-weight: 300;
  color: rgba(160, 200, 180, 0.4);
  letter-spacing: 5px;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 16px;
}

.btn-start {
  padding: 11px 36px;
  border-radius: 50px;
  border: 1px solid rgba(78, 207, 140, 0.4);
  background: rgba(78, 207, 140, 0.06);
  color: rgba(78, 207, 140, 0.9);
  font-family: 'DM Sans', Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 0.78rem;
  font-weight: 400;
  cursor: pointer;
  letter-spacing: 3px;
  text-transform: uppercase;
  backdrop-filter: blur(16px);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: all;
  line-height: 1.15;
}
.btn-start:hover {
  background: rgba(78, 207, 140, 0.16);
  border-color: rgba(78, 207, 140, 0.8);
  color: #a8f0cc;
  transform: translateY(-3px) scale(1.025);
  box-shadow: 0 0 30px rgba(78, 207, 140, 0.22), 0 8px 28px rgba(0, 0, 0, 0.35);
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
  .landing2-links {
    display: none;
  }
  .landing2-login {
    margin-left: auto;
  }
}
</style>

