# Recipe Model API

The local frontend can call the trained Transformer checkpoint through:

```text
POST /api/recipes/generate
```

Request body:

```json
{
  "ingredients": ["rice", "tofu", "onion", "garlic", "soy sauce"]
}
```

The list must contain 3 to 5 ingredients.

## Local Environment

The endpoint calls `server/src/recipe_model_infer.py`, which requires Python with PyTorch installed.

If your training environment already has PyTorch, point the server to that Python executable:

```powershell
$env:RECIPE_PYTHON="C:\Path\To\Your\Python.exe"
cd G:\FIT5120\FIT5120-ClimateQuest\server
npm run dev
```

Optional overrides:

```powershell
$env:RECIPE_CHECKPOINT="G:\FIT5120\FIT5120-ClimateQuest\AI Development\Cooking_Dataset\best_transformer_copy_v2.pt"
$env:RECIPE_MODEL_TIMEOUT_MS="120000"
```

Performance-focused overrides (real model + faster response):

```powershell
$env:RECIPE_MODEL_PERSISTENT="1"     # keep Python model loaded between requests
$env:RECIPE_MODEL_BEAM_SIZE="2"      # lower beam for faster decoding
$env:RECIPE_MODEL_MAX_LEN="80"
$env:RECIPE_MODEL_MIN_LEN="10"
$env:RECIPE_MODEL_TIMEOUT_MS="20000" # per-request timeout
$env:RECIPE_MODEL_WARMUP_TIMEOUT_MS="90000"
```

If `RECIPE_PYTHON` is not set, the server tries `python` from PATH.

## Vercel

When the site is deployed with **Root Directory = `frontend`**:

1. **`vercel.json`** must **not** send `/api/recipes/*` straight to Render in a single catch-all, or the `frontend/api/recipes/[...path].js` proxy (with `maxDuration: 120`) may never run and requests can time out. This repo uses a rewrite that excludes `recipes` so `/api/recipes/*` hits the serverless handler first.
2. Set **`BACKEND_BASE`** to your Render URL (same as other APIs). The handler forwards recipe requests to that Node server, which must run Python + PyTorch and have the checkpoint file on disk.

If the main Render app does **not** run the recipe model, deploy a backend that does and set **`RECIPE_BACKEND_BASE`** on Vercel so only recipe traffic goes there.

## Render (production Node)

Render’s default Node image usually **does not** include PyTorch or your `.pt` file unless you add them:

- Set **`RECIPE_PYTHON`** to a Python binary that has **PyTorch** installed (often a custom build or Docker).
- Set **`RECIPE_CHECKPOINT`** to an **absolute path** on the instance where the weight file actually exists (do not rely on a relative path if your deploy root omits `AI Development/`).
- Keep **`RECIPE_MODEL_PERSISTENT=1`** so Render reuses one warm Python worker and avoids reloading torch/checkpoint every request.
- Tune speed with **`RECIPE_MODEL_BEAM_SIZE=2`**, **`RECIPE_MODEL_MAX_LEN=80`**, and **`RECIPE_MODEL_TIMEOUT_MS=20000`** as a practical baseline.
- If inference is intentionally off, set **`RECIPE_MODEL_DISABLED=1`**; the API returns **503** with `RECIPE_MODEL_UNAVAILABLE` and the Tasks UI uses the template fallback.

### 查看 503 / 错误响应（浏览器为中文界面时）

部署后的页面上，生成菜谱失败时也会用红字显示服务端返回的 **`hint`**。若要在开发者工具里核对 JSON：

**Chrome / Microsoft Edge（界面语言为简体中文）**

1. 按 **`F12`**，或 **`Ctrl + Shift + I`**（Mac：**`Cmd + Option + I`**）打开**开发者工具**。  
2. 点击顶部的 **「网络」**（若界面为英文则为 **Network**）。  
3. 建议勾选 **「保留日志」**，再在页面里点一次「生成菜谱」，避免请求被刷新冲掉。  
4. 在下方请求列表里找到 **`recipes`** / **`generate`** 或 URL 含 **`/api/recipes/generate`** 的那一条，单击选中。  
5. 在右侧找到 **「响应」** 或 **「预览」**（英文界面为 **Response** / **Preview**），即可看到 JSON 中的 **`error`**、**`reason`**、**`hint`**。

**Mozilla Firefox（简体中文）**

1. **`Ctrl + Shift + E`**（Mac：**`Cmd + Option + E`**）打开**网络**，或菜单 **「工具」→「浏览器工具」→「网络」**。  
2. 选中对应请求，在详情中查看 **「响应」**。

当脚本或权重缺失时，常见为 **`reason`: `RECIPE_MODEL_SETUP_INCOMPLETE`**，请对照上文 Render 环境变量与路径配置。

### `reason` 为 `RECIPE_MODEL_FAILED` 时

说明 Python 已经启动，但进程**非零退出**或**标准输出不是合法 JSON**。请按顺序排查：

1. **响应体里的 `detail`**（若有）：为截取后的 **stderr**，常见内容如 `No module named 'torch'`、`CUDA out of memory`、版本不兼容等。  
2. **`exitCode`**（若有）：非 0 表示进程异常结束；若 `detail` 说明「退出码且 stderr 为空」，多为实例内存不足被系统终止，请到 Render **「日志」**查看。  
3. **Render 控制台 → 你的 Web Service →「日志」**：查看同一时间段的完整报错。  
4. 确认 **`RECIPE_PYTHON`** 指向的 Python 已执行过 `pip install torch`（且与 CPU/GPU 版本一致；Render 免费实例一般为 **CPU 版 torch**）。  
5. 确认 **`RECIPE_CHECKPOINT`** 与当前 `recipe_model_infer.py` 的模型结构一致（同一训练管线导出的 `.pt`）。

若 **`hint` 仍是英文**且没有 **`detail`** 字段，说明线上跑的还是**旧版 Node 代码**，请在 Render 上重新部署包含最新 `server/src/index.js` 的提交。


The Tasks UI first calls the model API. If the model API is unavailable (network error or 503), it falls back to the lightweight frontend template generator and labels the output as `Template fallback`.
