// Vercel Serverless Function (Node): proxy /api/scene/place to backend.

import { getBackendBase, proxyToBackend } from '../_proxy.js'

export default async function handler(req, res) {
  try {
    const url = `${getBackendBase()}/api/scene/place`
    await proxyToBackend(req, res, url)
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

