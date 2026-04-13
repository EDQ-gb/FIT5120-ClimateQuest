// Vercel Serverless Function: proxy auth routes to Render backend.
// Ensures Set-Cookie is forwarded so sessions persist across refresh.

const BACKEND_BASE =
  process.env.BACKEND_BASE || "https://fit5120-climatequest.onrender.com";

module.exports = async function handler(req, res) {
  try {
    const pathParam = req.query?.path;
    let tail = Array.isArray(pathParam)
      ? pathParam.join("/")
      : typeof pathParam === "string"
        ? pathParam
        : "";

    // Fallback: derive tail from URL if platform doesn't populate query params
    if (!tail) {
      const url = req.url || "";
      const marker = "/api/auth/";
      const idx = url.indexOf(marker);
      if (idx >= 0) tail = url.slice(idx + marker.length).split("?")[0];
      tail = String(tail || "").replace(/^\/+/, "");
    }

    const url = `${BACKEND_BASE}/api/auth/${tail}`;

    // Forward headers (excluding hop-by-hop)
    const headers = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (key === "host") continue;
      if (key === "connection") continue;
      if (key === "content-length") continue;
      headers[key] = v;
    }

    const method = req.method || "GET";
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : typeof req.body === "string"
          ? req.body
          : req.body
            ? JSON.stringify(req.body)
            : undefined;

    const upstream = await fetch(url, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    res.status(upstream.status);

    // Forward headers (especially Set-Cookie).
    // Strip content-encoding because Node fetch may already decode the body.
    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (k === "transfer-encoding") return;
      if (k === "content-length") return;
      if (k === "content-encoding") return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res.status(502).json({ error: "BAD_GATEWAY" });
  }
};

