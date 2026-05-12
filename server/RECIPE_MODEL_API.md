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
- If inference is intentionally off, set **`RECIPE_MODEL_DISABLED=1`**; the API returns **503** with `RECIPE_MODEL_UNAVAILABLE` and the Tasks UI uses the template fallback.

When setup is wrong (missing script or checkpoint), the server returns **503** with `reason: RECIPE_MODEL_SETUP_INCOMPLETE` so you can see it in the browser Network tab.

## Frontend Fallback

The Tasks UI first calls the model API. If the model API is unavailable (network error or 503), it falls back to the lightweight frontend template generator and labels the output as `Template fallback`.
