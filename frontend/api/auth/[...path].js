// Vercel Serverless Function (Node): proxy /api/auth/* to Render backend.
// This keeps auth cookies first-party on the Vercel domain.

const BACKEND_BASE = "https://fit5120-climatequest.onrender.com";

module.exports = async function handler(req, res) {
  try {
    const pathParam = req.query?.path;
    const tail = Array.isArray(pathParam)
      ? pathParam.join("/")
      : typeof pathParam === "string"
        ? pathParam
        : "";

    const url = `${BACKEND_BASE}/api/auth/${tail}`;

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

    res.statusCode = upstream.status;

    const setCookies =
      typeof upstream.headers.getSetCookie === "function"
        ? upstream.headers.getSetCookie()
        : null;

    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (k === "transfer-encoding") return;
      if (k === "content-length") return;
      if (k === "content-encoding") return;
      if (k === "set-cookie") return;
      res.setHeader(key, value);
    });

    if (setCookies && setCookies.length) {
      res.setHeader("set-cookie", setCookies);
    } else {
      const single = upstream.headers.get("set-cookie");
      if (single) res.setHeader("set-cookie", single);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "BAD_GATEWAY" }));
  }
};

