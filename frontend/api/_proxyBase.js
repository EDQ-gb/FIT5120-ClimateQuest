import { Buffer } from 'node:buffer'

const BACKEND_BASE = process.env.BACKEND_BASE || 'https://fit5120-climatequest.onrender.com'

/** Dedicated Render service (Node + Python/torch + `.pt`). Sync default with `api/[...path].js` if changed. */
export const DEFAULT_RECIPE_BACKEND_BASE = 'https://fit5120-climatequest-backend.onrender.com'

function getTailAndQuery(req, prefix) {
  const raw = typeof req.url === 'string' ? req.url : ''
  const u = new URL(raw || '/', 'http://local')
  const queryPath = req.query?.path
  const fromQuery =
    Array.isArray(queryPath) ? queryPath.join('/') : typeof queryPath === 'string' ? queryPath : ''
  const pathname = typeof u.pathname === 'string' ? u.pathname : ''
  const marker = `/api/${prefix}`
  const fromPathname = pathname.startsWith(marker) ? pathname.slice(marker.length).replace(/^\/+/, '') : ''
  const rawTail = String(fromPathname || fromQuery || u.searchParams.get('path') || '')
  const normalizedTail = rawTail.replace(/^\/+/, '')
  const dupPrefix = `${prefix}/`
  const tail = normalizedTail.startsWith(dupPrefix) ? normalizedTail.slice(dupPrefix.length) : normalizedTail
  u.searchParams.delete('path')
  const qs = u.searchParams.toString()
  return { tail, qs: qs ? `?${qs}` : '' }
}

export async function proxyWithPrefix(req, res, prefix, backendBaseOverride) {
  try {
    const base = backendBaseOverride ?? BACKEND_BASE
    if (!base) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'MISSING_BACKEND_BASE' }))
      return
    }

    const { tail, qs } = getTailAndQuery(req, prefix)
    const url = `${base.replace(/\/$/, '')}/api/${prefix}${tail ? `/${tail}` : ''}${qs}`

    const headers = {}
    for (const [k, v] of Object.entries(req.headers || {})) {
      if (!v) continue
      const key = k.toLowerCase()
      if (key === 'host') continue
      if (key === 'connection') continue
      if (key === 'content-length') continue
      headers[key] = v
    }

    const method = req.method || 'GET'
    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : typeof req.body === 'string'
          ? req.body
          : req.body
            ? JSON.stringify(req.body)
            : undefined

    const upstream = await fetch(url, { method, headers, body, redirect: 'manual' })
    res.statusCode = upstream.status

    const setCookies =
      typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : null

    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase()
      if (k === 'transfer-encoding') return
      if (k === 'content-length') return
      if (k === 'content-encoding') return
      if (k === 'set-cookie') return
      res.setHeader(key, value)
    })

    if (setCookies && setCookies.length) res.setHeader('set-cookie', setCookies)
    else {
      const single = upstream.headers.get('set-cookie')
      if (single) res.setHeader('set-cookie', single)
    }

    const buf = Buffer.from(await upstream.arrayBuffer())
    const ct = String(upstream.headers.get('content-type') || '').toLowerCase()
    if (
      upstream.status === 404 &&
      !ct.includes('application/json') &&
      buf.length &&
      buf.slice(0, 9).toString('utf8').toUpperCase().startsWith('<!DOCTYPE')
    ) {
      res.statusCode = 404
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'NOT_FOUND' }))
      return
    }
    res.end(buf)
  } catch (e) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'BAD_GATEWAY',
        message: e && typeof e.message === 'string' ? e.message : undefined,
      })
    )
  }
}

