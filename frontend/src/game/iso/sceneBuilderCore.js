const TILE_W = 116
const TILE_H = 58
const IMG_W = 128
const IMG_H = 256

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function getNaturalSize(img) {
  const w = img?.naturalWidth || img?.width || 0
  const h = img?.naturalHeight || img?.height || 0
  return { w, h }
}

function isLikelyTileSprite(img) {
  const { w, h } = getNaturalSize(img)
  if (!w || !h) return false
  // Kenney isometric tiles commonly export around 128×256; treat near-matches as "tile sprites".
  const rw = w / IMG_W
  const rh = h / IMG_H
  return rw > 0.6 && rw < 1.4 && rh > 0.6 && rh < 1.4
}

function gridToScreen(col, row, offsetX, offsetY, zoom) {
  const sx = (col - row) * (TILE_W / 2) * zoom
  const sy = (col + row) * (TILE_H / 2) * zoom
  return { x: sx + offsetX, y: sy + offsetY }
}

function screenToGrid(sx, sy, offsetX, offsetY, zoom) {
  // Each cell's diamond is centered at (TILE_W/2, TILE_H/2) relative to the
  // bounding-box origin returned by gridToScreen(). Shift the cursor into a
  // cell-center space, then invert the isometric basis and round to the
  // nearest cell whose diamond contains the point.
  const dx = (sx - offsetX) / zoom - TILE_W / 2
  const dy = (sy - offsetY) / zoom - TILE_H / 2
  const colF = dx / TILE_W + dy / TILE_H
  const rowF = dy / TILE_H - dx / TILE_W
  return { col: Math.round(colF), row: Math.round(rowF) }
}

function diamondDistanceToCell(sx, sy, col, row, offsetX, offsetY, zoom) {
  const centerX = (col - row) * (TILE_W / 2) * zoom + offsetX + (TILE_W / 2) * zoom
  const centerY = (col + row) * (TILE_H / 2) * zoom + offsetY + (TILE_H / 2) * zoom
  const nx = Math.abs(sx - centerX) / ((TILE_W / 2) * zoom)
  const ny = Math.abs(sy - centerY) / ((TILE_H / 2) * zoom)
  // <= 1 means inside this isometric diamond.
  return nx + ny
}

function keyFor(col, row) {
  return `${col},${row}`
}

function getSpriteDrawRectForTile(tileX, tileY, tileW, tileH, imgW, imgH, anchor = { rx: 0.5, ry: 1 }) {
  // Place the detected sprite "foot point" (anchor) on tile center.
  return {
    dx: tileX + tileW / 2 - imgW * anchor.rx,
    dy: tileY + tileH / 2 - imgH * anchor.ry,
  }
}

function baseScaleForKind(kind) {
  // One source of truth for sprite sizing.
  // Change these numbers to resize all items consistently (preview + placed).
  if (kind === 'decor') return 0.5 // pets / decor
  if (kind === 'tree') return 1.5
  if (kind === 'flower') return 1.5
  return 0.95
}

export function createSceneBuilderCore(opts) {
  const {
    canvas,
    gridSize = 20,
    getMode,
    getSelectedItem,
    getItemDefById,
    getPlacements, // { items: [...] }
    onPlace,
    onRemove,
    onMove,
    setGridPos,
    themeBg = 'forest',
    getDefaultGroundItemId, // kept for now (not used once we match HTML ground)
    minimapCanvas = null,
    /** Optional palette image URLs — triggers early decoding so placements feel instant. */
    getPreloadSrcs = null,
  } = opts
  let themeBgKey = themeBg

  if (!canvas) throw new Error('canvas required')

  const ctx = canvas.getContext('2d')
  const mm = minimapCanvas ? minimapCanvas.getContext('2d') : null

  let W = 1
  let H = 1
  // Screen-space clouds (drift + bob, similar vibe to AppLandingV2 globe clouds).
  const sceneClouds = Array.from({ length: 8 }, (_, i) => ({
    yNorm: 0.07 + (i % 4) * 0.055 + Math.random() * 0.04,
    xOffset: (i / 8 + Math.random() * 0.12) % 1,
    spd: 0.014 + Math.random() * 0.022,
    phase: Math.random() * Math.PI * 2,
    scale: 0.72 + Math.random() * 0.55,
    depth: 0.35 + Math.random() * 0.45,
  }))
  let offsetX = 0
  let offsetY = 0
  let zoom = 1
  const MIN_ZOOM = 0.35
  const MAX_ZOOM = 1.8
  const ZOOM_STEP = 1.08

  let isPanning = false
  let panLastX = 0
  let panLastY = 0

  const imageCache = new Map()
  const spriteAnchorCache = new Map()
  function getImage(src) {
    if (!src) return null
    const cached = imageCache.get(src)
    if (cached) return cached
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    img.onload = () => {
      try {
        if (typeof img.decode === 'function') img.decode().catch(() => {})
      } catch (_) {
        // ignore decode edge cases — decode() not supported everywhere
      }
    }
    imageCache.set(src, img)
    return img
  }

  function normalizeSrcCandidates(def) {
    if (!def) return []
    const c = Array.isArray(def.srcCandidates) ? def.srcCandidates : []
    const out = []
    for (const x of c) {
      const s = String(x || '').trim()
      if (s) out.push(s)
    }
    const primary = String(def.src || '').trim()
    if (primary) out.unshift(primary)
    return [...new Set(out)]
  }

  function getPrimarySrc(def) {
    const c = normalizeSrcCandidates(def)
    return c[0] || ''
  }

  function getImageForDef(def) {
    const candidates = normalizeSrcCandidates(def)
    if (!candidates.length) return null
    const key = candidates.join('|')
    const cached = imageCache.get(key)
    if (cached) return cached

    const img = new Image()
    img.decoding = 'async'
    let idx = 0
    const tryLoad = () => {
      const src = candidates[idx]
      if (!src) return
      img.src = src
    }
    img.onload = () => {
      try {
        if (typeof img.decode === 'function') img.decode().catch(() => {})
      } catch (_) {
        // ignore
      }
    }
    img.onerror = () => {
      idx += 1
      if (idx < candidates.length) tryLoad()
    }
    imageCache.set(key, img)
    tryLoad()
    return img
  }

  /** Prime cache/decoding for catalogue sprites before first click-place. */
  function warmupPlacementSprites() {
    if (typeof getPreloadSrcs !== 'function') return
    const urls = [...new Set(getPreloadSrcs().filter(Boolean))]
    for (const src of urls) getImage(src)
  }

  function getSpriteAnchor(src, img) {
    const cached = spriteAnchorCache.get(src)
    if (cached) return cached
    if (!img || !img.complete) return { rx: 0.5, ry: 1 }

    try {
      const w = img.naturalWidth || img.width || 0
      const h = img.naturalHeight || img.height || 0
      if (!w || !h) return { rx: 0.5, ry: 1 }

      const cvs = document.createElement('canvas')
      cvs.width = w
      cvs.height = h
      const c = cvs.getContext('2d', { willReadFrequently: true })
      c.drawImage(img, 0, 0, w, h)
      const data = c.getImageData(0, 0, w, h).data

      let hitY = -1
      let minX = w
      let maxX = -1
      const alphaThreshold = 8

      for (let y = h - 1; y >= 0; y--) {
        let rowMin = w
        let rowMax = -1
        for (let x = 0; x < w; x++) {
          const a = data[(y * w + x) * 4 + 3]
          if (a > alphaThreshold) {
            if (x < rowMin) rowMin = x
            if (x > rowMax) rowMax = x
          }
        }
        if (rowMax >= rowMin) {
          hitY = y
          minX = rowMin
          maxX = rowMax
          break
        }
      }

      let anchor = { rx: 0.5, ry: 1 }
      if (hitY >= 0) {
        const footX = (minX + maxX) / 2
        anchor = {
          rx: Math.max(0, Math.min(1, footX / w)),
          ry: Math.max(0, Math.min(1, hitY / h)),
        }
      }
      spriteAnchorCache.set(src, anchor)
      return anchor
    } catch {
      return { rx: 0.5, ry: 1 }
    }
  }

  function validCell(col, row) {
    return col >= 0 && row >= 0 && col < gridSize && row < gridSize
  }

  // Hover (for highlight preview)
  let hoverCell = null

  function resize() {
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    W = Math.max(1, rect.width)
    H = Math.max(1, rect.height)
    canvas.width = Math.max(1, Math.floor(W * dpr))
    canvas.height = Math.max(1, Math.floor(H * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Match scene_builder.html defaults
    if (offsetX === 0 && offsetY === 0) {
      offsetX = W / 2
      offsetY = H * 0.18
      // smaller tiles, show more blocks, look cleaner
      zoom = 0.65
    }
  }

  function buildGridIndex(placements) {
    const grid = {}
    const items = Array.isArray(placements?.items) ? placements.items : []
    for (const it of items) {
      const col = Number.isFinite(it.col) ? it.col : null
      const row = Number.isFinite(it.row) ? it.row : null
      if (col == null || row == null) continue
      const k = keyFor(col, row)
      if (!grid[k]) grid[k] = []
      grid[k].push(it)
    }
    return grid
  }

  function kindOfPlacement(it) {
    const def = it?.itemId ? getItemDefById(it.itemId) : null
    return def?.kind || it?.type || ''
  }

  function cornerIndexForFlower(it, itemsInCell) {
    // Deterministic ordering: by `at` then by `itemId`.
    const flowers = (itemsInCell || [])
      .filter((x) => kindOfPlacement(x) === 'flower')
      .slice()
      .sort((a, b) => {
        const atA = String(a?.at || '')
        const atB = String(b?.at || '')
        if (atA < atB) return -1
        if (atA > atB) return 1
        const idA = String(a?.itemId || '')
        const idB = String(b?.itemId || '')
        if (idA < idB) return -1
        if (idA > idB) return 1
        return 0
      })
    const idx = flowers.findIndex((x) => x === it)
    return idx < 0 ? 0 : idx % 4
  }

  function drawTileBase(x, y, stroke) {
    ctx.save()
    ctx.translate(x, y)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo((TILE_W / 2) * zoom, (TILE_H / 2) * zoom)
    ctx.lineTo(0, TILE_H * zoom)
    ctx.lineTo((-TILE_W / 2) * zoom, (TILE_H / 2) * zoom)
    ctx.closePath()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  /** Placement “foot” on the iso diamond (trees = center; flowers = quadrant). */
  function objectFootOnTile(it, cellItems, def, x, y, tw, th) {
    let footX = x + tw / 2
    let footY = y + th / 2
    if (def.kind === 'flower') {
      const ci = cornerIndexForFlower(it, cellItems)
      if (ci === 0) {
        footX = x + tw / 2
        footY = y + th * 0.12
      } else if (ci === 1) {
        footX = x + tw * 0.86
        footY = y + th / 2
      } else if (ci === 2) {
        footX = x + tw / 2
        footY = y + th * 0.88
      } else {
        footX = x + tw * 0.14
        footY = y + th / 2
      }
    }
    return { footX, footY }
  }

  function drawPlaceholderObject(def, footX, footY, yTilesBottom) {
    const r = Math.max(10, 14 * zoom)
    ctx.save()
    ctx.fillStyle =
      def.kind === 'flower'
        ? 'rgba(214, 138, 216, 0.88)'
        : def.kind === 'ground'
          ? 'rgba(120, 150, 120, 0.75)'
          : 'rgba(54, 150, 86, 0.92)'
    ctx.beginPath()
    ctx.arc(footX, Math.min(footY, yTilesBottom), r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function drawObjectAt(col, row, it, cellItems = null) {
    const def = it?.itemId ? getItemDefById(it.itemId) : null
    const primarySrc = getPrimarySrc(def)
    if (!primarySrc) return
    const img = getImageForDef(def)

    const { x, y } = gridToScreen(col, row, offsetX, offsetY, zoom)
    // Match scene_builder.html positioning
    const tw = TILE_W * zoom
    const th = TILE_H * zoom
    const { footX, footY } = objectFootOnTile(it, cellItems, def, x, y, tw, th)
    const yBottom = y + th * 0.92

    if (!img || !img.complete) {
      drawPlaceholderObject(def, footX, footY, yBottom)
      return
    }

    // Keep original aspect ratio; size controlled by baseScaleForKind().
    const s = Number.isFinite(def.scale) ? def.scale : baseScaleForKind(def.kind)
    const nat = getNaturalSize(img)
    const ratio = nat.w && nat.h ? nat.w / nat.h : IMG_W / IMG_H

    // If the sprite isn't a classic 128×256 tile, scale it down a bit more.
    const extra = isLikelyTileSprite(img) ? 1 : 0.82

    let iw = 0
    let ih = 0
    if (def.kind === 'ground') {
      // Fit into the standard isometric tile sprite box so it matches floor blocks.
      const boxW = IMG_W * zoom
      const boxH = IMG_H * zoom
      const sf = nat.w && nat.h ? Math.min(boxW / nat.w, boxH / nat.h) : 1
      iw = clamp((nat.w || IMG_W) * sf * s, 10, boxW)
      ih = clamp((nat.h || IMG_H) * sf * s, 10, boxH)
    } else {
      // Cap sizes to avoid oversized assets while keeping things crisp.



      ih = clamp(IMG_H * zoom * s * extra, 10, IMG_H * zoom * 1.5)

      iw = clamp(ih * ratio, 10, IMG_W * zoom * 2)
    }
    const anchor = def?.anchor && typeof def.anchor === 'object' ? def.anchor : getSpriteAnchor(primarySrc, img)
    const dx = footX - iw * anchor.rx
    const dy = footY - ih * anchor.ry

    if (def.tint) {
      ctx.drawImage(img, dx, dy, iw, ih)
      ctx.save()
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = def.tint
      ctx.fillRect(dx, dy, iw, ih)
      ctx.restore()
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.drawImage(img, dx, dy, iw, ih)
    }
  }

  function drawGroundAt(col, row) {
    const groundId = getDefaultGroundItemId?.()
    if (!groundId) return
    const def = getItemDefById(groundId)
    const primarySrc = getPrimarySrc(def)
    if (!primarySrc) return
    const img = getImageForDef(def)
    if (!img || !img.complete) return
    const { x, y } = gridToScreen(col, row, offsetX, offsetY, zoom)
    // Keep aspect ratio for ground sprites too (some kits are square previews).
    const nat = getNaturalSize(img)
    const ratio = nat.w && nat.h ? nat.w / nat.h : IMG_W / IMG_H
    const drawH = IMG_H * zoom
    const drawW = drawH * ratio
    const dx = x - drawW / 2
    const dy = y - drawH + TILE_H * zoom
    if (def.tint) {
      ctx.drawImage(img, dx, dy, drawW, drawH)
      ctx.save()
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = def.tint
      ctx.fillRect(dx, dy, drawW, drawH)
      ctx.restore()
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.drawImage(img, dx, dy, drawW, drawH)
    }
  }

  function groundPalette() {
    return {
      // Softer, less “checkerboard”, more grass-like
      c1Even: '#3c7f46',
      c2Even: '#367843',
      c1Odd: '#3a7b45',
      c2Odd: '#347542',
      leftEven: 'rgba(40, 80, 52, 0.55)',
      leftOdd: 'rgba(38, 74, 48, 0.55)',
      rightEven: 'rgba(46, 92, 58, 0.55)',
      rightOdd: 'rgba(42, 86, 54, 0.55)',
      stroke: 'rgba(0,0,0,0.07)',
    }
  }

  function rand01(col, row, salt = 0) {
    // Deterministic pseudo-random (no flicker)
    let x = (col + 1) * 374761393 + (row + 1) * 668265263 + (salt + 1) * 2147483647
    x = (x ^ (x >> 13)) >>> 0
    x = (x * 1274126177) >>> 0
    return (x & 0xfffffff) / 0xfffffff
  }

  // Match scene_builder.html ground shading (theme-aware)

  function drawIsoGround(x, y, tw, th, col, row) {
    const even = (col + row) % 2 === 0
    const pal = groundPalette()
    const c1 = even ? pal.c1Even : pal.c1Odd
    const c2 = even ? pal.c2Even : pal.c2Odd

    ctx.save()
    const h = 4 * zoom
    ctx.beginPath()
    ctx.moveTo(x + tw / 2, y)
    ctx.lineTo(x + tw, y + th / 2)
    ctx.lineTo(x + tw / 2, y + th)
    ctx.lineTo(x, y + th / 2)
    ctx.closePath()

    const grad = ctx.createLinearGradient(x, y, x, y + th)
    grad.addColorStop(0, c1)
    grad.addColorStop(1, c2)
    ctx.fillStyle = grad
    ctx.fill()

    ctx.strokeStyle = pal.stroke
    ctx.lineWidth = 0.5
    ctx.stroke()

    // “Fuzzy grass” micro texture on the top face
    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.fillStyle = even ? 'rgba(210,255,210,0.22)' : 'rgba(210,255,210,0.18)'
    const dots = 7
    for (let i = 0; i < dots; i++) {
      const r1 = rand01(col, row, i)
      const r2 = rand01(col, row, i + 99)
      // place within diamond-ish region
      const px = x + tw * (0.25 + r1 * 0.5)
      const py = y + th * (0.18 + r2 * 0.64)
      const rr = (0.6 + rand01(col, row, i + 7) * 1.3) * zoom
      ctx.beginPath()
      ctx.arc(px, py, rr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Left face
    ctx.beginPath()
    ctx.moveTo(x, y + th / 2)
    ctx.lineTo(x + tw / 2, y + th)
    ctx.lineTo(x + tw / 2, y + th + 4 * zoom)
    ctx.lineTo(x, y + th / 2 + 4 * zoom)
    ctx.closePath()
    ctx.fillStyle = even ? pal.leftEven : pal.leftOdd
    ctx.fill()

    // Right face
    ctx.beginPath()
    ctx.moveTo(x + tw, y + th / 2)
    ctx.lineTo(x + tw / 2, y + th)
    ctx.lineTo(x + tw / 2, y + th + 4 * zoom)
    ctx.lineTo(x + tw, y + th / 2 + 4 * zoom)
    ctx.closePath()
    ctx.fillStyle = even ? pal.rightEven : pal.rightOdd
    ctx.fill()

    ctx.restore()
  }

  function drawGroundEdgeFeather() {
    // Feather the ground boundary into the sky (soft blur extension).
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = `blur(${Math.max(12, 28 * zoom)}px)`
    ctx.globalAlpha = 0.52

    const cx = offsetX
    const cy = offsetY + (gridSize + 10) * (TILE_H / 2) * zoom
    const r0 = Math.max(W, H) * 0.25
    const r1 = Math.max(W, H) * 0.92
    const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.55, 'rgba(215,245,255,0.03)')
    g.addColorStop(0.78, 'rgba(215,245,255,0.09)')
    g.addColorStop(1, 'rgba(215,245,255,0.20)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    ctx.restore()
    ctx.filter = 'none'
  }

  function boardCornersForPlayable(tw, th) {
    // Outer diamond corners for the playable board (gridSize).
    return {
      top: { x: offsetX + tw / 2, y: offsetY },
      right: {
        x: offsetX + (gridSize - 1) * (TILE_W / 2) * zoom + tw,
        y: offsetY + (gridSize - 1) * (TILE_H / 2) * zoom + th / 2,
      },
      bottom: { x: offsetX + tw / 2, y: offsetY + (gridSize - 1) * TILE_H * zoom + th },
      left: {
        x: offsetX - (gridSize - 1) * (TILE_W / 2) * zoom,
        y: offsetY + (gridSize - 1) * (TILE_H / 2) * zoom + th / 2,
      },
    }
  }

  function roundedBoardPath(top, right, bottom, left, r) {
    // Rounded corners for the outer board silhouette only.
    const rr = Math.max(0, r)
    const t1 = { x: top.x - rr, y: top.y + rr * 0.55 }
    const t2 = { x: top.x + rr, y: top.y + rr * 0.55 }
    const r1 = { x: right.x - rr, y: right.y - rr * 0.55 }
    const r2 = { x: right.x - rr, y: right.y + rr * 0.55 }
    const b1 = { x: bottom.x + rr, y: bottom.y - rr * 0.55 }
    const b2 = { x: bottom.x - rr, y: bottom.y - rr * 0.55 }
    const l1 = { x: left.x + rr, y: left.y + rr * 0.55 }
    const l2 = { x: left.x + rr, y: left.y - rr * 0.55 }

    ctx.beginPath()
    ctx.moveTo(t1.x, t1.y)
    ctx.quadraticCurveTo(top.x, top.y, t2.x, t2.y)
    ctx.lineTo(r1.x, r1.y)
    ctx.quadraticCurveTo(right.x, right.y, r2.x, r2.y)
    ctx.lineTo(b1.x, b1.y)
    ctx.quadraticCurveTo(bottom.x, bottom.y, b2.x, b2.y)
    ctx.lineTo(l1.x, l1.y)
    ctx.quadraticCurveTo(left.x, left.y, l2.x, l2.y)
    ctx.closePath()
  }

  function drawRoundedBoardEdge() {
    // Visual-only rounded outer edge with soft fade.
    const tw = TILE_W * zoom
    const th = TILE_H * zoom
    const c = boardCornersForPlayable(tw, th)
    const radius = 46 * zoom

    ctx.save()
    ctx.globalCompositeOperation = 'source-over'

    // Outer feather glow (blurred stroke)
    ctx.save()
    ctx.filter = `blur(${Math.max(10, 18 * zoom)}px)`
    ctx.globalAlpha = 0.26
    roundedBoardPath(c.top, c.right, c.bottom, c.left, radius)
    ctx.strokeStyle = 'rgba(215,245,255,0.12)'
    ctx.lineWidth = Math.max(10, 18 * zoom)
    ctx.stroke()
    ctx.restore()

    // Inner subtle rim to suggest a rounded bevel
    ctx.save()
    ctx.globalAlpha = 0.18
    roundedBoardPath(c.top, c.right, c.bottom, c.left, radius)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = Math.max(1.3, 2.2 * zoom)
    ctx.stroke()
    ctx.restore()

    ctx.restore()
    ctx.filter = 'none'
  }

  function drawHoverTile(col, row) {
    const { x, y } = gridToScreen(col, row, offsetX, offsetY, zoom)
    const tw = TILE_W * zoom
    const th = TILE_H * zoom
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x + tw / 2, y)
    ctx.lineTo(x + tw, y + th / 2)
    ctx.lineTo(x + tw / 2, y + th)
    ctx.lineTo(x, y + th / 2)
    ctx.closePath()

    const m = getMode()
    const isDelete = m === 'delete'
    const isMove = m === 'move'
    ctx.fillStyle = isDelete ? 'rgba(224,82,82,0.25)' : isMove ? 'rgba(0,242,255,0.18)' : 'rgba(82,212,150,0.22)'
    ctx.fill()
    ctx.strokeStyle = isDelete ? '#e05252' : isMove ? '#00f2ff' : '#52d496'
    ctx.lineWidth = 2
    ctx.stroke()

    if (m === 'place') {
      const sel = getSelectedItem()
      const def = sel ? getItemDefById(sel) : null
      const primarySrc = getPrimarySrc(def)
      if (primarySrc) {
        const img = getImageForDef(def)
        const placements = getPlacements()
        const gi = buildGridIndex(placements)
        const kk = keyFor(col, row)
        const cellItems = gi[kk] || null
        const syntheticIt = sel ? { itemId: sel } : null
        const { footX, footY } = syntheticIt
          ? objectFootOnTile(syntheticIt, cellItems, def, x, y, tw, th)
          : { footX: x + tw / 2, footY: y + th / 2 }

        if (img && img.complete) {




          const s = Number.isFinite(def.scale) ? def.scale : baseScaleForKind(def.kind)
          const iw = IMG_W * zoom * s
          const ih = IMG_H * zoom * s
          const anchor = def?.anchor && typeof def.anchor === 'object' ? def.anchor : getSpriteAnchor(primarySrc, img)
          const { dx, dy } = getSpriteDrawRectForTile(x, y, tw, th, iw, ih, anchor)
          ctx.globalAlpha = 0.6
          ctx.drawImage(img, dx, dy, iw, ih)
          ctx.globalAlpha = 1
        } else {
          ctx.save()
          ctx.globalAlpha = 0.55
          drawPlaceholderObject(def, footX, footY, y + th * 0.92)
          ctx.restore()
        }
      }
    }

    ctx.restore()
  }

  function drawSkyBackground() {
    // Bright, friendly sky (no image assets needed)
    ctx.save()

    const t = performance.now() * 0.001

    // Deeper blue sky (less cream at horizon than before)
    const top = '#4fa8ff'
    const mid = '#b8e8ff'
    const bot = '#e8f6ff'

    // Sky gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, top)
    bg.addColorStop(0.55, mid)
    bg.addColorStop(1, bot)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Sun glow (top-right)
    const sunX = W * 0.82
    const sunY = H * 0.16
    const sunR = Math.max(W, H) * 0.18
    const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
    sun.addColorStop(0, 'rgba(255,255,255,0.95)')
    sun.addColorStop(0.18, 'rgba(255,248,210,0.50)')
    sun.addColorStop(1, 'rgba(255,244,196,0)')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, W, H)

    // Drifting clouds (multi-puff clusters, inspired by landing-page globe clouds)
    function drawCloudPuffs(cx, cy, sz, alpha) {
      const cg = Math.round(228 + (1 - alpha) * 18)
      ctx.globalAlpha = alpha
      ctx.fillStyle = `rgb(${cg + 10},${cg + 14},${cg + 18})`
      ctx.beginPath()
      ctx.arc(cx, cy, sz, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx + sz * 0.85, cy + sz * 0.15, sz * 0.72, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx - sz * 0.8, cy + sz * 0.15, sz * 0.65, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = alpha * 0.32
      ctx.fillStyle = 'rgba(100,140,180,0.28)'
      ctx.beginPath()
      ctx.ellipse(cx + sz * 0.15, cy + sz * 0.95, sz * 1.1, sz * 0.35, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    sceneClouds.forEach((cl) => {
      const span = W + 280
      const drift = (cl.xOffset + t * cl.spd * (0.6 + cl.depth * 0.4)) % 1.15
      const cx = drift * span - 120
      const cy =
        cl.yNorm * H +
        Math.sin(t * 0.35 + cl.phase) * (6 + 5 * cl.depth) +
        Math.sin(t * 0.12 + cl.phase * 0.7) * 3
      const baseSz = (34 + 26 * cl.depth) * Math.min(1.25, zoom) * cl.scale
      const alpha = Math.max(0.14, Math.min(0.52, 0.18 + cl.depth * 0.42))
      ctx.save()
      drawCloudPuffs(cx, cy, baseSz, alpha)
      ctx.restore()
    })

    // A tiny bit of sky grain to avoid flat gradients (very subtle)
    ctx.save()
    ctx.globalAlpha = 0.035
    ctx.fillStyle = 'rgba(255,255,255,1)'
    const step = Math.max(28, 46 * zoom)
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const a = (x * 0.17 + y * 0.23) % 1
        if (a > 0.55) ctx.fillRect(x, y, 1, 1)
      }
    }
    ctx.restore()

    ctx.restore()
  }

  function drawAtmosphereBlend() {
    // Softens the sky/ground boundary and pushes distant tiles back.
    ctx.save()

    const tint = 'rgba(255, 250, 230, '

    // Haze over the top portion (distance fog)
    const haze = ctx.createLinearGradient(0, 0, 0, H)
    haze.addColorStop(0, `${tint}0.20)`)
    haze.addColorStop(0.26, `${tint}0.12)`)
    haze.addColorStop(0.62, `${tint}0.04)`)
    haze.addColorStop(1, `${tint}0.00)`)
    ctx.fillStyle = haze
    ctx.fillRect(0, 0, W, H)

    // NOTE: Keep horizon glow very subtle (avoid visible “white band” across the map).
    const horizonY = offsetY + (TILE_H * zoom) * 0.18
    const band = ctx.createLinearGradient(0, horizonY - 120 * zoom, 0, horizonY + 160 * zoom)
    band.addColorStop(0, `${tint}0.00)`)
    band.addColorStop(0.35, `${tint}0.07)`)
    band.addColorStop(0.65, `${tint}0.05)`)
    band.addColorStop(1, `${tint}0.00)`)
    ctx.fillStyle = band
    ctx.fillRect(0, 0, W, H)

    ctx.restore()
  }

  function render() {
    raf = requestAnimationFrame(render)

    // Background: sky + sunlight + clouds
    ctx.clearRect(0, 0, W, H)
    drawSkyBackground()

    const placements = getPlacements()
    const gridIndex = buildGridIndex(placements)

    // Rounded board silhouette (visual only): clip the entire ground to rounded corners.
    const tw = TILE_W * zoom
    const th = TILE_H * zoom
    const corners = boardCornersForPlayable(tw, th)
    const boardRadius = 50 * zoom

    ctx.save()
    roundedBoardPath(corners.top, corners.right, corners.bottom, corners.left, boardRadius)
    ctx.clip()

    // Draw grid + objects in row-major order (scene_builder.html)
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const p = gridToScreen(col, row, offsetX, offsetY, zoom)
        drawIsoGround(p.x, p.y, tw, th, col, row)
        const k = keyFor(col, row)
        if (gridIndex[k]) {
          for (const it of gridIndex[k]) drawObjectAt(col, row, it, gridIndex[k])
        }
      }
    }
    ctx.restore()

    // Blend sky/ground transition (after tiles so it affects distance too)
    drawAtmosphereBlend()
    drawGroundEdgeFeather()
    drawRoundedBoardEdge()

    // Hover highlight
    if (hoverCell && validCell(hoverCell.col, hoverCell.row)) drawHoverTile(hoverCell.col, hoverCell.row)

    // Minimap removed by default (per request). If we bring it back later, we’ll match HTML sizing.
  }

  function hitCellFromEvent(e) {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const approx = screenToGrid(x, y, offsetX, offsetY, zoom)

    let bestCol = approx.col
    let bestRow = approx.row
    let bestDist = Infinity

    // Search around the approximate cell and choose the actual diamond under
    // cursor. This avoids off-by-one near tile boundaries.
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const c = approx.col + dc
        const r = approx.row + dr
        if (!validCell(c, r)) continue
        const d = diamondDistanceToCell(x, y, c, r, offsetX, offsetY, zoom)
        if (d < bestDist) {
          bestDist = d
          bestCol = c
          bestRow = r
        }
      }
    }

    return { col: bestCol, row: bestRow, x: e.clientX, y: e.clientY }
  }

  function onMouseMove(e) {
    if (isPanning) {
      const dx = e.clientX - panLastX
      const dy = e.clientY - panLastY
      offsetX += dx
      offsetY += dy
      panLastX = e.clientX
      panLastY = e.clientY
      return
    }

    const h = hitCellFromEvent(e)
    const col = h.col
    const row = h.row
    hoverCell = { col, row }
    if (validCell(col, row)) setGridPos?.(col, row)
    else setGridPos?.(null, null)

    // move mode removed (no panning by drag)
  }

  function onMouseDown(e) {
    if (e.button === 2) {
      e.preventDefault()
      isPanning = true
      panLastX = e.clientX
      panLastY = e.clientY
      return
    }

    if (e.button !== 0) return

    // Target cell from pointer — matches first tap without a prior mousemove/touchmove
    // and avoids stale hover after pan/zoom.
    const h = hitCellFromEvent(e)
    const col = h.col
    const row = h.row
    hoverCell = { col, row }
    if (!validCell(col, row)) return

    const placements = getPlacements()
    const gridIndex = buildGridIndex(placements)
    const k = keyFor(col, row)

    if (getMode() === 'place') {
      const sel = getSelectedItem()
      if (!sel) return
      // prevent duplicates of same itemId in same cell
      if (gridIndex[k] && gridIndex[k].some((x) => x.itemId === sel)) return
      onPlace?.({ itemId: sel, col, row })
      return
    }

    if (getMode() === 'delete') {
      if (gridIndex[k] && gridIndex[k].length > 0) {
        const last = gridIndex[k][gridIndex[k].length - 1]
        onRemove?.({ itemId: last.itemId || null, col, row })
      }
      return
    }

    // move mode removed
  }

  function onMouseUp(e) {
    if (isPanning && (e.button === 2 || e.button === 0)) {
      isPanning = false
    }
  }

  function onMouseLeave() {
    if (isPanning) isPanning = false
  }

  function onContextMenu(e) {
    e.preventDefault()
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
  }

  function onWheel(e) {
    e.preventDefault()

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const oldZoom = zoom
    const nextZoom = clamp(e.deltaY < 0 ? oldZoom * ZOOM_STEP : oldZoom / ZOOM_STEP, MIN_ZOOM, MAX_ZOOM)
    if (nextZoom === oldZoom) return

    // Keep the world point under the cursor fixed while zooming.
    const worldX = (mouseX - offsetX) / oldZoom
    const worldY = (mouseY - offsetY) / oldZoom
    zoom = nextZoom
    offsetX = mouseX - worldX * zoom
    offsetY = mouseY - worldY * zoom

    // Do not force-update hoverCell on wheel: placement should stay bound to
    // the visible preview tile until the next mouse move updates it naturally.
  }

  let raf = 0
  function start() {
    resize()
    // One more resize after mount/layout, fixes “blank until click” on some browsers.
    setTimeout(() => {
      warmupPlacementSprites()
      resize()
    }, 0)
    window.addEventListener('resize', resize)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mouseup', onMouseUp)
    render()
  }

  function stop() {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mouseleave', onMouseLeave)
    canvas.removeEventListener('contextmenu', onContextMenu)
    canvas.removeEventListener('wheel', onWheel)
    window.removeEventListener('mouseup', onMouseUp)
  }

  function setThemeBg(bg) {
    themeBgKey = bg || 'forest'
  }

  function forceResize() {
    resize()
  }

  return { start, stop, setThemeBg, forceResize }
}

