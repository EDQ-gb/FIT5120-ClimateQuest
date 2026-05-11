# Recipe Generator Development Progress

## 1. Purpose

This document records the current progress of the recipe generator feature in ClimateQuest.

The feature is designed for the `Light emission meal` task. Users select 3 to 5 common low-carbon ingredients, and the system generates a recipe idea using the trained recipe generation model.

The current implementation is a local prototype that validates the feasibility of connecting the trained Transformer model to the web application.

## 2. Dataset Suitability

The recipe model was trained using the cooking dataset under:

```text
AI Development/Cooking_Dataset
```

Key dataset facts:

| Item | Value |
| --- | ---: |
| Raw train samples | 162,899 |
| Filtered train samples used by notebook | 155,248 |
| Dev samples | about 1,005 |
| Test samples | about 1,043 |
| Median ingredients per recipe | about 7 |
| 90% of recipes have ingredients | 11 or fewer |

This dataset is suitable for the planned feature because the task format is naturally:

```text
ingredients -> recipe steps
```

The user flow of selecting 3 to 5 ingredients is also compatible with the training data, because most training examples contain a moderate number of ingredients.

## 3. Model Training Progress

The main notebook is:

```text
AI Development/code_32124112_spicy1.ipynb
```

The improved model checkpoint is:

```text
AI Development/Cooking_Dataset/best_transformer_copy_v2.pt
```

The model architecture is:

- Transformer encoder-decoder
- Pointer-generator copy mechanism
- Vocabulary built from the training set
- Copy mechanism used to handle source ingredients and out-of-vocabulary words

### Baseline Result

Earlier baseline:

| Metric | Score |
| --- | ---: |
| Dev loss | 2.1279 |
| BLEU-4 | 0.0607 |
| METEOR | 0.2559 |
| BERTScore F1 | 0.8586 |

### Improved `transformer_copy_v2`

The updated training setup included:

- 20 max epochs
- label smoothing: `0.05`
- early stopping support
- checkpoint reload before evaluation
- metric export
- fixed prompt evaluation

Final v2 training result:

| Metric | Score |
| --- | ---: |
| Best epoch | 20 |
| Dev loss | 2.0808 |
| BLEU-4 | 0.0660 |
| METEOR | 0.2662 |
| BERTScore F1 | 0.8770 |
| Ingredient coverage | 0.2468 |
| Repetition rate | 0.0099 |

The v2 model improved over the baseline, but ingredient coverage was still limited when using the original sampling generation method.

## 4. Generation Strategy Improvement

A stronger generation strategy was added in the notebook:

- beam search
- best-of-n candidate selection
- repetition penalty
- no-repeat n-gram control
- ingredient coverage scoring
- recipe step formatting

After applying `best_of_n`, the same checkpoint achieved:

| Metric | Sampling | Best-of-N |
| --- | ---: | ---: |
| BLEU-4 | 0.0660 | 0.0823 |
| METEOR | 0.2662 | 0.3109 |
| BERTScore F1 | 0.8770 | 0.8810 |
| Ingredient coverage | 0.2468 | 0.4865 |
| Repetition rate | 0.0099 | 0.0060 |
| Average generated length | 34.7 tokens | 41.8 tokens |

This showed that the trained model can support the selected-ingredient feature more effectively when decoding is improved.

Generated result files:

```text
AI Development/training_runs/transformer_copy_v2/test_metrics_best_of_n.json
AI Development/training_runs/transformer_copy_v2/fixed_prompt_generations_best_of_n.json
AI Development/training_runs/transformer_copy_v2/test_with_preds_transformer_copy_best_of_n.tsv
```

## 5. Ingredient Selection Feature

The `Plant-based meal` task was renamed to:

```text
Light emission meal
```

The task description was changed to:

```text
Have one meal with selected ingredients, which emits lower carbon.
```

The frontend now guides the user through this flow:

1. User opens the `Tasks` page.
2. User clicks the `Light emission meal` task.
3. The UI displays 10 ingredients at a time.
4. The user selects at least 3 and at most 5 ingredients.
5. The user clicks `Generate meal idea`.
6. The frontend calls the model API.
7. The generated recipe is displayed.
8. The user can complete the task after generating a recipe.

The ingredient pool contains 27 common low-carbon ingredients extracted or selected from the training data, including:

```text
rice, pasta, potato, bread, oats,
tofu, beans, chickpeas, lentils,
tomato, onion, garlic, bell pepper, mushroom,
broccoli, carrot, cabbage, spinach, lettuce,
soy sauce, olive oil, lemon juice, chili powder, parsley
```

Frontend files involved:

```text
frontend/src/components/AppTasks.vue
frontend/src/api/recipeGenerator.js
frontend/src/api/features.js
frontend/vite.config.js
```

## 6. Model API Integration

A local model API was added to the Express backend:

```text
POST /api/recipes/generate
```

Request body:

```json
{
  "ingredients": ["rice", "tofu", "onion", "garlic", "soy sauce"]
}
```

The endpoint calls:

```text
server/src/recipe_model_infer.py
```

This Python script loads:

```text
AI Development/Cooking_Dataset/best_transformer_copy_v2.pt
```

and returns generated recipe steps from the trained Transformer model.

Backend files involved:

```text
server/src/index.js
server/src/recipe_model_infer.py
server/RECIPE_MODEL_API.md
```

## 7. Local Development Setup

Two local servers are needed.

### Frontend

Run in one PowerShell window:

```powershell
G:
cd G:\FIT5120\FIT5120-ClimateQuest\frontend
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

### Backend Model API

Run in another PowerShell window:

```powershell
G:
cd G:\FIT5120\FIT5120-ClimateQuest\server
conda activate TorchModel
$env:RECIPE_PYTHON="$(python -c 'import sys; print(sys.executable)')"
npm run dev
```

The backend runs at:

```text
http://localhost:8080
```

### API Proxy Setup

The Vite dev proxy is configured so that:

```text
/api/recipes -> local backend at http://localhost:8080
/api         -> deployed backend at https://fit5120-climatequest.onrender.com
```

This keeps login, registration, tasks, and progress connected to the deployed backend database, while the recipe model runs locally.

## 8. Current Behavior

When the model API works, the frontend labels the result as:

```text
Transformer model
```

If the model API fails, the frontend falls back to the lightweight template generator and labels the result as:

```text
Template fallback
```

This fallback is useful for UI testing, but it is not the trained model.

## 9. Current Limitations

The feature is working as a local feasibility prototype, but there are still limitations:

- The trained PyTorch model is not deployed to a cloud server.
- The local backend must be running for model generation.
- The conda environment must include PyTorch.
- The model quality is improved but still not perfect.
- Generated recipes can sometimes be generic, repetitive, or slightly unnatural.
- The frontend fallback generator is rule-based and should not be treated as the final AI model.
- The current model is trained from scratch, so it is less fluent than a fine-tuned pretrained model such as T5 or FLAN-T5.

## 10. Recommended Next Steps

Short-term:

1. Keep testing the model API with different ingredient combinations.
2. Record examples where the model performs well and poorly.
3. Add clearer UI wording so users know the recipe is AI-generated.
4. Improve post-processing to remove repeated phrases.

Medium-term:

1. Add a proper backend model service instead of spawning Python per request.
2. Cache the loaded model in memory for faster generation.
3. Add a quality check before returning results.
4. Add ingredient coverage feedback.

Long-term:

1. Fine-tune a pretrained text-to-text model such as `flan-t5-small`.
2. Compare it against the current Transformer-copy model.
3. Deploy the best model to a reliable backend service.
4. Replace the frontend template fallback with a real model-backed fallback or curated recipe suggestions.

## 11. Summary

The current system demonstrates that the selected-ingredient recipe generator is feasible.

The project now has:

- a trained Transformer-copy recipe model,
- improved decoding results,
- a frontend ingredient-selection flow,
- a local model API,
- and a working fallback mechanism.

The feature is not yet production-ready, but it is a strong prototype for validating the AI recipe generation concept inside ClimateQuest.
