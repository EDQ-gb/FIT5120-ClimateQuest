const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const {
  buildRecipeFallbackResponse,
  runRecipeModelViaLocalWorker,
  useLocalAiWorker,
} = require("../src/recipe_local_ai");

test("buildRecipeFallbackResponse includes fallback flag and steps", () => {
  const res = buildRecipeFallbackResponse(["rice", "tofu", "onion"], "test message");
  assert.equal(res.fallback, true);
  assert.equal(res.message, "test message");
  assert.ok(Array.isArray(res.steps) && res.steps.length >= 2);
  assert.deepEqual(res.ingredients, ["rice", "tofu", "onion"]);
});

test("useLocalAiWorker is false when LOCAL_AI_ENDPOINT unset", () => {
  const prev = process.env.LOCAL_AI_ENDPOINT;
  delete process.env.LOCAL_AI_ENDPOINT;
  assert.equal(useLocalAiWorker(), false);
  if (prev) process.env.LOCAL_AI_ENDPOINT = prev;
});

test("runRecipeModelViaLocalWorker returns fallback when endpoint missing", async () => {
  const prev = process.env.LOCAL_AI_ENDPOINT;
  delete process.env.LOCAL_AI_ENDPOINT;
  const res = await runRecipeModelViaLocalWorker(["rice", "tofu", "garlic"]);
  assert.equal(res.fallback, true);
  assert.ok(res.steps.length > 0);
  if (prev) process.env.LOCAL_AI_ENDPOINT = prev;
});

test("runRecipeModelViaLocalWorker forwards to mock worker", async (t) => {
  const ingredients = ["rice", "tofu", "onion", "garlic"];
  const mockBody = JSON.stringify({
    source: "mock",
    ingredients,
    title: "Mock meal",
    text: "Cook and serve.",
    steps: ["Cook rice.", "Add tofu."],
  });

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/generate") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(mockBody);
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  const prevEndpoint = process.env.LOCAL_AI_ENDPOINT;
  const prevTimeout = process.env.AI_WORKER_TIMEOUT_MS;
  process.env.LOCAL_AI_ENDPOINT = `http://127.0.0.1:${port}`;
  process.env.AI_WORKER_TIMEOUT_MS = "5000";

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (prevEndpoint) process.env.LOCAL_AI_ENDPOINT = prevEndpoint;
    else delete process.env.LOCAL_AI_ENDPOINT;
    if (prevTimeout) process.env.AI_WORKER_TIMEOUT_MS = prevTimeout;
    else delete process.env.AI_WORKER_TIMEOUT_MS;
  });

  const result = await runRecipeModelViaLocalWorker(ingredients);
  assert.equal(result.title, "Mock meal");
  assert.equal(result.fallback, undefined);
});

test("runRecipeModelViaLocalWorker returns fallback when worker unreachable", async () => {
  const prevEndpoint = process.env.LOCAL_AI_ENDPOINT;
  const prevTimeout = process.env.AI_WORKER_TIMEOUT_MS;
  // Port 1 is reserved and should refuse connections quickly on most hosts.
  process.env.LOCAL_AI_ENDPOINT = "http://127.0.0.1:1";
  process.env.AI_WORKER_TIMEOUT_MS = "2000";

  try {
    const result = await runRecipeModelViaLocalWorker(["rice", "tofu", "onion"]);
    assert.equal(result.fallback, true);
  } finally {
    if (prevEndpoint) process.env.LOCAL_AI_ENDPOINT = prevEndpoint;
    else delete process.env.LOCAL_AI_ENDPOINT;
    if (prevTimeout) process.env.AI_WORKER_TIMEOUT_MS = prevTimeout;
    else delete process.env.AI_WORKER_TIMEOUT_MS;
  }
});
