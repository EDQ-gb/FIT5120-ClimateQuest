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

## Frontend Fallback

The Tasks UI first calls the model API. If the model API is unavailable, it falls back to the lightweight frontend template generator and labels the output as `Template fallback`.

## Vercel

When the site is deployed with **Root Directory = `frontend`**, `/api/recipes/*` must be implemented as a serverless proxy (see `frontend/api/recipes/[...path].js`). Set **`BACKEND_BASE`** (same as other API routes) so requests forward to your Node server; that server must have Python + PyTorch and the checkpoint available.

If the main Render app does **not** run the recipe model, deploy a backend that does and set **`RECIPE_BACKEND_BASE`** on Vercel to that URL only for recipe routes.

Recipe inference can exceed default function timeouts; the recipes proxy sets **`maxDuration`**: upgrade the Vercel plan if requests still time out.
