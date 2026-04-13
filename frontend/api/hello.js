module.exports = function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, path: req.url || "" }));
};

