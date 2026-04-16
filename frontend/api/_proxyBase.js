import { Buffer } from 'node:buffer'

const BACKEND_BASE = process.env.BACKEND_BASE || 'https://fit5120-climatequest.onrender.com'

function getTailAndQuery(req) {
  const raw = typeof req.url === 'string' ? req.url : ''
  const u = new URL(raw || '/', 'http://local')
  const queryPath = req.query?.path
  const fromQuery =
    Array.isArray(queryPath) ? queryPath.join('/') : typeof queryPath === 'string' ? queryPath : ''
  const tail = String(fromQuery || u.searchParams.get('path') || '').replace(/^\/+/, '')
  u.searchParams.delete('path')
  const qs = u.searchParams.toString()
  return { tail, qs: qs ? `?${qs}` : '' }
}

export async function proxyWithPrefix(req, res, prefix) {
  try {
    if (!BACKEND_BASE) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'MISSING_BACKEND_BASE' }))
      return
    }

    const { tail, qs } = getTailAndQuery(req)
    const url = `${BACKEND_BASE}/api/${prefix}${tail ? `/${tail}` : ''}${qs}`

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

