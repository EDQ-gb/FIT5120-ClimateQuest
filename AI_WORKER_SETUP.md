# 本地 AI Worker（混合推理架构）

ClimateQuest 的 **菜谱生成（Transformer / PyTorch）** 在 Render 免费/低配 CPU 上容易超时。推荐架构：

- **前端 + Node API + 数据库** → 继续部署在 Render  
- **PyTorch 推理** → 在你自己的电脑上运行 `ai_worker`（FastAPI）  
- **Render Node** 通过 **Tunnel HTTPS URL** 调用本地 worker，不在 Render 上加载模型  

前端 **只** 请求现有接口：`POST /api/recipes/generate`，**不要** 直接访问 `LOCAL_AI_ENDPOINT`。

## 请求流程

```text
Browser (Vite / 生产站点)
  → Render Node  POST /api/recipes/generate
  → (tunnel)     POST https://<tunnel-host>/generate
  → 本机 ai_worker (uvicorn + FastAPI)
  → PyTorch transformer
  → JSON 原路返回前端
```

若 worker 不可用/超时/非 2xx，Node 返回 **HTTP 200** 且 JSON 带 `fallback: true`，前端展示温和提示 + 简单步骤，不会 408/503 整页失败。

---

## 环境变量

### Render / Node backend（`server`）

| 变量 | 说明 |
|------|------|
| `LOCAL_AI_ENDPOINT` | Tunnel 暴露的 **HTTPS 根地址**（无尾部斜杠），例如 `https://abc.trycloudflare.com` |
| `AI_WORKER_TOKEN` | 与本地 worker 相同的密钥；设置后双方必须带 `Authorization: Bearer <token>` |
| `AI_WORKER_TIMEOUT_MS` | 转发超时，默认 `60000` |

**建议在 Render 上同时设置（避免 Node 再跑 PyTorch / 多余云端路径）：**

```env
RECIPE_FAST_CLOUD_ENABLED=0
RECIPE_MODEL_DISABLED=1
```

设置 `LOCAL_AI_ENDPOINT` 后，Node **只会** 转发到本地 worker（失败则 fallback），不会 `spawn` Python。

### 本地 AI worker

| 变量 | 说明 |
|------|------|
| `AI_WORKER_TOKEN` | 可选；与 Render 一致则启用 Bearer 鉴权 |
| `MODEL_PATH` | 可选；`.pt` 权重绝对路径，默认 `AI Development/Cooking_Dataset/best_transformer_copy_v2.pt` |
| `RECIPE_MODEL_DEVICE` | 可选，`auto` / `cpu` / `cuda` |
| `RECIPE_MODEL_BEAM_SIZE` | 可选，默认 `4` |
| `RECIPE_MODEL_MAX_LEN` | 可选，默认 `110` |
| `RECIPE_MODEL_MIN_LEN` | 可选，默认 `18` |
| `MODEL_LAZY_LOAD` | 设为 `1` 则启动时不预加载模型（首次 `/generate` 较慢） |

**不要把真实 token 或 tunnel URL 提交到 Git。**

---

## 1. 安装依赖（本机）

在仓库根目录：

```bash
python3 -m venv .venv-ai
source .venv-ai/bin/activate   # Windows: .venv-ai\Scripts\activate
pip install -r requirements-ai.txt
```

## 2. 启动 AI worker

```bash
# 仓库根目录，已激活 venv
export AI_WORKER_TOKEN="your-secret-token"   # 可选
export MODEL_PATH="/absolute/path/to/best_transformer_copy_v3.pt"  # 可选

uvicorn ai_worker.app:app --host 0.0.0.0 --port 8000
```

## 3. 健康检查

```bash
curl http://localhost:8000/health
```

期望：`{"status":"ok","model_ready":true,...}`（模型未加载时可能为 `degraded`）。

## 4. 本地测试生成

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token" \
  -d '{"ingredients":["rice","tofu","onion","garlic","soy sauce"]}'
```

## 5. 暴露到公网（Tunnel）

本地服务：`http://localhost:8000`

**Cloudflare Tunnel（示例）：**

```bash
cloudflared tunnel --url http://localhost:8000
```

复制输出的 `https://....trycloudflare.com`，在 Render 设置：

```env
LOCAL_AI_ENDPOINT=https://....trycloudflare.com
AI_WORKER_TOKEN=your-secret-token
AI_WORKER_TIMEOUT_MS=60000
```

**ngrok（示例）：**

```bash
ngrok http 8000
```

使用 `https://....ngrok-free.app` 作为 `LOCAL_AI_ENDPOINT`。

> Tunnel URL 每次重启可能变化，需在 Render 环境变量中更新。

## 6. 启动 Render Node + 前端验证

1. Render Web Service 部署 `server`，配置上述环境变量。  
2. 前端照常访问站点，打开 **Light emission meal** → 选 3–5 种食材 → **Generate meal idea**。  
3. 成功：显示 Transformer 结果；失败：显示 **Quick suggestion** 与温和英文提示（`fallback: true`）。

## 7. 仅本机联调（不经 Tunnel）

在 `server/.env` 或 Render 外本地 Node：

```env
LOCAL_AI_ENDPOINT=http://127.0.0.1:8000
```

`npm run dev` 启动 `server` 后，前端经 Vite 代理访问 `/api/recipes/generate`。

---

## Node 单元测试

```bash
cd server
npm test
```

覆盖：fallback 结构、`LOCAL_AI_ENDPOINT` 缺失、mock worker 转发、超时 fallback。

---

## API 约定

### `GET /health`

```json
{ "status": "ok", "model_ready": true }
```

### `POST /generate`

请求：

```json
{ "ingredients": ["rice", "tofu", "onion", "garlic", "soy sauce"] }
```

成功响应（与历史 `recipe_model_infer.py` 一致字段）：

```json
{
  "source": "transformer_local_worker",
  "ingredients": ["..."],
  "title": "Generated low-carbon meal",
  "text": "...",
  "steps": ["..."],
  "checkpointEpoch": 24,
  "bestDevLoss": 2.06,
  "device": "cpu"
}
```

Node fallback（200）：

```json
{
  "fallback": true,
  "message": "AI worker unavailable or too slow. Returned fallback result.",
  "source": "template_fallback",
  "ingredients": ["..."],
  "title": "Simple low-carbon meal idea",
  "text": "...",
  "steps": ["..."]
}
```
