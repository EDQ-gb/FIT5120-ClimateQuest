const TILE_W = 128
const TILE_H = 64
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
    setTooltip,
    themeBg = 'forest',
    getDefaultGroundItemId, // kept for now (not used once we match HTML ground)
    minimapCanvas = null,
  } = opts
  let themeBgKey = themeBg

  if (!canvas) throw new Error('canvas required')

  const ctx = canvas.getContext('2d')
  const mm = minimapCanvas ? minimapCanvas.getContext('2d') : null

  let W = 1
  let H = 1
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
      // trigger redraw on load
      // no-op here; render loop is running
    }
    imageCache.set(src, img)
    return img
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

  function drawObjectAt(col, row, it, cellItems = null) {
    const def = it?.itemId ? getItemDefById(it.itemId) : null
    if (!def?.src) return
    const img = getImage(def.src)
    if (!img || !img.complete) return

    const { x, y } = gridToScreen(col, row, offsetX, offsetY, zoom)
    // Match scene_builder.html positioning
    const tw = TILE_W * zoom
    const th = TILE_H * zoom
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
    const anchor = getSpriteAnchor(def.src, img)
    // Trees: tile center. Flowers: tile corners (max 4 per tile).
    let footX = x + tw / 2
    let footY = y + th / 2
    if (def.kind === 'flower') {
      const ci = cornerIndexForFlower(it, cellItems)
      // Diamond corners: top, right, bottom, left (clockwise)
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
    if (!def?.src) return
    const img = getImage(def.src)
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
    if (themeBgKey === 'glacier') {
      // sea-water / ice vibe
      return {
        c1Even: '#2e8aa1',
        c2Even: '#1e6b7d',
        c1Odd: '#2a8096',
        c2Odd: '#1a6273',
        leftEven: '#184f5e',
        leftOdd: '#144554',
        rightEven: '#1d5e6f',
        rightOdd: '#184f5e',
        stroke: 'rgba(0,0,0,0.10)',
      }
    }
  
    // forest default
    return {
      c1Even: '#3f7a44',
      c2Even: '#2f6338',
      c1Odd: '#3a713f',
      c2Odd: '#2a5b34',
      leftEven: '#244b2c',
      leftOdd: '#204227',
      rightEven: '#2b5633',
      rightOdd: '#254d2e',
      stroke: 'rgba(0,0,0,0.10)',
    }
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
      if (def?.src) {
        const img = getImage(def.src)
        if (img && img.complete) {






          const s = Number.isFinite(def.scale) ? def.scale : baseScaleForKind(def.kind)
          const iw = IMG_W * zoom * s
          const ih = IMG_H * zoom * s
          const anchor = getSpriteAnchor(def.src, img)
          const { dx, dy } = getSpriteDrawRectForTile(x, y, tw, th, iw, ih, anchor)
          ctx.globalAlpha = 0.6
          ctx.drawImage(img, dx, dy, iw, ih)
          ctx.globalAlpha = 1
        }
      }
    }

    ctx.restore()
  }

  function drawSkyBackground() {
    // Bright, friendly sky (no image assets needed)
    ctx.save()

    const isGlacier = themeBgKey === 'glacier'
    const top = isGlacier ? '#98d7ff' : '#8fd4ff'
    const mid = isGlacier ? '#c7f1ff' : '#d7f5ff'
    const bot = isGlacier ? '#f5fbff' : '#fff6d8'

    // Sky gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, top)
    bg.addColorStop(0.62, mid)
    bg.addColorStop(1, bot)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Sun glow (top-right)
    const sunX = W * 0.82
    const sunY = H * 0.16
    const sunR = Math.max(W, H) * 0.18
    const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
    sun.addColorStop(0, 'rgba(255,255,255,0.95)')
    sun.addColorStop(0.25, 'rgba(255,244,196,0.65)')
    sun.addColorStop(1, 'rgba(255,244,196,0)')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, W, H)

    // Soft clouds (a few translucent blobs)
    function cloud(cx, cy, s, a) {
      ctx.save()
      ctx.globalAlpha = a
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.ellipse(cx, cy, 46 * s, 22 * s, 0, 0, Math.PI * 2)
      ctx.ellipse(cx - 34 * s, cy + 2 * s, 30 * s, 18 * s, 0, 0, Math.PI * 2)
      ctx.ellipse(cx + 34 * s, cy + 4 * s, 32 * s, 19 * s, 0, 0, Math.PI * 2)
      ctx.ellipse(cx + 8 * s, cy - 10 * s, 28 * s, 18 * s, 0, 0, Math.PI * 2)
      ctx.fill()

      // Slight shadow to ground the cloud
      ctx.globalAlpha = a * 0.35
      ctx.fillStyle = 'rgba(120,160,190,0.35)'
      ctx.beginPath()
      ctx.ellipse(cx + 6 * s, cy + 12 * s, 52 * s, 18 * s, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    cloud(W * 0.22, H * 0.18, 0.95, 0.34)
    cloud(W * 0.44, H * 0.12, 0.75, 0.28)
    cloud(W * 0.62, H * 0.22, 1.05, 0.26)
    if (W > 900) cloud(W * 0.36, H * 0.26, 1.2, 0.22)

    ctx.restore()
  }

  function drawAtmosphereBlend() {
    // Softens the sky/ground boundary and pushes distant tiles back.
    ctx.save()

    const isGlacier = themeBgKey === 'glacier'
    const tint = isGlacier ? 'rgba(210, 245, 255, ' : 'rgba(255, 252, 230, '

    // Haze over the top portion (distance fog)
    const haze = ctx.createLinearGradient(0, 0, 0, H)
    haze.addColorStop(0, `${tint}0.26)`)
    haze.addColorStop(0.22, `${tint}0.18)`)
    haze.addColorStop(0.45, `${tint}0.00)`)
    ctx.fillStyle = haze
    ctx.fillRect(0, 0, W, H)

    // Horizon glow band around the first row of tiles
    const horizonY = offsetY + (TILE_H * zoom) * 0.25
    const band = ctx.createLinearGradient(0, horizonY - 80 * zoom, 0, horizonY + 140 * zoom)
    band.addColorStop(0, `${tint}0.00)`)
    band.addColorStop(0.35, `${tint}0.16)`)
    band.addColorStop(0.7, `${tint}0.05)`)
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

    // Draw grid + objects in row-major order (scene_builder.html)
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const { x, y } = gridToScreen(col, row, offsetX, offsetY, zoom)
        const tw = TILE_W * zoom
        const th = TILE_H * zoom
        drawIsoGround(x, y, tw, th, col, row)
        const k = keyFor(col, row)
        if (gridIndex[k]) {
          for (const it of gridIndex[k]) drawObjectAt(col, row, it, gridIndex[k])
        }
      }
    }

    // Blend sky/ground transition (after tiles so it affects distance too)
    drawAtmosphereBlend()

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
      setTooltip?.({ show: false, x: 0, y: 0, text: '' })
      return
    }

    const h = hitCellFromEvent(e)
    const col = h.col
    const row = h.row
    hoverCell = { col, row }
    if (validCell(col, row)) setGridPos?.(col, row)
    else setGridPos?.(null, null)

    // move mode removed (no panning by drag)

    // tooltip: show contents at cell
    const placements = getPlacements()
    const gridIndex = buildGridIndex(placements)
    const k = keyFor(col, row)
    if (validCell(col, row) && gridIndex[k] && gridIndex[k].length > 0) {
      const names = gridIndex[k]
        .map((it) => (it.itemId ? it.itemId : it.type || 'item'))
        .join(', ')
      setTooltip?.({ show: true, x: h.x + 12, y: h.y + 12, text: names })
    } else {
      setTooltip?.({ show: false, x: 0, y: 0, text: '' })
    }
  }

  function onMouseDown(e) {
    if (e.button === 2) {
      e.preventDefault()
      isPanning = true
      panLastX = e.clientX
      panLastY = e.clientY
      setTooltip?.({ show: false, x: 0, y: 0, text: '' })
      return
    }

    if (e.button !== 0) return

    // Strict WYSIWYG: only place/remove on the currently highlighted preview
    // tile so click result always matches what the user sees.
    if (!hoverCell) return
    const col = hoverCell.col
    const row = hoverCell.row
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
    setTooltip?.({ show: false, x: 0, y: 0, text: '' })
  }

  let raf = 0
  function start() {
    resize()
    // One more resize after mount/layout, fixes “blank until click” on some browsers.
    setTimeout(resize, 0)
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

