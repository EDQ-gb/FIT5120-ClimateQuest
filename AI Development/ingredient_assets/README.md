# Ingredient Assets

These files support the first version of the recipe generator ingredient-selection flow.

## Files

- `ingredient_candidates.csv`: top normalized ingredient candidates extracted from `Cooking_Dataset/train.csv`, with counts and raw examples.
- `ingredient_pool.json`: machine-readable version of the extracted top candidates.
- `ingredient_synonyms.json`: first-pass synonym map used during ingredient normalization.
- `curated_ingredient_pool.json`: smaller user-facing ingredient pool grouped by category for the frontend.
- `ingredient_vocab_summary.txt`: build summary and top ingredient counts.

## Regenerate

From the `AI Development` directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build_ingredient_vocab_fast.ps1 -Top 300 -MinCount 20
```

The extracted pool is intentionally data-driven, while `curated_ingredient_pool.json` is intentionally product-facing. Use the curated file for the first UI, and use the candidate CSV when expanding or refining the ingredient list.
