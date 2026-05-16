/**
 * Parse open-data CSVs used on the Education page (public/data/education/*.csv).
 */

export function parseTemperatureCsv(text) {
  const out = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const [a, b] = t.split(',')
    if (a === 'Year') continue
    const year = Number(a)
    const anomaly = Number(b)
    if (Number.isFinite(year) && Number.isFinite(anomaly)) {
      out.push({ year, anomaly })
    }
  }
  return out.sort((p, q) => p.year - q.year)
}

/** Annual mean of NASA smoothed GMSL (cm) for chart readability */
export function parseNasaAnnualCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const header = lines[0].split(',')
  const yi = header.indexOf('year_fraction')
  const si = header.indexOf('gmsl_smoothed_cm')
  if (yi < 0 || si < 0) return []
  const buckets = new Map()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const yf = Number(cols[yi])
    const v = Number(cols[si])
    if (!Number.isFinite(yf) || !Number.isFinite(v)) continue
    const y = Math.floor(yf + 0.001)
    if (!buckets.has(y)) buckets.set(y, { sum: 0, n: 0 })
    const b = buckets.get(y)
    b.sum += v
    b.n += 1
  }
  return [...buckets.entries()]
    .map(([year, { sum, n }]) => ({ year, gmsl: sum / n }))
    .sort((a, b) => a.year - b.year)
}

function splitCsvLine(line) {
  const cols = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      q = !q
      continue
    }
    if (ch === ',' && !q) {
      cols.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  cols.push(cur.trim())
  return cols.map((c) => c.replace(/^"|"$/g, ''))
}

function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const header = splitCsvLine(lines[0]).map((h) => h.replace(/^\ufeff/, '').trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const row = {}
    header.forEach((h, j) => {
      row[h] = (cols[j] || '').trim()
    })
    rows.push(row)
  }
  return rows
}

function ghgTotalValueKey(headers) {
  if (headers.includes('ghg_emissions')) return 'ghg_emissions'
  return (
    headers.find(
      (h) => /greenhouse gas/i.test(h) && !/per capita/i.test(h) && !/capita/i.test(h),
    ) || null
  )
}

function ghgPerCapitaValueKey(headers) {
  if (headers.includes('ghg_emissions_per_capita')) return 'ghg_emissions_per_capita'
  return headers.find((h) => /per capita.*greenhouse gas/i.test(h)) || null
}

/** Entity → [{ year, value }] — tonnes CO₂e (raw annual GHG including LULUCF when present) */
export function parseGhgByEntity(text, { minYear = 1850 } = {}) {
  const rows = parseCsvRows(text)
  if (!rows.length) return new Map()
  const valueKey = ghgTotalValueKey(Object.keys(rows[0]))
  if (!valueKey) return new Map()
  const map = new Map()
  for (const r of rows) {
    const entity = r.Entity
    const year = Number(r.Year)
    const v = Number(r[valueKey])
    if (!entity || !Number.isFinite(year) || year < minYear || !Number.isFinite(v)) continue
    if (!map.has(entity)) map.set(entity, [])
    map.get(entity).push({ year, value: v })
  }
  for (const arr of map.values()) arr.sort((a, b) => a.year - b.year)
  return map
}

export function parsePerCapitaByEntity(text, { minYear = 1850 } = {}) {
  const rows = parseCsvRows(text)
  if (!rows.length) return new Map()
  const valueKey = ghgPerCapitaValueKey(Object.keys(rows[0]))
  if (!valueKey) return new Map()
  const map = new Map()
  for (const r of rows) {
    const entity = r.Entity
    const year = Number(r.Year)
    const v = Number(r[valueKey])
    if (!entity || !Number.isFinite(year) || year < minYear || !Number.isFinite(v)) continue
    if (!map.has(entity)) map.set(entity, [])
    map.get(entity).push({ year, value: v })
  }
  for (const arr of map.values()) arr.sort((a, b) => a.year - b.year)
  return map
}

/** Sorted entity names from a parsed emissions map */
export function listEntitiesFromMap(map) {
  return [...map.keys()].sort((a, b) => a.localeCompare(b))
}

/** World forest land area (1000 ha) → million ha */
export function parseFaostatForestWorld(text) {
  const rows = parseCsvRows(text)
  const out = []
  for (const r of rows) {
    if (r.Area !== 'World' || r.Item !== 'Forest land' || r.Element !== 'Area') continue
    const year = Number(r.Year)
    const v = Number(r.Value)
    if (!Number.isFinite(year) || !Number.isFinite(v)) continue
    out.push({ year, millionHa: v / 1000 })
  }
  return out.sort((a, b) => a.year - b.year)
}

/** Map data Y to SVG y (top of viewBox = smaller values visually up) */
export function chartYToSvg(yVal, yMin, yMax, h, pad) {
  const innerH = h - 2 * pad
  const dy = yMax - yMin || 1
  return pad + innerH - ((yVal - yMin) / dy) * innerH
}

/** Evenly spaced Y tick values between yMin and yMax (inclusive) */
export function buildLinearYTicks(yMin, yMax, count = 5) {
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return []
  if (yMax === yMin) return [yMin]
  const ticks = []
  const n = Math.max(2, count)
  for (let i = 0; i < n; i++) {
    ticks.push(yMin + (i / (n - 1)) * (yMax - yMin))
  }
  return ticks
}

/** Build SVG polyline points "x,y x,y ... " in viewBox coordinates */
export function toSvgPolyline(points, w, h, pad, xKey, yKey, xMin, xMax, yMin, yMax) {
  const innerW = w - 2 * pad
  const dx = xMax - xMin || 1
  return points
    .map((p) => {
      const x = pad + ((p[xKey] - xMin) / dx) * innerW
      const y = chartYToSvg(p[yKey], yMin, yMax, h, pad)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function extentYs(arr, key) {
  let lo = Infinity
  let hi = -Infinity
  for (const p of arr) {
    const v = p[key]
    if (!Number.isFinite(v)) continue
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  if (!Number.isFinite(lo)) return [0, 1]
  if (lo === hi) return [lo - 1, hi + 1]
  const m = (hi - lo) * 0.06
  return [lo - m, hi + m]
}

export function extentXs(arr, key) {
  let lo = Infinity
  let hi = -Infinity
  for (const p of arr) {
    const v = p[key]
    if (!Number.isFinite(v)) continue
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  if (!Number.isFinite(lo)) return [0, 1]
  if (lo === hi) return [lo - 1, hi + 1]
  return [lo, hi]
}
