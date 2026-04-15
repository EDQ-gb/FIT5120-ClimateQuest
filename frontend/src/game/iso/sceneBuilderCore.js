const TILE_W = 128
const TILE_H = 64
const IMG_W = 128
const IMG_H = 256

function gridToScreen(col, row, offsetX, offsetY, zoom) {
  const sx = (col - row) * (TILE_W / 2) * zoom
  const sy = (col + row) * (TILE_H / 2) * zoom
  return { x: sx + offsetX, y: sy + offsetY }
}

function screenToGrid(sx, sy, offsetX, offsetY, zoom) {
  const dx = (sx - offsetX) / zoom
  const dy = (sy - offsetY) / zoom
  const col = Math.floor((dx / (TILE_W / 2) + dy / (TILE_H / 2)) / 2)
  const row = Math.floor((dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2)
  return { col, row }
}

function keyFor(col, row) {
  return `${col},${row}`
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

  let dragging = false
  let dragStart = null
  let moving = null // { fromKey, pickedObj, startCol, startRow }

  const imageCache = new Map()
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

  function drawObjectAt(col, row, it) {
    const def = it?.itemId ? getItemDefById(it.itemId) : null
    if (!def?.src) return
    const img = getImage(def.src)
    if (!img || !img.complete) return

    const { x, y } = gridToScreen(col, row, offsetX, offsetY, zoom)
    // Match scene_builder.html positioning
    const tw = TILE_W * zoom
    const th = TILE_H * zoom
    const s = Number.isFinite(def.scale) ? def.scale : def.kind === 'decor' ? 0.72 : 1
    const iw = IMG_W * zoom * s
    const ih = IMG_H * zoom * s
    const dx = x - iw / 2 + tw / 2
    const dy = y - ih + th

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
    const drawW = IMG_W * zoom
    const drawH = IMG_H * zoom
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
        c1Even: '#1f6f86',
        c2Even: '#164d60',
        c1Odd: '#1c6277',
        c2Odd: '#134454',
        leftEven: '#0f3a49',
        leftOdd: '#0c313d',
        rightEven: '#12414f',
        rightOdd: '#0f3744',
        stroke: 'rgba(0,0,0,0.18)',
      }
    }
    if (themeBgKey === 'city') {
      return {
        c1Even: '#3f5c4f',
        c2Even: '#2e463c',
        c1Odd: '#395447',
        c2Odd: '#293e35',
        leftEven: '#22332c',
        leftOdd: '#1e2d27',
        rightEven: '#2a3f35',
        rightOdd: '#253a31',
        stroke: 'rgba(0,0,0,0.22)',
      }
    }
    // forest default
    return {
      c1Even: '#2a5c2a',
      c2Even: '#1e461e',
      c1Odd: '#245224',
      c2Odd: '#1a3e1a',
      leftEven: '#1a3a1a',
      leftOdd: '#162e16',
      rightEven: '#1e421e',
      rightOdd: '#1a361a',
      stroke: 'rgba(0,0,0,0.20)',
    }
  }

  // Match scene_builder.html ground shading (theme-aware)
  function drawIsoGround(x, y, tw, th, col, row) {
    const even = (col + row) % 2 === 0
    const pal = groundPalette()
    const c1 = even ? pal.c1Even : pal.c1Odd
    const c2 = even ? pal.c2Even : pal.c2Odd

    ctx.save()
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
          const s = Number.isFinite(def.scale) ? def.scale : def.kind === 'decor' ? 0.72 : 1
          const iw = IMG_W * zoom * 0.75 * s
          const ih = IMG_H * zoom * 0.75 * s
          ctx.globalAlpha = 0.6
          ctx.drawImage(img, x - iw / 2 + tw / 2, y - ih + th, iw, ih)
          ctx.globalAlpha = 1
        }
      }
    }

    ctx.restore()
  }

  function render() {
    raf = requestAnimationFrame(render)

    // Background gradient (exactly like scene_builder.html)
    ctx.clearRect(0, 0, W, H)
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0f1f0f')
    bg.addColorStop(1, '#1a3a1a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

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
          for (const it of gridIndex[k]) drawObjectAt(col, row, it)
        }
      }
    }

    // Hover highlight
    if (hoverCell && validCell(hoverCell.col, hoverCell.row)) drawHoverTile(hoverCell.col, hoverCell.row)

    // Minimap removed by default (per request). If we bring it back later, we’ll match HTML sizing.
  }

  function hitCellFromEvent(e) {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const { col, row } = screenToGrid(x, y, offsetX, offsetY, zoom)
    return { col, row, x: e.clientX, y: e.clientY }
  }

  function onMouseMove(e) {
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
    const h = hitCellFromEvent(e)
    const { col, row } = h
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
    // move mode removed
  }

  let raf = 0
  function start() {
    resize()
    // One more resize after mount/layout, fixes “blank until click” on some browsers.
    setTimeout(resize, 0)
    window.addEventListener('resize', resize)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    render()
  }

  function stop() {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mousedown', onMouseDown)
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

