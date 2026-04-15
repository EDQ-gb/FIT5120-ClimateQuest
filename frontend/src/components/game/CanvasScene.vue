<template>
  <div class="scene-wrap">
    <canvas ref="cvs"></canvas>
    <div class="scene-hud">
      <div>
        <div class="hud-name">{{ label }}</div>
        <div class="hud-sub">Keep completing tasks to grow your world</div>
      </div>
      <div class="hud-pct">{{ progress }}%</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getTheme, getItemById } from '../../game/assets/catalog.js'

const props = defineProps({
  themeType: { type: String, default: 'forest' }, // forest|glacier|cityGreen
  progress: { type: Number, default: 0 }, // 0..100
  trees: { type: Number, default: 0 }, // minimal v1
  flowers: { type: Number, default: 0 }, // minimal v1
  placements: { type: Object, default: null }, // { items: [{ itemId?, type?, at? }, ...] }
})

const cvs = ref(null)

const imageCache = new Map()

function getImage(src) {
  if (!src) return null
  const cached = imageCache.get(src)
  if (cached) return cached
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  img.onload = () => draw()
  imageCache.set(src, img)
  return img
}

function placementSeed(p) {
  const s = String(p?.itemId || p?.type || '') + String(p?.at || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647
  return h || 1
}

function stablePos(idx, W, H, seed) {
  // Deterministic pseudo-random positions in lower half of canvas
  let s = (seed + idx * 97) % 233280
  const r = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const x = W * (0.08 + r() * 0.84)
  const y = H * (0.56 + r() * 0.28)
  return { x, y }
}

function resolveSprite(p, themeType) {
  const theme = getTheme(themeType)
  if (p?.itemId) return getItemById(themeType, p.itemId) || null
  const kind = p?.type || ''
  if (kind) {
    const sameKind = theme.items.filter((x) => x.kind === kind)
    if (sameKind.length > 0) return sameKind[0]
  }
  // fallback to first tree/flower/ground
  if (theme.items.length > 0) return theme.items[0]
  return null
}

function drawTinted(ctx, img, x, y, w, h, tint) {
  ctx.drawImage(img, x, y, w, h)
  if (!tint) return
  ctx.save()
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = tint
  ctx.fillRect(x, y, w, h)
  ctx.restore()
  ctx.globalCompositeOperation = 'source-over'
}

const label = computed(
  () =>
    ({
      forest: '🌲 Rainforest',
      glacier: '❄️ Polar Glacier',
      cityGreen: '🏙️ City Green',
    })[props.themeType] || '🌍 Scene'
)

function lerp(a, b, t) {
  return a + (b - a) * t
}
function lerpColor(c1, c2, t) {
  const h = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
  const [r1, g1, b1] = h(c1),
    [r2, g2, b2] = h(c2)
  return `rgb(${Math.round(lerp(r1, r2, t))},${Math.round(lerp(g1, g2, t))},${Math.round(lerp(b1, b2, t))})`
}

function seeded(n, lo, hi, seed) {
  let s = seed
  const a = []
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280
    a.push(lo + (hi - lo) * (s / 233280))
  }
  return a
}

function drawHUD(ctx, W, H, icon, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.roundRect(W - 122, H - 48, 112, 34, 10)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '800 12px Inter'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${icon} ${p}%`, W - 16, H - 31)
  ctx.textAlign = 'left'
}

function drawForest(ctx, W, H, p, trees, flowers) {
  const pn = p / 100
  const skyG = ctx.createLinearGradient(0, 0, 0, H * 0.6)
  skyG.addColorStop(0, lerpColor('#0a1a0a', '#1a4030', pn))
  skyG.addColorStop(1, lerpColor('#1a2a10', '#4a8030', pn))
  ctx.fillStyle = skyG
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = lerpColor('#0a180a', '#2a5018', pn)
  ctx.beginPath()
  ctx.moveTo(0, H * 0.55)
  ctx.bezierCurveTo(W * 0.18, H * 0.38, W * 0.38, H * 0.44, W * 0.5, H * 0.46)
  ctx.bezierCurveTo(W * 0.65, H * 0.49, W * 0.82, H * 0.36, W, H * 0.44)
  ctx.lineTo(W, H)
  ctx.lineTo(0, H)
  ctx.closePath()
  ctx.fill()

  const gG = ctx.createLinearGradient(0, H * 0.6, 0, H)
  gG.addColorStop(0, lerpColor('#0e1e0a', '#38780e', pn))
  gG.addColorStop(1, lerpColor('#080f06', '#1a380a', pn))
  ctx.fillStyle = gG
  ctx.fillRect(0, H * 0.6, W, H * 0.4)

  const baseTrees = Math.ceil((p / 100) * 10)
  const totalTrees = Math.max(1, baseTrees + (trees || 0))
  const xs = seeded(totalTrees, W * 0.06, W * 0.94, 7)
  const szs = seeded(totalTrees, 0.55, 1.12, 77)
  for (let i = 0; i < totalTrees; i++) {
    const x = xs[i]
    const sz = szs[i]
    const baseY = H * 0.63 + (x / W) * H * 0.06
    drawTree(ctx, x, baseY, sz, pn)
  }

  const fl = Math.min(40, flowers || 0)
  if (fl > 0) {
    const fx = seeded(fl, W * 0.06, W * 0.94, 11)
    ctx.fillStyle = `rgba(255,210,120,${0.15 + pn * 0.3})`
    for (let i = 0; i < fl; i++) {
      const x = fx[i]
      const y = H * 0.78 + ((i % 7) / 7) * 18
      ctx.beginPath()
      ctx.arc(x, y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  drawHUD(ctx, W, H, '🌲', p)
}

function drawTree(ctx, x, baseY, sz, pn) {
  const h = 72 * sz,
    trunk = h * 0.22
  ctx.save()
  ctx.translate(x, baseY)
  ctx.fillStyle = lerpColor('#1a0c06', '#4a2810', pn)
  ctx.beginPath()
  ctx.moveTo(-5 * sz, 0)
  ctx.lineTo(5 * sz, 0)
  ctx.lineTo(3 * sz, -trunk)
  ctx.lineTo(-3 * sz, -trunk)
  ctx.closePath()
  ctx.fill()
  ;[1.0, 0.76, 0.54].forEach((sc, i) => {
    const cy = -trunk - h * 0.28 * i
    const cg = ctx.createRadialGradient(0, cy - 8 * sc, 1, 0, cy, 30 * sz * sc)
    cg.addColorStop(0, lerpColor('#0e220e', '#4a9022', pn))
    cg.addColorStop(1, lerpColor('#0a1a0a', '#2a6010', pn))
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.ellipse(0, cy, 28 * sz * sc, 28 * sz * sc, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}

function drawGlacier(ctx, W, H, p) {
  const pn = p / 100
  const sg = ctx.createLinearGradient(0, 0, 0, H * 0.5)
  sg.addColorStop(0, lerpColor('#000510', '#020b1c', pn))
  sg.addColorStop(1, lerpColor('#051020', '#0a2040', pn))
  ctx.fillStyle = sg
  ctx.fillRect(0, 0, W, H)

  const seaG = ctx.createLinearGradient(0, H * 0.45, 0, H)
  seaG.addColorStop(0, lerpColor('#030d18', '#0a2044', pn))
  seaG.addColorStop(1, lerpColor('#020810', '#061428', pn))
  ctx.fillStyle = seaG
  ctx.fillRect(0, H * 0.45, W, H)

  ctx.fillStyle = lerpColor('#0a1520', '#c0dcf0', pn)
  ctx.beginPath()
  ctx.moveTo(0, H * 0.52)
  ctx.bezierCurveTo(W * 0.22, H * 0.44, W * 0.48, H * 0.5, W * 0.56, H * 0.47)
  ctx.bezierCurveTo(W * 0.72, H * 0.43, W * 0.88, H * 0.5, W, H * 0.48)
  ctx.lineTo(W, H)
  ctx.lineTo(0, H)
  ctx.closePath()
  ctx.fill()
  drawHUD(ctx, W, H, '❄️', p)
}

function drawDesert(ctx, W, H, p) {
  const pn = p / 100
  const skyG = ctx.createLinearGradient(0, 0, 0, H * 0.55)
  skyG.addColorStop(0, lerpColor('#100608', '#1c0a1c', pn))
  skyG.addColorStop(1, lerpColor('#c05010', '#d07030', pn))
  ctx.fillStyle = skyG
  ctx.fillRect(0, 0, W, H)

  const sunG = ctx.createRadialGradient(W * 0.68, H * 0.14, 0, W * 0.68, H * 0.14, 70)
  sunG.addColorStop(0, `rgba(255,200,60,${0.3 + pn * 0.5})`)
  sunG.addColorStop(0.5, `rgba(255,140,10,${0.15 + pn * 0.25})`)
  sunG.addColorStop(1, 'rgba(255,80,0,0)')
  ctx.fillStyle = sunG
  ctx.beginPath()
  ctx.arc(W * 0.68, H * 0.14, 70, 0, Math.PI * 2)
  ctx.fill()

  const sandG = ctx.createLinearGradient(0, H * 0.5, 0, H)
  sandG.addColorStop(0, lerpColor('#3a1a04', '#d4a055', pn))
  sandG.addColorStop(1, lerpColor('#200e02', '#9a6828', pn))
  ctx.fillStyle = sandG
  ctx.fillRect(0, H * 0.5, W, H * 0.5)
  drawHUD(ctx, W, H, '🌵', p)
}

function draw() {
  const canvas = cvs.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const cw = canvas.offsetWidth
  const ch = canvas.offsetHeight
  if (!cw || !ch) return
  canvas.width = cw * dpr
  canvas.height = ch * dpr
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const W = cw
  const H = ch
  const p = Math.max(0, Math.min(100, props.progress || 0))
  if (props.themeType === 'glacier') drawGlacier(ctx, W, H, p)
  else if (props.themeType === 'cityGreen') {
    // Reuse forest base for now, but cooler ground and fewer trees until purchases
    drawForest(ctx, W, H, Math.max(10, p), Math.floor((props.trees || 0) * 0.6), props.flowers || 0)
  } else drawForest(ctx, W, H, p, props.trees, props.flowers)

  // Draw placements as sprites (minimal overlay layer)
  const items = Array.isArray(props.placements?.items) ? props.placements.items : []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const def = resolveSprite(it, props.themeType)
    if (!def?.src) continue
    const img = getImage(def.src)
    if (!img || !img.complete) continue
    const seed = placementSeed(it)
    const pos = stablePos(i, W, H, seed)
    const size = def.kind === 'ground' ? 72 : def.kind === 'ice' ? 84 : 96
    const x = pos.x - size / 2
    const y = pos.y - size * 0.85
    drawTinted(ctx, img, x, y, size, size, def.tint)
  }
}

onMounted(() => {
  draw()
  window.addEventListener('resize', draw)
})

onUnmounted(() => {
  window.removeEventListener('resize', draw)
})

watch(() => [props.themeType, props.progress, props.trees, props.flowers, props.placements], draw)
</script>

<style scoped>
.scene-wrap {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
}
canvas {
  display: block;
  width: 100%;
  height: min(520px, calc(100vh - 180px));
}
.scene-hud {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 18px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hud-name {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
}
.hud-sub {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}
.hud-pct {
  font-size: 1.7rem;
  font-weight: 900;
  color: var(--primary-accent);
}
</style>

