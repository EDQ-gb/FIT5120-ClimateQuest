export default function handler(req, res) {
  res.setHeader('content-type', 'application/json')
  res.statusCode = 200
  res.end(JSON.stringify({ ok: true, path: req.url || '' }))
}

